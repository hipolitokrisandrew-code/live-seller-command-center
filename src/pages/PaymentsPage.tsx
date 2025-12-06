// src/pages/PaymentsPage.tsx
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

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10); // yyyy-mm-dd
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

  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);

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

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId),
    [orders, activeOrderId]
  );

  // Initial load: sessions
  useEffect(() => {
    void (async () => {
      try {
        setLoadingSessions(true);
        const list = await listLiveSessions();
        setSessions(list);

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

  // Load orders for a session
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

  // When session changes → reload orders
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

  // Load order detail + payments
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

  // When active order changes → load detail + payments
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

      // Reload detail + payments so totals update
      await refreshOrderDetailAndPayments(activeOrderId);
      // Also refresh orders list (status + paid/balance)
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Payments</h1>
        <p className="text-sm text-slate-400">
          Track all payments per order. When you add a payment, the order&apos;s
          paid amount, balance, and status will auto-update and connect to
          finance.
        </p>
      </div>

      {/* Filters: session + order selector */}
      <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Live session
          </label>
          <select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? e.target.value : undefined)
            }
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {sessions.length === 0 && <option value="">No sessions yet</option>}
            {sessions.length > 0 && activeSessionId == null && (
              <option value="">Select session…</option>
            )}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.platform})
              </option>
            ))}
          </select>
          {activeSession && (
            <p className="text-xs text-slate-500">
              Status:{" "}
              <span className="font-medium text-slate-200">
                {activeSession.status}
              </span>
              {activeSession.targetRevenue != null && (
                <>
                  {" "}
                  · Target:{" "}
                  <span className="font-medium text-emerald-400">
                    ₱{activeSession.targetRevenue.toLocaleString("en-PH")}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Order
          </label>
          <select
            value={activeOrderId ?? ""}
            onChange={(e) =>
              setActiveOrderId(e.target.value ? e.target.value : undefined)
            }
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {!activeSessionId && (
              <option value="">Select a session first…</option>
            )}
            {activeSessionId && orders.length === 0 && (
              <option value="">No orders yet for this session</option>
            )}
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} – {o.customerId}
              </option>
            ))}
          </select>
          {activeOrder && (
            <p className="text-xs text-slate-500">
              Status:{" "}
              <span className="font-medium text-slate-200">
                {activeOrder.status}
              </span>{" "}
              · Payment:{" "}
              <span className="font-medium text-slate-200">
                {activeOrder.paymentStatus}
              </span>
            </p>
          )}
        </div>
      </div>

      {infoMessage && (
        <div className="rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
          {infoMessage}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-rose-500/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Main layout: order summary + payment form + payment log */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Left: order summary + payments log */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60">
            <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Order summary
            </div>
            {loadingOrderDetail ? (
              <div className="px-3 py-4 text-sm text-slate-400">
                Loading order details…
              </div>
            ) : !orderDetail ? (
              <div className="px-3 py-4 text-sm text-slate-500">
                Select an order to see its totals and payments.
              </div>
            ) : (
              <div className="space-y-3 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Order #
                    </div>
                    <div className="font-semibold text-emerald-300">
                      {orderDetail.order.orderNumber}
                    </div>
                    <div className="text-xs text-slate-400">
                      {orderDetail.customer?.displayName ??
                        orderDetail.order.customerId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Created
                    </div>
                    <div className="text-xs text-slate-200">
                      {formatDateTime(orderDetail.order.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Subtotal</div>
                    <div className="font-semibold text-slate-100">
                      {formatCurrency(orderDetail.order.subtotal)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Discounts</div>
                    <div className="font-semibold text-slate-100">
                      {formatCurrency(
                        (orderDetail.order.discountTotal ?? 0) +
                          (orderDetail.order.promoDiscountTotal ?? 0)
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Shipping + COD</div>
                    <div className="font-semibold text-slate-100">
                      {formatCurrency(
                        (orderDetail.order.shippingFee ?? 0) +
                          (orderDetail.order.codFee ?? 0)
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Other fees</div>
                    <div className="font-semibold text-slate-100">
                      {formatCurrency(orderDetail.order.otherFees)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Grand total</div>
                    <div className="font-semibold text-emerald-300">
                      {formatCurrency(orderDetail.order.grandTotal)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Paid</div>
                    <div className="font-semibold text-slate-100">
                      {formatCurrency(orderDetail.order.amountPaid)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Balance</div>
                    <div className="font-semibold text-amber-300">
                      {formatCurrency(orderDetail.order.balanceDue)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="text-slate-400">Payment status</div>
                    <div className="font-semibold text-slate-100">
                      {orderDetail.order.paymentStatus}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payments log */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60">
            <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Payments for this order
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingOrderDetail ? (
                <div className="px-3 py-4 text-sm text-slate-400">
                  Loading payments…
                </div>
              ) : !activeOrderId ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Select an order first.
                </div>
              ) : payments.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Walang payments pa for this order.
                </div>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400">
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
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-[11px] text-slate-100">
                          {formatDateTime(p.date)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-100">
                          {p.method}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-400">
                          {p.referenceNumber ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-100">
                          {p.status}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px]">
                          <button
                            type="button"
                            disabled={p.status === "VOIDED"}
                            onClick={() => void handleVoidPayment(p)}
                            className="rounded border border-rose-500/70 px-2 py-0.5 text-[10px] font-medium text-rose-200 hover:bg-rose-900/70 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                          >
                            {voidingPaymentId === p.id
                              ? "Voiding…"
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
        <div className="rounded-lg border border-slate-800 bg-slate-950/60">
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Add payment
          </div>
          <form
            onSubmit={handleSubmitPayment}
            className="space-y-3 p-3 text-sm"
          >
            {!activeOrderId ? (
              <p className="text-sm text-slate-500">
                Select an order first to add a payment.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Amount <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="0.00"
                  />
                  {orderDetail && (
                    <p className="text-xs text-slate-500">
                      Current balance:{" "}
                      <span className="font-semibold text-amber-300">
                        {formatCurrency(orderDetail.order.balanceDue)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Method <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formMethod}
                    onChange={(e) =>
                      setFormMethod(e.target.value as Payment["method"])
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
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
                  <label className="text-xs font-medium text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Reference #
                  </label>
                  <input
                    type="text"
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="GCash ref, bank ref, etc."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Notes
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="Optional notes (ex: partial payment, who paid, etc.)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!activeOrderId || savingPayment}
                  className="w-full rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {savingPayment ? "Saving payment…" : "Save payment"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {loadingSessions && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          Loading sessions…
        </div>
      )}
      {loadingOrders && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          Loading orders…
        </div>
      )}
    </div>
  );
}
