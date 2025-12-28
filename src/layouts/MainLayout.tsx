import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppSettings } from "../hooks/useAppSettings";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

// Add new routes here to keep navigation consistent across the app.
const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 13h7V4H4v9zM13 20h7v-7h-7v7zM13 11h7V4h-7v7zM4 20h7v-5H4v5z" />
      </svg>
    ),
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 7l8-4 8 4-8 4-8-4z" />
        <path d="M4 7v10l8 4 8-4V7" />
      </svg>
    ),
  },
  {
    to: "/live-sessions",
    label: "Live Sessions",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 6h14v12H5z" />
        <path d="M9 9l6 3-6 3V9z" />
      </svg>
    ),
  },
  {
    to: "/claims",
    label: "Claims",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 4h10l3 4v12H7z" />
        <path d="M7 8h13" />
        <path d="M10 12h7" />
      </svg>
    ),
  },
  {
    to: "/orders",
    label: "Orders",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 6h16v12H4z" />
        <path d="M4 10h16" />
        <path d="M8 14h4" />
      </svg>
    ),
  },
  {
    to: "/payments-shipping",
    label: "Payments & Shipping",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3 7h18v10H3z" />
        <path d="M7 7V5h10v2" />
        <path d="M7 13h6" />
      </svg>
    ),
  },
  {
    to: "/customers",
    label: "Customers",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M8 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
        <path d="M16 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
        <path d="M2 20c0-3.3 3.6-6 8-6" />
        <path d="M14 20c0-2.5 2.1-4.5 5-4.5" />
      </svg>
    ),
  },
  {
    to: "/finance",
    label: "Finance",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 19h16" />
        <path d="M6 17l4-6 4 4 4-7" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
        <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.5 6.5l1.5 1.5m8 8 1.5 1.5M17.5 6.5L16 8m-8 8-1.5 1.5" />
      </svg>
    ),
  },
];

