// FinancePage.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FinanceSnapshot } from "../core/types";
import {
  getFinanceSnapshotForRange,
  getNetProfitSeries,
  type NetProfitPoint,
} from "../services/finance.service";
import { Page } from "../components/layout/Page";
import { MobileRail } from "../components/layout/MobileRail";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardHint,
  CardTitle,
} from "../components/ui/Card";
import {
  ChartCard,
  ChartContainer,
  ChartTooltip,
  type ChartTooltipEntry,
} from "../components/charts/ChartCard";
import { PH_COPY } from "../ui/copy/ph";
import {
  formatCompactLabel,
  formatCurrencyPHP,
  formatPercent,
} from "../utils/finance-formatters";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useFinanceTutorial } from "../hooks/useFinanceTutorial";
import {
  PeriodPlatformFilterCard,
  rangeLabel,
} from "../components/filters/PeriodPlatformFilterCard";
import { FinanceHelpButton } from "../components/finance/FinanceHelpButton";
import { FinanceTutorialOverlay } from "../components/finance/FinanceTutorialOverlay";
import type {
  PlatformOption,
  RangePreset,
} from "../components/filters/PeriodPlatformFilterCard";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeText(value: unknown) {
  const s =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return s || "(Unnamed)";
}

function getProductLabel(p: { name?: string; itemCode?: string }) {
  const n = safeText(p.name);
  if (n !== "(Unnamed)") return n;
  const code = safeText(p.itemCode);
  return code !== "(Unnamed)" ? code : "(Unnamed)";
}

const COLOR_PALETTE = {
  primary: "#059669",
  primaryDark: "#047857",
  accent: "#f97316",
  slate: "#0f172a",
  grid: "#e2e8f0",
  donut: {
    goods: "#047857",
    shipping: "#0ea5e9",
    other: "#f59e0b",
    profit: "#22c55e",
  },
  cashFlow: {
    in: "#059669",
    out: "#ef4444",
    shipping: "#0ea5e9",
    other: "#f59e0b",
  },
} as const;

