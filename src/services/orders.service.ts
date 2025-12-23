// src/services/orders.service.ts
import { db } from "../core/db";
import type { Claim, Customer, Order, OrderLine } from "../core/types";
import {
  getOrCreateCustomerByDisplayName,
  recomputeCustomerStats,
} from "./customers.service";
import { adjustStock, getInventoryItem } from "./inventory.service";

const nowIso = () => new Date().toISOString();

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function generateOrderNumber(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  // Simple unique-ish suffix using base36 timestamp
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return `ORD-${y}${m}${d}-${suffix}`;
}

/**
 * Get all orders for a live session, newest first.
 */
export async function listOrdersForSession(
  liveSessionId: string
): Promise<Order[]> {
  const orders = await db.orders
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  return orders.sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

export interface OrderDetail {
  order: Order;
  customer?: Customer;
  lines: OrderLine[];
}

/**
 * Get one order with its customer + lines.
 */
export async function getOrderDetail(
  orderId: string
): Promise<OrderDetail | null> {
  const order = await db.orders.get(orderId);
  if (!order) return null;

  const [customer, lines] = await Promise.all([
    db.customers.get(order.customerId),
    db.orderLines.where("orderId").equals(orderId).toArray(),
  ]);

  return { order, customer: customer ?? undefined, lines };
}

/**
 * Recalculate totals for an order based on its lines and payments.
 * Also updates paymentStatus + main status + customer stats.
 */
export async function recalculateOrderTotals(orderId: string): Promise<Order> {
  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const [lines, payments] = await Promise.all([
    db.orderLines.where("orderId").equals(orderId).toArray(),
    db.payments.where("orderId").equals(orderId).toArray(),
  ]);

  const subtotal = lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);

  const discountTotal = lines.reduce(
    (sum, l) => sum + (l.lineDiscount ?? 0),
    0
  );

  const promoDiscountTotal = order.promoDiscountTotal ?? 0;

  const shippingFee = order.shippingFee ?? 0;
  const codFee = order.codFee ?? 0;
  const otherFees = order.otherFees ?? 0;

  const grandTotal =
    subtotal -
    discountTotal -
    promoDiscountTotal +
    shippingFee +
    codFee +
    otherFees;

  const amountPaid = payments
    .filter((p) => p.status === "POSTED")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const balanceDue = Math.max(0, grandTotal - amountPaid);

  let paymentStatus: Order["paymentStatus"] = "UNPAID";
  if (amountPaid <= 0.000001) {
    paymentStatus = "UNPAID";
  } else if (amountPaid + 0.000001 < grandTotal) {
    paymentStatus = "PARTIAL";
  } else {
    paymentStatus = "PAID";
  }

  let status = order.status;
  // Only auto-change status for "active" orders
  if (
    status !== "CANCELLED" &&
    status !== "RETURNED" &&
    status !== "SHIPPED" &&
    status !== "DELIVERED"
  ) {
    if (paymentStatus === "PAID") {
      status = "PAID";
    } else if (paymentStatus === "PARTIAL") {
      status = "PARTIALLY_PAID";
    } else {
      status = "PENDING_PAYMENT";
    }
  }

  const updated: Order = {
    ...order,
    subtotal,
    discountTotal,
    promoDiscountTotal,
    shippingFee,
    codFee,
    otherFees,
    grandTotal,
    amountPaid,
    balanceDue,
    paymentStatus,
    status,
    updatedAt: nowIso(),
  };

  await db.orders.put(updated);
  await recomputeCustomerStats(order.customerId);

  return updated;
}

/**
 * Build orders from ACCEPTED claims for a specific live session.
 *
 * Strategy:
 *  - Delete any existing orders + lines for that session
 *    (so you can rebuild safely if you change claims).
 *  - Group ACCEPTED claims by customer (temporaryName).
 *  - For each group:
 *      * Create (or reuse) Customer
 *      * Create one Order
 *      * Create OrderLines per claim
 *      * Recalculate totals
 *
 * Note: This is designed to be run AFTER the live, before payments.
 */
