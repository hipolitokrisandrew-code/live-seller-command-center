// src/services/finance.service.ts
import { db } from "../core/db";
import type {
  FinanceSnapshot,
  InventoryItem,
  LiveSession,
  Order,
  OrderLine,
  Payment,
  Shipment,
} from "../core/types";

export type FinanceRangeInput = {
  from: string; // ISO date string, e.g. 2025-12-06T00:00:00.000Z
  to: string; // ISO date string (end of range, inclusive)
  platform?: "ALL" | "FACEBOOK" | "TIKTOK" | "SHOPEE" | "OTHER";
};

export type NetProfitPoint = {
  date: string; // YYYY-MM-DD
  label: string;
  netProfit: number;
};

function toDateOrNull(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isWithinRange(iso: string | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const d = toDateOrNull(iso);
  if (!d) return false;
  return d >= from && d <= to;
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveCostPrice(item: InventoryItem | undefined, variantId?: string) {
  if (!item) return 0;
  const variant =
    variantId && item.variants
      ? item.variants.find((v) => v.id === variantId)
      : undefined;
  return safeNumber(variant?.costPrice ?? item.costPrice);
}

async function loadCoreData() {
  const [orders, orderLines, inventory, payments, shipments, sessions] =
    await Promise.all([
      db.orders.toArray(),
      db.orderLines.toArray(),
      db.inventory.toArray(),
      db.payments.toArray(),
      db.shipments.toArray(),
      db.liveSessions.toArray(),
    ]);

  const inventoryMap = new Map<string, InventoryItem>();
  inventory.forEach((item) => inventoryMap.set(item.id, item));

  const sessionMap = new Map<string, LiveSession>();
  sessions.forEach((s) => sessionMap.set(s.id, s));

  return {
    orders,
    orderLines,
    inventoryMap,
    payments,
    shipments,
    sessionMap,
  };
}

function filterOrdersByRangeAndPlatform(
  orders: Order[],
  sessionMap: Map<string, LiveSession>,
  fromIso: string,
  toIso: string,
  platform: FinanceRangeInput["platform"]
): Order[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);

  return orders.filter((order) => {
    if (!isWithinRange(order.createdAt, from, to)) return false;

    if (!platform || platform === "ALL") return true;

    const session = order.liveSessionId && sessionMap.get(order.liveSessionId);
    if (!session) return false;
    return session.platform === platform;
  });
}

/**
 * Main snapshot for a date range.
 */
export async function getFinanceSnapshotForRange(
  params: FinanceRangeInput
): Promise<FinanceSnapshot> {
  const { from, to, platform = "ALL" } = params;

  const { orders, orderLines, inventoryMap, payments, shipments, sessionMap } =
    await loadCoreData();

  const rangeOrders = filterOrdersByRangeAndPlatform(
    orders,
    sessionMap,
    from,
    to,
    platform
  );

  const paidOrders = rangeOrders.filter(
    (o) => o.paymentStatus === "PAID" || safeNumber(o.amountPaid) > 0
  );

  const paidOrderIds = new Set(paidOrders.map((o) => o.id));

  // Sales from orders
  const totalSales = paidOrders.reduce(
    (sum, o) => sum + safeNumber(o.grandTotal),
    0
  );

  // Cost of goods + per-product performance
  const rangeLines: OrderLine[] = orderLines.filter((line) =>
    paidOrderIds.has(line.orderId)
  );

  const productMap = new Map<
    string,
    {
      itemCode: string;
      name: string;
      qtySold: number;
      revenue: number;
      cost: number;
      profit: number;
    }
  >();

  rangeLines.forEach((line) => {
    const item = inventoryMap.get(line.inventoryItemId);
    const key = line.inventoryItemId;
    const revenue = safeNumber(line.lineTotal);
    const qty = safeNumber(line.quantity);
    const costPrice = resolveCostPrice(item, line.variantId);
    const cost = costPrice * qty;
    const profit = revenue - cost;

    const existing = productMap.get(key);
    if (!existing) {
      productMap.set(key, {
        itemCode: line.itemCodeSnapshot,
        name: line.nameSnapshot,
        qtySold: qty,
        revenue,
        cost,
        profit,
      });
    } else {
      existing.qtySold += qty;
      existing.revenue += revenue;
      existing.cost += cost;
      existing.profit += profit;
    }
  });

  const productPerformance = Array.from(productMap.values()).sort(
    (a, b) => b.revenue - a.revenue
  );

  const totalCostOfGoods = productPerformance.reduce(
    (sum, p) => sum + p.cost,
    0
  );

  // Shipping cost from shipments linked to orders in range
  const rangeShipments: Shipment[] = shipments.filter((s) =>
    paidOrderIds.has(s.orderId)
  );

  const totalShippingCost = rangeShipments.reduce(
    (sum, s) => sum + safeNumber(s.shippingFee),
    0
  );

  // Other expenses from orders
  const totalOtherExpenses = paidOrders.reduce(
    (sum, o) => sum + safeNumber(o.otherFees),
    0
  );

  const grossProfit = totalSales - totalCostOfGoods;
  const netProfit = grossProfit - totalShippingCost - totalOtherExpenses;
  const profitMarginPercent =
    totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Cash in/out
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const rangePayments: Payment[] = payments.filter((p) =>
    isWithinRange(p.date, fromDate, toDate)
  );

  const cashIn = rangePayments
    .filter((p) => p.status === "POSTED")
    .reduce((sum, p) => sum + safeNumber(p.amount), 0);

  const cashOut = totalCostOfGoods + totalShippingCost + totalOtherExpenses;
  const balanceChange = cashIn - cashOut;

  // Top sessions (using paid orders only)
  const sessionAgg = new Map<
    string,
    { liveSessionId: string; title: string; revenue: number; profit: number }
  >();

  paidOrders.forEach((o) => {
    const sessionId = o.liveSessionId ?? "NO_SESSION";
    const session = o.liveSessionId ? sessionMap.get(o.liveSessionId) : null;
    const title = session ? session.title : "No session";

    // approximate profit contribution of this order
    const linesForOrder = rangeLines.filter((l) => l.orderId === o.id);
    const orderCost = linesForOrder.reduce((sum, l) => {
      const item = inventoryMap.get(l.inventoryItemId);
      const costPrice = safeNumber(item?.costPrice);
      return sum + costPrice * safeNumber(l.quantity);
    }, 0);
    const orderShippingCost = rangeShipments
      .filter((s) => s.orderId === o.id)
      .reduce((sum, s) => sum + safeNumber(s.shippingFee), 0);
    const orderOther = safeNumber(o.otherFees);
    const orderGross = safeNumber(o.grandTotal) - orderCost;
    const orderNet = orderGross - orderShippingCost - orderOther;

    const existing = sessionAgg.get(sessionId);
    if (!existing) {
      sessionAgg.set(sessionId, {
        liveSessionId: sessionId,
        title,
        revenue: safeNumber(o.grandTotal),
        profit: orderNet,
      });
    } else {
      existing.revenue += safeNumber(o.grandTotal);
      existing.profit += orderNet;
    }
  });

  const topSessions = Array.from(sessionAgg.values()).sort(
    (a, b) => b.revenue - a.revenue
  );

  const topProducts = productPerformance.slice(0, 10);

  const snapshot: FinanceSnapshot = {
    periodLabel: "Custom range",
    totalSales,
    totalCostOfGoods,
    totalShippingCost,
    totalOtherExpenses,
    grossProfit,
    netProfit,
    profitMarginPercent,
    topProducts,
    topSessions,
    cashIn,
    cashOut,
    balanceChange,
  };

  return snapshot;
}

/**
 * Finance snapshot for a specific live session.
 */
export async function getFinanceSnapshotForLiveSession(
  liveSessionId: string
): Promise<FinanceSnapshot> {
  const [orders, orderLines, inventory, payments, shipments, sessions] =
    await Promise.all([
      db.orders.toArray(),
      db.orderLines.toArray(),
      db.inventory.toArray(),
      db.payments.toArray(),
      db.shipments.toArray(),
      db.liveSessions.toArray(),
    ]);

  const session = sessions.find((s) => s.id === liveSessionId);
  const inventoryMap = new Map<string, InventoryItem>();
  inventory.forEach((item) => inventoryMap.set(item.id, item));

  const sessionOrders = orders.filter((o) => o.liveSessionId === liveSessionId);
  const paidOrders = sessionOrders.filter(
    (o) => o.paymentStatus === "PAID" || safeNumber(o.amountPaid) > 0
  );
  const paidOrderIds = new Set(paidOrders.map((o) => o.id));

  const totalSales = paidOrders.reduce(
    (sum, o) => sum + safeNumber(o.grandTotal),
    0
  );

  const linesForSession = orderLines.filter((l) => paidOrderIds.has(l.orderId));

  const productMap = new Map<
    string,
    {
      itemCode: string;
      name: string;
      qtySold: number;
      revenue: number;
      cost: number;
      profit: number;
    }
  >();

  linesForSession.forEach((line) => {
    const item = inventoryMap.get(line.inventoryItemId);
    const key = line.inventoryItemId;
    const revenue = safeNumber(line.lineTotal);
    const qty = safeNumber(line.quantity);
    const costPrice = resolveCostPrice(item, line.variantId);
    const cost = costPrice * qty;
    const profit = revenue - cost;

    const existing = productMap.get(key);
    if (!existing) {
      productMap.set(key, {
        itemCode: line.itemCodeSnapshot,
        name: line.nameSnapshot,
        qtySold: qty,
        revenue,
        cost,
        profit,
      });
    } else {
      existing.qtySold += qty;
      existing.revenue += revenue;
      existing.cost += cost;
      existing.profit += profit;
    }
  });

  const productPerformance = Array.from(productMap.values());
  const totalCostOfGoods = productPerformance.reduce(
    (sum, p) => sum + p.cost,
    0
  );

  const shipmentsForSession = shipments.filter((s) =>
    paidOrderIds.has(s.orderId)
  );
  const totalShippingCost = shipmentsForSession.reduce(
    (sum, s) => sum + safeNumber(s.shippingFee),
    0
  );

  const totalOtherExpenses = paidOrders.reduce(
    (sum, o) => sum + safeNumber(o.otherFees),
    0
  );

  const grossProfit = totalSales - totalCostOfGoods;
  const netProfit = grossProfit - totalShippingCost - totalOtherExpenses;
  const profitMarginPercent =
    totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Payments for this session's orders
  const paymentsForSession = payments.filter((p) =>
    paidOrderIds.has(p.orderId)
  );
  const cashIn = paymentsForSession
    .filter((p) => p.status === "POSTED")
    .reduce((sum, p) => sum + safeNumber(p.amount), 0);
  const cashOut = totalCostOfGoods + totalShippingCost + totalOtherExpenses;
  const balanceChange = cashIn - cashOut;

  const topProducts = productPerformance.sort((a, b) => b.revenue - a.revenue);

  const topSessions = [
    {
      liveSessionId,
      title: session ? session.title : "Session",
      revenue: totalSales,
      profit: netProfit,
    },
  ];

  const snapshot: FinanceSnapshot = {
    periodLabel: session ? session.title : "Session",
    totalSales,
    totalCostOfGoods,
    totalShippingCost,
    totalOtherExpenses,
    grossProfit,
    netProfit,
    profitMarginPercent,
    topProducts,
    topSessions,
    cashIn,
    cashOut,
    balanceChange,
  };

  return snapshot;
}

/**
 * Product performance list for a range.
 */
export async function getProductPerformance(params: FinanceRangeInput) {
  const snapshot = await getFinanceSnapshotForRange(params);
  return snapshot.topProducts;
}

/**
 * Cash flow for a range (used by UI).
 */
export async function getCashFlow(params: FinanceRangeInput) {
  const snapshot = await getFinanceSnapshotForRange(params);
  return {
    cashIn: snapshot.cashIn,
    cashOut: snapshot.cashOut,
    balanceChange: snapshot.balanceChange,
  };
}

/**
 * Net profit per day (simple series for charts).
 */
export async function getNetProfitSeries(
  params: FinanceRangeInput
): Promise<NetProfitPoint[]> {
  const { from, to, platform = "ALL" } = params;
  const { orders, orderLines, inventoryMap, shipments, sessionMap } =
    await loadCoreData();

  const rangeOrders = filterOrdersByRangeAndPlatform(
    orders,
    sessionMap,
    from,
    to,
    platform
  );

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const linesByOrder = new Map<string, OrderLine[]>();
  orderLines.forEach((line) => {
    const existing = linesByOrder.get(line.orderId);
    if (!existing) {
      linesByOrder.set(line.orderId, [line]);
    } else {
      existing.push(line);
    }
  });

  const shipmentsByOrder = new Map<string, Shipment[]>();
  shipments.forEach((s) => {
    const existing = shipmentsByOrder.get(s.orderId);
    if (!existing) {
      shipmentsByOrder.set(s.orderId, [s]);
    } else {
      existing.push(s);
    }
  });

  const perDay = new Map<string, number>();

  rangeOrders.forEach((order) => {
    if (!isWithinRange(order.createdAt, fromDate, toDate)) return;

    const orderDate = new Date(order.createdAt!);
    const key = orderDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const lines = linesByOrder.get(order.id) ?? [];
    const cost = lines.reduce((sum, l) => {
      const item = inventoryMap.get(l.inventoryItemId);
      const costPrice = safeNumber(item?.costPrice);
      return sum + costPrice * safeNumber(l.quantity);
    }, 0);

    const shipCost = (shipmentsByOrder.get(order.id) ?? []).reduce(
      (sum, s) => sum + safeNumber(s.shippingFee),
      0
    );

    const other = safeNumber(order.otherFees);
    const gross = safeNumber(order.grandTotal) - cost;
    const net = gross - shipCost - other;

    const existing = perDay.get(key) ?? 0;
    perDay.set(key, existing + net);
  });

  const dates = Array.from(perDay.keys()).sort();
  const points: NetProfitPoint[] = dates.map((d) => ({
    date: d,
    label: d,
    netProfit: perDay.get(d) ?? 0,
  }));

  return points;
}
