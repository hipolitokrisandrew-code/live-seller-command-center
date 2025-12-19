import { useEffect, useMemo, useState } from "react";
import type { FinanceSnapshot } from "../core/types";
import {
  getFinanceSnapshotForRange,
  getNetProfitSeries,
  type NetProfitPoint,
  type FinanceRangeInput,
} from "../services/finance.service";
import {
  PANEL_CLASS,
  MUTED_PANEL_CLASS,
  INPUT_CLASS,
} from "../theme/classes";

type RangePreset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

const SMALL_INPUT_CLASS = `${INPUT_CLASS} px-2 py-1 text-xs`;
const SUMMARY_CARD_CLASS = `${PANEL_CLASS} p-3`;

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
  const cashFlowMax = useMemo(() => {
    if (!snapshot) {
      return 1;
    }
    return Math.max(
      snapshot.cashIn,
      snapshot.cashOut,
      snapshot.totalOtherExpenses,
      snapshot.totalShippingCost,
      snapshot.totalCostOfGoods,
      1,
    );
  }, [snapshot]);
  // Visual helpers for dashboard charts.
  const expenseTotal = useMemo(() => {
    if (!snapshot) {
      return 0;
    }
    return (
      snapshot.totalCostOfGoods +
      snapshot.totalShippingCost +
      snapshot.totalOtherExpenses
    );
  }, [snapshot]);
  const donutSegments = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    const total = Math.max(
      snapshot.totalCostOfGoods +
        snapshot.totalShippingCost +
        snapshot.totalOtherExpenses +
        Math.max(snapshot.netProfit, 0),
      1,
    );
    const segments = [
      {
        label: "Cost of Goods",
        value: snapshot.totalCostOfGoods,
        color: "#0f766e",
      },
      {
        label: "Shipping",
        value: snapshot.totalShippingCost,
        color: "#38bdf8",
      },
      {
        label: "Other",
        value: snapshot.totalOtherExpenses,
        color: "#f59e0b",
      },
      {
        label: "Net Profit",
        value: Math.max(snapshot.netProfit, 0),
        color: "#22c55e",
      },
    ];
    let offset = 0;
    return segments.map((segment) => {
      const percent = (segment.value / total) * 100;
      const start = offset;
      offset += percent;
      return { ...segment, percent, start };
    });
  }, [snapshot]);
  const donutStyle = useMemo(() => {
    if (donutSegments.length === 0) {
      return { background: "#e2e8f0" };
    }
    const gradient = donutSegments
      .map(
        (segment) =>
          `${segment.color} ${segment.start.toFixed(2)}% ${(segment.start + segment.percent).toFixed(2)}%`,
      )
      .join(", ");
    return { background: `conic-gradient(${gradient})` };
  }, [donutSegments]);
  const barSeries = useMemo(() => {
    if (series.length === 0) {
      return [];
    }
    const max = Math.max(...series.map((point) => Math.abs(point.netProfit)), 1);
    return series.map((point) => ({
      ...point,
      height: Math.max(12, (Math.abs(point.netProfit) / max) * 140),
      positive: point.netProfit >= 0,
    }));
  }, [series]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Finance
          </h1>
          <p className="text-sm text-slate-600">
            Kita, gastos, at tubo per period. Based on orders, payments, and
            shipments from your live sessions.
          </p>
        </div>
        {snapshot ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Net Profit
              </p>
              <p className="text-base font-semibold text-emerald-600">
                {formatCurrency(snapshot.netProfit)}
              </p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Margin
              </p>
              <p className="text-base font-semibold text-slate-900">
                {formatPercent(snapshot.profitMarginPercent)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Filters */}
      <div
        className={`${PANEL_CLASS} grid gap-3 p-3 text-sm md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {rangeLabel(value)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                From
              </label>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => {
                  setFromInput(e.target.value);
                  setPreset("CUSTOM");
                }}
                className={SMALL_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                To
              </label>
              <input
                type="date"
                value={toInput}
                onChange={(e) => {
                  setToInput(e.target.value);
                  setPreset("CUSTOM");
                }}
                className={SMALL_INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Platform
          </div>
          <select
            value={platform ?? "ALL"}
            onChange={(e) =>
              setPlatform(e.target.value as FinanceRangeInput["platform"])
            }
            className={`${INPUT_CLASS} text-sm`}
          >
            <option value="ALL">All platforms</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SHOPEE">Shopee</option>
            <option value="OTHER">Other</option>
          </select>

          {snapshot && (
            <p className="text-xs text-slate-600">
              Period:{" "}
              <span className="font-medium text-slate-900">
                {periodLabel}
              </span>
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}
        >
          Loading finance data...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/70 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {snapshot && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={`${PANEL_CLASS} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Report statistics
                </p>
                <p className="text-xs text-slate-500">
                  Snapshot for {periodLabel.toLowerCase()} across all channels.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                {formatCurrency(snapshot.totalSales)} sales
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                {
                  label: "Total Sales",
                  value: snapshot.totalSales,
                  accent: "text-emerald-600",
                },
                {
                  label: "Gross Profit",
                  value: snapshot.grossProfit,
                  accent: "text-slate-900",
                },
                {
                  label: "Cash In",
                  value: snapshot.cashIn,
                  accent: "text-emerald-600",
                },
                {
                  label: "Cash Out",
                  value: snapshot.cashOut,
                  accent: "text-amber-600",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {item.label}
                  </div>
                  <div className={`mt-1 text-lg font-semibold ${item.accent}`}>
                    {formatCurrency(item.value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Expenses
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(expenseTotal)}
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (expenseTotal / Math.max(snapshot.totalSales, 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Margin
                </div>
                <div className="mt-1 text-lg font-semibold text-emerald-600">
                  {formatPercent(snapshot.profitMarginPercent)}
                </div>
                <div className="mt-2 h-2 rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.min(
                        100,
                        snapshot.profitMarginPercent,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Net Change
                </div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    snapshot.balanceChange >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatCurrency(snapshot.balanceChange)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Compared to last period.
                </p>
              </div>
            </div>
          </div>

          <div className={`${PANEL_CLASS} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Expense split
                </p>
                <p className="text-xs text-slate-500">
                  Breakdown of costs vs. profit.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                {formatCurrency(snapshot.netProfit)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="h-28 w-28 shrink-0 rounded-full"
                style={donutStyle}
                aria-hidden="true"
              />
              <div className="space-y-2 text-xs text-slate-600">
                {donutSegments.map((segment) => (
                  <div key={segment.label} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="flex-1">{segment.label}</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(segment.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {snapshot.netProfit >= 0
                ? "Healthy profit margin. Maintain inventory momentum and watch expenses."
                : "Profit is negative. Review pricing and cost of goods before next cycle."}
            </div>
          </div>
        </div>
      )}

      {/* Net profit "graph" */}
      {hasData && series.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className={`${PANEL_CLASS} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Report statistic
                </p>
                <p className="text-xs text-slate-500">
                  Net profit trend by day.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Updated {periodLabel}
              </span>
            </div>
            <div className="flex items-end gap-3 overflow-x-auto pb-2">
              {barSeries.map((point) => (
                <div
                  key={point.date}
                  className="flex min-w-12 flex-col items-center justify-end gap-2"
                >
                  <div
                    className={`w-8 rounded-t-lg ${
                      point.positive ? "bg-emerald-500/80" : "bg-rose-500/80"
                    }`}
                    style={{ height: point.height }}
                  />
                  <div className="text-[10px] text-slate-500">
                    {point.label.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${PANEL_CLASS} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Cash flow snapshot
                </p>
                <p className="text-xs text-slate-500">
                  Compare inflows vs. outflows.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                {formatCurrency(snapshot.balanceChange)}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Cash In",
                  value: snapshot.cashIn,
                  color: "bg-emerald-500",
                  text: "text-emerald-600",
                },
                {
                  label: "Cash Out",
                  value: snapshot.cashOut,
                  color: "bg-amber-500",
                  text: "text-amber-600",
                },
                {
                  label: "Shipping Cost",
                  value: snapshot.totalShippingCost,
                  color: "bg-slate-400",
                  text: "text-slate-600",
                },
                {
                  label: "Other Expenses",
                  value: snapshot.totalOtherExpenses,
                  color: "bg-rose-400",
                  text: "text-rose-600",
                },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{item.label}</span>
                    <span className={`font-semibold ${item.text}`}>
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{
                        width: `${Math.min(
                          100,
                          (item.value / cashFlowMax) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Track expenses daily to keep cash flow positive.
            </div>
          </div>
        </div>
      )}

      {/* Tables */}
      {snapshot && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Per-session */}
          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Per live session performance
            </div>
            {snapshot.topSessions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-600">
                Walang sales pa in this period.
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
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
                        className="border-t border-slate-200"
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-900">
                          {s.title}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-900">
                          {formatCurrency(s.revenue)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-emerald-600">
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
          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Per product performance
            </div>
            {snapshot.topProducts.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-600">
                Walang benta pa per item in this period.
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
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
                        className="border-t border-slate-200"
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-900">
                          <span className="font-mono text-[10px] text-slate-500">
                            {p.itemCode}
                          </span>{" "}
                          {p.name}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-900">
                          {p.qtySold}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-900">
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-emerald-600">
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
