// src/pages/DashboardPage.tsx
//
// Main Dashboard UI.
// Shows:
//  - Today's sales & orders
//  - Pending payments
//  - To-ship orders
//  - Low stock summary + table
//  - Recent live sessions with revenue & profit
//

import { useEffect, useState } from "react";
import {
  getDashboardSummary,
  type DashboardSummary,
  type DashboardSessionTile,
  type DashboardLowStockItem,
} from "../services/dashboard.service";

function formatCurrency(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getDashboardSummary();
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
  }, []);

  const lowStockItems: DashboardLowStockItem[] = summary?.lowStockItems ?? [];
  const recentSessions: DashboardSessionTile[] = summary?.recentSessions ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Real-time command center for your live selling. Quick view of benta,
          pending payments, to-ship, and low-stock items.
        </p>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">
          Loading dashboard data…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* Today sales */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="uppercase tracking-wide">
                Today&apos;s sales
              </span>
              <span>{summary.todayLabel}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-emerald-300">
              {formatCurrency(summary.todaySales)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Paid orders today:{" "}
              <span className="font-medium text-slate-200">
                {summary.todayOrdersCount}
              </span>
            </div>
          </div>

          {/* Pending payments */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="uppercase tracking-wide">Pending payments</span>
              <span>Hindi pa fully paid</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-amber-300">
              {summary.pendingPaymentsCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Total balance:{" "}
              <span className="font-medium text-amber-200">
                {formatCurrency(summary.pendingPaymentsAmount)}
              </span>
            </div>
          </div>

          {/* To ship */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="uppercase tracking-wide">To ship</span>
              <span>Paid but not shipped</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-sky-300">
              {summary.toShipCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Check &quot;Shipping&quot; tab to process these orders.
            </div>
          </div>

          {/* Low stock */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="uppercase tracking-wide">Low stock</span>
              <span>Items nearing zero</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-rose-300">
              {summary.lowStockCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Showing top low-stock items below.
            </div>
          </div>
        </div>
      )}

      {/* Main lower section: recent sessions + low stock table */}
      {summary && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
          {/* Recent live sessions */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-200">
                Recent live sessions
              </span>
              <span className="text-[11px] text-slate-500">
                Based on paid orders per session
              </span>
            </div>

            {recentSessions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">
                Walang sessions with paid orders yet. Once you create live
                sessions and build orders from claims, makikita mo dito ang
                performance per live.
              </div>
            ) : (
              <div className="grid gap-3 p-3 md:grid-cols-2">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col justify-between rounded-md border border-slate-800 bg-slate-950/90 p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-slate-50">
                          {session.title}
                        </div>
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
                          {formatPlatform(session.platform)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {session.startTime
                          ? formatDateTime(session.startTime)
                          : "No start time"}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-slate-400">Revenue</div>
                        <div className="font-semibold text-emerald-300">
                          {formatCurrency(session.revenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Profit</div>
                        <div
                          className={`font-semibold ${
                            session.profit >= 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }`}
                        >
                          {formatCurrency(session.profit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400">Status</div>
                        <div className="font-medium text-slate-200">
                          {session.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low stock table */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-200">
                Low stock items
              </span>
              <span className="text-[11px] text-slate-500">
                Auto-flagged based on item threshold
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">
                Wala pang low-stock items. Set your thresholds in Inventory to
                get warnings here.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">On hand</th>
                      <th className="px-3 py-2 text-right">Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-mono text-[10px] text-slate-400">
                              {item.itemCode}
                            </span>
                            <span className="text-slate-100">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-100">
                          {item.currentStock}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-300">
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

      {/* Empty state when summary is still null and not loading */}
      {!loading && !summary && !error && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs text-slate-500">
          No data yet. Once you create inventory, live sessions, claims, and
          orders, this dashboard will show your real-time selling status.
        </div>
      )}
    </div>
  );
}
