import { useEffect, useState } from "react";
import {
  getDashboardSummary,
  type DashboardSummary,
  type DashboardSessionTile,
  type DashboardLowStockItem,
} from "../services/dashboard.service";
import { useAppSettings } from "../hooks/useAppSettings";
import { PANEL_CLASS, MUTED_PANEL_CLASS } from "../theme/classes";

const SUMMARY_CARD_CLASS = `${PANEL_CLASS} p-3`;

function formatCurrency(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return `₱${num.toLocaleString("en-PH", {
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

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>(
    () => ({
      from: new Date().toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    })
  );
  const [detailView, setDetailView] = useState<
    "pending" | "ship" | "low" | null
  >(null);
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

  return (
    <div className="space-y-4">
      <div className={PANEL_CLASS + " p-4"}>
        <h1 className="text-2xl font-semibold text-slate-900">
          Dashboard — {businessName}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Owner: {ownerName}</p>
        <p className="mt-1 text-sm text-slate-600">
          Real-time command center for your live selling. Quick view of benta,
          pending payments, to-ship, and low-stock items.
        </p>
      </div>

      {loading && (
        <div className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}>
          Loading dashboard data...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/70 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {summary && (
        <div className={`${PANEL_CLASS} flex flex-wrap items-center gap-3 p-3 text-sm`}>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-xs uppercase tracking-wide">
              Sales date range:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={applyDateRange}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
          <span className="text-xs text-slate-500">
            Sales card reflects the selected range; other tiles remain real-time.
          </span>
        </div>
      )}

      {summary && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setDetailView(null)}
            className={`${SUMMARY_CARD_CLASS} text-left transition hover:-translate-y-0.5 hover:shadow`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="uppercase tracking-wide">Sales (range)</span>
              <span>{summary.dateRangeLabel}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-emerald-600">
              {formatCurrency(summary.rangeSales)}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Paid orders:{" "}
              <span className="font-medium text-slate-900">
                {summary.rangeOrdersCount}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDetailView("pending")}
            className={`${SUMMARY_CARD_CLASS} text-left transition hover:-translate-y-0.5 hover:shadow`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="uppercase tracking-wide">Pending payments</span>
              <span>Hindi pa fully paid</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-amber-600">
              {summary.pendingPaymentsCount}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Total balance:{" "}
              <span className="font-medium text-amber-700">
                {formatCurrency(summary.pendingPaymentsAmount)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDetailView("ship")}
            className={`${SUMMARY_CARD_CLASS} text-left transition hover:-translate-y-0.5 hover:shadow`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="uppercase tracking-wide">To ship</span>
              <span>Paid but not shipped</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-sky-700">
              {summary.toShipCount}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Click to see orders to ship.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDetailView("low")}
            className={`${SUMMARY_CARD_CLASS} text-left transition hover:-translate-y-0.5 hover:shadow`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="uppercase tracking-wide">Low stock</span>
              <span>Items nearing zero</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-rose-600">
              {summary.lowStockCount}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Click to view low-stock items.
            </div>
          </button>
        </div>
      )}

      {summary && detailView === "pending" && (
        <div className={PANEL_CLASS}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="font-semibold text-slate-800">
              Pending payments — who still owes and for which orders
            </span>
            <span className="text-[11px] text-slate-500">
              {summary.pendingOrders.length} order(s)
            </span>
          </div>
          {summary.pendingOrders.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-600">
              All orders are fully paid. Good job!
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-left text-[11px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.pendingOrders.map((o) => (
                    <tr key={o.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {o.orderNumber}
                          </span>
                          {o.liveSessionTitle && (
                            <span className="text-[10px] text-slate-500">
                              {o.liveSessionTitle}
                            </span>
                          )}
                          <span className="text-[10px] text-amber-700">
                            {o.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-900">{o.customerName}</td>
                      <td className="px-3 py-2 text-slate-700">{o.itemsSummary}</td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">
                        {formatCurrency(o.balanceDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {summary && detailView === "ship" && (
        <div className={PANEL_CLASS}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="font-semibold text-slate-800">
              Orders to ship — paid but not yet shipped
            </span>
            <span className="text-[11px] text-slate-500">
              {summary.toShipOrders.length} order(s)
            </span>
          </div>
          {summary.toShipOrders.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-600">
              Nothing to ship right now. Nice!
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-left text-[11px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.toShipOrders.map((o) => (
                    <tr key={o.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {o.orderNumber}
                          </span>
                          {o.liveSessionTitle && (
                            <span className="text-[10px] text-slate-500">
                              {o.liveSessionTitle}
                            </span>
                          )}
                          <span className="text-[10px] text-sky-700">
                            {o.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-900">{o.customerName}</td>
                      <td className="px-3 py-2 text-slate-700">{o.itemsSummary}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {formatCurrency(o.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {summary && detailView === "low" && (
        <div className={PANEL_CLASS}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="font-semibold text-slate-800">
              Low stock items — click Inventory to restock
            </span>
            <span className="text-[11px] text-slate-500">
              {summary.lowStockItems.length} item(s)
            </span>
          </div>
          {summary.lowStockItems.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-600">
              Wala pang low-stock items. Great!
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-left text-[11px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">On hand</th>
                    <th className="px-3 py-2 text-right">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lowStockItems.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] text-slate-500">
                            {item.itemCode}
                          </span>
                          <span className="text-slate-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-900">
                        {item.currentStock}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-700">
                        {item.lowStockThreshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
          <div className={PANEL_CLASS}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">
                Recent live sessions
              </span>
              <span className="text-[11px] text-slate-500">
                Based on paid orders per session
              </span>
            </div>

            {recentSessions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-600">
                Walang sessions with paid orders yet. Once you create live
                sessions and build orders from claims, makikita mo dito ang
                performance per live.
              </div>
            ) : (
              <div className="grid gap-3 p-3 md:grid-cols-2">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 px-3 py-3 text-xs`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-slate-900">
                          {session.title}
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                          {formatPlatform(session.platform)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {session.startTime
                          ? formatDateTime(session.startTime)
                          : "No start time"}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-slate-500">Revenue</div>
                        <div className="font-semibold text-emerald-600">
                          {formatCurrency(session.revenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Profit</div>
                        <div
                          className={`font-semibold ${
                            session.profit >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {formatCurrency(session.profit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500">Status</div>
                        <div className="font-medium text-slate-900">
                          {session.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={PANEL_CLASS}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">
                Low stock items
              </span>
              <span className="text-[11px] text-slate-500">
                Auto-flagged based on item threshold
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-600">
                Wala pang low-stock items. Set your thresholds in Inventory to
                get warnings here.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">On hand</th>
                      <th className="px-3 py-2 text-right">Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-mono text-[10px] text-slate-500">
                              {item.itemCode}
                            </span>
                            <span className="text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-900">
                          {item.currentStock}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-700">
                          {item.lowStockThreshold}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !summary && !error && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-3 text-xs text-slate-600`}
        >
          No data yet. Once you create inventory, live sessions, claims, and
          orders, this dashboard will show your real-time selling status.
        </div>
      )}
    </div>
  );
}
