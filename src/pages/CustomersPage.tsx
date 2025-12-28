import { useEffect, useMemo, useState } from "react";
import type { Order } from "../core/types";
import {
  getCustomerOverviewList,
  getCustomerWithHistory,
  type CustomerOverview,
} from "../services/customers.service";
import { Page } from "../components/layout/Page";
import { Badge } from "../components/ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { useScrollRetention } from "../hooks/useScrollRetention";
import { useCustomersTutorial } from "../hooks/useCustomersTutorial";
import { CustomersTutorialOverlay } from "../components/customers/CustomersTutorialOverlay";
import { CustomersHelpButton } from "../components/customers/CustomersHelpButton";

type JoyFilter = "ALL" | "JOY_ONLY";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500";

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500";

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
  return `\u20B1${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function renderJoyBadge(noPayCount: number) {
  if (noPayCount <= 0) {
    return (
      <Badge variant="success" className="text-[10px] uppercase tracking-wide">
        Good record
      </Badge>
    );
  }
  if (noPayCount === 1) {
    return (
      <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
        1× joy reserve
      </Badge>
    );
  }
  if (noPayCount === 2) {
    return (
      <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
        2× joy reserve
      </Badge>
    );
  }
  return (
    <Badge variant="danger" className="text-[10px] uppercase tracking-wide">
      {noPayCount}× joy reserve
    </Badge>
  );
}

function paymentBadgeVariant(
  status: Order["paymentStatus"],
): "success" | "warning" | "danger" {
  switch (status) {
    case "PAID":
      return "success";
    case "PARTIAL":
      return "warning";
    case "UNPAID":
    default:
      return "danger";
  }
}

function orderStatusBadgeVariant(
  status: Order["status"],
): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "SHIPPED":
    case "PACKING":
      return "warning";
    case "PENDING_PAYMENT":
    case "PARTIALLY_PAID":
      return "danger";
    case "PAID":
    default:
      return "neutral";
  }
}

export function CustomersPage() {
  const tutorial = useCustomersTutorial();
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

  const customersListRef = useScrollRetention<HTMLDivElement>(
    !loadingList,
    [loadingList, overviews.length]
  );
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
    <Page className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-3" data-tour="customers-stats">
        <Card className="p-3">
          <div className="text-xs font-medium text-slate-600">
            Total customers
          </div>
          <div className="mt-1 text-base font-semibold tabular-nums text-slate-900">
            {overviews.length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs font-medium text-slate-600">Joy reserves</div>
          <div className="mt-1 text-base font-semibold tabular-nums text-amber-700">
            {joyCount}
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-xs font-medium text-slate-600">Total spent</div>
          <div className="mt-1 text-base font-semibold tabular-nums text-emerald-700">
            {formatCurrency(totalSpentAll)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: list */}
        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            data-tour="customers-list-filters"
          >
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search customer name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={CONTROL_CLASS}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={joyFilter === "JOY_ONLY"}
                onChange={(e) =>
                  setJoyFilter(e.target.checked ? "JOY_ONLY" : "ALL")
                }
                className={CHECKBOX_CLASS}
              />
              Show joy reserves only
            </label>
          </CardHeader>
          <CardContent className="p-0">
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
            <div
              ref={customersListRef}
              className="max-h-[420px] overflow-y-auto"
              data-tour="customers-list"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className={`${TABLE_HEAD_CLASS} sticky top-0`}>
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
                        className={cn(
                          "cursor-pointer border-t border-slate-200 hover:bg-slate-50",
                          isSelected && "bg-emerald-50",
                        )}
                      >
                        <td
                          className={cn(
                            "px-3 py-2 text-[11px] text-slate-900",
                            isSelected && "border-l-4 border-emerald-500",
                          )}
                        >
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
                        <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                          {o.totalOrders}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                          {formatCurrency(o.totalSpent)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px]">
                          {renderJoyBadge(o.noPayCount)}
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
            </div>
          )}
          </CardContent>
        </Card>

        {/* Right: detail */}
        <Card
          className="overflow-hidden lg:col-span-7"
          data-tour="customers-detail"
        >
          <CardHeader>
            <CardTitle>Customer details &amp; history</CardTitle>
          </CardHeader>

          {!selectedOverview && (
            <CardContent>
              <div className="text-sm text-slate-600">
                Select a customer from the left list.
              </div>
            </CardContent>
          )}

          {selectedOverview && (
            <CardContent className="space-y-4 text-xs">
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
                  {renderJoyBadge(selectedOverview.noPayCount)}
                  <div className="text-[11px] text-slate-600">
                    Total spent:{" "}
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(selectedOverview.totalSpent)}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="grid gap-3 sm:grid-cols-3"
                data-tour="customers-detail-metrics"
              >
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Total orders
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                    {selectedOverview.totalOrders}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Paid orders
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                    {selectedOverview.totalPaidOrders}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Joy reserve count
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                    {selectedOverview.noPayCount}
                  </div>
                </div>
              </div>

              <div className="space-y-2" data-tour="customers-history">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-600">
                    Recent orders
                  </div>
                  {loadingDetail && (
                    <div className="text-[10px] text-slate-500">
                      Loading history...
                    </div>
                  )}
                </div>

                {detailOrders.length === 0 && !loadingDetail && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    Walang orders pa for this customer.
                  </div>
                )}

                {detailOrders.length > 0 && (
                  <div className="max-h-[280px] overflow-y-auto rounded-lg border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className={TABLE_HEAD_CLASS}>
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Order #</th>
                            <th className="px-3 py-2 text-right">Total</th>
                            <th className="px-3 py-2 text-right">Payment</th>
                            <th className="px-3 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailOrders.map((order) => (
                            <tr
                              key={order.id}
                              className="border-t border-slate-200 hover:bg-slate-50"
                            >
                              <td className="px-3 py-2 text-[11px] text-slate-700">
                                {formatDateTime(order.createdAt)}
                              </td>
                              <td className="px-3 py-2 font-mono text-[10px] text-slate-600">
                                {order.orderNumber}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                                {formatCurrency(order.grandTotal)}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px]">
                                <Badge
                                  variant={paymentBadgeVariant(order.paymentStatus)}
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  {order.paymentStatus}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right text-[11px]">
                                <Badge
                                  variant={orderStatusBadgeVariant(order.status)}
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  {order.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      <CustomersHelpButton onClick={tutorial.open} />
      <CustomersTutorialOverlay
        isOpen={tutorial.isOpen}
        steps={tutorial.steps}
        currentIndex={tutorial.currentStep}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onClose={tutorial.close}
        onSkip={tutorial.skip}
      />
    </Page>
  );
}
