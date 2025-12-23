/* eslint-disable react-hooks/set-state-in-effect */
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Order, Payment, Shipment } from "../core/types";
import { useOrderPaymentsAndShipping } from "../hooks/useOrderPaymentsAndShipping";
import { usePaymentsShippingTutorial } from "../hooks/usePaymentsShippingTutorial";
import { useScrollRetention } from "../hooks/useScrollRetention";
import { Page } from "../components/layout/Page";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { PaymentsShippingHelpButton } from "../components/paymentsShipping/PaymentsShippingHelpButton";
import { PaymentsShippingTutorialOverlay } from "../components/paymentsShipping/PaymentsShippingTutorialOverlay";

// Combined Payments + Shipping workspace.
// Routing: add Route path="payments-shipping" to App.tsx and point the sidebar there (see MainLayout).
// Logic reuse: all actions call existing payments/shipments/orders services via useOrderPaymentsAndShipping hook.

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500";

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

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

function orderPaymentBadgeVariant(
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

function paymentRecordBadgeVariant(
  status: Payment["status"],
): "neutral" | "success" | "danger" {
  if (status === "VOIDED") return "danger";
  if (status === "POSTED") return "success";
  return "neutral";
}

export function PaymentsShippingPage() {
  const tutorial = usePaymentsShippingTutorial();
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

  const paymentsListRef = useScrollRetention<HTMLDivElement>(
    !loadingOrderData,
    [loadingOrderData, filteredPayments.length, activeOrderId]
  );

  const queueListRef = useScrollRetention<HTMLDivElement>(
    !loadingOrders,
    [loadingOrders, queueOrders.length, activeSessionId]
  );

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
    <Page className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div
            className="space-y-2 md:pr-4 md:border-r md:border-slate-200"
            data-tour="payments-shipping-session"
          >
            <label className="text-xs font-medium text-slate-600">
              Live session
            </label>
            <select
              value={activeSessionId ?? ""}
              onChange={(e) =>
                setActiveSessionId(e.target.value ? e.target.value : undefined)
              }
              className={CONTROL_CLASS}
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
                      {formatCurrency(activeSession.targetRevenue)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="space-y-3 md:pl-4" data-tour="payments-shipping-order">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Order</label>
              <select
                value={activeOrderId ?? ""}
                onChange={(e) =>
                  setActiveOrderId(e.target.value ? e.target.value : undefined)
                }
                className={CONTROL_CLASS}
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
                      customerMap[o.customerId ?? ""]?.realName,
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
            </div>

            <div className="space-y-2" data-tour="payments-shipping-payment-filter">
              <div className="text-xs font-medium text-slate-600">
                Filter by payment
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {(["ALL", "UNPAID", "PARTIAL", "PAID"] as const).map(
                  (status) => {
                    const active = orderPaymentFilter === status;
                    const count =
                      status === "ALL"
                        ? orders.length
                        : paymentCounts[status] ?? 0;
                    return (
                      <Button
                        key={status}
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setOrderPaymentFilter(
                            status === "ALL" ? "ALL" : status,
                          )
                        }
                        className={cn(
                          "rounded-full font-medium whitespace-nowrap",
                          active
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <span className="capitalize">
                          {status === "ALL" ? "All" : status.toLowerCase()}
                        </span>
                        <span
                          className={cn(
                            "ml-1 tabular-nums",
                            active ? "text-emerald-700/80" : "text-slate-500",
                          )}
                        >
                          {count}
                        </span>
                      </Button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-6">
          <Card data-tour="payments-shipping-summary">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            {loadingOrderData ? (
              <div className="px-4 py-4 text-sm text-slate-600">
                Loading order details...
              </div>
            ) : !orderDetail ? (
              <div className="px-4 py-4 text-sm text-slate-600">
                Select an order to see its totals and payments.
              </div>
            ) : (
              <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-600">
                      Order #
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {orderDetail.order.orderNumber}
                    </div>
                    <div className="text-xs text-slate-600">
                      {formatCustomerLabel(
                        orderDetail.order.customerId,
                        orderDetail.customer?.displayName ??
                          customerMap[orderDetail.order.customerId]?.displayName,
                        orderDetail.customer?.realName ??
                          customerMap[orderDetail.order.customerId]?.realName,
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-600">
                      Created
                    </div>
                    <div className="text-xs text-slate-700">
                      {formatDateTime(orderDetail.order.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Subtotal
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(orderDetail.order.subtotal)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Discounts
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(
                        (orderDetail.order.discountTotal ?? 0) +
                          (orderDetail.order.promoDiscountTotal ?? 0),
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Shipping + COD
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(
                        (orderDetail.order.shippingFee ?? 0) +
                          (orderDetail.order.codFee ?? 0),
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Other fees
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(orderDetail.order.otherFees)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Grand total
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(orderDetail.order.grandTotal)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Paid
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(orderDetail.order.amountPaid)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Balance
                    </div>
                    <div className="mt-1 font-semibold tabular-nums text-amber-700">
                      {formatCurrency(orderDetail.order.balanceDue)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Payment status
                    </div>
                    <div className="mt-1">
                      <Badge
                        variant={orderPaymentBadgeVariant(
                          orderDetail.order.paymentStatus,
                        )}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {orderDetail.order.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <Card data-tour="payments-shipping-payments">
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Payments for this order</CardTitle>
              <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-600">
                <span className="shrink-0">Method:</span>
                {(
                  ["ALL", "GCASH", "MAYA", "BANK", "COD", "CASH", "OTHER"] as const
                ).map((method) => {
                  const active = paymentMethodFilter === method;
                  const count =
                    method === "ALL"
                      ? payments.length
                      : methodCounts[method as Payment["method"]] ?? 0;
                  return (
                    <Button
                      key={method}
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setPaymentMethodFilter(method === "ALL" ? "ALL" : method)
                      }
                      className={cn(
                        "rounded-full font-medium whitespace-nowrap",
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {method === "ALL" ? "All" : method}
                      <span
                        className={cn(
                          "ml-1 tabular-nums",
                          active ? "text-emerald-700/80" : "text-slate-500",
                        )}
                      >
                        ({count})
                      </span>
                    </Button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={paymentsListRef} className="max-h-64 overflow-y-auto">
                {loadingOrderData ? (
                  <div className="px-4 py-4 text-sm text-slate-600">
                    Loading payments...
                  </div>
                ) : !activeOrderId ? (
                  <div className="px-4 py-4 text-sm text-slate-600">
                    Select an order first.
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-600">
                    Walang payments pa for this order.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                          <tr
                            key={p.id}
                            className="border-t border-slate-200 hover:bg-slate-50"
                          >
                            <td className="px-3 py-2 text-[11px] text-slate-700">
                              {formatDateTime(p.date)}
                            </td>
                            <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-700">
                              {p.method}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-500">
                              {p.referenceNumber ?? "-"}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-700">
                              <Badge
                                variant={paymentRecordBadgeVariant(p.status)}
                                className="text-[10px] uppercase tracking-wide"
                              >
                                {p.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right text-[11px]">
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={p.status === "VOIDED"}
                                onClick={() => void handleVoidPayment(p)}
                              >
                                {voidingPaymentId === p.id
                                  ? "Voiding..."
                                  : p.status === "VOIDED"
                                  ? "Voided"
                                  : "Void"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-tour="payments-shipping-add-payment">
            <CardHeader>
              <CardTitle>Add payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitPayment} className="space-y-4 text-sm">
                {!activeOrderId ? (
                  <p className="text-sm text-slate-600">
                    Select an order first to add a payment.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">
                        Amount <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className={CONTROL_CLASS}
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
                      <label className="text-xs font-medium text-slate-600">
                        Method <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formMethod}
                        onChange={(e) =>
                          setFormMethod(e.target.value as Payment["method"])
                        }
                        className={CONTROL_CLASS}
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
                      <label className="text-xs font-medium text-slate-600">
                        Date
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className={CONTROL_CLASS}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">
                        Reference #
                      </label>
                      <input
                        type="text"
                        value={formRef}
                        onChange={(e) => setFormRef(e.target.value)}
                        className={CONTROL_CLASS}
                        placeholder="GCash ref, bank ref, etc."
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-slate-600">
                        Notes
                      </label>
                      <textarea
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        rows={3}
                        className={cn(CONTROL_CLASS, "min-h-[90px]")}
                        placeholder="Optional notes (ex: partial payment, who paid, etc.)"
                      />
                    </div>

                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={!activeOrderId || savingPayment}
                        className="w-full sm:w-auto"
                      >
                        {savingPayment ? "Saving payment..." : "Save payment"}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6 lg:col-span-6">
          <Card data-tour="payments-shipping-shipment">
            <CardHeader>
              <CardTitle>Shipment details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveShipment} className="space-y-4 text-sm">
                {!activeOrderId ? (
                  <p className="text-sm text-slate-600">
                    Select an order from the queue to create or edit its shipment.
                  </p>
                ) : loadingOrderData ? (
                  <p className="text-sm text-slate-600">
                    Loading shipment info...
                  </p>
                ) : (
                  <>
                    {orderDetail && (
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="text-xs font-medium text-slate-600">
                            Grand total
                          </div>
                          <div className="mt-1 font-semibold tabular-nums text-emerald-700">
                            {formatCurrency(orderDetail.order.grandTotal)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="text-xs font-medium text-slate-600">
                            Balance
                          </div>
                          <div className="mt-1 font-semibold tabular-nums text-amber-700">
                            {formatCurrency(orderDetail.order.balanceDue)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="text-xs font-medium text-slate-600">
                            Payment status
                          </div>
                          <div className="mt-1">
                            <Badge
                              variant={orderPaymentBadgeVariant(
                                orderDetail.order.paymentStatus,
                              )}
                              className="text-[10px] uppercase tracking-wide"
                            >
                              {orderDetail.order.paymentStatus}
                            </Badge>
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="text-xs font-medium text-slate-600">
                            Order status
                          </div>
                          <div className="mt-1">
                            <Badge
                              variant={orderStatusBadgeVariant(
                                orderDetail.order.status,
                              )}
                              className="text-[10px] uppercase tracking-wide"
                            >
                              {orderDetail.order.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Courier <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formCourier}
                          onChange={(e) => setFormCourier(e.target.value)}
                          className={CONTROL_CLASS}
                          placeholder="J&T, JRS, LBC, etc."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Tracking number
                        </label>
                        <input
                          type="text"
                          value={formTracking}
                          onChange={(e) => setFormTracking(e.target.value)}
                          className={CONTROL_CLASS}
                          placeholder="Tracking number from courier"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Shipping fee
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={formShippingFee}
                          onChange={(e) => setFormShippingFee(e.target.value)}
                          className={CONTROL_CLASS}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Status
                        </label>
                        <select
                          value={formStatus}
                          onChange={(e) =>
                            setFormStatus(e.target.value as Shipment["status"])
                          }
                          className={CONTROL_CLASS}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="BOOKED">Booked / To pick up</option>
                          <option value="IN_TRANSIT">In transit</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="RETURNED">Returned</option>
                          <option value="LOST">Lost</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Booking date
                        </label>
                        <input
                          type="date"
                          value={formBookingDate}
                          onChange={(e) => setFormBookingDate(e.target.value)}
                          className={CONTROL_CLASS}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Ship date
                        </label>
                        <input
                          type="date"
                          value={formShipDate}
                          onChange={(e) => setFormShipDate(e.target.value)}
                          className={CONTROL_CLASS}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Delivery date
                        </label>
                        <input
                          type="date"
                          value={formDeliveryDate}
                          onChange={(e) => setFormDeliveryDate(e.target.value)}
                          className={CONTROL_CLASS}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">
                        Notes
                      </label>
                      <textarea
                        value={formShipmentNotes}
                        onChange={(e) => setFormShipmentNotes(e.target.value)}
                        rows={3}
                        className={cn(CONTROL_CLASS, "min-h-[90px]")}
                        placeholder="Optional notes (ex: rider, special instructions, RTD reason, etc.)"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={savingShipment}
                        className="w-full sm:w-auto"
                      >
                        {savingShipment ? "Saving shipment..." : "Save shipment"}
                      </Button>
                    </div>

                    {shipment && (
                      <div className="space-y-2 border-t border-slate-200 pt-3 text-xs">
                        <div className="text-xs font-medium text-slate-600">
                          Quick status
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updatingShipmentStatus}
                            onClick={() => void handleQuickStatusChange("BOOKED")}
                          >
                            Mark as booked
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updatingShipmentStatus}
                            onClick={() =>
                              void handleQuickStatusChange("IN_TRANSIT")
                            }
                          >
                            Mark as in transit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updatingShipmentStatus}
                            onClick={() =>
                              void handleQuickStatusChange("DELIVERED")
                            }
                            className="border-emerald-500/70 text-emerald-700 hover:bg-emerald-50"
                          >
                            Mark as delivered
                          </Button>
                        </div>
                        <p className="text-xs text-slate-600">
                          Current status:{" "}
                          <span className="font-medium text-slate-900">
                            {shipment.status}
                          </span>{" "}
                          | Last updated:{" "}
                          <span className="font-medium text-slate-900">
                            {formatDateTime(
                              shipment.deliveryDate ?? shipment.shipDate,
                            )}
                          </span>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          <Card data-tour="payments-shipping-queue">
            <CardHeader>
              <CardTitle>Shipping queue for this session</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={queueListRef} className="max-h-[420px] overflow-y-auto">
                {loadingOrders ? (
                  <div className="px-4 py-4 text-sm text-slate-600">
                    Loading orders...
                  </div>
                ) : queueOrders.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-600">
                    Walang orders pa for this session (or all are cancelled /
                    returned).
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                              className={cn(
                                "border-t border-slate-200 hover:bg-slate-50",
                                isActive && "bg-emerald-50",
                              )}
                              onClick={() => setActiveOrderId(o.id)}
                            >
                              <td
                                className={cn(
                                  "cursor-pointer px-3 py-2 text-[11px] font-semibold text-emerald-700",
                                  isActive && "border-l-4 border-emerald-500",
                                )}
                              >
                                {o.orderNumber}
                              </td>
                              <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-900">
                                {formatCustomerLabel(
                                  o.customerId,
                                  customerMap[o.customerId ?? ""]?.displayName,
                                  customerMap[o.customerId ?? ""]?.realName,
                                )}
                              </td>
                              <td className="cursor-pointer px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                                {formatCurrency(o.grandTotal)}
                              </td>
                              <td className="cursor-pointer px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                                {formatCurrency(o.amountPaid)}
                              </td>
                              <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-900">
                                <Badge
                                  variant={orderPaymentBadgeVariant(
                                    o.paymentStatus,
                                  )}
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  {o.paymentStatus}
                                </Badge>
                              </td>
                              <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-900">
                                <Badge
                                  variant={orderStatusBadgeVariant(o.status)}
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  {o.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {loadingSessions && (
        <Card className="bg-slate-50">
          <CardContent className="py-2 text-xs text-slate-600">
            Loading sessions...
          </CardContent>
        </Card>
      )}
      {loadingOrders && !loadingSessions && (
        <Card className="bg-slate-50">
          <CardContent className="py-2 text-xs text-slate-600">
            Loading orders...
          </CardContent>
        </Card>
      )}
      <PaymentsShippingHelpButton onClick={tutorial.open} />
      <PaymentsShippingTutorialOverlay
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
