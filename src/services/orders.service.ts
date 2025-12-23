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
    // Order details must only include lines tied to this specific orderId.
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
 * Remove order lines linked to a claim only when the order is still UNPAID.
 * PAID / PARTIAL orders keep their lines for historical accuracy.
 */
export async function removeOrderLinesForClaim(claimId: string): Promise<void> {
  if (!claimId) return;

  const claim = await db.claims.get(claimId);

  // Order lines carry claimId so we can find the exact line to remove.
  let lines = await db.orderLines
    .filter((line) => line.claimId === claimId)
    .toArray();

  const touchedOrders = new Set<string>();
  const ordersById = new Map<string, Order>();

  const maybeTouchOrder = (order: Order | undefined) => {
    if (order) {
      ordersById.set(order.id, order);
      touchedOrders.add(order.id);
    }
  };

  if (lines.length > 0) {
    const orderIds = Array.from(new Set(lines.map((line) => line.orderId)));
    const orders = await db.orders.where("id").anyOf(orderIds).toArray();
    for (const order of orders) {
      ordersById.set(order.id, order);
    }

    for (const line of lines) {
      const order = ordersById.get(line.orderId);
      // Only adjust orders that are still UNPAID.
      if (!order || order.paymentStatus !== "UNPAID") continue;

      await db.orderLines.delete(line.id);
      touchedOrders.add(order.id);
    }
  }

  // Legacy fallback: older lines may not have claimId.
  if (lines.length === 0 && claim) {
    let customerId = claim.customerId;
    if (!customerId && claim.temporaryName?.trim()) {
      const display = claim.temporaryName.trim().toLowerCase();
      const customer = await db.customers
        .filter(
          (c) => c.displayName?.trim().toLowerCase() === display
        )
        .first();
      customerId = customer?.id;
    }

    if (customerId) {
      const sessionOrders = await db.orders
        .where("liveSessionId")
        .equals(claim.liveSessionId)
        .toArray();

      const candidates = sessionOrders.filter(
        (order) =>
          order.customerId === customerId &&
          order.paymentStatus === "UNPAID"
      );

      const matchesClaim = (line: OrderLine) =>
        line.inventoryItemId === claim.inventoryItemId &&
        (line.variantId ?? "") === (claim.variantId ?? "") &&
        Number(line.quantity) === Number(claim.quantity ?? 0);

      for (const order of candidates) {
        const orderLines = await db.orderLines
          .where("orderId")
          .equals(order.id)
          .toArray();
        const match = orderLines.find(matchesClaim);
        if (!match) continue;

        await db.orderLines.delete(match.id);
        maybeTouchOrder(order);
        break;
      }
    }
  }

  for (const orderId of touchedOrders) {
    const remaining = await db.orderLines
      .where("orderId")
      .equals(orderId)
      .toArray();

    if (remaining.length === 0) {
      const order = ordersById.get(orderId) ?? (await db.orders.get(orderId));
      if (!order) continue;
      await db.orders.delete(orderId);
      await recomputeCustomerStats(order.customerId);
      continue;
    }

    await recalculateOrderTotals(orderId);
  }
}

/**
 * Sync UNPAID orders in a session with ACCEPTED claims.
 * Removes order lines that no longer map to accepted claims and deletes
 * empty UNPAID orders. PAID/PARTIAL orders are left untouched.
 */
