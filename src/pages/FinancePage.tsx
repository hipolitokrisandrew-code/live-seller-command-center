// src/pages/FinancePage.tsx
import { useEffect, useMemo, useState } from "react";
import type { FinanceSnapshot } from "../core/types";
import {
  getFinanceSnapshotForRange,
  getNetProfitSeries,
  type NetProfitPoint,
  type FinanceRangeInput,
} from "../services/finance.service";

type RangePreset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday as start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toIso(d: Date) {
  return d.toISOString();
}

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `${num.toFixed(1)}%`;
}

function rangeLabel(preset: RangePreset): string {
  switch (preset) {
    case "TODAY":
      return "Today";
    case "THIS_WEEK":
      return "This week";
    case "THIS_MONTH":
      return "This month";
    case "CUSTOM":
      return "Custom";
    default:
      return "Range";
  }
}

export function FinancePage() {
  const [preset, setPreset] = useState<RangePreset>("THIS_MONTH");
  const [fromInput, setFromInput] = useState(formatDateInput(startOfMonth()));
  const [toInput, setToInput] = useState(formatDateInput(endOfToday()));
  const [platform, setPlatform] =
    useState<FinanceRangeInput["platform"]>("ALL");

  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [series, setSeries] = useState<NetProfitPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodLabel = useMemo(() => rangeLabel(preset), [preset]);

  function computeRange(): { from: string; to: string } {
    let from: Date;
    let to: Date;

    if (preset === "TODAY") {
      from = startOfToday();
      to = endOfToday();
    } else if (preset === "THIS_WEEK") {
      from = startOfWeek();
      to = endOfToday();
    } else if (preset === "THIS_MONTH") {
      from = startOfMonth();
      to = endOfToday();
    } else {
      // CUSTOM
      from = new Date(fromInput);
      from.setHours(0, 0, 0, 0);
      to = new Date(toInput);
      to.setHours(23, 59, 59, 999);
    }

    return { from: toIso(from), to: toIso(to) };
  }

  useEffect(() => {
    const { from, to } = computeRange();

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const params = { from, to, platform };

        const [snap, seriesData] = await Promise.all([
          getFinanceSnapshotForRange(params),
          getNetProfitSeries(params),
        ]);

        setSnapshot({
          ...snap,
          periodLabel,
        });
        setSeries(seriesData);
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load finance data.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, fromInput, toInput, platform]);

  function handlePresetChange(newPreset: RangePreset) {
    setPreset(newPreset);

    if (newPreset === "TODAY") {
      const from = startOfToday();
      const to = endOfToday();
      setFromInput(formatDateInput(from));
      setToInput(formatDateInput(to));
    } else if (newPreset === "THIS_WEEK") {
      const from = startOfWeek();
      const to = endOfToday();
      setFromInput(formatDateInput(from));
      setToInput(formatDateInput(to));
    } else if (newPreset === "THIS_MONTH") {
      const from = startOfMonth();
      const to = endOfToday();
      setFromInput(formatDateInput(from));
      setToInput(formatDateInput(to));
    }
  }

  const hasData =
    snapshot &&
    (snapshot.totalSales > 0 || snapshot.cashIn > 0 || snapshot.cashOut > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Finance</h1>
        <p className="text-sm text-slate-400">
          Kita, gastos, at tubo per period. Based on orders, payments, and
          shipments from your live sessions.
        </p>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Period
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              ["TODAY", "THIS_WEEK", "THIS_MONTH", "CUSTOM"] as RangePreset[]
            ).map((value) => {
              const isActive = preset === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePresetChange(value)}
                  className={`rounded-md px-3 py-1 text-xs ${
                    isActive
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-900 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {rangeLabel(value)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">From</label>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => {
                  setFromInput(e.target.value);
                  setPreset("CUSTOM");
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">To</label>
              <input
                type="date"
                value={toInput}
                onChange={(e) => {
                  setToInput(e.target.value);
                  setPreset("CUSTOM");
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Platform
          </div>
          <select
            value={platform ?? "ALL"}
            onChange={(e) =>
              setPlatform(e.target.value as FinanceRangeInput["platform"])
            }
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All platforms</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SHOPEE">Shopee</option>
            <option value="OTHER">Other</option>
          </select>

          {snapshot && (
            <p className="text-xs text-slate-500">
              Period:{" "}
              <span className="font-medium text-slate-100">{periodLabel}</span>
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          Loading finance data…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {snapshot && (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Sales
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">
              {formatCurrency(snapshot.totalSales)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cost of Goods
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {formatCurrency(snapshot.totalCostOfGoods)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Gross Profit
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {formatCurrency(snapshot.grossProfit)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Net Profit
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">
              {formatCurrency(snapshot.netProfit)}
            </div>
            <div className="text-xs text-slate-400">
              Margin:{" "}
              <span className="font-medium text-slate-100">
                {formatPercent(snapshot.profitMarginPercent)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Shipping Cost
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {formatCurrency(snapshot.totalShippingCost)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Other Expenses
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {formatCurrency(snapshot.totalOtherExpenses)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cash In
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">
              {formatCurrency(snapshot.cashIn)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cash Out
            </div>
            <div className="mt-1 text-lg font-semibold text-amber-300">
              {formatCurrency(snapshot.cashOut)}
            </div>
            <div className="text-xs text-slate-400">
              Net change:{" "}
              <span
                className={
                  snapshot.balanceChange >= 0
                    ? "font-semibold text-emerald-300"
                    : "font-semibold text-rose-300"
                }
              >
                {formatCurrency(snapshot.balanceChange)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Net profit "graph" */}
      {hasData && series.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Net profit over time
          </div>
          <div className="flex items-end gap-2 overflow-x-auto pb-2">
            {series.map((point) => {
              const max = Math.max(...series.map((p) => Math.abs(p.netProfit)));
              const height =
                max > 0
                  ? Math.max(12, (Math.abs(point.netProfit) / max) * 80)
                  : 12;
              const positive = point.netProfit >= 0;
              return (
                <div
                  key={point.date}
                  className="flex min-w-10 flex-col items-center justify-end gap-1"
                >
                  <div
                    className={`w-full rounded-t-sm ${
                      positive ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                    style={{ height }}
                  />
                  <div className="text-[10px] text-slate-400">
                    {point.label.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tables */}
      {snapshot && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Per-session */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Per live session performance
            </div>
            {snapshot.topSessions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">
                Walang sales pa in this period.
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Session</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.topSessions.map((s) => (
                      <tr
                        key={s.liveSessionId}
                        className="border-t border-slate-800"
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-100">
                          {s.title}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(s.revenue)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-emerald-300">
                          {formatCurrency(s.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Per-product */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Per product performance
            </div>
            {snapshot.topProducts.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">
                Walang benta pa per item in this period.
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.topProducts.map((p) => (
                      <tr
                        key={p.itemCode + p.name}
                        className="border-t border-slate-800"
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-100">
                          <span className="font-mono text-[10px] text-slate-400">
                            {p.itemCode}
                          </span>{" "}
                          {p.name}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-100">
                          {p.qtySold}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-emerald-300">
                          {formatCurrency(p.profit)}
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
    </div>
  );
}
