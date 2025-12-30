/* eslint-disable react-hooks/set-state-in-effect */
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Order, Payment, Shipment } from "../core/types";
import { useOrderPaymentsAndShipping } from "../hooks/useOrderPaymentsAndShipping";
import { usePaymentsShippingTutorial } from "../hooks/usePaymentsShippingTutorial";
import { useScrollRetention } from "../hooks/useScrollRetention";
import { updateOrderFees } from "../services/orders.service";
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

const PANEL_CARD_CLASS = "w-full min-w-0";
const PANEL_HEADER_CLASS = "border-b-0 px-4 pt-3 pb-0";
const PANEL_TITLE_CLASS = "text-xs font-medium text-slate-600";
const PANEL_CONTENT_CLASS = "pt-2";
const PANEL_BODY_WRAP_CLASS = "px-4 py-3";
const SUMMARY_VALUE_CLASS =
  "mt-1 font-semibold tabular-nums leading-tight text-[clamp(0.65rem,3.4vw,0.95rem)]";

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
    refreshOrdersForSession,
    refreshOrderData,
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
  const [formShippingFee, setFormShippingFee] = useState("");
  const [formBookingDate, setFormBookingDate] = useState("");
  const [formShipmentNotes, setFormShipmentNotes] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [formSection, setFormSection] = useState<"payment" | "shipment">("payment");
  const [formOtherFees, setFormOtherFees] = useState("");
  const [formOtherFeesNote, setFormOtherFeesNote] = useState("");
  const paymentSectionRef = useRef<HTMLDivElement | null>(null);
  const shipmentSectionRef = useRef<HTMLDivElement | null>(null);

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

  const paymentTotal = useMemo(() => {
    return payments.reduce((sum, payment) => {
      if (payment.status === "POSTED") {
        return sum + payment.amount;
      }
      return sum;
    }, 0);
  }, [payments]);

  const derivedBalance = useMemo(() => {
    if (!orderDetail) return 0;
    const total = orderDetail.order.grandTotal - paymentTotal;
    return total > 0 ? total : 0;
  }, [orderDetail, paymentTotal]);

  const derivedPaymentStatus = useMemo<Order["paymentStatus"]>(() => {
    if (!orderDetail) return "UNPAID";
    if (paymentTotal <= 0) return "UNPAID";
    if (paymentTotal >= orderDetail.order.grandTotal) return "PAID";
    return "PARTIAL";
  }, [orderDetail, paymentTotal]);

  const parsedFormAmount = useMemo(() => {
    const raw = formAmount.replace(/,/g, "").trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) ? value : 0;
  }, [formAmount]);

  const amountGreaterThanBalance =
    derivedBalance > 0 && parsedFormAmount > derivedBalance;

  const openPaymentModal = () => {
    setFormSection("payment");
    setFormVisible(true);
  };

  const openShipmentModal = () => {
    setFormSection("shipment");
    setFormVisible(true);
  };


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
    if (!activeOrderId) {
      setFormVisible(false);
    }
  }, [activeOrderId]);

  useEffect(() => {
    if (!formVisible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFormVisible(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formVisible]);

  useEffect(() => {
    if (!formVisible) return;
    const target =
      formSection === "payment" ? paymentSectionRef.current : shipmentSectionRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formVisible, formSection]);

  useEffect(() => {
    if (!orderDetail) return;
    setFormAmount(
      derivedBalance > 0
        ? derivedBalance.toFixed(2)
        : orderDetail.order.grandTotal.toFixed(2),
    );
  }, [orderDetail, derivedBalance]);

  useEffect(() => {
    if (!activeOrderId) {
      setFormCourier("");
      setFormShippingFee("");
      setFormBookingDate("");
      setFormShipmentNotes("");
      setFormOtherFees("");
      setFormOtherFeesNote("");
      return;
    }
    if (!shipment) {
      setFormCourier("");
      setFormShippingFee("");
      setFormBookingDate(todayDateInput());
      setFormShipmentNotes("");
      return;
    }
    setFormCourier(shipment.courier ?? "");
    setFormShippingFee(
      Number.isFinite(shipment.shippingFee as number)
        ? (shipment.shippingFee as number).toFixed(2)
        : ""
    );
    setFormBookingDate(shipment.bookingDate?.slice(0, 10) ?? "");
    setFormShipmentNotes(shipment.notes ?? "");
  }, [shipment, activeOrderId]);

  useEffect(() => {
    if (!orderDetail) {
      setFormOtherFees("");
      setFormOtherFeesNote("");
      return;
    }
    setFormOtherFees(
      Number.isFinite(orderDetail.order.otherFees as number)
        ? (orderDetail.order.otherFees as number).toFixed(2)
        : ""
    );
    setFormOtherFeesNote(orderDetail.order.otherFeesNote ?? "");
  }, [orderDetail]);

  async function handleSavePaymentAndShipment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!activeOrderId) {
      setError("Please select an order first.");
      return;
    }

    const isPaymentMode = formSection === "payment";
    const isShipmentMode = formSection === "shipment";
    let feeValue = 0;
    let otherFeeValue = 0;
    let otherFeeNote = "";

    if (isShipmentMode) {
      feeValue = parseFloat(
        formShippingFee.replace(/,/g, "").trim() || "0"
      );
      if (!Number.isFinite(feeValue) || feeValue < 0) {
        setError("Please enter a valid shipping fee (0 or above).");
        return;
      }

      otherFeeValue = parseFloat(
        formOtherFees.replace(/,/g, "").trim() || "0"
      );
      if (!Number.isFinite(otherFeeValue) || otherFeeValue < 0) {
        setError("Please enter a valid other fee (0 or above).");
        return;
      }
      otherFeeNote = formOtherFeesNote.trim();
    }

    let amount = 0;
    if (isPaymentMode) {
      const raw = formAmount.replace(/,/g, "").trim();
      amount = parseFloat(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Please enter a payment amount above 0.");
        return;
      }
      if (derivedBalance <= 0) {
        setError("Wala nang natitirang balance para sa order na ito.");
        return;
      }
      if (amount > derivedBalance) {
        setError(
          `Lagpas ang bayad sa natitirang balance (${formatCurrency(
            derivedBalance,
          )}). Bawasan muna.`,
        );
        return;
      }
    }

    try {
      if (isPaymentMode) {
        const dateIso = formDate ? new Date(formDate).toISOString() : undefined;
        await addPayment(
          {
            amount,
            method: formMethod,
            date: dateIso,
            referenceNumber: formRef.trim() || undefined,
            notes: formNotes.trim() || undefined,
          },
          { suppressInfo: true },
        );
        setFormRef("");
        setFormNotes("");
      }

      if (isShipmentMode) {
        await saveShipmentDetails(
          {
            courier: formCourier || "",
            shippingFee: feeValue,
            bookingDate: formBookingDate
              ? new Date(formBookingDate).toISOString()
              : undefined,
            notes: formShipmentNotes || undefined,
          },
          { suppressInfo: true },
        );

        await updateOrderFees(activeOrderId, {
          otherFees: otherFeeValue,
          otherFeesNote: otherFeeNote,
        });
      }

      await refreshOrderData(activeOrderId);
      if (activeSessionId) {
        await refreshOrdersForSession(activeSessionId);
      }

      setInfoMessage(isPaymentMode ? "Payment saved." : "Shipment saved.");
      setFormVisible(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleVoidPayment(payment: Payment) {
    if (payment.status === "VOIDED") return;
    if (!window.confirm("Void this payment?")) return;

    setError(null);
    setInfoMessage(null);
    await voidExistingPayment(payment.id);
  }

  async function handleQuickStatusChange(status: Shipment["status"]) {
    setError(null);
    setInfoMessage(null);
    await quickUpdateShipmentStatus(status);
  }
  return (
    <Page className="w-full max-w-none min-w-0 space-y-6">
      <div className="space-y-6">
      <Card className={PANEL_CARD_CLASS}>
        <CardContent className="grid gap-4 md:grid-cols-2 items-start">
          <div
            className="min-w-0 space-y-3 md:pr-6 md:border-r md:border-slate-200"
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
              className={cn(CONTROL_CLASS, "w-full")}
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

          <div className="min-w-0 space-y-3 md:pl-6" data-tour="payments-shipping-order">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Order</label>
              <select
                value={activeOrderId ?? ""}
                onChange={(e) =>
                  setActiveOrderId(e.target.value ? e.target.value : undefined)
                }
                className={cn(CONTROL_CLASS, "w-full")}
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
              <div className="flex flex-wrap gap-2">
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
        <div className="space-y-6 lg:col-span-12">
          <Card data-tour="payments-shipping-summary" className={PANEL_CARD_CLASS}>
            <CardHeader className={PANEL_HEADER_CLASS}>
              <CardTitle className={PANEL_TITLE_CLASS}>Order summary</CardTitle>
            </CardHeader>
            {loadingOrderData ? (
              <div className={cn(PANEL_BODY_WRAP_CLASS, "text-sm text-slate-600")}>
                Naglo-load pa ng detalye ng order...
              </div>
            ) : !orderDetail ? (
              <div className={cn(PANEL_BODY_WRAP_CLASS, "text-sm text-slate-600")}>
                Piliin ang order para makita ang kabuuan at mga bayad.
              </div>
            ) : (
              <CardContent className={cn(PANEL_CONTENT_CLASS, "space-y-4 text-sm")}>
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Subtotal
                    </div>
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-slate-900")}>
                      {formatCurrency(orderDetail.order.subtotal)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Discounts
                    </div>
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-slate-900")}>
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
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-slate-900")}>
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
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-slate-900")}>
                      {formatCurrency(orderDetail.order.otherFees)}
                    </div>
                    {orderDetail.order.otherFeesNote ? (
                      <div className="text-[10px] text-slate-500">
                        {orderDetail.order.otherFeesNote}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Grand total
                    </div>
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-emerald-700")}>
                      {formatCurrency(orderDetail.order.grandTotal)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Paid
                    </div>
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-slate-900")}>
                      {formatCurrency(orderDetail.order.amountPaid)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Balance
                    </div>
                    <div className={cn(SUMMARY_VALUE_CLASS, "text-amber-700")}>
                      {formatCurrency(derivedBalance)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">
                      Payment status
                    </div>
                    <div className="mt-1">
                      <Badge
                        variant={orderPaymentBadgeVariant(derivedPaymentStatus)}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {derivedPaymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="primary"
              size="cta"
              onClick={openShipmentModal}
              disabled={!activeOrderId}
              className="w-full sm:w-auto"
            >
              + Record shipment
            </Button>
            <Button
              variant="primary"
              size="cta"
              onClick={openPaymentModal}
              disabled={!activeOrderId}
              className="w-full sm:w-auto"
            >
              + Record payment
            </Button>
          </div>

          {formVisible && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
              onClick={() => setFormVisible(false)}
            >
              <div
                className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
                data-tour="payments-shipping-add-payment"
                role="dialog"
                aria-modal="true"
                aria-labelledby="payments-shipping-modal-title"
                aria-describedby="payments-shipping-modal-helper"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2
                      id="payments-shipping-modal-title"
                      className="text-lg font-semibold text-slate-900"
                    >
                      {formSection === "payment" ? "Payment" : "Shipment"}
                    </h2>
                    <p
                      id="payments-shipping-modal-helper"
                      className="mt-1 text-xs text-slate-600"
                    >
                      {formSection === "payment"
                        ? "Save payment info in a single step."
                        : "Save shipment info in a single step."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormVisible(false)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
                <form
                  onSubmit={handleSavePaymentAndShipment}
                  className="flex min-h-0 flex-1 flex-col text-sm"
                >
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {!activeOrderId ? (
                      <p className="text-sm text-slate-600">
                        Piliin muna ang order bago mag-update ng payment at
                        shipment.
                      </p>
                    ) : loadingOrderData ? (
                      <p className="text-sm text-slate-600">
                        Naglo-load pa ng order data...
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {formSection === "payment" && (
                          <div
                            ref={paymentSectionRef}
                            className="space-y-3 rounded-lg border border-slate-200 bg-white p-3"
                          >
                            <div className="text-xs font-medium text-slate-600">
                              Payment
                            </div>
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
                                    Natitirang balance:{" "}
                                    <span className="font-semibold text-amber-700">
                                      {formatCurrency(derivedBalance)}
                                    </span>
                                  </p>
                                )}
                                {orderDetail && derivedBalance <= 0 ? (
                                  <p className="text-xs text-rose-600">
                                    Wala nang natitirang balance para sa order na ito.
                                  </p>
                                ) : amountGreaterThanBalance ? (
                                  <p className="text-xs text-rose-600">
                                    Lagpas ang nilagay mong bayad sa natitirang
                                    balance ({formatCurrency(derivedBalance)}).
                                    Bawasan muna.
                                  </p>
                                ) : null}
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
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
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
                                  placeholder="GCash ref, bank ref, atbp."
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-600">
                                Notes
                              </label>
                              <textarea
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                                rows={3}
                                className={cn(CONTROL_CLASS, "min-h-[90px]")}
                                placeholder="Optional notes (hal. partial payment, sino ang nagbayad, atbp.)"
                              />
                            </div>
                          </div>
                        )}

                        {formSection === "shipment" && (
                          <>
                            <div
                              ref={shipmentSectionRef}
                              className="space-y-3 rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <div className="text-xs font-medium text-slate-600">
                                Shipment
                              </div>
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
                                    placeholder="J&T, JRS, LBC, atbp."
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
                                    onChange={(e) =>
                                      setFormShippingFee(e.target.value)
                                    }
                                    className={CONTROL_CLASS}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-600">
                                    Other fees
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={formOtherFees}
                                    onChange={(e) => setFormOtherFees(e.target.value)}
                                    className={CONTROL_CLASS}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-600">
                                    Other fee details
                                  </label>
                                  <input
                                    type="text"
                                    value={formOtherFeesNote}
                                    onChange={(e) =>
                                      setFormOtherFeesNote(e.target.value)
                                    }
                                    className={CONTROL_CLASS}
                                    placeholder="Packaging, tips, atbp."
                                  />
                                </div>
                              </div>
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
                                  Notes
                                </label>
                                <textarea
                                  value={formShipmentNotes}
                                  onChange={(e) =>
                                    setFormShipmentNotes(e.target.value)
                                  }
                                  rows={2}
                                  className={cn(CONTROL_CLASS, "min-h-[70px]")}
                                  placeholder="Mga paalala (special instructions, RTD reason, atbp.)"
                                />
                              </div>
                            </div>

                            {shipment && (
                              <div className="space-y-3 border-t border-slate-200 pt-3 text-xs">
                                <div className="text-xs font-medium text-slate-600">
                                  Quick status
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={updatingShipmentStatus}
                                    className="min-w-[140px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    onClick={() =>
                                      void handleQuickStatusChange("BOOKED")
                                    }
                                  >
                                    Mark as booked
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={updatingShipmentStatus}
                                    className="min-w-[140px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                                    className="min-w-[140px] border border-emerald-500/70 text-emerald-700 hover:bg-emerald-50"
                                  >
                                    Mark as delivered
                                  </Button>
                                </div>
                                <p className="text-xs text-slate-600">
                                  Current status:{" "}
                                  <span className="font-medium text-slate-900">
                                    {shipment.status}
                                  </span>{" "}
                                  | Huling update:{" "}
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
                      </div>
                    )}
                  </div>
                  <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-3">
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        disabled={
                          !activeOrderId ||
                          savingPayment ||
                          savingShipment ||
                          loadingOrderData
                        }
                      >
                        {savingPayment || savingShipment
                          ? "Saving..."
                          : formSection === "payment"
                            ? "Save payment"
                            : "Save shipment"}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          <Card data-tour="payments-shipping-payments" className={PANEL_CARD_CLASS}>
            <CardHeader
              className={cn(
                PANEL_HEADER_CLASS,
                "flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
              )}
            >
              <CardTitle className={PANEL_TITLE_CLASS}>
                Payments for this order
              </CardTitle>
              <div className="flex max-w-full flex-wrap items-center gap-2 pb-1 text-xs text-slate-600">
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
            <CardContent className={PANEL_CONTENT_CLASS}>
              <div ref={paymentsListRef} className="sm:max-h-64 sm:overflow-y-auto">
                {loadingOrderData ? (
                  <div className="text-sm text-slate-600">
                    Loading payments...
                  </div>
                ) : !activeOrderId ? (
                  <div className="text-sm text-slate-600">
                    Select an order first.
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-sm text-slate-600">
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

          <Card data-tour="payments-shipping-queue" className={PANEL_CARD_CLASS}>
            <CardHeader className={PANEL_HEADER_CLASS}>
              <CardTitle className={PANEL_TITLE_CLASS}>
                Shipping queue for this session
              </CardTitle>
            </CardHeader>
            <CardContent className={PANEL_CONTENT_CLASS}>
              <div ref={queueListRef} className="sm:max-h-[420px] sm:overflow-y-auto">
                {loadingOrders ? (
                  <div className="text-sm text-slate-600">
                    Loading orders...
                  </div>
                ) : queueOrders.length === 0 ? (
                  <div className="text-sm text-slate-600">
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