export async function syncUnpaidOrdersForSession(
  liveSessionId: string
): Promise<number> {
  if (!liveSessionId) return 0;

  const claims = await db.claims
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  const acceptedClaims = claims.filter((c) => c.status === "ACCEPTED");
  const claimById = new Map(claims.map((c) => [c.id, c]));

  const customers = await db.customers.toArray();
  const displayNameToId = new Map<string, string>();
  customers.forEach((c) => {
    if (c.displayName) {
      displayNameToId.set(c.displayName.trim().toLowerCase(), c.id);
    }
  });

  const acceptedByCustomer = new Map<string, Claim[]>();
  for (const claim of acceptedClaims) {
    let customerId = claim.customerId;
    if (!customerId && claim.temporaryName?.trim()) {
      customerId = displayNameToId.get(
        claim.temporaryName.trim().toLowerCase()
      );
    }
    if (!customerId) continue;
    const list = acceptedByCustomer.get(customerId) ?? [];
    list.push(claim);
    acceptedByCustomer.set(customerId, list);
  }

  const sessionOrders = await db.orders
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  const unpaidOrders = sessionOrders.filter(
    (order) => order.paymentStatus === "UNPAID"
  );

  if (unpaidOrders.length === 0) return 0;

  const lineKey = (itemId: string, variantId: string | undefined, qty: number) =>
    `${itemId}::${variantId ?? ""}::${qty}`;

  const removedOrders: string[] = [];

  for (const order of unpaidOrders) {
    const lines = await db.orderLines
      .where("orderId")
      .equals(order.id)
      .toArray();

    if (lines.length === 0) {
      await db.orders.delete(order.id);
      removedOrders.push(order.id);
      await recomputeCustomerStats(order.customerId);
      continue;
    }

    const acceptedForCustomer = acceptedByCustomer.get(order.customerId) ?? [];
    const remainingCounts = new Map<string, number>();
    for (const claim of acceptedForCustomer) {
      const key = lineKey(
        claim.inventoryItemId,
        claim.variantId,
        claim.quantity ?? 0
      );
      remainingCounts.set(key, (remainingCounts.get(key) ?? 0) + 1);
    }

    let removedAny = false;
    for (const line of lines) {
      if (line.claimId) {
        const claim = claimById.get(line.claimId);
        if (!claim || claim.status !== "ACCEPTED") {
          await db.orderLines.delete(line.id);
          removedAny = true;
        }
        continue;
      }

      const key = lineKey(line.inventoryItemId, line.variantId, line.quantity);
      const remaining = remainingCounts.get(key) ?? 0;
      if (remaining > 0) {
        remainingCounts.set(key, remaining - 1);
        continue;
      }

      await db.orderLines.delete(line.id);
      removedAny = true;
    }

    if (!removedAny) continue;

    const remainingLines = await db.orderLines
      .where("orderId")
      .equals(order.id)
      .toArray();

    if (remainingLines.length === 0) {
      await db.orders.delete(order.id);
      removedOrders.push(order.id);
      await recomputeCustomerStats(order.customerId);
      continue;
    }

    await recalculateOrderTotals(order.id);
  }

  return removedOrders.length;
}

/**
 * Build orders from ACCEPTED claims for a specific live session.
 *
 * Strategy:
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
  // 1) Load existing orders for this session (used to decide reuse vs new).
  const existingOrders = await db.orders
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  const existingOrderById = new Map(existingOrders.map((o) => [o.id, o]));
  const existingOrdersByCustomer = new Map<string, Order[]>();
  for (const order of existingOrders) {
    const list = existingOrdersByCustomer.get(order.customerId) ?? [];
    list.push(order);
    existingOrdersByCustomer.set(order.customerId, list);
  }

  for (const list of existingOrdersByCustomer.values()) {
    list.sort((a, b) =>
      (b.updatedAt || b.createdAt || "").localeCompare(
        a.updatedAt || a.createdAt || ""
      )
    );
  }

  const existingOrderIds = existingOrders.map((o) => o.id);
  const existingLines = existingOrderIds.length
    ? await db.orderLines.where("orderId").anyOf(existingOrderIds).toArray()
    : [];

  const lineCountsByCustomer = new Map<string, Map<string, number>>();

  const lineKey = (itemId: string, variantId: string | undefined, qty: number) =>
    `${itemId}::${variantId ?? ""}::${qty}`;

  for (const line of existingLines) {
    const order = existingOrderById.get(line.orderId);
    if (!order) continue;
    const customerId = order.customerId;
    const key = lineKey(line.inventoryItemId, line.variantId, line.quantity);
    const counts = lineCountsByCustomer.get(customerId) ?? new Map<string, number>();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    lineCountsByCustomer.set(customerId, counts);
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

    const existingLineCounts = new Map(
      lineCountsByCustomer.get(customer.id) ?? []
    );

    const newClaims = groupClaims
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .filter((claim) => {
        const key = lineKey(
          claim.inventoryItemId,
          claim.variantId,
          claim.quantity ?? 0
        );
        const remaining = existingLineCounts.get(key) ?? 0;
        if (remaining > 0) {
          existingLineCounts.set(key, remaining - 1);
          return false;
        }
        return true;
      });

    if (newClaims.length === 0) {
      continue;
    }

    const existingForCustomer = existingOrdersByCustomer.get(customer.id) ?? [];
    // Detect PAID orders and skip them; create a fresh order instead.
    const reusableOrder = existingForCustomer.find(
      (order) => order.paymentStatus !== "PAID"
    );

    const orderId = reusableOrder?.id ?? generateId("order");

    if (!reusableOrder) {
      const createdAt = nowIso();
      const orderNumber = generateOrderNumber(new Date());
      // Create a new order when no reusable order exists (or only PAID orders).
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
    }

    // One order line per new claim (orderId keeps items separated per order).
    for (const claim of newClaims) {
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
        claimId: claim.id,
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