export async function buildOrdersFromClaims(liveSessionId: string): Promise<{
  createdOrders: number;
  createdLines: number;
}> {
  // 1) Remove previous orders + lines for this session
  const existingOrders = await db.orders
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  const existingOrderIds = existingOrders.map((o) => o.id);

  if (existingOrderIds.length > 0) {
    await db.orderLines.where("orderId").anyOf(existingOrderIds).delete();
    await db.orders.bulkDelete(existingOrderIds);
  }

  // 2) Get ACCEPTED claims for this session
  const claims = await db.claims
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  const acceptedClaims = claims.filter((c: Claim) => c.status === "ACCEPTED");

  if (acceptedClaims.length === 0) {
    return { createdOrders: 0, createdLines: 0 };
  }

  // 3) Group by (customerId || temporaryName)
  type GroupKey = string;
  const groups = new Map<GroupKey, Claim[]>();

  for (const claim of acceptedClaims) {
    const name = claim.temporaryName?.trim() || "Unknown";
    const key: GroupKey = `${claim.customerId ?? ""}|${name}`;
    const arr = groups.get(key) ?? [];
    arr.push(claim);
    groups.set(key, arr);
  }

  let createdOrders = 0;
  let createdLines = 0;

  // 4) For each group, create order + lines
  for (const groupClaims of groups.values()) {
    const sample = groupClaims[0];
    const displayName = sample.temporaryName?.trim() || "Unknown";

    const customer = await getOrCreateCustomerByDisplayName(displayName);

    const orderId = generateId("order");
    const createdAt = nowIso();
    const orderNumber = generateOrderNumber(new Date());

    const baseOrder: Order = {
      id: orderId,
      customerId: customer.id,
      liveSessionId,
      orderNumber,
      status: "PENDING_PAYMENT",
      subtotal: 0,
      discountTotal: 0,
      promoDiscountTotal: 0,
      shippingFee: 0,
      codFee: 0,
      otherFees: 0,
      grandTotal: 0,
      amountPaid: 0,
      balanceDue: 0,
      paymentStatus: "UNPAID",
      shipmentId: undefined,
      createdAt,
      updatedAt: createdAt,
    };

    await db.orders.add(baseOrder);
    createdOrders += 1;

    // One order line per claim
    for (const claim of groupClaims) {
      const item = await getInventoryItem(claim.inventoryItemId);
      if (!item) {
        // If item not found, skip that claim
        // (could log this in future)
        continue;
      }

      const variantPrice =
        claim.variantId && item.variants?.length
          ? item.variants.find((v) => v.id === claim.variantId)?.sellingPrice
          : undefined;
      const unitPrice = variantPrice ?? item.sellingPrice ?? 0;
      const quantity = claim.quantity ?? 0;
      const lineSubtotal = unitPrice * quantity;
      const lineDiscount = 0;
      const lineTotal = lineSubtotal - lineDiscount;

      const line: OrderLine = {
        id: generateId("line"),
        orderId,
        inventoryItemId: item.id,
        variantId: claim.variantId,
        itemCodeSnapshot: item.itemCode,
        nameSnapshot: item.name,
        unitPrice,
        quantity,
        lineSubtotal,
        lineDiscount,
        lineTotal,
      };

      await db.orderLines.add(line);
      createdLines += 1;

      // Move reserved stock to consumed (on-hand minus reserved) for this claim
      await adjustStock(item.id, {
        currentDelta: -quantity,
        reservedDelta: -quantity,
        variantId: claim.variantId,
      });
    }

    // Recalculate totals for this order + update customer stats
    await recalculateOrderTotals(orderId);
  }

  return { createdOrders, createdLines };
}

/**
 * Apply a manual discount (promo/adjustment) to an order.
 * Uses promoDiscountTotal field so recalc will include it in grandTotal.
 */
export async function updateOrderDiscount(
  orderId: string,
  amount: number
): Promise<Order> {
  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const promoDiscountTotal = Math.max(0, amount);
  const updated: Order = {
    ...order,
    promoDiscountTotal,
    updatedAt: nowIso(),
  };

  await db.orders.put(updated);
  return recalculateOrderTotals(orderId);
}

export async function updateOrderFees(
  orderId: string,
  patch: Partial<
    Pick<Order, "shippingFee" | "codFee" | "otherFees" | "promoDiscountTotal">
  >
): Promise<Order> {
  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const updated: Order = {
    ...order,
    ...patch,
    updatedAt: nowIso(),
  };

  await db.orders.put(updated);
  return recalculateOrderTotals(orderId);
}
