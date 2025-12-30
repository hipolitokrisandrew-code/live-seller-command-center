import * as React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export type CardTitleProps = React.HTMLAttributes<HTMLParagraphElement>;

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <p className={cn("text-sm font-semibold text-slate-900", className)} {...props} />
  );
}

export type CardHintProps = React.HTMLAttributes<HTMLParagraphElement>;

export function CardHint({ className, ...props }: CardHintProps) {
  return (
    <p className={cn("text-xs text-slate-500", className)} {...props} />
  );
}

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={cn("px-4 py-3", className)} {...props} />;
}
