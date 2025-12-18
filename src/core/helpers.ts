import type {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ShipmentStatus,
} from "./types";

export type StatusGroup =
  | OrderStatus
  | PaymentStatus
  | ShipmentStatus
  | PaymentMethod;

export function formatCurrency(
  value: number | null | undefined,
  currency = "₱"
): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `${currency}${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso?: string | null): string {
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

export type RangePreset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

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