export function FinancePage() {
  const [preset, setPreset] = useState<RangePreset>("THIS_MONTH");
  const [fromInput, setFromInput] = useState(formatDateInput(startOfMonth()));
  const [toInput, setToInput] = useState(formatDateInput(endOfToday()));
  const [platform, setPlatform] = useState<PlatformOption>("ALL");

  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [netProfitSeries, setNetProfitSeries] = useState<NetProfitPoint[]>([]);
  const [profitMetric, setProfitMetric] = useState<
    "profit" | "revenue" | "margin"
  >("profit");

  const tutorial = useFinanceTutorial();

  const isCompact = useMediaQuery("(max-width: 640px)");
  const periodLabel = useMemo(() => rangeLabel(preset), [preset]);

  const computeRange = useCallback((): { from: string; to: string } => {
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
  }, [preset, fromInput, toInput]);

  useEffect(() => {
    const { from, to } = computeRange();

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const params = { from, to, platform };
        const [snap, series] = await Promise.all([
          getFinanceSnapshotForRange(params),
          getNetProfitSeries(params),
        ]);

        setSnapshot({ ...snap, periodLabel });
        setNetProfitSeries(series);
      } catch (e: unknown) {
        console.error(e);
        setError(PH_COPY.common.errorFinance);
      } finally {
        setLoading(false);
      }
    })();
  }, [platform, periodLabel, computeRange]);

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

  const axisTickStyle = {
    fill: "#64748b",
    fontSize: isCompact ? 10 : 11,
  } as const;

  const axisProps = {
    axisLine: false,
    tickLine: false,
    tickMargin: isCompact ? 8 : 6,
  } as const;

  const axisLabelLineHeight = isCompact ? 10 : 12;
  const axisLabelMaxChars = isCompact ? 12 : 18;

  type CategoryTickPayload = { value?: unknown };
  type CategoryTickProps = {
    x?: number;
    y?: number;
    payload?: CategoryTickPayload;
  };

  const renderCategoryTick = ({ x = 0, y = 0, payload }: CategoryTickProps) => {
    if (!payload) return null;
    const label = formatCompactLabel(payload.value, axisLabelMaxChars, 2);
    const lines = label.split("\n");

    return (
      <text
        x={x}
        y={y}
        fill={axisTickStyle.fill}
        fontSize={axisTickStyle.fontSize}
        textAnchor="end"
        dominantBaseline="middle"
      >
        {lines.map((line, index) => (
          <tspan
            key={`tick-${index}-${line}`}
            x={x}
            dy={index === 0 ? 0 : axisLabelLineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  const renderScrollableChart = (
    content: ReactNode,
    height: number,
    viewportHeight: number,
    shouldScroll: boolean
  ) => {
    const chart = (
      <ChartContainer height={height}>{content}</ChartContainer>
    );
    if (!shouldScroll) return chart;
    return (
      <div className="overflow-y-auto" style={{ maxHeight: viewportHeight }}>
        {chart}
      </div>
    );
  };

  const hasData =
    snapshot &&
    (snapshot.totalSales > 0 || snapshot.cashIn > 0 || snapshot.cashOut > 0);

  const expenseTotal = useMemo(() => {
    if (!snapshot) return 0;
    return (
      snapshot.totalCostOfGoods +
      snapshot.totalShippingCost +
      snapshot.totalOtherExpenses
    );
  }, [snapshot]);

  const donutSegments = useMemo(() => {
    if (!snapshot) return [];
    const total = Math.max(
      snapshot.totalCostOfGoods +
        snapshot.totalShippingCost +
        snapshot.totalOtherExpenses +
        Math.max(snapshot.netProfit, 0),
      1
    );

    const segments = [
      {
        label: "Cost of Goods",
        value: snapshot.totalCostOfGoods,
        color: COLOR_PALETTE.donut.goods,
      },
      {
        label: "Shipping",
        value: snapshot.totalShippingCost,
        color: COLOR_PALETTE.donut.shipping,
      },
      {
        label: "Other",
        value: snapshot.totalOtherExpenses,
        color: COLOR_PALETTE.donut.other,
      },
      {
        label: "Net Profit",
        value: Math.max(snapshot.netProfit, 0),
        color: COLOR_PALETTE.donut.profit,
      },
    ];

    return segments.map((segment) => ({
      ...segment,
      percent: (segment.value / total) * 100,
    }));
  }, [snapshot]);

  const donutHasData = donutSegments.some((segment) => segment.percent > 0);

  const heroStats = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        key: "sales",
        label: "Total Sales",
        value: snapshot.totalSales,
        accent: "text-emerald-700",
        subLabel: PH_COPY.finance.heroStats.totalRevenue,
        glow: "from-emerald-50/80 via-white to-white",
        chip: "bg-emerald-600/10 text-emerald-700 border-emerald-200/70",
      },
      {
        key: "gross",
        label: "Gross Profit",
        value: snapshot.grossProfit,
        accent: "text-slate-900",
        subLabel: PH_COPY.finance.heroStats.grossProfit,
        glow: "from-slate-50/80 via-white to-white",
        chip: "bg-slate-900/5 text-slate-700 border-slate-200/70",
      },
      {
        key: "net",
        label: "Net Profit",
        value: snapshot.netProfit,
        accent: snapshot.netProfit >= 0 ? "text-emerald-700" : "text-rose-700",
        subLabel: `${formatPercent(snapshot.profitMarginPercent)} margin`,
        glow:
          snapshot.netProfit >= 0
            ? "from-emerald-50/80 via-white to-white"
            : "from-rose-50/80 via-white to-white",
        chip:
          snapshot.netProfit >= 0
            ? "bg-emerald-600/10 text-emerald-700 border-emerald-200/70"
            : "bg-rose-600/10 text-rose-700 border-rose-200/70",
      },
      {
        key: "out",
        label: "Cash Out",
        value: snapshot.cashOut,
        accent: "text-rose-700",
        subLabel: PH_COPY.finance.heroStats.cashOut,
        glow: "from-rose-50/80 via-white to-white",
        chip: "bg-rose-600/10 text-rose-700 border-rose-200/70",
      },
    ];
  }, [snapshot]);

  // Normalize product labels + remove junk rows that cause unreadable axes
  const analyzedProducts = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.topProducts
      .map((product) => {
        const name = getProductLabel(product);
        const revenue = Number(product.revenue ?? 0);
        const profit = Number(product.profit ?? 0);
        const qtySold = Number(product.qtySold ?? 0);

        return {
          ...product,
          name,
          revenue,
          profit,
          qtySold,
          marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
        };
      })
      .filter((p) => {
        const hasAnyValue =
          Math.abs(p.revenue) > 0 ||
          Math.abs(p.profit) > 0 ||
          Math.abs(p.qtySold) > 0;
        const hasName = p.name !== "(Unnamed)";
        return hasAnyValue && hasName;
      });
  }, [snapshot]);

  const heroBarTrend = useMemo(
    () => [...analyzedProducts].sort((a, b) => b.revenue - a.revenue),
    [analyzedProducts]
  );

  const profitSortedProducts = useMemo(
    () => [...analyzedProducts].sort((a, b) => b.profit - a.profit),
    [analyzedProducts]
  );

  const marginSortedProducts = useMemo(
    () =>
      [...analyzedProducts].sort((a, b) => b.marginPercent - a.marginPercent),
    [analyzedProducts]
  );

  const profitMetricChartData = useMemo(() => {
    return profitSortedProducts.map((product) => ({
      name: product.name,
      profit: product.profit,
      revenue: product.revenue,
      margin: product.marginPercent,
      value:
        profitMetric === "profit"
          ? product.profit
          : profitMetric === "revenue"
          ? product.revenue
          : product.marginPercent,
    }));
  }, [profitMetric, profitSortedProducts]);

  const baseProfitChartHeight = isCompact ? 220 : 260;
  const profitChartHeight = Math.min(
    baseProfitChartHeight + profitMetricChartData.length * 32,
    1600
  );
  const profitChartViewportHeight = Math.min(
    profitChartHeight,
    isCompact ? 360 : 520
  );
  const shouldScrollProfitChart = profitChartHeight > profitChartViewportHeight;
  const profitChartContent = profitMetricChartData.length ? (
    <BarChart
      layout="vertical"
      data={profitMetricChartData}
      margin={{
        top: 12,
        bottom: 18,
        right: isCompact ? 70 : 150,
        left: 10,
      }}
    >
      <CartesianGrid
        stroke={COLOR_PALETTE.grid}
        strokeDasharray="3 3"
        vertical={false}
      />
      <XAxis
        type="number"
        {...axisProps}
        domain={
          profitMetric === "margin" ? [0, 100] : [0, "dataMax"]
        }
        tickFormatter={(value) =>
          profitMetric === "margin"
            ? formatPercent(Number(value))
            : formatCurrencyPHP(Number(value))
        }
        tick={axisTickStyle}
      />
      <YAxis
        type="category"
        dataKey="name"
        {...axisProps}
        width={isCompact ? 128 : 160}
        tick={renderCategoryTick}
      />
      <Tooltip
        content={
          <ChartTooltip
            valueFormatter={(v) => metricValueFormatter(v)}
            labelFormatter={(label) => safeText(label)}
          />
        }
      />
      <Bar
        dataKey="value"
        fill={COLOR_PALETTE.primary}
        radius={[6, 6, 6, 6]}
      >
        {!isCompact ? (
          <LabelList
            dataKey="value"
            position="right"
            offset={12}
            style={{ fontSize: 10, fill: "#475569" }}
            formatter={(value: unknown) => {
              const numeric = Number(value ?? 0);
              const threshold = profitMetric === "margin" ? 0.2 : 0.5;
              return Math.abs(numeric) >= threshold
                ? metricValueFormatter(numeric)
                : undefined;
            }}
          />
        ) : null}
      </Bar>
    </BarChart>
    ) : (
      <div className="flex h-full items-center justify-center text-xs text-slate-500">
        {PH_COPY.finance.noProfitProducts}
      </div>
    );

  const topItemsChartHeight = useMemo(() => {
    const rows = heroBarTrend.length || 1;
    const rowH = isCompact ? 34 : 32;
    const minChart = isCompact ? 240 : 260;
    const rawHeight = rows * rowH + 72;
    return Math.min(Math.max(rawHeight, minChart), 1600);
  }, [heroBarTrend.length, isCompact]);

  const topItemsViewportHeight = Math.min(
    topItemsChartHeight,
    isCompact ? 360 : 520
  );
  const topItemsChartContent = heroBarTrend.length ? (
    <BarChart
      layout="vertical"
      data={heroBarTrend}
      margin={{
        top: 10,
        right: isCompact ? 40 : 72,
        left: 10,
        bottom: 10,
      }}
    >
      <CartesianGrid
        stroke={COLOR_PALETTE.grid}
        strokeDasharray="3 3"
        vertical={false}
      />
      <XAxis
        type="number"
        {...axisProps}
        tickFormatter={(value) =>
          formatCurrencyPHP(value as number)
        }
        tick={axisTickStyle}
      />
      <YAxis
        type="category"
        dataKey="name"
        {...axisProps}
        width={isCompact ? 128 : 160}
        tick={renderCategoryTick}
      />
      <Tooltip
        content={
          <ChartTooltip
            valueFormatter={(v) => formatCurrencyPHP(v)}
            labelFormatter={(label) => safeText(label)}
          />
        }
      />
      <Bar
        dataKey="revenue"
        fill={COLOR_PALETTE.primary}
        radius={[8, 8, 8, 8]}
      >
        <LabelList
          dataKey="revenue"
          position="right"
          style={{
            fontSize: isCompact ? 9 : 10,
            fill: COLOR_PALETTE.primaryDark,
          }}
          formatter={(value: unknown) => {
            const numericValue = Number(value ?? 0);
            return Math.abs(numericValue) >= 0.5
              ? formatCurrencyPHP(numericValue)
              : undefined;
          }}
        />
      </Bar>
    </BarChart>
  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
      {PH_COPY.finance.noRevenue}
                    </div>
  );
  const shouldScrollTopItems = topItemsChartHeight > topItemsViewportHeight;

  const marginChartData = marginSortedProducts;

  const averageMargin = useMemo(() => {
    if (!marginChartData.length) return 0;
    const total = marginChartData.reduce((sum, p) => sum + p.marginPercent, 0);
    return total / marginChartData.length;
  }, [marginChartData]);

  const paretoData = useMemo(() => {
    const ranking = profitSortedProducts;
    const totalProfit = ranking.reduce((sum, p) => sum + p.profit, 0);
    let cumulative = 0;
    return ranking.map((p) => {
      cumulative += p.profit;
      return {
        name: p.name,
        profit: p.profit,
        cumulative: totalProfit > 0 ? (cumulative / totalProfit) * 100 : 0,
      };
    });
  }, [profitSortedProducts]);

  const cashFlowData = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        label: "Cash In",
        value: snapshot.cashIn,
        color: COLOR_PALETTE.cashFlow.in,
      },
      {
        label: "Cash Out",
        value: snapshot.cashOut,
        color: COLOR_PALETTE.cashFlow.out,
      },
      {
        label: "Shipping",
        value: snapshot.totalShippingCost,
        color: COLOR_PALETTE.cashFlow.shipping,
      },
      {
        label: "Other",
        value: snapshot.totalOtherExpenses,
        color: COLOR_PALETTE.cashFlow.other,
      },
    ];
  }, [snapshot]);

  const reportStats = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        label: "Total Sales",
        value: snapshot.totalSales,
        accent: "text-emerald-700",
      },
      {
        label: "Gross Profit",
        value: snapshot.grossProfit,
        accent: "text-slate-900",
      },
      { label: "Cash In", value: snapshot.cashIn, accent: "text-emerald-700" },
      { label: "Cash Out", value: snapshot.cashOut, accent: "text-rose-700" },
    ];
  }, [snapshot]);

  const profitMetricOptions = [
    { id: "profit", label: "Profit" },
    { id: "revenue", label: "Revenue" },
    { id: "margin", label: "Margin %" },
  ] as const;

  const metricValueFormatter =
    profitMetric === "margin"
      ? (value: number) => formatPercent(value)
      : (value: number) => formatCurrencyPHP(value);

  const trendHeight = isCompact ? 220 : 320;

  const marginChartHeight = useMemo(() => {
    const rows = marginChartData.length || 1;
    const rowH = isCompact ? 34 : 32;
    return clamp(
      rows * rowH + 78,
      isCompact ? 240 : 240,
      isCompact ? 400 : 400
    );
  }, [marginChartData.length, isCompact]);

  const marginChartViewportHeight = Math.min(
    marginChartHeight,
    isCompact ? 360 : 520
  );
  const shouldScrollMarginChart = marginChartHeight > marginChartViewportHeight;

  const marginChartContent = marginChartData.length ? (
    <BarChart
      layout="vertical"
      data={marginChartData}
      margin={{ top: 12, right: 26, left: 10, bottom: 10 }}
    >
      <CartesianGrid
        stroke={COLOR_PALETTE.grid}
        strokeDasharray="3 3"
        vertical={false}
      />
      <XAxis
        type="number"
        {...axisProps}
        domain={[0, 100]}
        tickFormatter={(value) => formatPercent(Number(value))}
        tick={axisTickStyle}
      />
      <YAxis
        type="category"
        dataKey="name"
        {...axisProps}
        width={isCompact ? 128 : 160}
        tick={renderCategoryTick}
      />
      <Tooltip
        content={
          <ChartTooltip
            valueFormatter={(v) => formatPercent(v)}
            labelFormatter={(label) => safeText(label)}
          />
        }
      />
      <ReferenceLine
        x={averageMargin}
        stroke="#f59e0b"
        strokeDasharray="3 3"
        label={
          isCompact
            ? undefined
            : {
                value: `Avg ${formatPercent(averageMargin)}`,
                position: "top",
                fill: "#f59e0b",
                fontSize: 10,
              }
        }
      />
      <Bar
        dataKey="marginPercent"
        fill={COLOR_PALETTE.primary}
        radius={[8, 8, 8, 8]}
      >
        <LabelList
          dataKey="marginPercent"
          position="right"
          style={{
            fontSize: isCompact ? 9 : 10,
            fill: "#0f766e",
            fontWeight: 700,
          }}
          formatter={(value: unknown) => {
            const numeric = Number(value ?? 0);
            return Math.abs(numeric) >= 0.1 ? formatPercent(numeric) : undefined;
          }}
        />
      </Bar>
    </BarChart>
  ) : (
    <div className="flex h-full items-center justify-center text-xs text-slate-500">
      {PH_COPY.finance.noMarginData}
    </div>
  );

  const paretoHeight = useMemo(() => {
    const rows = paretoData.length || 1;
    const rowH = isCompact ? 34 : 32;
    return clamp(
      rows * rowH + 92,
      isCompact ? 260 : 260,
      isCompact ? 440 : 440
    );
  }, [paretoData.length, isCompact]);

  const paretoViewportHeight = Math.min(
    paretoHeight,
    isCompact ? 360 : 520
  );
  const shouldScrollParetoChart = paretoHeight > paretoViewportHeight;
  const legendVisiblePareto = !isCompact;

  const paretoChartContent = paretoData.length ? (
    <ComposedChart
      layout="vertical"
      data={paretoData}
      margin={{
        top: 22,
        right: isCompact ? 70 : 126,
        left: 10,
        bottom: 16,
      }}
    >
      <CartesianGrid
        stroke={COLOR_PALETTE.grid}
        strokeDasharray="3 3"
        vertical={false}
      />

      <XAxis
        xAxisId="profit"
        type="number"
        {...axisProps}
        tickFormatter={(value) => formatCurrencyPHP(value as number)}
        tick={axisTickStyle}
      />

      <XAxis
        xAxisId="cum"
        type="number"
        orientation="top"
        {...axisProps}
        domain={[0, 100]}
        tickFormatter={(value) => formatPercent(Number(value))}
        tick={{
          ...axisTickStyle,
          fontSize: isCompact ? 9 : 10,
        }}
      />

      <YAxis
        type="category"
        dataKey="name"
        {...axisProps}
        width={isCompact ? 128 : 160}
        tick={renderCategoryTick}
      />

      <Tooltip
        content={
          <ChartTooltip
            valueFormatter={(value: number, entry: ChartTooltipEntry) =>
              entry?.dataKey === "cumulative"
                ? formatPercent(value)
                : formatCurrencyPHP(value)
            }
            labelFormatter={(label) => safeText(label)}
          />
        }
      />

      {legendVisiblePareto && (
        <Legend wrapperStyle={{ fontSize: 11, color: "#475569" }} iconSize={8} />
      )}

      <Bar
        xAxisId="profit"
        dataKey="profit"
        fill={COLOR_PALETTE.primaryDark}
        radius={[8, 8, 8, 8]}
        name="profit"
      >
        <LabelList
          dataKey="profit"
          position="right"
          offset={isCompact ? 8 : 18}
          style={{
            fontSize: isCompact ? 9 : 10,
            fill: "#0f766e",
            fontWeight: 700,
          }}
          formatter={(value: unknown) => {
            const numeric = Number(value ?? 0);
            return Math.abs(numeric) >= 0.5 ? formatCurrencyPHP(numeric) : undefined;
          }}
        />
      </Bar>

      <Line
        xAxisId="cum"
        dataKey="cumulative"
        stroke={COLOR_PALETTE.accent}
        strokeWidth={2.25}
        dot={{ r: 3 }}
        name="cumulative"
      />
    </ComposedChart>
  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      {PH_COPY.finance.waitingPareto}
                    </div>
  );

  const pieHeight = isCompact ? 220 : 260;
  const cashFlowHeight = isCompact ? 210 : 240;

  const surface =
    "border border-slate-200/70 bg-white shadow-sm shadow-slate-900/5";
  const sectionWrap = "space-y-4";
  const railCardClass = (base: string) =>
    cn("min-w-0", isCompact ? "w-full" : `snap-start flex-none ${base}`);

  const platformLabel =
    platform === "ALL"
      ? "All platforms"
      : typeof platform === "string"
      ? platform
      : "Platform";

  const sortedSessions = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.topSessions].sort((a, b) => b.revenue - a.revenue);
  }, [snapshot]);

  const topProductsTable = useMemo(() => {
    return [...analyzedProducts].sort((a, b) => b.revenue - a.revenue);
  }, [analyzedProducts]);

  return (
    <Page className="w-full max-w-none min-w-0 bg-slate-50">
      <div className="mx-auto w-full max-w-[1400px] space-y-5 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
        {/* Header strip (clean + eye-catching, no clutter) */}
        <div
          className={cn(
            surface,
            "rounded-3xl p-4 sm:p-5",
            "bg-linear-to-br from-white via-white to-emerald-50/50"
          )}
          data-tour="finance-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                Finance
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
                Kita, gastos, at tubo per period
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {PH_COPY.finance.pageDescription}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                {periodLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                {platformLabel}
              </span>
              {snapshot ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    snapshot.netProfit >= 0
                      ? "border-emerald-200 bg-emerald-600/10 text-emerald-800"
                      : "border-rose-200 bg-rose-600/10 text-rose-800"
                  )}
                >
                  Net: {formatCurrencyPHP(snapshot.netProfit)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {loading && (
          <Card className={cn(surface, "rounded-3xl")}>
            <CardContent className="py-3 text-xs text-slate-600">
              {PH_COPY.common.loadingFinance}
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {snapshot ? (
          <div className={sectionWrap}>
            {/* Hero stats */}
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
              data-tour="finance-hero-stats"
            >
              {heroStats.map((stat) => (
                <ChartCard
                  key={stat.key}
                  title={stat.label}
                  compact={isCompact}
                  className={cn(
                    surface,
                    "rounded-3xl overflow-hidden",
                    "relative min-h-[120px] min-w-0"
                  )}
                  bodyClassName="relative"
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 bg-linear-to-br opacity-100",
                      stat.glow
                    )}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          stat.chip
                        )}
                      >
                        {stat.label}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "mt-3 font-semibold tracking-tight",
                        isCompact ? "text-xl" : "text-2xl",
                        stat.accent
                      )}
                    >
                      {formatCurrencyPHP(stat.value)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {stat.subLabel}
                    </p>
                  </div>
                </ChartCard>
              ))}
            </div>

            {/* Trend + Top items */}
            <MobileRail innerClassName="lg:grid lg:grid-cols-12 lg:gap-4">
              <ChartCard
                className={cn(
                  surface,
                  "rounded-3xl",
                  railCardClass("min-w-[320px]"),
                  "lg:col-span-8"
                )}
                title="Daily profit trend"
                subtitle={PH_COPY.finance.trendSubtitle}
                badge={`${netProfitSeries.length} points`}
                compact={isCompact}
                data-tour="finance-trend"
              >
                <ChartContainer height={trendHeight}>
                  {netProfitSeries.length ? (
                    <ComposedChart data={netProfitSeries}>
                      <defs>
                        <linearGradient
                          id="finance-hero-area"
                          x1="0%"
                          y1="0%"
                          x2="0%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stopColor={COLOR_PALETTE.primary}
                            stopOpacity="0.30"
                          />
                          <stop
                            offset="100%"
                            stopColor={COLOR_PALETTE.primaryDark}
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke={COLOR_PALETTE.grid}
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="date"
                        {...axisProps}
                        tickFormatter={(value) =>
                          new Date(value as string).toLocaleDateString(
                            "en-PH",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )
                        }
                        tick={axisTickStyle}
                      />

                      <YAxis
                        {...axisProps}
                        tickFormatter={(value) =>
                          formatCurrencyPHP(value as number)
                        }
                        tick={axisTickStyle}
                      />

                      <Tooltip
                        content={
                          <ChartTooltip
                            valueFormatter={(v) => formatCurrencyPHP(v)}
                            labelFormatter={(label) =>
                              new Date(String(label)).toLocaleDateString(
                                "en-PH",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            }
                          />
                        }
                      />

                      <Area
                        key="finance-trend-area"
                        dataKey="netProfit"
                        stroke="none"
                        fill="url(#finance-hero-area)"
                        type="monotone"
                      />

                      <Line
                        key="finance-trend-line"
                        dataKey="netProfit"
                        stroke={COLOR_PALETTE.primaryDark}
                        strokeWidth={2.25}
                        dot={false}
                      />
                    </ComposedChart>
                  ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        {PH_COPY.finance.waitingTrend}
                      </div>
                    )}
                </ChartContainer>
              </ChartCard>

              <ChartCard
                className={cn(
                  surface,
                  "rounded-3xl",
                  railCardClass("min-w-[280px]"),
                  "lg:col-span-4"
                )}
                title="Top items this period"
                subtitle={PH_COPY.finance.topItemsSubtitle}
                compact={isCompact}
                bodyClassName="overflow-visible"
                data-tour="finance-top-items"
              >
                {renderScrollableChart(
                  topItemsChartContent,
                  topItemsChartHeight,
                  topItemsViewportHeight,
                  shouldScrollTopItems
                )}
              </ChartCard>
            </MobileRail>
          </div>
        ) : null}

        <div data-tour="finance-filters">
          <PeriodPlatformFilterCard
            preset={preset}
            onPresetChange={handlePresetChange}
            dateFrom={fromInput}
            onDateFromChange={(value) => {
              setFromInput(value);
              setPreset("CUSTOM");
            }}
            dateTo={toInput}
            onDateToChange={(value) => {
              setToInput(value);
              setPreset("CUSTOM");
            }}
            platform={platform}
            onPlatformChange={(value) => setPlatform(value)}
            periodLabel={periodLabel}
            showPeriodLabel={Boolean(snapshot)}
          />
        </div>

        {snapshot ? (
          <>
            <MobileRail innerClassName="lg:grid lg:grid-cols-12 lg:gap-4">
              <ChartCard
                className={cn(
                  surface,
                  "rounded-3xl",
                  railCardClass("min-w-[320px]"),
                  "lg:col-span-8"
                )}
                title="Report statistics"
                subtitle={`Snapshot for ${periodLabel.toLowerCase()} across all channels.`}
                badge={`${formatCurrencyPHP(snapshot.totalSales)} sales`}
                compact={isCompact}
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {reportStats.map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "flex flex-col rounded-3xl border border-slate-200/70 bg-white p-3",
                        "shadow-sm shadow-slate-900/5"
                      )}
                    >
                      <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                        {stat.label}
                      </span>
                      <span
                        className={cn(
                          "mt-2 font-semibold tracking-tight",
                          isCompact ? "text-lg" : "text-2xl",
                          stat.accent
                        )}
                      >
                        {formatCurrencyPHP(stat.value)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className={cn(surface, "rounded-3xl p-4")}>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                      Expenses
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {formatCurrencyPHP(expenseTotal)}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-rose-100">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (expenseTotal / Math.max(snapshot.totalSales, 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {PH_COPY.finance.heroStats.shareOfSales}
                    </p>
                  </div>

                  <div className={cn(surface, "rounded-3xl p-4")}>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                      Margin
                    </div>
                    <div className="mt-1 text-xl font-semibold text-emerald-700">
                      {formatPercent(snapshot.profitMarginPercent)}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            snapshot.profitMarginPercent
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {PH_COPY.finance.heroStats.profitability}
                    </p>
                  </div>

                  <div className={cn(surface, "rounded-3xl p-4")}>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                      Net Change
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-xl font-semibold",
                        snapshot.balanceChange >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      )}
                    >
                      {formatCurrencyPHP(snapshot.balanceChange)}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {PH_COPY.finance.heroStats.comparedToLastPeriod}
                    </p>
                  </div>
                </div>
              </ChartCard>

              <ChartCard
                className={cn(
                  surface,
                  "rounded-3xl",
                  railCardClass("min-w-[280px]"),
                  "lg:col-span-4"
                )}
                title="Expense split"
                subtitle="Costs vs. profit"
                badge={formatCurrencyPHP(snapshot.netProfit)}
                compact={isCompact}
              >
                <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
                  <ChartContainer height={pieHeight}>
                    {donutHasData ? (
                      <PieChart>
                        <Tooltip
                          content={
                            <ChartTooltip
                              valueFormatter={(v) => formatCurrencyPHP(v)}
                            />
                          }
                        />
                        <Pie
                          data={donutSegments}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={isCompact ? 56 : 64}
                          outerRadius={isCompact ? 84 : 92}
                          paddingAngle={2}
                          stroke="transparent"
                        >
                          {donutSegments.map((segment) => (
                            <Cell key={segment.label} fill={segment.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        {PH_COPY.finance.noExpenseData}
                      </div>
                    )}
                  </ChartContainer>

                  {/* Legend list (more readable than raw donut only) */}
                  <div className="space-y-2">
                    {donutSegments.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate text-xs font-medium text-slate-700">
                            {s.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-slate-900">
                            {formatCurrencyPHP(s.value)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatPercent(s.percent)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
            </MobileRail>

            {/* Profit analysis */}
            <div className="space-y-3">
              <div className={cn(surface, "rounded-3xl p-4 sm:p-5")}>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Profit analysis
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  Understand what drives your margins
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {PH_COPY.finance.profitAnalysisDescription}
                </p>
              </div>

              <MobileRail innerClassName="lg:grid lg:grid-cols-12 lg:gap-4">
                <ChartCard
                  className={cn(
                    surface,
                    "rounded-3xl",
                    railCardClass("min-w-[320px]"),
                    "lg:col-span-4"
                  )}
                  title="Profit by product"
                  compact={isCompact}
                  bodyClassName="overflow-visible"
                  data-tour="finance-profit"
                >
                  {/* Segmented control look */}
                  <div className="mb-3 inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    {profitMetricOptions.map((option) => (
                      <Button
                        key={option.id}
                        size="sm"
                        variant={
                          profitMetric === option.id ? "primary" : "secondary"
                        }
                        onClick={() => setProfitMetric(option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>

                  {renderScrollableChart(
                    profitChartContent,
                    profitChartHeight,
                    profitChartViewportHeight,
                    shouldScrollProfitChart
                  )}
                </ChartCard>

                <ChartCard
                  className={cn(
                    surface,
                    "rounded-3xl",
                    railCardClass("min-w-[320px]"),
                    "lg:col-span-4"
                  )}
                  title="Margin % by product"
                  subtitle="Top margins"
                  compact={isCompact}
                  data-tour="finance-margin"
                >
                    {renderScrollableChart(
                      marginChartContent,
                      marginChartHeight,
                      marginChartViewportHeight,
                      shouldScrollMarginChart
                    )}
                  </ChartCard>

                <ChartCard
                  className={cn(
                    surface,
                    "rounded-3xl",
                    railCardClass("min-w-[320px]"),
                    "lg:col-span-4"
                  )}
                  title="Contribution to total profit"
                  compact={isCompact}
                  bodyClassName="overflow-visible"
                  data-tour="finance-pareto"
                >
                  {renderScrollableChart(
                    paretoChartContent,
                    paretoHeight,
                    paretoViewportHeight,
                    shouldScrollParetoChart
                  )}
                </ChartCard>
              </MobileRail>
            </div>

            {/* Cash flow */}
            {hasData && cashFlowData.length ? (
              <ChartCard
                title="Cash flow snapshot"
                subtitle={PH_COPY.finance.cashFlowSubtitle}
                badge={formatCurrencyPHP(snapshot.balanceChange)}
                compact={isCompact}
                className={cn(surface, "rounded-3xl")}
                data-tour="finance-cash-flow"
              >
                <ChartContainer height={cashFlowHeight}>
                  <BarChart
                    layout="vertical"
                    data={cashFlowData}
                    margin={{ left: 10, right: 56, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid
                      stroke={COLOR_PALETTE.grid}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      type="number"
                      {...axisProps}
                      tickFormatter={(value) =>
                        formatCurrencyPHP(value as number)
                      }
                      tick={axisTickStyle}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      {...axisProps}
                      tick={renderCategoryTick}
                      width={isCompact ? 120 : 150}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          valueFormatter={(v) => formatCurrencyPHP(v)}
                          labelFormatter={(label) => safeText(label)}
                        />
                      }
                    />
                    <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                      {cashFlowData.map((item) => (
                        <Cell key={item.label} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            ) : null}

            {/* Tables */}
            <MobileRail
              innerClassName="lg:grid lg:grid-cols-2 lg:gap-4"
              data-tour="finance-tables"
            >
              <Card className={cn(surface, "rounded-3xl lg:col-span-1")}>
                <CardHeader className="items-start">
                  <CardTitle>Per live session performance</CardTitle>
                  <CardHint>Revenue and profit per session.</CardHint>
                </CardHeader>
                <CardContent className="p-0">
                  {sortedSessions.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-600">
                      Walang sales pa in this period.
                    </div>
                  ) : (
                    <div className="max-h-[280px] overflow-y-auto">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-2">Session</th>
                              <th className="px-4 py-2 text-right">Revenue</th>
                              <th className="px-4 py-2 text-right">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedSessions.map((sessionEntry) => (
                              <tr
                                key={sessionEntry.liveSessionId}
                                className="border-t border-slate-200 hover:bg-slate-50"
                              >
                                <td className="px-4 py-2 text-[11px] font-medium text-slate-900">
                                  {sessionEntry.title}
                                </td>
                                <td className="px-4 py-2 text-right text-[11px] text-slate-900">
                                  {formatCurrencyPHP(sessionEntry.revenue)}
                                </td>
                                <td className="px-4 py-2 text-right text-[11px] font-semibold text-emerald-700">
                                  {formatCurrencyPHP(sessionEntry.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(surface, "rounded-3xl lg:col-span-1")}>
                <CardHeader className="items-start">
                  <CardTitle>Per product performance</CardTitle>
                  <CardHint>Top items by revenue and profit.</CardHint>
                </CardHeader>
                <CardContent className="p-0">
                  {topProductsTable.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-600">
                      Walang benta pa per item in this period.
                    </div>
                  ) : (
                    <div className="max-h-[280px] overflow-y-auto">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-2">Item</th>
                              <th className="px-4 py-2 text-right">Qty</th>
                              <th className="px-4 py-2 text-right">Revenue</th>
                              <th className="px-4 py-2 text-right">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topProductsTable.map((product) => (
                              <tr
                                key={`${product.itemCode}-${product.name}`}
                                className="border-t border-slate-200 hover:bg-slate-50"
                              >
                                <td className="px-4 py-2 text-[11px] text-slate-900">
                                  <span className="mr-2 rounded-md bg-slate-900/5 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                                    {safeText(product.itemCode)}
                                  </span>
                                  <span className="font-medium">
                                    {product.name}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-[11px] text-slate-900">
                                  {product.qtySold}
                                </td>
                                <td className="px-4 py-2 text-right text-[11px] text-slate-900">
                                  {formatCurrencyPHP(product.revenue)}
                                </td>
                                <td className="px-4 py-2 text-right text-[11px] font-semibold text-emerald-700">
                                  {formatCurrencyPHP(product.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </MobileRail>
          </>
        ) : null}
      </div>
      <FinanceHelpButton onClick={tutorial.open} />
      <FinanceTutorialOverlay
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
