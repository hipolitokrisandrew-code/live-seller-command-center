// src/services/dashboard.service.ts
//
// Central data provider for the Dashboard page.
// Reads from Dexie (db) and aggregates:
//  - Today's sales & orders
//  - Pending payments
//  - Orders to ship
//  - Low stock items
//  - Recent live sessions with revenue & profit
//

import { db } from "../core/db";
import type {
  InventoryItem,
  LiveSession,
  Order,
  OrderLine,
  Customer,
} from "../core/types";

export type DashboardLowStockItem = {
  id: string;
  itemCode: string;
  name: string;
  currentStock: number;
  lowStockThreshold: number;
};

export type DashboardSessionTile = {
  id: string;
  title: string;
  platform: LiveSession["platform"];
  status: LiveSession["status"];
  startTime?: string;
  endTime?: string;
  revenue: number;
  profit: number;
};

export type DashboardOrderLite = {
  id: string;
  orderNumber: string;
  customerName: string;
  balanceDue: number;
  paymentStatus: Order["paymentStatus"];
  status: Order["status"];
  itemsSummary: string;
  grandTotal: number;
  amountPaid: number;
  liveSessionTitle?: string;
};

export type DashboardSummary = {
  dateRangeLabel: string;

  rangeSales: number;
  rangeOrdersCount: number;

  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  pendingOrders: DashboardOrderLite[];

  toShipCount: number;
  toShipOrders: DashboardOrderLite[];

  lowStockCount: number;
  lowStockItems: DashboardLowStockItem[];

  recentSessions: DashboardSessionTile[];
};

