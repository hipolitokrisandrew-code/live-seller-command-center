import * as React from "react";
import { ResponsiveContainer } from "recharts";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ChartCardProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  compact?: boolean;
  bodyClassName?: string;
};

export function ChartCard({
  title,
  subtitle,
  badge,
  compact,
  bodyClassName,
  className,
  children,
  ...props
}: ChartCardProps) {
  const headerPadding = compact ? "px-3 py-1.5" : "px-4 py-2";
  const bodyPaddingClass = compact ? "px-3 py-2" : "px-4 py-3";
  const titleClass = compact
    ? "text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400"
    : "text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400";
  const subtitleClass = compact
    ? "text-[11px] font-semibold text-slate-900"
    : "text-sm font-semibold text-slate-900";
  const badgeClass = compact
    ? "text-[10px] font-semibold text-slate-500"
    : "text-[11px] font-semibold text-slate-500";

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-slate-200 bg-white/90 shadow-sm min-w-0",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-2 border-b border-slate-100",
          headerPadding,
        )}
      >
        <div className="min-w-0">
          <p className={cn(titleClass, "whitespace-normal break-words")}>
            {title}
          </p>
          {subtitle ? (
            <p className={cn(subtitleClass, "mt-1 whitespace-normal break-words")}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? (
          <div className={cn(badgeClass, "shrink-0 whitespace-nowrap")}>{badge}</div>
        ) : null}
      </div>
      <div className={cn(bodyPaddingClass, bodyClassName)}>{children}</div>
    </div>
  );
}

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  height?: number;
};

export function ChartContainer({
  height = 260,
  className,
  children,
  ...props
}: ChartContainerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };

    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const ready = size.width > 0 && size.height > 0;

  return (
    <div
      ref={containerRef}
      className={cn("w-full min-h-0", className)}
      style={{ height, minHeight: height }}
      {...props}
    >
      {ready ? (
        <ResponsiveContainer width={size.width} height={size.height}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );
}

export type ChartTooltipEntry = {
  dataKey?: string | number;
  name?: string;
  color?: string;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  valueFormatter?: (value: number, entry: ChartTooltipEntry) => string;
  labelFormatter?: (label: string | number | undefined) => string | number;
};

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-600 shadow-lg">
      {label ? (
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      ) : null}
      <div className="mt-2 space-y-1">
        {payload.map((entry, index) => (
          <div
            key={`${entry.dataKey ?? entry.name}-${index}`}
            className="flex items-center justify-between gap-2 font-semibold text-slate-900"
          >
            <span className="flex items-center gap-2 text-[11px] text-slate-600">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color as string }}
              />
              {entry.name ?? entry.dataKey}
            </span>
            <span className="text-[12px]">
              {valueFormatter
                ? valueFormatter(Number(entry.value ?? 0), entry)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
