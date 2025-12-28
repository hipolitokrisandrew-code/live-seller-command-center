import { useEffect, useMemo, useState } from "react";
import {
  getDashboardSummary,
  type DashboardLowStockItem,
  type DashboardSessionTile,
  type DashboardSummary,
} from "../services/dashboard.service";
import { Page } from "../components/layout/Page";
import { DashboardHelpButton } from "../components/dashboard/DashboardHelpButton";
import { DashboardTutorialOverlay } from "../components/dashboard/DashboardTutorialOverlay";
import { useDashboardTutorial } from "../hooks/useDashboardTutorial";
import { ChartCard } from "../components/charts/ChartCard";
import {
  Card,
  CardContent,
} from "../components/ui/Card";
import { PeriodPlatformFilterCard, rangeLabel } from "../components/filters/PeriodPlatformFilterCard";
import type { PlatformOption, RangePreset } from "../components/filters/PeriodPlatformFilterCard";
import { PH_COPY } from "../ui/copy/ph";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function startOfWeek() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

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
  const tutorial = useDashboardTutorial();
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
  const [preset, setPreset] = useState<RangePreset>("CUSTOM");
  const [platform, setPlatform] = useState<PlatformOption>("ALL");
  const periodLabel = useMemo(() => rangeLabel(preset), [preset]);
  const [detailView, setDetailView] = useState<"pending" | "ship" | "low" | null>(
    null,
  );
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
          setError(PH_COPY.dashboard.errorLoading);
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

  function handlePresetChange(newPreset: RangePreset) {
    setPreset(newPreset);
    let from = startOfToday();
    const to = endOfToday();

    if (newPreset === "THIS_WEEK") {
      from = startOfWeek();
    } else if (newPreset === "THIS_MONTH") {
      from = startOfMonth();
    } else if (newPreset === "CUSTOM") {
      return;
    }

    setDateFrom(formatDateInput(from));
    setDateTo(formatDateInput(to));
  }

  function applyDateRange() {
    const from = dateFrom || dateTo || new Date().toISOString().slice(0, 10);
    const to = dateTo || dateFrom || new Date().toISOString().slice(0, 10);
    setAppliedRange({ from, to });
  }

  return (
    <Page className="w-full max-w-none min-w-0 px-3 py-4 sm:px-4 md:px-6 lg:px-8">
      <div className="space-y-4">
        {loading ? (
          <Card className="bg-slate-50">
            <CardContent className="py-3 text-xs text-slate-600">
              {PH_COPY.dashboard.loading}
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-rose-500/70 bg-rose-50">
            <CardContent className="py-3 text-xs text-rose-700">{error}</CardContent>
          </Card>
        ) : null}

        <PeriodPlatformFilterCard
          preset={preset}
          onPresetChange={handlePresetChange}
          dateFrom={dateFrom}
          onDateFromChange={(value) => {
            setDateFrom(value);
            setPreset("CUSTOM");
          }}
          dateTo={dateTo}
          onDateToChange={(value) => {
            setDateTo(value);
            setPreset("CUSTOM");
          }}
          platform={platform}
          onPlatformChange={(value) => setPlatform(value)}
          periodLabel={periodLabel}
          showPeriodLabel
          helperText={PH_COPY.dashboard.filterHelper}
          onApply={applyDateRange}
          dataTour="dashboard-range"
        />

        {summary ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          data-tour="dashboard-stats"
        >
          {[
            {
              id: "range",
              title: "Sales (range)",
              subtitle: summary.dateRangeLabel,
              value: formatCurrency(summary.rangeSales),
              detail: `${PH_COPY.dashboard.statsDetailRangeOrders} ${summary.rangeOrdersCount}`,
              accent: "text-emerald-600",
              onClick: () => setDetailView(null),
            },
            {
              id: "pending",
              title: "Pending payments",
              subtitle: "Not fully paid",
              value: summary.pendingPaymentsCount.toString(),
              detail: `${PH_COPY.dashboard.statsDetailPendingBalance} ${formatCurrency(
                summary.pendingPaymentsAmount,
              )}`,
              accent: "text-amber-600",
              onClick: () => setDetailView("pending"),
            },
            {
              id: "ship",
              title: "To ship",
              subtitle: "Paid, not shipped",
              value: summary.toShipCount.toString(),
              detail: PH_COPY.dashboard.statsDetailShip,
              accent: "text-sky-700",
              onClick: () => setDetailView("ship"),
            },
            {
              id: "low",
              title: "Low stock",
              subtitle: "Near zero",
              value: summary.lowStockCount.toString(),
              detail: PH_COPY.dashboard.statsDetailLow,
              accent: "text-rose-600",
              onClick: () => setDetailView("low"),
            },
          ].map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              className="w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              <ChartCard
                title={tile.title}
                subtitle={tile.subtitle}
                compact
                className="shadow-sm border border-transparent transition hover:border-slate-200 hover:shadow-lg"
                bodyClassName="space-y-2"
              >
                <div className="text-2xl font-semibold tabular-nums">
                  <span className={tile.accent}>{tile.value}</span>
                </div>
                <p className="text-[11px] text-slate-500">{tile.detail}</p>
              </ChartCard>
            </button>
          ))}
        </div>
        ) : null}

      {summary && detailView === "pending" ? (
        <ChartCard
          title="Pending payments"
          subtitle="Who still owes and for which orders."
          compact
          className="shadow-sm"
          bodyClassName="space-y-3"
        >
          <div className="text-xs text-slate-500">
            {summary.pendingOrders.length} order(s)
          </div>
          {summary.pendingOrders.length === 0 ? (
            <p className="text-sm text-slate-600">{PH_COPY.dashboard.noPendingOrders}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Items</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
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
                            <span className="text-[11px] text-slate-500">
                              {o.liveSessionTitle}
                            </span>
                          ) : null}
                          <span className="text-[11px] text-amber-700">
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
        </ChartCard>
      ) : null}

      {summary && detailView === "ship" ? (
        <ChartCard
          title="Orders to ship"
          subtitle="Paid but not yet shipped."
          compact
          className="shadow-sm"
          bodyClassName="space-y-3"
        >
          <div className="text-xs text-slate-500">
            {summary.toShipOrders.length} order(s)
          </div>
          {summary.toShipOrders.length === 0 ? (
            <p className="text-sm text-slate-600">{PH_COPY.dashboard.nothingToShip}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Items</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
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
                            <span className="text-[11px] text-slate-500">
                              {o.liveSessionTitle}
                            </span>
                          ) : null}
                          <span className="text-[11px] text-sky-700">{o.status}</span>
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
        </ChartCard>
      ) : null}

      {summary && detailView === "low" ? (
        <ChartCard
          title="Low stock items"
          subtitle="Click Inventory to restock."
          compact
          className="shadow-sm"
          bodyClassName="space-y-3"
        >
          <div className="text-xs text-slate-500">
            {summary.lowStockItems.length} item(s)
          </div>
          {summary.lowStockItems.length === 0 ? (
            <p className="text-sm text-slate-600">
              {PH_COPY.dashboard.noLowStockYet}
            </p>
          ) : (
            <LowStockTable items={summary.lowStockItems} />
          )}
        </ChartCard>
      ) : null}

      {summary ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Recent live sessions"
            subtitle="Based on paid orders per session."
            compact
            className="shadow-sm"
            bodyClassName="space-y-3"
            data-tour="dashboard-recent-sessions"
          >
            {recentSessions.length === 0 ? (
              <p className="text-sm text-slate-600">
                {PH_COPY.dashboard.noRecentSessions}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recentSessions.map((session) => (
                  <ChartCard
                    key={session.id}
                    title={session.title}
                    subtitle={session.startTime ? formatDateTime(session.startTime) : "No start time"}
                    badge={formatPlatform(session.platform)}
                    compact
                    className="shadow-sm"
                    bodyClassName="space-y-2"
                  >
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[11px] font-medium text-slate-600">
                          Revenue
                        </div>
                        <div className="font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(session.revenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-600">
                          Profit
                        </div>
                        <div
                          className={cn(
                            "font-semibold tabular-nums",
                            session.profit >= 0 ? "text-emerald-600" : "text-rose-600",
                          )}
                        >
                          {formatCurrency(session.profit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-medium text-slate-600">
                          Status
                        </div>
                        <div className="font-semibold text-slate-900">
                          {session.status}
                        </div>
                      </div>
                    </div>
                  </ChartCard>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Low stock items"
            subtitle="Auto-flagged by item threshold."
            compact
            className="shadow-sm"
            bodyClassName="space-y-3"
            data-tour="dashboard-low-stock"
          >
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-600">
                {PH_COPY.dashboard.lowStockHint}
              </p>
            ) : (
              <LowStockTable items={lowStockItems} />
            )}
          </ChartCard>
        </div>
      ) : null}

      {!loading && !summary && !error ? (
        <Card className="bg-slate-50">
          <CardContent className="py-3 text-xs text-slate-600">
            {PH_COPY.dashboard.noDataYet}
          </CardContent>
        </Card>
      ) : null}
      </div>
      <DashboardHelpButton onClick={tutorial.open} />
      <DashboardTutorialOverlay
        isOpen={tutorial.isOpen}
        steps={tutorial.steps}
        currentIndex={tutorial.currentStep}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onClose={tutorial.close}
        onSkip={tutorial.skip}
      />
    </Page>
  );
}
