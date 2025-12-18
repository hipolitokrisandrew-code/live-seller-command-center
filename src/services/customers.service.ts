// src/services/customers.service.ts

import { db } from "../core/db";
import type { Claim, Customer, Order } from "../core/types";

// -----------------------------
// Helpers
// -----------------------------

function generateId(prefix: string): string {
  // Prefer crypto.randomUUID if available (browser)
  const g = globalThis as typeof globalThis & {
    crypto?: Crypto;
  };

  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return `${prefix}_${g.crypto.randomUUID()}`;
  }

  // Fallback: timestamp + random
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Stats we compute per customer from orders
type CustomerStats = {
  totalOrders: number;
  totalPaidOrders: number;
  totalSpent: number;
  firstOrderDate?: string;
  lastOrderDate?: string;
  noPayCount: number;
  lastOrderStatus?: Order["status"];
};

function computeStatsForOrders(orders: Order[]): CustomerStats {
  const sorted = [...orders].sort((a, b) => {
    const aDate = a.createdAt ?? "";
    const bDate = b.createdAt ?? "";
    return aDate.localeCompare(bDate);
  });

  const totalOrders = orders.length;

  const paidOrders = orders.filter(
    (o) =>
      o.paymentStatus === "PAID" ||
      safeNumber(o.amountPaid) >= safeNumber(o.grandTotal)
  );

  const totalPaidOrders = paidOrders.length;

  const totalSpent = paidOrders.reduce(
    (sum, o) => sum + safeNumber(o.grandTotal),
    0
  );

  const firstOrderDate = sorted[0]?.createdAt;
  const lastOrderDate = sorted[sorted.length - 1]?.createdAt;

  // Joy reserve definition (stricter unpaid behavior):
  //  - amountPaid <= 0 AND paymentStatus is not PAID
  const noPayCount = orders.filter((o) => {
    const noPaidAmount = safeNumber(o.amountPaid) <= 0;
    const notPaid = o.paymentStatus !== "PAID";
    return noPaidAmount && notPaid;
  }).length;

  const lastOrderStatus = sorted[sorted.length - 1]?.status;

  return {
    totalOrders,
    totalPaidOrders,
    totalSpent,
    firstOrderDate,
    lastOrderDate,
    noPayCount,
    lastOrderStatus,
  };
}

// -----------------------------
// Create / lookup
// -----------------------------

/**
 * Create or find a customer by displayName (FB/TikTok name).
 * Used when building orders from claims.
 */
export async function getOrCreateCustomerByDisplayName(
  displayName: string
): Promise<Customer> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("displayName is required to create a customer");
  }

  // Try exact match first
  const existing = await db.customers
    .where("displayName")
    .equals(trimmed)
    .first();

  if (existing) {
    return existing;
  }

  const customer: Customer = {
    id: generateId("CUST"),
    displayName: trimmed,
    realName: undefined,
    phone: undefined,
    email: undefined,
    addressLine1: undefined,
    addressLine2: undefined,
    city: undefined,
    province: undefined,
    postalCode: undefined,
    notes: undefined,
    totalOrders: 0,
    totalSpent: 0,
    firstOrderDate: undefined,
    lastOrderDate: undefined,
    noPayCount: 0,
  };

  await db.customers.add(customer);
  return customer;
}

// -----------------------------
// Aggregated views / overviews
// -----------------------------

export type CustomerOverview = {
  customer: Customer;
  totalOrders: number;
  totalPaidOrders: number;
  totalSpent: number;
  firstOrderDate?: string;
  lastOrderDate?: string;
  noPayCount: number;
  lastOrderStatus?: Order["status"];
};

export type CustomerOverviewOptions = {
  search?: string;
  joyFilter?: "ALL" | "JOY_ONLY";
};

/**
 * Compute per-customer stats from Orders table.
 */
