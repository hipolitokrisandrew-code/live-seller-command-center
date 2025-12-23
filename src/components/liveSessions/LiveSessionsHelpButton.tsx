import type { ButtonHTMLAttributes } from "react";

type LiveSessionsHelpButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function LiveSessionsHelpButton({
  className,
  ...props
}: LiveSessionsHelpButtonProps) {
  return (
    <div className="fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6">
      <button
        type="button"
        className={[
          "group relative inline-flex h-12 w-12 items-center justify-center rounded-full",
          "bg-emerald-500 text-slate-950 shadow-lg transition hover:bg-emerald-600",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Live sessions help"
        {...props}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M9.09 9a3 3 0 1 1 5.82 1c-.74 1-1.91 1.5-2.41 2.5" />
          <circle cx="12" cy="17" r="1" />
        </svg>
        <span className="sr-only">Live sessions help</span>
        <span className="pointer-events-none absolute right-14 hidden rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-md group-hover:block">
          Live sessions help
        </span>
      </button>
    </div>
  );
}
