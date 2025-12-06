// src/pages/CustomersPage.tsx

import { useEffect, useMemo, useState } from "react";
import type { Order } from "../core/types";
import {
  getCustomerOverviewList,
  getCustomerWithHistory,
  type CustomerOverview,
} from "../services/customers.service";

type JoyFilter = "ALL" | "JOY_ONLY";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getJoyBadge(noPayCount: number) {
  if (noPayCount <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-600/40">
        ✅ Good record
      </span>
    );
  }
  if (noPayCount === 1) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-950/60 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-600/40">
        ⚠️ 1x joy reserve
      </span>
    );
  }
  if (noPayCount === 2) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-950/70 px-2 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-500/60">
        ⚠️ 2x joy reserve
      </span>
    );
  }
  // 3 or more
  return (
    <span className="inline-flex items-center rounded-full bg-rose-950/70 px-2 py-0.5 text-[10px] font-semibold text-rose-200 ring-1 ring-rose-500/70">
      🚨 {noPayCount}x joy reserve
    </span>
  );
}

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [joyFilter, setJoyFilter] = useState<JoyFilter>("ALL");

  const [overviews, setOverviews] = useState<CustomerOverview[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [detailOrders, setDetailOrders] = useState<Order[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOverview = useMemo(
    () => overviews.find((o) => o.customer.id === selectedCustomerId) ?? null,
    [overviews, selectedCustomerId]
  );

  // Load overview list whenever search or joyFilter changes
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoadingList(true);
        setError(null);

        const list = await getCustomerOverviewList({
          search,
          joyFilter,
        });

        if (cancelled) return;

        setOverviews(list);

        // Ensure selection stays valid
        if (
          !selectedCustomerId ||
          !list.some((o) => o.customer.id === selectedCustomerId)
        ) {
          setSelectedCustomerId(list[0]?.customer.id ?? null);
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) {
          setError("Failed to load customers.");
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search, joyFilter, selectedCustomerId]);

  // Load history for selected customer
  useEffect(() => {
    if (!selectedCustomerId) {
      setDetailOrders([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoadingDetail(true);
        const { orders } = await getCustomerWithHistory(selectedCustomerId);
        if (cancelled) return;
        setDetailOrders(orders);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  const hasCustomers = overviews.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Customers</h1>
        <p className="text-sm text-slate-400">
          List of buyers with history, total spent, and joy reserve indicator
          (no pay / cancelled orders).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)]">
        {/* Left: list */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/70">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                placeholder="Search customer name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setJoyFilter((prev) => (prev === "ALL" ? "JOY_ONLY" : "ALL"))
                }
                className={`rounded-md px-2 py-1 text-[11px] ${
                  joyFilter === "JOY_ONLY"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-900 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {joyFilter === "JOY_ONLY"
                  ? "Show all customers"
                  : "Show joy reserves only"}
              </button>
            </div>
          </div>

          {loadingList && (
            <div className="px-3 py-2 text-xs text-slate-400">
              Loading customers…
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-xs text-rose-200">{error}</div>
          )}

          {!loadingList && !hasCustomers && !error && (
            <div className="px-3 py-3 text-sm text-slate-500">
              Walang customers pa. Once you build orders from claims, lalabas
              sila dito.
            </div>
          )}

          {hasCustomers && (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase text-slate-400 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Orders</th>
                    <th className="px-3 py-2 text-right">Total spent</th>
                    <th className="px-3 py-2 text-right">Joy reserve</th>
                    <th className="px-3 py-2 text-right">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {overviews.map((o) => {
                    const isSelected = selectedCustomerId === o.customer.id;
                    return (
                      <tr
                        key={o.customer.id}
                        onClick={() => setSelectedCustomerId(o.customer.id)}
                        className={`cursor-pointer border-t border-slate-800 ${
                          isSelected
                            ? "bg-slate-800/70"
                            : "hover:bg-slate-900/70"
                        }`}
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-100">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {o.customer.displayName}
                            </span>
                            {o.customer.realName && (
                              <span className="text-[10px] text-slate-400">
                                {o.customer.realName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-100">
                          {o.totalOrders}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(o.totalSpent)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px]">
                          {getJoyBadge(o.noPayCount)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-300">
                          {formatDate(o.lastOrderDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/70">
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Customer details &amp; history
          </div>

          {!selectedOverview && (
            <div className="px-3 py-3 text-sm text-slate-500">
              Select a customer from the left list.
            </div>
          )}

          {selectedOverview && (
            <div className="space-y-3 p-3 text-xs">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-50">
                    {selectedOverview.customer.displayName}
                  </div>
                  {selectedOverview.customer.realName && (
                    <div className="text-[11px] text-slate-400">
                      {selectedOverview.customer.realName}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {selectedOverview.customer.phone && (
                      <span>📱 {selectedOverview.customer.phone}</span>
                    )}
                    {selectedOverview.customer.city && (
                      <span>📍 {selectedOverview.customer.city}</span>
                    )}
                    {selectedOverview.firstOrderDate && (
                      <span>
                        First order:{" "}
                        {formatDate(selectedOverview.firstOrderDate)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getJoyBadge(selectedOverview.noPayCount)}
                  <div className="text-[11px] text-slate-400">
                    Total spent:{" "}
                    <span className="font-semibold text-emerald-300">
                      {formatCurrency(selectedOverview.totalSpent)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-slate-800 bg-slate-950/80 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Total orders
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-50">
                    {selectedOverview.totalOrders}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/80 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Paid orders
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-50">
                    {selectedOverview.totalPaidOrders}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/80 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Joy reserve count
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-50">
                    {selectedOverview.noPayCount}
                  </div>
                </div>
              </div>

              {/* History */}
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Recent orders
                  </div>
                  {loadingDetail && (
                    <div className="text-[10px] text-slate-400">
                      Loading history…
                    </div>
                  )}
                </div>

                {detailOrders.length === 0 && !loadingDetail && (
                  <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2 text-[11px] text-slate-500">
                    Walang orders pa for this customer.
                  </div>
                )}

                {detailOrders.length > 0 && (
                  <div className="max-h-[280px] overflow-y-auto rounded-md border border-slate-800 bg-slate-950/60">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="px-2 py-2">Date</th>
                          <th className="px-2 py-2">Order #</th>
                          <th className="px-2 py-2 text-right">Total</th>
                          <th className="px-2 py-2 text-right">Payment</th>
                          <th className="px-2 py-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="border-t border-slate-800"
                          >
                            <td className="px-2 py-2 text-slate-200">
                              {formatDateTime(order.createdAt)}
                            </td>
                            <td className="px-2 py-2 font-mono text-[10px] text-slate-300">
                              {order.orderNumber}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-100">
                              {formatCurrency(order.grandTotal)}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-300">
                              {order.paymentStatus}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-300">
                              {order.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
