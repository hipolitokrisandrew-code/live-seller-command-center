import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type RangePreset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";
export type PlatformOption = "ALL" | "FACEBOOK" | "TIKTOK" | "SHOPEE" | "OTHER";

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

const RANGE_PRESETS: RangePreset[] = ["TODAY", "THIS_WEEK", "THIS_MONTH", "CUSTOM"];

export function rangeLabel(preset: RangePreset): string {
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

type PeriodPlatformFilterCardProps = {
  className?: string;
  preset: RangePreset;
  onPresetChange: (value: RangePreset) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  platform: PlatformOption;
  onPlatformChange: (value: PlatformOption) => void;
  periodLabel?: string;
  showPeriodLabel?: boolean;
  helperText?: ReactNode;
  onApply?: () => void;
  applyLabel?: string;
  dataTour?: string;
};

export function PeriodPlatformFilterCard({
  className,
  preset,
  onPresetChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  platform,
  onPlatformChange,
  periodLabel,
  showPeriodLabel = true,
  helperText,
  onApply,
  applyLabel,
  dataTour,
}: PeriodPlatformFilterCardProps) {
  return (
    <Card data-tour={dataTour} className={cn("w-full min-w-0", className)}>
      <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">Period</div>
          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.map((value) => {
              const isActive = value === preset;
              return (
                <Button
                  key={value}
                  size="sm"
                  variant="secondary"
                  onClick={() => onPresetChange(value)}
                  className={cn(
                    "rounded-full font-medium",
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "text-slate-700",
                  )}
                >
                  {rangeLabel(value)}
                </Button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  onDateFromChange(event.target.value);
                }}
                className={CONTROL_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  onDateToChange(event.target.value);
                }}
                className={CONTROL_CLASS}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">Platform</div>
          <select
            value={platform}
            onChange={(event) =>
              onPlatformChange(event.target.value as PlatformOption)
            }
            className={CONTROL_CLASS}
          >
            <option value="ALL">All platforms</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SHOPEE">Shopee</option>
            <option value="OTHER">Other</option>
          </select>

          {showPeriodLabel && periodLabel ? (
            <p className="text-xs text-slate-500">
              Period: <span className="font-medium text-slate-900">{periodLabel}</span>
            </p>
          ) : null}
          {helperText ? (
            <p className="text-xs text-slate-500">{helperText}</p>
          ) : null}
          {onApply ? (
            <Button
              variant="primary"
              onClick={onApply}
              className="w-full"
            >
              {applyLabel ?? "Apply"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