export async function getCustomerOverviewList(
  options: CustomerOverviewOptions = {}
): Promise<CustomerOverview[]> {
  const [customers, orders, claims] = await Promise.all([
    db.customers.toArray(),
    db.orders.toArray(),
    db.claims.toArray(),
  ]);

  const searchTerm = options.search?.trim().toLowerCase() ?? "";

  const displayNameToId = new Map<string, string>();
  customers.forEach((c) => {
    if (c.displayName) {
      displayNameToId.set(c.displayName.trim().toLowerCase(), c.id);
    }
  });

  let filteredCustomers = customers;

  if (searchTerm) {
    filteredCustomers = customers.filter((c) => {
      const display = c.displayName?.toLowerCase() ?? "";
      const real = c.realName?.toLowerCase() ?? "";
      return display.includes(searchTerm) || real.includes(searchTerm);
    });
  }

  // Group orders by customerId
  const ordersByCustomer = new Map<string, Order[]>();
  orders.forEach((order) => {
    if (!order.customerId) return;
    const list = ordersByCustomer.get(order.customerId);
    if (!list) {
      ordersByCustomer.set(order.customerId, [order]);
    } else {
      list.push(order);
    }
  });

  const joyReserveCounts = new Map<string, number>();
  claims.forEach((claim) => {
    if (!claim.joyReserve) return;
    let customerId = claim.customerId;
    if (!customerId && claim.temporaryName) {
      const key = claim.temporaryName.trim().toLowerCase();
      customerId = displayNameToId.get(key);
    }
    if (!customerId) return;
    joyReserveCounts.set(
      customerId,
      (joyReserveCounts.get(customerId) ?? 0) + 1
    );
  });

  const overviews: CustomerOverview[] = filteredCustomers.map((customer) => {
    const customerOrders = ordersByCustomer.get(customer.id) ?? [];
    const stats = computeStatsForOrders(customerOrders);
    const joyReserveFromClaims =
      joyReserveCounts.get(customer.id) ?? 0;
    const mergedNoPay = stats.noPayCount + joyReserveFromClaims;

    const customerSnapshot: Customer = {
      ...customer,
      totalOrders: stats.totalOrders,
      totalSpent: stats.totalSpent,
      firstOrderDate: stats.firstOrderDate,
      lastOrderDate: stats.lastOrderDate,
      noPayCount: mergedNoPay,
    };

    return {
      customer: customerSnapshot,
      totalOrders: stats.totalOrders,
      totalPaidOrders: stats.totalPaidOrders,
      totalSpent: stats.totalSpent,
      firstOrderDate: stats.firstOrderDate,
      lastOrderDate: stats.lastOrderDate,
      noPayCount: mergedNoPay,
      lastOrderStatus: stats.lastOrderStatus,
    };
  });

  let result = overviews;

  if (options.joyFilter === "JOY_ONLY") {
    result = result.filter((o) => o.noPayCount > 0);
  }

  // Sort: joy reserves first, then by total spent (desc)
  result.sort((a, b) => {
    if (a.noPayCount !== b.noPayCount) {
      return b.noPayCount - a.noPayCount;
    }
    return b.totalSpent - a.totalSpent;
  });

  return result;
}

/**
 * Detailed history for a single customer.
 */
export async function getCustomerWithHistory(customerId: string): Promise<{
  customer: Customer | undefined;
  orders: Order[];
}> {
  const [customer, ordersForCustomer] = await Promise.all([
    db.customers.get(customerId),
    db.orders.where("customerId").equals(customerId).toArray(),
  ]);

  const ordered = ordersForCustomer.sort((a, b) => {
    const aDate = a.createdAt ?? "";
    const bDate = b.createdAt ?? "";
    return bDate.localeCompare(aDate); // newest first
  });

  return {
    customer: customer ?? undefined,
    orders: ordered,
  };
}

/**
 * Lightweight list for lookup (id + names).
 */
export async function listCustomerBasics(): Promise<
  Pick<Customer, "id" | "displayName" | "realName">[]
> {
  const customers = await db.customers.toArray();
  return customers.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    realName: c.realName,
  }));
}

/**
 * Keep existing code happy: recomputeCustomerStats is called
 * from orders.service.ts after major order changes.
 * This updates the stored aggregate fields on the Customer row.
 */
export async function recomputeCustomerStats(
  customerId: string
): Promise<void> {
  const [orders, claims] = await Promise.all([
    db.orders.where("customerId").equals(customerId).toArray(),
    db.claims.where("customerId").equals(customerId).toArray(),
  ]);

  const stats = computeStatsForOrders(orders);
  const joyReserveFromClaims = claims.filter((c) => c.joyReserve).length;

  await db.customers.update(customerId, {
    totalOrders: stats.totalOrders,
    totalSpent: stats.totalSpent,
    firstOrderDate: stats.firstOrderDate,
    lastOrderDate: stats.lastOrderDate,
    noPayCount: stats.noPayCount + joyReserveFromClaims,
  });
}
