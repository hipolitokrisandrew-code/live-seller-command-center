import * as React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type PageProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Page wrapper for content inside MainLayout's `max-w-6xl px-6` container.
 * Uses negative margins so small screens can use `px-4` while keeping `px-6` on larger screens.
 */
export function Page({ className, ...props }: PageProps) {
  return <div className={cn("-mx-6 px-4 sm:px-6", className)} {...props} />;
}

