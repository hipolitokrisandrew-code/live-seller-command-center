import * as React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type PageProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Page wrapper for module content.
 * MainLayout now owns the global padding, so pages can be full width.
 */
export function Page({ className, ...props }: PageProps) {
  return <div className={cn("w-full", className)} {...props} />;
}