function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function NavList({
  compact,
  onNavigate,
}: {
  compact: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 px-2 py-3 text-sm">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          title={item.label}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              "group flex items-center gap-3 rounded-md px-3 py-2 font-medium text-slate-600 transition",
              "hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              isActive ? "bg-emerald-500/10 text-emerald-700" : "",
              compact ? "justify-center px-2" : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <span className="text-slate-500 group-hover:text-slate-900">
            {item.icon}
          </span>
          <span className={compact ? "sr-only" : "truncate"}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function MainLayout() {
  const { settings } = useAppSettings();
  const location = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const prevPathRef = useRef(location.pathname);

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  // Close the mobile drawer whenever the route changes.
  // This is intentional UI sync; we only update state if it's currently open.
  useEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath === location.pathname) return;
    prevPathRef.current = location.pathname;
    const frame = window.requestAnimationFrame(() => {
      closeMobileNav();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, closeMobileNav]);

  const businessName =
    settings?.businessName?.trim() || "Live Seller Command Center";
  const ownerName = settings?.ownerName?.trim() || "Owner name not set";
  const logoUrl = settings?.logoUrl?.trim() || "";
  const displayLogoText = getInitials(businessName) || "LS";

  const headerCopy = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path.startsWith("/dashboard")) {
      return {
        label: "Dashboard",
        subtitle:
          "Real-time command center for your live selling: benta, pending payments, to-ship, and low-stock items.",
      };
    }
    if (path.startsWith("/inventory")) {
      return {
        label: "Inventory",
        subtitle:
          "Dito mo ilalagay lahat ng items na binebenta mo sa live - with codes, presyo, at stock. Connected to claims, orders, at finance.",
      };
    }
    if (path.startsWith("/live-sessions")) {
      return {
        label: "Live Sessions",
        subtitle:
          "Planuhin at i-track ang bawat live: platform, target sales, at status (Planned, Live, Paused, Ended, Closed).",
      };
    }
    if (path.startsWith("/claims")) {
      return {
        label: "Claims",
        subtitle:
          'Dito mo ita-type ang "mine" claims ng customers habang live. Auto-accept / waitlist / reject based sa stock.',
      };
    }
    if (path.startsWith("/orders")) {
      return {
        label: "Orders",
        subtitle:
          "Auto-built mula sa accepted claims per customer. Dito mo makikita ang items, totals, hiwalay na katayuan ng bayad at padala.",
      };
    }
    if (path.startsWith("/payments-shipping")) {
      return {
        label: "Payments & Shipping",
        subtitle:
          "One workspace to review an order, record payments, and update shipment details. Statuses stay in sync with finance and fulfillment.",
      };
    }
    if (path.startsWith("/payments")) {
      return {
        label: "Payments",
        subtitle:
          "Track all payments per order. When you add a payment, the order's paid amount, balance, and status will auto-update and connect to finance.",
      };
    }
    if (path.startsWith("/shipping")) {
      return {
        label: "Shipping",
        subtitle:
          "Manage shipping queue: courier, tracking number, shipping fee, and delivery status. Orders auto-update to PACKING, SHIPPED, or DELIVERED based on shipment status and payment.",
      };
    }
    if (path.startsWith("/customers")) {
      return {
        label: "Customers",
        subtitle:
          "Buyer history, total spend, and joy reserve status (no pay / cancelled).",
      };
    }
    if (path.startsWith("/finance")) {
      return {
        label: "Finance",
        subtitle:
          "Kita, gastos, at tubo per period. Based on orders, payments, and shipments from your live sessions.",
      };
    }
    if (path.startsWith("/settings")) {
      return {
        label: "Settings",
        subtitle:
          "Global preferences that affect Inventory, Live Sessions, Orders, Customers, Payments, and Finance.",
      };
    }
    return {
      label: NAV_ITEMS[0]?.label ?? "Dashboard",
      subtitle:
        "Overview ng benta, claims, orders, payments, shipping, at stock.",
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        {/* Mobile drawer: uses overlay + slide-in panel for small screens. */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/30 opacity-100 transition-opacity"
              onClick={closeMobileNav}
            />
            <aside className="absolute left-0 top-0 h-full w-64 border-r border-slate-200 bg-white shadow-lg transition-transform translate-x-0">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-500 text-xs font-bold text-slate-950">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${businessName} logo`}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      displayLogoText
                    )}
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
                  onClick={closeMobileNav}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close menu"
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
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </svg>
                </button>
              </div>
              <NavList compact={false} onNavigate={closeMobileNav} />
              <div className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-600">
                <p>
                  Owner:{" "}
                  <span className="font-medium text-slate-800">{ownerName}</span>
                </p>
                <p className="mt-1">Works even with weak internet.</p>
              </div>
            </aside>
          </div>
        )}

        {/* Desktop sidebar: collapsible rail to save horizontal space. */}
        <aside
          className={[
            "hidden lg:flex lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white",
            "transition-[width] duration-200 ease-out",
            isSidebarExpanded ? "lg:w-64" : "lg:w-16",
          ].join(" ")}
        >
          <div
            className={
              isSidebarExpanded
                ? "flex items-center justify-between border-b border-slate-200 px-4 py-4"
                : "flex flex-col items-center gap-2 border-b border-slate-200 px-2 py-3"
            }
          >
            <div
              className={
                isSidebarExpanded
                  ? "flex items-center gap-3"
                  : "flex flex-col items-center gap-2"
              }
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-500 text-xs font-bold text-slate-950">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${businessName} logo`}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  displayLogoText
                )}
              </div>
              <div className={isSidebarExpanded ? "flex flex-col" : "sr-only"}>
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
              onClick={() => setIsSidebarExpanded((prev) => !prev)}
              className={`inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${
                isSidebarExpanded ? "h-9 w-9" : "h-8 w-8"
              }`}
              aria-label={isSidebarExpanded ? "Collapse menu" : "Expand menu"}
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
                {isSidebarExpanded ? (
                  <path d="M15 6l-6 6 6 6" />
                ) : (
                  <path d="M9 6l6 6-6 6" />
                )}
              </svg>
            </button>
          </div>
          {/* Sidebar labels collapse to icons only when compact is true. */}
          <NavList compact={!isSidebarExpanded} />
          {isSidebarExpanded ? (
            <div className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-600">
              <p>
                Owner:{" "}
                <span className="font-medium text-slate-800">{ownerName}</span>
              </p>
              <p className="mt-1">Works even with weak internet.</p>
            </div>
          ) : null}
        </aside>

        {/* Main content area: full width, responsive padding. */}
        <div className="flex min-w-0 flex-1 flex-col relative z-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden relative z-50 pointer-events-auto touch-manipulation"
                aria-label="Open menu"
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
              <div
                data-tour={
                  headerCopy.label === "Inventory"
                    ? "inventory-header"
                    : headerCopy.label === "Dashboard"
                    ? "dashboard-header"
                    : headerCopy.label === "Live Sessions"
                    ? "live-sessions-header"
                    : headerCopy.label === "Claims"
                    ? "claims-header"
                    : headerCopy.label === "Orders"
                    ? "orders-header"
                    : headerCopy.label === "Payments & Shipping"
                    ? "payments-shipping-header"
                    : undefined
                }
              >
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  {headerCopy.label}
                </p>
                <p className="text-[11px] text-slate-500">
                  {headerCopy.subtitle}
                </p>
              </div>
            </div>
            <div className="hidden flex-col items-end text-[11px] text-slate-500 sm:flex">
              <span className="text-emerald-600">Finance-connected</span>
              <span>Offline-ready</span>
            </div>
          </header>

          {/* Main content uses fluid padding instead of a max-width wrapper. */}
          <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 md:px-6 md:py-6 lg:px-8 lg:py-8 pt-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
