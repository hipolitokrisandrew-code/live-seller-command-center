import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveSession, Order, Payment } from "../core/types";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  getOrderDetail,
  listOrdersForSession,
  type OrderDetail,
} from "../services/orders.service";
import {
  listPaymentsForOrder,
  recordPayment,
  voidPayment,
} from "../services/payments.service";
import { listCustomerBasics } from "../services/customers.service";
import { PANEL_CLASS, MUTED_PANEL_CLASS, INPUT_CLASS } from "../theme/classes";

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600";

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatCustomerLabel(
  id?: string | null,
  displayName?: string | null,
  realName?: string | null
): string {
  if (displayName && displayName.trim()) return displayName.trim();
  if (realName && realName.trim()) return realName.trim();
  if (!id) return "Customer";
  const clean = id.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}

export function PaymentsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    undefined
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(
    undefined
  );
  const [customerMap, setCustomerMap] = useState<
    Record<string, { displayName?: string; realName?: string }>
  >({});

  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);

  const [orderPaymentFilter, setOrderPaymentFilter] = useState<
    Order["paymentStatus"] | "ALL"
  >("ALL");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    Payment["method"] | "ALL"
  >("ALL");

  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<Payment["method"]>("GCASH");
  const [formDate, setFormDate] = useState(todayDateInput);
  const [formRef, setFormRef] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const filteredOrders = useMemo(() => {
    if (orderPaymentFilter === "ALL") return orders;
    return orders.filter((o) => o.paymentStatus === orderPaymentFilter);
  }, [orders, orderPaymentFilter]);

  const activeOrder = useMemo(
    () => filteredOrders.find((o) => o.id === activeOrderId),
    [filteredOrders, activeOrderId]
  );

  useEffect(() => {
    void (async () => {
      try {
        setLoadingSessions(true);
        const list = await listLiveSessions();
        setSessions(list);
        const basics = await listCustomerBasics();
        const map: Record<string, { displayName?: string; realName?: string }> =
          {};
        basics.forEach((c) => {
          map[c.id] = { displayName: c.displayName, realName: c.realName };
        });
        setCustomerMap(map);

        if (list.length > 0) {
          const live = list.find((s) => s.status === "LIVE");
          const firstId = (live ?? list[0]).id;
          setActiveSessionId(firstId);
        }
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load live sessions.");
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, []);

  const refreshOrdersForSession = useCallback(async (sessionId: string) => {
    try {
      setLoadingOrders(true);
      setError(null);
      const list = await listOrdersForSession(sessionId);
      setOrders(list);

      if (list.length > 0) {
        setActiveOrderId(list[0].id);
      } else {
        setActiveOrderId(undefined);
        setOrderDetail(null);
        setPayments([]);
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load orders for session.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      setOrders([]);
      setActiveOrderId(undefined);
      setOrderDetail(null);
      setPayments([]);
      return;
    }
    void refreshOrdersForSession(activeSessionId);
  }, [activeSessionId, refreshOrdersForSession]);

  useEffect(() => {
    if (!activeOrderId || !filteredOrders.some((o) => o.id === activeOrderId)) {
      const next = filteredOrders[0]?.id;
      setActiveOrderId(next);
    }
  }, [filteredOrders, activeOrderId]);

  const refreshOrderDetailAndPayments = useCallback(async (orderId: string) => {
    try {
      setLoadingOrderDetail(true);
      setError(null);
      const [detail, paymentList] = await Promise.all([
        getOrderDetail(orderId),
        listPaymentsForOrder(orderId),
      ]);

      setOrderDetail(detail);
      setPayments(paymentList);

      if (detail) {
        const balance = detail.order.balanceDue ?? 0;
        setFormAmount(
          balance > 0 ? balance.toFixed(2) : detail.order.grandTotal.toFixed(2)
        );
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load order details or payments.");
    } finally {
      setLoadingOrderDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!activeOrderId) {
      setOrderDetail(null);
      setPayments([]);
      return;
    }
    void refreshOrderDetailAndPayments(activeOrderId);
  }, [activeOrderId, refreshOrderDetailAndPayments]);

  async function handleSubmitPayment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!activeOrderId) {
      setError("Please select an order first.");
      return;
    }

    const raw = formAmount.replace(/,/g, "").trim();
    const amount = parseFloat(raw);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid payment amount greater than 0.");
      return;
    }

    try {
      setSavingPayment(true);

      const dateIso = formDate ? new Date(formDate).toISOString() : undefined;

      await recordPayment({
        orderId: activeOrderId,
        amount,
        method: formMethod,
        date: dateIso,
        referenceNumber: formRef.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      setInfoMessage("Payment recorded successfully.");
      setFormRef("");
      setFormNotes("");

      await refreshOrderDetailAndPayments(activeOrderId);
      if (activeSessionId) {
        await refreshOrdersForSession(activeSessionId);
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleVoidPayment(payment: Payment) {
    if (!window.confirm("Void this payment?")) return;
    setError(null);
    setInfoMessage(null);

    try {
      setVoidingPaymentId(payment.id);
      await voidPayment(payment.id);

      if (activeOrderId) {
        await refreshOrderDetailAndPayments(activeOrderId);
      }
      if (activeSessionId) {
        await refreshOrdersForSession(activeSessionId);
      }

      setInfoMessage("Payment voided and totals updated.");
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to void payment.");
    } finally {
      setVoidingPaymentId(null);
    }
  }

  const paymentCounts = useMemo(() => {
    const counts: Record<Order["paymentStatus"], number> = {
      UNPAID: 0,
      PARTIAL: 0,
      PAID: 0,
    };
    for (const order of orders) {
      counts[order.paymentStatus] =
        (counts[order.paymentStatus] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const methodCounts = useMemo(() => {
    const counts: Record<Payment["method"], number> = {
      GCASH: 0,
      MAYA: 0,
      BANK: 0,
      COD: 0,
      CASH: 0,
      OTHER: 0,
    };
    for (const p of payments) {
      counts[p.method] = (counts[p.method] ?? 0) + 1;
    }
    return counts;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (paymentMethodFilter === "ALL") return payments;
    return payments.filter((p) => p.method === paymentMethodFilter);
  }, [payments, paymentMethodFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-600">
          Track all payments per order. When you add a payment, the order&apos;s
          paid amount, balance, and status will auto-update and connect to
          finance.
        </p>
      </div>

      {/* Filters: session + order selector */}
      <div
        className={`${PANEL_CLASS} grid gap-3 p-3 text-sm lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`}
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Live session
          </label>
          <select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? e.target.value : undefined)
            }
            className={INPUT_CLASS}
          >
            {sessions.length === 0 && <option value="">No sessions yet</option>}
            {sessions.length > 0 && activeSessionId == null && (
              <option value="">Select session...</option>
            )}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.platform})
              </option>
            ))}
          </select>
          {activeSession && (
            <p className="text-xs text-slate-600">
              Status:{" "}
              <span className="font-medium text-slate-900">
                {activeSession.status}
              </span>
              {activeSession.targetRevenue != null && (
                <>
                  {" "}
                  | Target:{" "}
                  <span className="font-medium text-emerald-700">
                    ₱{activeSession.targetRevenue.toLocaleString("en-PH")}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Order
          </label>
          <select
            value={activeOrderId ?? ""}
            onChange={(e) =>
              setActiveOrderId(e.target.value ? e.target.value : undefined)
            }
            className={INPUT_CLASS}
          >
            {!activeSessionId && (
              <option value="">Select a session first...</option>
            )}
            {activeSessionId && filteredOrders.length === 0 && (
              <option value="">No orders yet for this session</option>
            )}
            {filteredOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} -{" "}
                {formatCustomerLabel(
                  o.customerId,
                  customerMap[o.customerId ?? ""]?.displayName,
                  customerMap[o.customerId ?? ""]?.realName
                )}
              </option>
            ))}
          </select>
          {activeOrder && (
            <p className="text-xs text-slate-600">
              Status:{" "}
              <span className="font-medium text-slate-900">
                {activeOrder.status}
              </span>{" "}
              | Payment:{" "}
              <span className="font-medium text-slate-900">
                {activeOrder.paymentStatus}
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
            <span>Filter by payment:</span>
            {(["ALL", "UNPAID", "PARTIAL", "PAID"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setOrderPaymentFilter(status)}
                className={`rounded-full border px-2 py-0.5 ${
                  orderPaymentFilter === status
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {status === "ALL" ? "All" : status.toLowerCase()} (
                {status === "ALL"
                  ? orders.length
                  : paymentCounts[status as Order["paymentStatus"]] ?? 0}
                )
              </button>
            ))}
          </div>
        </div>
      </div>

      {infoMessage && (
        <div className="rounded-md border border-emerald-500/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {infoMessage}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-rose-500/70 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Main layout: order summary + payment form + payment log */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Left: order summary + payments log */}
        <div className="space-y-4">
          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Order summary
            </div>
            {loadingOrderDetail ? (
              <div className="px-3 py-4 text-sm text-slate-600">
                Loading order details...
              </div>
            ) : !orderDetail ? (
              <div className="px-3 py-4 text-sm text-slate-600">
                Select an order to see its totals and payments.
              </div>
            ) : (
              <div className="space-y-3 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-600">
                      Order #
                    </div>
                    <div className="font-semibold text-emerald-700">
                      {orderDetail.order.orderNumber}
                    </div>
                    <div className="text-xs text-slate-600">
                      {formatCustomerLabel(
                        orderDetail.order.customerId,
                        orderDetail.customer?.displayName ??
                          customerMap[orderDetail.order.customerId]?.displayName,
                        orderDetail.customer?.realName ??
                          customerMap[orderDetail.order.customerId]?.realName
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-600">
                      Created
                    </div>
                    <div className="text-xs text-slate-800">
                      {formatDateTime(orderDetail.order.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Subtotal</div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(orderDetail.order.subtotal)}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Discounts</div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(
                        (orderDetail.order.discountTotal ?? 0) +
                          (orderDetail.order.promoDiscountTotal ?? 0)
                      )}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Shipping + COD</div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(
                        (orderDetail.order.shippingFee ?? 0) +
                          (orderDetail.order.codFee ?? 0)
                      )}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Other fees</div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(orderDetail.order.otherFees)}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Grand total</div>
                    <div className="font-semibold text-emerald-700">
                      {formatCurrency(orderDetail.order.grandTotal)}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Paid</div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(orderDetail.order.amountPaid)}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Balance</div>
                    <div className="font-semibold text-amber-700">
                      {formatCurrency(orderDetail.order.balanceDue)}
                    </div>
                  </div>
                  <div
                    className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                  >
                    <div className="text-slate-600">Payment status</div>
                    <div className="font-semibold text-slate-900">
                      {orderDetail.order.paymentStatus}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payments log */}
          <div className={PANEL_CLASS}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span>Payments for this order</span>
              <div className="flex items-center gap-2 text-[11px] font-normal lowercase text-slate-600">
                <span>Method:</span>
                {(["ALL", "GCASH", "MAYA", "BANK", "COD", "CASH", "OTHER"] as const).map(
                  (method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() =>
                        setPaymentMethodFilter(method === "ALL" ? "ALL" : method)
                      }
                      className={`rounded-full border px-2 py-0.5 ${
                        paymentMethodFilter === method
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {method === "ALL" ? "All" : method}
                      {" ("}
                      {method === "ALL"
                        ? payments.length
                        : methodCounts[method as Payment["method"]] ?? 0}
                      {")"}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingOrderDetail ? (
                <div className="px-3 py-4 text-sm text-slate-600">
                  Loading payments...
                </div>
              ) : !activeOrderId ? (
                <div className="px-3 py-4 text-sm text-slate-600">
                  Select an order first.
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-600">
                  Walang payments pa for this order.
                </div>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className={TABLE_HEAD_CLASS}>
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Ref #</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-200">
                        <td className="px-3 py-2 text-[11px] text-slate-700">
                          {formatDateTime(p.date)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-900">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-700">
                          {p.method}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500">
                          {p.referenceNumber ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-700">
                          {p.status}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px]">
                          <button
                            type="button"
                            disabled={p.status === "VOIDED"}
                            onClick={() => void handleVoidPayment(p)}
                            className="rounded border border-rose-500/70 px-2 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                          >
                            {voidingPaymentId === p.id
                              ? "Voiding..."
                              : p.status === "VOIDED"
                              ? "Voided"
                              : "Void"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right: add payment form */}
        <div className={PANEL_CLASS}>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Add payment
          </div>
          <form
            onSubmit={handleSubmitPayment}
            className="space-y-3 p-3 text-sm"
          >
            {!activeOrderId ? (
              <p className="text-sm text-slate-600">
                Select an order first to add a payment.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Amount <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="0.00"
                  />
                  {orderDetail && (
                    <p className="text-xs text-slate-600">
                      Current balance:{" "}
                      <span className="font-semibold text-amber-700">
                        {formatCurrency(orderDetail.order.balanceDue)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formMethod}
                    onChange={(e) =>
                      setFormMethod(e.target.value as Payment["method"])
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="BANK">Bank transfer</option>
                    <option value="COD">COD</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Reference #
                  </label>
                  <input
                    type="text"
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="GCash ref, bank ref, etc."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    className={`${INPUT_CLASS} min-h-[90px]`}
                    placeholder="Optional notes (ex: partial payment, who paid, etc.)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!activeOrderId || savingPayment}
                  className="w-full rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {savingPayment ? "Saving payment..." : "Save payment"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {loadingSessions && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}
        >
          Loading sessions...
        </div>
      )}
      {loadingOrders && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}
        >
          Loading orders...
        </div>
      )}
    </div>
  );
}