export type DashboardSummaryInput = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function startOfDayIso(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function formatRangeLabel(fromIso: string, toIso: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const fromLabel = from.toLocaleDateString("en-PH", opts);
  const toLabel = to.toLocaleDateString("en-PH", opts);
  return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`;
}

function summarizeOrderLines(lines: OrderLine[]): string {
  if (!lines.length) return "No items";
  return lines
    .map((l) => `${safeNumber(l.quantity)}x ${l.nameSnapshot}`)
    .join(", ");
}

/**
 * Main entry point for the dashboard.
 */
export async function getDashboardSummary(
  params?: DashboardSummaryInput
): Promise<DashboardSummary> {
  const [orders, inventory, sessions, orderLines, customers] = await Promise.all([
    db.orders.toArray(),
    db.inventory.toArray(),
    db.liveSessions.toArray(),
    db.orderLines.toArray(),
    db.customers.toArray(),
  ]);

  const rangeFromIso = params?.from
    ? startOfDayIso(params.from)
    : startOfTodayISO();
  const rangeToIso = params?.to ? endOfDayIso(params.to) : endOfTodayISO();

  // 1) Sales & orders in range (paid only)
  const isToday = (order: Order): boolean => {
    if (!order.createdAt) return false;
    return order.createdAt >= rangeFromIso && order.createdAt <= rangeToIso;
  };

  const rangePaidOrders = orders.filter(
    (o) => isToday(o) && o.paymentStatus === "PAID"
  );

  const rangeSales = rangePaidOrders.reduce(
    (sum, o) => sum + safeNumber(o.grandTotal),
    0
  );

  const rangeOrdersCount = rangePaidOrders.length;

  // 2) Pending payments
  const pendingOrders = orders.filter(
    (o) =>
      o.paymentStatus !== "PAID" &&
      o.status !== "CANCELLED" &&
      o.status !== "RETURNED"
  );

  const pendingPaymentsCount = pendingOrders.length;

  const pendingPaymentsAmount = pendingOrders.reduce((sum, o) => {
    const grand = safeNumber(o.grandTotal);
    const paid = safeNumber(o.amountPaid);
    const balance =
      typeof o.balanceDue === "number"
        ? safeNumber(o.balanceDue)
        : Math.max(grand - paid, 0);

    return sum + balance;
  }, 0);

  // 3) Orders to ship: fully paid, not yet shipped
  const toShipOrders = orders.filter(
    (o) =>
      o.paymentStatus === "PAID" &&
      (o.status === "PAID" || o.status === "PACKING")
  );
  const toShipCount = toShipOrders.length;

  // 4) Low stock
  const lowStockAll = inventory.filter((item) => {
    if (item.status !== "ACTIVE") return false;
    const current = safeNumber(item.currentStock);
    const threshold = safeNumber(item.lowStockThreshold);
    if (threshold <= 0) return false;
    return current <= threshold;
  });

  const lowStockItems: DashboardLowStockItem[] = lowStockAll
    .slice()
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      itemCode: item.itemCode,
      name: item.name,
      currentStock: safeNumber(item.currentStock),
      lowStockThreshold: safeNumber(item.lowStockThreshold),
    }));

  const lowStockCount = lowStockAll.length;

  // 5) Recent live sessions - revenue & profit
  const linesByOrderId = new Map<string, OrderLine[]>();
  orderLines.forEach((line) => {
    const existing = linesByOrderId.get(line.orderId);
    if (existing) {
      existing.push(line);
    } else {
      linesByOrderId.set(line.orderId, [line]);
    }
  });

  const customersById = new Map<string, Customer>();
  customers.forEach((c) => customersById.set(c.id, c));

  const sessionsById = new Map<string, LiveSession>();
  sessions.forEach((s) => sessionsById.set(s.id, s));

  const inventoryById = new Map<string, InventoryItem>();
  inventory.forEach((i) => inventoryById.set(i.id, i));

  const mapOrderLite = (o: Order): DashboardOrderLite => {
    const balance =
      typeof o.balanceDue === "number"
        ? safeNumber(o.balanceDue)
        : Math.max(safeNumber(o.grandTotal) - safeNumber(o.amountPaid), 0);
    const lines = linesByOrderId.get(o.id) ?? [];
    const customerName =
      customersById.get(o.customerId)?.displayName ?? o.customerId ?? "Customer";
    const liveSessionTitle = o.liveSessionId
      ? sessionsById.get(o.liveSessionId)?.title
      : undefined;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName,
      balanceDue: balance,
      paymentStatus: o.paymentStatus,
      status: o.status,
      itemsSummary: summarizeOrderLines(lines),
      grandTotal: safeNumber(o.grandTotal),
      amountPaid: safeNumber(o.amountPaid),
      liveSessionTitle,
    };
  };

  const pendingOrderTiles = pendingOrders.map(mapOrderLite);
  const toShipOrderTiles = toShipOrders.map(mapOrderLite);

  const sessionAgg = new Map<string, { revenue: number; cost: number }>();

  orders.forEach((order) => {
    if (!order.liveSessionId) return;
    if (order.paymentStatus !== "PAID") return;

    const key = order.liveSessionId;
    let agg = sessionAgg.get(key);
    if (!agg) {
      agg = { revenue: 0, cost: 0 };
      sessionAgg.set(key, agg);
    }

    agg.revenue += safeNumber(order.grandTotal);

    const lines = linesByOrderId.get(order.id) ?? [];
    lines.forEach((line) => {
      const item = inventoryById.get(line.inventoryItemId);
      const costPrice = item ? safeNumber(item.costPrice) : 0;
      const qty = safeNumber(line.quantity);
      agg!.cost += costPrice * qty;
    });
  });

  const recentSessions: DashboardSessionTile[] = sessions
    .filter((s) => sessionAgg.has(s.id))
    .slice()
    .sort((a, b) => {
      const aTime = a.startTime ?? "";
      const bTime = b.startTime ?? "";
      return bTime.localeCompare(aTime);
    })
    .slice(0, 5)
    .map((session) => {
      const agg = sessionAgg.get(session.id)!;
      const profit = agg.revenue - agg.cost;

      return {
        id: session.id,
        title: session.title,
        platform: session.platform,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        revenue: agg.revenue,
        profit,
      };
    });

  const dateRangeLabel = formatRangeLabel(rangeFromIso, rangeToIso);

  return {
    dateRangeLabel,
    rangeSales,
    rangeOrdersCount,
    pendingPaymentsCount,
    pendingPaymentsAmount,
    pendingOrders: pendingOrderTiles,
    toShipCount,
    toShipOrders: toShipOrderTiles,
    lowStockCount,
    lowStockItems,
    recentSessions,
  };
}
