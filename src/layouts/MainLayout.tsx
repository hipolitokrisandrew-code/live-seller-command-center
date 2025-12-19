import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAppSettings } from "../hooks/useAppSettings";

type NavItem = {
  to: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/inventory", label: "Inventory" },
  { to: "/live-sessions", label: "Live Sessions" },
  { to: "/claims", label: "Claims" },
  { to: "/orders", label: "Orders" },
  { to: "/payments-shipping", label: "Payments & Shipping" },
  { to: "/customers", label: "Customers" },
  { to: "/finance", label: "Finance" },
  { to: "/settings", label: "Settings" },
];

export default function MainLayout() {
  const { settings } = useAppSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const businessName =
    settings?.businessName?.trim() || "Live Seller Command Center";
  const ownerName = settings?.ownerName?.trim() || "Owner name not set";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-slate-200 bg-white text-slate-900">
          {/* Brand / app name */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-slate-950">
                LS
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Live Seller Command Center
                </span>
                <span className="max-w-36 truncate text-sm font-semibold text-slate-900">
                  {businessName}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={isSidebarOpen ? "Hide menu" : "Show menu"}
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
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 px-2 py-3 text-sm">
            {isSidebarOpen
              ? NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        "flex items-center justify-between rounded-md px-3 py-2",
                        "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                        isActive
                          ? "bg-emerald-500 font-semibold text-slate-950"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    }
                  >
                    <span>{item.label}</span>
                  </NavLink>
                ))
              : null}
          </nav>

          {/* Sidebar footer */}
          {isSidebarOpen ? (
            <div className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-600">
              <p>
                Owner: <span className="font-medium text-slate-800">{ownerName}</span>
              </p>
              <p className="mt-1">Works even with weak internet.</p>
            </div>
          ) : null}
        </aside>

        {/* Right side: header + content */}
        <div className="flex flex-1 flex-col">
          {/* Top header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 text-xs text-slate-600">
            <div>
              <p className="font-medium uppercase tracking-[0.14em]">
                Real-time command center for live selling
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Overview ng benta, claims, orders, payments, shipping, at stock
                - all in one place.
              </p>
            </div>
            <div className="flex flex-col items-end text-[11px] text-slate-500">
              <span className="text-emerald-600">Finance-connected</span>
              <span>Offline-ready</span>
            </div>
          </header>

          {/* Main scrollable content */}
          <main className="flex-1 overflow-y-auto bg-slate-50">
            <div className="mx-auto max-w-6xl px-6 py-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
