/* eslint-disable react-hooks/set-state-in-effect */
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Order, Payment, Shipment } from "../core/types";
import { useOrderPaymentsAndShipping } from "../hooks/useOrderPaymentsAndShipping";
import { INPUT_CLASS, MUTED_PANEL_CLASS, PANEL_CLASS } from "../theme/classes";

// Combined Payments + Shipping workspace.
// Routing: add Route path="payments-shipping" to App.tsx and point the sidebar there (see MainLayout).
// Logic reuse: all actions call existing payments/shipments/orders services via useOrderPaymentsAndShipping hook.

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600";

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `\u20b1${num.toLocaleString("en-PH", {
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
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

export function PaymentsShippingPage() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    orders,
    queueOrders,
    activeOrderId,
    setActiveOrderId,
    customerMap,
    orderDetail,
    payments,
    shipment,
    loadingSessions,
    loadingOrders,
    loadingOrderData,
    savingPayment,
    voidingPaymentId,
    savingShipment,
    updatingShipmentStatus,
    error,
    infoMessage,
    setError,
    setInfoMessage,
    addPayment,
    voidExistingPayment,
    saveShipmentDetails,
    quickUpdateShipmentStatus,
  } = useOrderPaymentsAndShipping();

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

  const [formCourier, setFormCourier] = useState("");
  const [formTracking, setFormTracking] = useState("");
  const [formShippingFee, setFormShippingFee] = useState("");
  const [formStatus, setFormStatus] = useState<Shipment["status"]>("PENDING");
  const [formBookingDate, setFormBookingDate] = useState("");
  const [formShipDate, setFormShipDate] = useState("");
  const [formDeliveryDate, setFormDeliveryDate] = useState("");
  const [formShipmentNotes, setFormShipmentNotes] = useState("");

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

  useEffect(() => {
    if (
      !activeOrderId ||
      !filteredOrders.some((o) => o.id === activeOrderId)
    ) {
      const next = filteredOrders[0]?.id;
      setActiveOrderId(next);
    }
  }, [filteredOrders, activeOrderId, setActiveOrderId]);

  useEffect(() => {
    if (!orderDetail) return;
    const balance = orderDetail.order.balanceDue ?? 0;
    setFormAmount(
      balance > 0
        ? balance.toFixed(2)
        : orderDetail.order.grandTotal.toFixed(2)
    );
  }, [orderDetail]);

  useEffect(() => {
    if (!activeOrderId) {
      setFormCourier("");
      setFormTracking("");
      setFormShippingFee("");
      setFormStatus("PENDING");
      setFormBookingDate("");
      setFormShipDate("");
      setFormDeliveryDate("");
      setFormShipmentNotes("");
      return;
    }
    if (!shipment) {
      setFormCourier("");
      setFormTracking("");
      setFormShippingFee("");
      setFormStatus("PENDING");
      setFormBookingDate(todayDateInput());
      setFormShipDate("");
      setFormDeliveryDate("");
      setFormShipmentNotes("");
      return;
    }
    setFormCourier(shipment.courier ?? "");
    setFormTracking(shipment.trackingNumber ?? "");
    setFormShippingFee(
      Number.isFinite(shipment.shippingFee as number)
        ? (shipment.shippingFee as number).toFixed(2)
        : ""
    );
    setFormStatus(shipment.status);
    setFormBookingDate(shipment.bookingDate?.slice(0, 10) ?? "");
    setFormShipDate(shipment.shipDate?.slice(0, 10) ?? "");
    setFormDeliveryDate(shipment.deliveryDate?.slice(0, 10) ?? "");
    setFormShipmentNotes(shipment.notes ?? "");
  }, [shipment, activeOrderId]);

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

    const dateIso = formDate ? new Date(formDate).toISOString() : undefined;

    await addPayment({
      amount,
      method: formMethod,
      date: dateIso,
      referenceNumber: formRef.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });

    setFormRef("");
    setFormNotes("");
  }

  async function handleVoidPayment(payment: Payment) {
    if (payment.status === "VOIDED") return;
    if (!window.confirm("Void this payment?")) return;

    setError(null);
    setInfoMessage(null);
    await voidExistingPayment(payment.id);
  }

  async function handleSaveShipment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!activeOrderId) {
      setError("Please select an order first.");
      return;
    }

    const feeValue = parseFloat(
      formShippingFee.replace(/,/g, "").trim() || "0"
    );
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      setError("Please enter a valid shipping fee (0 or above).");
      return;
    }

    await saveShipmentDetails({
      courier: formCourier || "",
      trackingNumber: formTracking || "",
      shippingFee: feeValue,
      status: formStatus,
      bookingDate: formBookingDate
        ? new Date(formBookingDate).toISOString()
        : undefined,
      shipDate: formShipDate
        ? new Date(formShipDate).toISOString()
        : undefined,
      deliveryDate: formDeliveryDate
        ? new Date(formDeliveryDate).toISOString()
        : undefined,
      notes: formShipmentNotes || undefined,
    });
  }

  async function handleQuickStatusChange(status: Shipment["status"]) {
    setError(null);
    setInfoMessage(null);
    await quickUpdateShipmentStatus(status);
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Payments &amp; Shipping
        </h1>
        <p className="text-sm text-slate-600">
          One workspace to review an order, record payments, and update shipment
          details. Statuses stay in sync with finance and fulfillment.
        </p>
      </div>

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
                    {"\u20b1"}
                    {activeSession.targetRevenue.toLocaleString("en-PH")}
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
            {["ALL", "UNPAID", "PARTIAL", "PAID"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setOrderPaymentFilter(status as Order["paymentStatus"] | "ALL")}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Order summary
            </div>
            {loadingOrderData ? (
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

          <div className={PANEL_CLASS}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span>Payments for this order</span>
              <div className="flex items-center gap-2 text-[11px] font-normal lowercase text-slate-600">
                <span>Method:</span>
                {(
                  ["ALL", "GCASH", "MAYA", "BANK", "COD", "CASH", "OTHER"] as const
                ).map((method) => (
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
                ))}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingOrderData ? (
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
        <div className="space-y-4">
          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Shipment details
            </div>

            <form onSubmit={handleSaveShipment} className="space-y-3 p-3 text-sm">
              {!activeOrderId ? (
                <p className="text-sm text-slate-600">
                  Select an order from the queue to create or edit its shipment.
                </p>
              ) : loadingOrderData ? (
                <p className="text-sm text-slate-600">Loading shipment info...</p>
              ) : (
                <>
                  {orderDetail && (
                    <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
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
                      <div
                        className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                      >
                        <div className="text-slate-600">Order status</div>
                        <div className="font-semibold text-slate-900">
                          {orderDetail.order.status}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      Courier <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCourier}
                      onChange={(e) => setFormCourier(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="J&T, JRS, LBC, etc."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      Tracking number
                    </label>
                    <input
                      type="text"
                      value={formTracking}
                      onChange={(e) => setFormTracking(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Tracking number from courier"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      Shipping fee
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={formShippingFee}
                      onChange={(e) => setFormShippingFee(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) =>
                        setFormStatus(e.target.value as Shipment["status"])
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="BOOKED">Booked / To pick up</option>
                      <option value="IN_TRANSIT">In transit</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="RETURNED">Returned</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">
                        Booking date
                      </label>
                      <input
                        type="date"
                        value={formBookingDate}
                        onChange={(e) => setFormBookingDate(e.target.value)}
                        className={`${INPUT_CLASS} text-xs`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">
                        Ship date
                      </label>
                      <input
                        type="date"
                        value={formShipDate}
                        onChange={(e) => setFormShipDate(e.target.value)}
                        className={`${INPUT_CLASS} text-xs`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">
                        Delivery date
                      </label>
                      <input
                        type="date"
                        value={formDeliveryDate}
                        onChange={(e) => setFormDeliveryDate(e.target.value)}
                        className={`${INPUT_CLASS} text-xs`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      Notes
                    </label>
                    <textarea
                      value={formShipmentNotes}
                      onChange={(e) => setFormShipmentNotes(e.target.value)}
                      rows={3}
                      className={`${INPUT_CLASS} min-h-[90px]`}
                      placeholder="Optional notes (ex: rider, special instructions, RTD reason, etc.)"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingShipment}
                    className="w-full rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    {savingShipment ? "Saving shipment..." : "Save shipment"}
                  </button>

                  {shipment && (
                    <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs">
                      <div className="text-slate-600">Quick status:</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={updatingShipmentStatus}
                          onClick={() => void handleQuickStatusChange("BOOKED")}
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Mark as booked
                        </button>
                        <button
                          type="button"
                          disabled={updatingShipmentStatus}
                          onClick={() =>
                            void handleQuickStatusChange("IN_TRANSIT")
                          }
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Mark as in transit
                        </button>
                        <button
                          type="button"
                          disabled={updatingShipmentStatus}
                          onClick={() =>
                            void handleQuickStatusChange("DELIVERED")
                          }
                          className="rounded border border-emerald-500/70 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Mark as delivered
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Current status:{" "}
                        <span className="font-medium text-slate-900">
                          {shipment.status}
                        </span>{" "}
                        | Last updated:{" "}
                        <span className="font-medium text-slate-900">
                          {formatDateTime(
                            shipment.deliveryDate ?? shipment.shipDate
                          )}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </form>
          </div>

          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Shipping queue for this session
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {loadingOrders ? (
                <div className="px-3 py-4 text-sm text-slate-600">
                  Loading orders...
                </div>
              ) : queueOrders.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-600">
                  Walang orders pa for this session (or all are cancelled /
                  returned).
                </div>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className={TABLE_HEAD_CLASS}>
                    <tr>
                      <th className="px-3 py-2">Order #</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2 text-right">Grand total</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueOrders.map((o) => {
                      const isActive = o.id === activeOrderId;
                      return (
                        <tr
                          key={o.id}
                          className={`border-t border-slate-200 hover:bg-slate-50 ${
                            isActive ? "bg-slate-100" : "bg-transparent"
                          }`}
                          onClick={() => setActiveOrderId(o.id)}
                        >
                          <td className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-emerald-700">
                            {o.orderNumber}
                          </td>
                          <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-900">
                            {formatCustomerLabel(
                              o.customerId,
                              customerMap[o.customerId ?? ""]?.displayName,
                              customerMap[o.customerId ?? ""]?.realName
                            )}
                          </td>
                          <td className="cursor-pointer px-3 py-2 text-right text-[11px] text-slate-900">
                            {formatCurrency(o.grandTotal)}
                          </td>
                          <td className="cursor-pointer px-3 py-2 text-right text-[11px] text-slate-900">
                            {formatCurrency(o.amountPaid)}
                          </td>
                          <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-900">
                            {o.paymentStatus}
                          </td>
                          <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-900">
                            {o.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {loadingSessions && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}
        >
          Loading sessions...
        </div>
      )}
      {loadingOrders && !loadingSessions && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}
        >
          Loading orders...
        </div>
      )}
    </div>
  );
}
