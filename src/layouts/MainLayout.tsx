// src/layouts/MainLayout.tsx
//
// Main application shell:
//  - Left sidebar navigation
//  - Top header
//  - Content area with <Outlet />
//  - Single dark theme (matches Finance / dark Settings UI).

import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAppSettings } from "../services/settings.service";

type NavItem = {
  to: string;
  label: string;
};

type ShellSettings = {
  businessName?: string | null;
  ownerName?: string | null;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/inventory", label: "Inventory" },
  { to: "/live-sessions", label: "Live Sessions" },
  { to: "/claims", label: "Claims" },
  { to: "/orders", label: "Orders" },
  { to: "/payments", label: "Payments" },
  { to: "/shipping", label: "Shipping" },
  { to: "/customers", label: "Customers" },
  { to: "/finance", label: "Finance" },
  { to: "/settings", label: "Settings" },
];

export default function MainLayout() {
  const [settings, setSettings] = useState<ShellSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = (await getAppSettings()) as ShellSettings;

        if (!cancelled) {
          setSettings({
            businessName: raw.businessName ?? null,
            ownerName: raw.ownerName ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to load app settings for shell", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const businessName =
    settings?.businessName?.trim() || "Live Seller Command Center";
  const ownerName = settings?.ownerName?.trim() || "Owner name not set";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950">
        {/* Brand / app name */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-slate-950">
            LS
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Live Seller Command Center
            </span>
            <span className="max-w-36 truncate text-sm font-semibold text-slate-50">
              {businessName}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-2 py-3 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex items-center justify-between rounded-md px-3 py-2",
                  "text-slate-300 hover:bg-slate-800 hover:text-slate-50",
                  isActive ? "bg-emerald-500 text-slate-950 font-semibold" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-slate-800 px-4 py-3">
          <p className="text-[11px] text-slate-500">
            Owner:{" "}
            <span className="font-medium text-slate-300">{ownerName}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Works even with mahina ang internet 📶
          </p>
        </div>
      </aside>

      {/* Right side: header + content */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-6 py-3 text-xs text-slate-400">
          <div>
            <p className="font-medium uppercase tracking-[0.14em] text-slate-400">
              Real-time command center for live selling
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Overview ng benta, claims, orders, payments, shipping, at stock —
              all in one place.
            </p>
          </div>
          <div className="flex flex-col items-end text-[11px] text-slate-400">
            <span className="text-emerald-400">Finance-connected</span>
            <span>Offline-ready</span>
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
