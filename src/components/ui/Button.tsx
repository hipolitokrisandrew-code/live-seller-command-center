import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "dangerSolid";
type ButtonSize = "md" | "sm" | "cta";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const BASE_CLASS =
  "inline-flex items-center justify-center rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:pointer-events-none disabled:opacity-50";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-emerald-500 text-slate-950 hover:bg-emerald-600",
  secondary:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  danger:
    "border border-rose-500/70 bg-transparent text-rose-700 hover:bg-rose-50",
  dangerSolid:
    "border border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "h-9 px-3 text-sm",
  sm: "h-8 px-2.5 text-xs",
  cta: "h-auto px-4 py-2 text-sm font-medium shadow-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

