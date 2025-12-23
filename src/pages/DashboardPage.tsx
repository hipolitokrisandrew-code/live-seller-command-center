import { useEffect, useState } from "react";
import {
  getDashboardSummary,
  type DashboardLowStockItem,
  type DashboardSessionTile,
  type DashboardSummary,
} from "../services/dashboard.service";
import { useAppSettings } from "../hooks/useAppSettings";
import { Page } from "../components/layout/Page";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardHint,
  CardTitle,
} from "../components/ui/Card";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

function formatCurrency(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return `\u20B1${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPlatform(platform: DashboardSessionTile["platform"]): string {
  switch (platform) {
    case "FACEBOOK":
      return "Facebook";
    case "TIKTOK":
      return "TikTok";
    case "SHOPEE":
      return "Shopee";
    default:
      return "Other";
  }
}

function LowStockTable({ items }: { items: DashboardLowStockItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2 text-right">On hand</th>
            <th className="px-4 py-2 text-right">Threshold</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-t border-slate-200 hover:bg-slate-50"
            >
              <td className="px-4 py-2">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <span className="text-xs text-slate-500">
                    <span className="font-mono">{item.itemCode}</span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">
                {item.currentStock}
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums text-rose-700">
                {item.lowStockThreshold}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dateTo, setDateTo] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>(
    () => ({
      from: new Date().toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    }),
  );
  const [detailView, setDetailView] = useState<"pending" | "ship" | "low" | null>(
    null,
  );
  const { settings } = useAppSettings();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getDashboardSummary({
          from: appliedRange.from,
          to: appliedRange.to,
        });
        if (!cancelled) {
          setSummary(data);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError("Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appliedRange]);

  const lowStockItems: DashboardLowStockItem[] = summary?.lowStockItems ?? [];
  const recentSessions: DashboardSessionTile[] = summary?.recentSessions ?? [];
  const businessName =
    settings?.businessName?.trim() || "Live Seller Command Center";
  const ownerName = settings?.ownerName?.trim() || "Not set";

  function applyDateRange() {
    const from = dateFrom || dateTo || new Date().toISOString().slice(0, 10);
    const to = dateTo || dateFrom || new Date().toISOString().slice(0, 10);
    setAppliedRange({ from, to });
  }

  const statCardClass = (active: boolean) =>
    cn(
      "rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition",
      "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
      active ? "ring-1 ring-emerald-200" : "",
    );

  return (
    <Page className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Dashboard <span className="text-slate-400">{"\u2014"}</span>{" "}
            {businessName}
          </h1>
          <p className="text-sm text-slate-600">
            Real-time command center for your live selling: benta, pending
            payments, to-ship, and low-stock items.
          </p>
          <p className="text-xs text-slate-500">Owner: {ownerName}</p>
        </div>
        <div className="flex gap-3 text-xs text-slate-500 sm:flex-col sm:items-end sm:gap-1">
          <span>Finance-connected</span>
          <span>Offline-ready</span>
        </div>
      </div>

      {loading ? (
        <Card className="bg-slate-50">
          <CardContent className="py-3 text-xs text-slate-600">
            Loading dashboard data...
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-500/70 bg-rose-50">
          <CardContent className="py-3 text-xs text-rose-700">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <div className="text-xs font-medium text-slate-600">
              Sales date range
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-auto sm:min-w-[160px]">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={CONTROL_CLASS}
                />
              </div>
              <span className="text-xs text-slate-500">to</span>
              <div className="w-full sm:w-auto sm:min-w-[160px]">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={CONTROL_CLASS}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Sales uses the selected range; other tiles are real-time.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={applyDateRange}
            className="w-full sm:w-auto"
          >
            Apply
          </Button>
        </div>
      </Card>

      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setDetailView(null)}
            className={statCardClass(detailView === null)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">
                Sales (range)
              </span>
              <span className="text-xs text-slate-500">
                {summary.dateRangeLabel}
              </span>
            </div>
            <div className="mt-2 text-lg font-semibold tabular-nums text-emerald-600">
              {formatCurrency(summary.rangeSales)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Paid orders:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {summary.rangeOrdersCount}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDetailView("pending")}
            className={statCardClass(detailView === "pending")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">
                Pending payments
              </span>
              <span className="text-xs text-slate-500">Not fully paid</span>
            </div>
            <div className="mt-2 text-lg font-semibold tabular-nums text-amber-600">
              {summary.pendingPaymentsCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Total balance:{" "}
              <span className="font-semibold tabular-nums text-amber-700">
                {formatCurrency(summary.pendingPaymentsAmount)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDetailView("ship")}
            className={statCardClass(detailView === "ship")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">To ship</span>
              <span className="text-xs text-slate-500">Paid, not shipped</span>
            </div>
            <div className="mt-2 text-lg font-semibold tabular-nums text-sky-700">
              {summary.toShipCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Click to see orders to ship.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDetailView("low")}
            className={statCardClass(detailView === "low")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">Low stock</span>
              <span className="text-xs text-slate-500">Near zero</span>
            </div>
            <div className="mt-2 text-lg font-semibold tabular-nums text-rose-600">
              {summary.lowStockCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Click to view low-stock items.
            </div>
          </button>
        </div>
      ) : null}

      {summary && detailView === "pending" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pending payments</CardTitle>
              <CardHint>Who still owes and for which orders.</CardHint>
            </div>
            <span className="text-xs text-slate-500">
              {summary.pendingOrders.length} order(s)
            </span>
          </CardHeader>
          <CardContent className="py-3">
            {summary.pendingOrders.length === 0 ? (
              <p className="text-sm text-slate-600">
                All orders are fully paid. Good job!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Order</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Items</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {summary.pendingOrders.map((o) => (
                      <tr
                        key={o.id}
                        className="border-t border-slate-200 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                              {o.orderNumber}
                            </span>
                            {o.liveSessionTitle ? (
                              <span className="text-xs text-slate-500">
                                {o.liveSessionTitle}
                              </span>
                            ) : null}
                            <span className="text-xs text-amber-700">
                              {o.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-900">
                          {o.customerName}
                        </td>
                        <td className="px-4 py-2 text-slate-700">{o.itemsSummary}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-amber-700">
                          {formatCurrency(o.balanceDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {summary && detailView === "ship" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Orders to ship</CardTitle>
              <CardHint>Paid but not yet shipped.</CardHint>
            </div>
            <span className="text-xs text-slate-500">
              {summary.toShipOrders.length} order(s)
            </span>
          </CardHeader>
          <CardContent className="py-3">
            {summary.toShipOrders.length === 0 ? (
              <p className="text-sm text-slate-600">Nothing to ship right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Order</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Items</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {summary.toShipOrders.map((o) => (
                      <tr
                        key={o.id}
                        className="border-t border-slate-200 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                              {o.orderNumber}
                            </span>
                            {o.liveSessionTitle ? (
                              <span className="text-xs text-slate-500">
                                {o.liveSessionTitle}
                              </span>
                            ) : null}
                            <span className="text-xs text-sky-700">{o.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-900">
                          {o.customerName}
                        </td>
                        <td className="px-4 py-2 text-slate-700">{o.itemsSummary}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">
                          {formatCurrency(o.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {summary && detailView === "low" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Low stock items</CardTitle>
              <CardHint>Click Inventory to restock.</CardHint>
            </div>
            <span className="text-xs text-slate-500">
              {summary.lowStockItems.length} item(s)
            </span>
          </CardHeader>
          <CardContent className="py-3">
            {summary.lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-600">No low-stock items yet.</p>
            ) : (
              <LowStockTable items={summary.lowStockItems} />
            )}
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent live sessions</CardTitle>
              <CardHint>Based on paid orders per session.</CardHint>
            </CardHeader>
            <CardContent className="py-3">
              {recentSessions.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No sessions with paid orders yet. Once you build orders from
                  claims, you will see performance per live session here.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentSessions.map((session) => (
                    <Card key={session.id} className="p-3 shadow-none">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {session.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {session.startTime
                              ? formatDateTime(session.startTime)
                              : "No start time"}
                          </div>
                        </div>
                        <Badge className="shrink-0" variant="neutral">
                          {formatPlatform(session.platform)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-xs font-medium text-slate-600">
                            Revenue
                          </div>
                          <div className="font-semibold tabular-nums text-emerald-600">
                            {formatCurrency(session.revenue)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-600">
                            Profit
                          </div>
                          <div
                            className={cn(
                              "font-semibold tabular-nums",
                              session.profit >= 0
                                ? "text-emerald-600"
                                : "text-rose-600",
                            )}
                          >
                            {formatCurrency(session.profit)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-slate-600">
                            Status
                          </div>
                          <div className="font-semibold text-slate-900">
                            {session.status}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low stock items</CardTitle>
              <CardHint>Auto-flagged by item threshold.</CardHint>
            </CardHeader>
            <CardContent className="py-3">
              {lowStockItems.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No low-stock items. Set thresholds in Inventory to enable warnings.
                </p>
              ) : (
                <LowStockTable items={lowStockItems} />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!loading && !summary && !error ? (
        <Card className="bg-slate-50">
          <CardContent className="py-3 text-xs text-slate-600">
            No data yet. Once you create inventory, live sessions, claims, and
            orders, this dashboard will show your real-time selling status.
          </CardContent>
        </Card>
      ) : null}
    </Page>
  );
}

