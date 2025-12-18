import { useEffect, useMemo, useState } from "react";
import type { Order } from "../core/types";
import {
  getCustomerOverviewList,
  getCustomerWithHistory,
  type CustomerOverview,
} from "../services/customers.service";
import { PANEL_CLASS, MUTED_PANEL_CLASS, INPUT_CLASS } from "../theme/classes";

type JoyFilter = "ALL" | "JOY_ONLY";

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600";

function formatDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso?: string): string {
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
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        Good record
      </span>
    );
  }
  if (noPayCount === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
        1× joy reserve
      </span>
    );
  }
  if (noPayCount === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600"></span>
        2× joy reserve
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-800 ring-1 ring-rose-300">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span>
      {noPayCount}× joy reserve
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

  const hasCustomers = overviews.length > 0;
  const joyCount = useMemo(
    () => overviews.filter((o) => o.noPayCount > 0).length,
    [overviews]
  );
  const totalSpentAll = useMemo(
    () => overviews.reduce((sum, o) => sum + o.totalSpent, 0),
    [overviews]
  );

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

  return (
    <div className="space-y-4">
      <div className={`${PANEL_CLASS} border border-slate-200 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
            <p className="text-sm text-slate-600">
              Buyer history, total spend, and joy reserve status (no pay / cancelled).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-600">
                Total customers
              </div>
              <div className="text-base font-semibold text-slate-900">
                {overviews.length}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-amber-700">
                Joy reserves
              </div>
              <div className="text-base font-semibold text-amber-700">
                {joyCount}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700">
                Total spent
              </div>
              <div className="text-base font-semibold text-emerald-700">
                {formatCurrency(totalSpentAll)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)]">
        {/* Left: list */}
        <div className={PANEL_CLASS}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                placeholder="Search customer name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${INPUT_CLASS} text-xs`}
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
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                {joyFilter === "JOY_ONLY"
                  ? "Show all customers"
                  : "Show joy reserves only"}
              </button>
            </div>
          </div>

          {loadingList && (
            <div className="px-3 py-2 text-xs text-slate-600">
              Loading customers...
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          {!loadingList && !hasCustomers && !error && (
            <div className="px-3 py-3 text-sm text-slate-600">
              Walang customers pa. Once you build orders from claims, lalabas
              sila dito.
            </div>
          )}

          {hasCustomers && (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className={`${TABLE_HEAD_CLASS} sticky top-0 backdrop-blur`}>
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
                        className={`cursor-pointer border-t border-slate-200 ${
                          isSelected
                            ? "bg-slate-50 shadow-inner ring-1 ring-emerald-200"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-900">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {o.customer.displayName}
                            </span>
                            {o.customer.realName && (
                              <span className="text-[10px] text-slate-500">
                                {o.customer.realName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-900">
                          {o.totalOrders}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-900">
                          {formatCurrency(o.totalSpent)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px]">
                          {getJoyBadge(o.noPayCount)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-700">
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
        <div className={PANEL_CLASS}>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Customer details &amp; history
          </div>

          {!selectedOverview && (
            <div className="px-3 py-3 text-sm text-slate-600">
              Select a customer from the left list.
            </div>
          )}

          {selectedOverview && (
            <div className="space-y-3 p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {selectedOverview.customer.displayName}
                  </div>
                  {selectedOverview.customer.realName && (
                    <div className="text-[11px] text-slate-600">
                      {selectedOverview.customer.realName}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    {selectedOverview.customer.phone && (
                      <span>Phone: {selectedOverview.customer.phone}</span>
                    )}
                    {selectedOverview.customer.city && (
                      <span>City: {selectedOverview.customer.city}</span>
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
                  <div className="text-[11px] text-slate-600">
                    Total spent:{" "}
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(selectedOverview.totalSpent)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">
                    Total orders
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {selectedOverview.totalOrders}
                  </div>
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">
                    Paid orders
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {selectedOverview.totalPaidOrders}
                  </div>
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">
                    Joy reserve count
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {selectedOverview.noPayCount}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Recent orders
                  </div>
                  {loadingDetail && (
                    <div className="text-[10px] text-slate-500">
                      Loading history...
                    </div>
                  )}
                </div>

                {detailOrders.length === 0 && !loadingDetail && (
                  <div
                    className={`${MUTED_PANEL_CLASS} rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-600`}
                  >
                    Walang orders pa for this customer.
                  </div>
                )}

                {detailOrders.length > 0 && (
                  <div className="max-h-[280px] overflow-y-auto rounded-md border border-slate-200 bg-slate-50">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className={TABLE_HEAD_CLASS}>
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
                            className="border-t border-slate-200"
                          >
                            <td className="px-2 py-2 text-slate-700">
                              {formatDateTime(order.createdAt)}
                            </td>
                            <td className="px-2 py-2 font-mono text-[10px] text-slate-600">
                              {order.orderNumber}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-900">
                              {formatCurrency(order.grandTotal)}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-700">
                              {order.paymentStatus}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-700">
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
