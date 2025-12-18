import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveSession, Order, PaymentStatus } from "../core/types";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  buildOrdersFromClaims,
  getOrderDetail,
  listOrdersForSession,
  updateOrderDiscount,
  updateOrderFees,
  type OrderDetail,
} from "../services/orders.service";
import { listClaimsForSession } from "../services/claims.service";
import { listCustomerBasics } from "../services/customers.service";
import { useAppSettings } from "../hooks/useAppSettings";
import { PANEL_CLASS, MUTED_PANEL_CLASS, INPUT_CLASS } from "../theme/classes";
import { useNotification } from "../components/NotificationProvider";

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600";

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function formatCustomerLabel(
  id?: string | null,
  displayName?: string | null
): string {
  if (displayName && displayName.trim()) return displayName.trim();
  if (!id) return "Customer";
  const clean = id.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 6)}???${clean.slice(-4)}`;
}

function paymentLabel(status: PaymentStatus) {
  switch (status) {
    case "UNPAID":
      return "Hindi pa bayad";
    case "PARTIAL":
      return "May partial na bayad";
    case "PAID":
      return "Kumpleto ang bayad";
    default:
      return status;
  }
}

function shippingLabel(status: Order["status"]) {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Hintay sa bayad bago ipadala";
    case "PARTIALLY_PAID":
      return "May bayad na, puwedeng i-pack";
    case "PAID":
      return "Bayad na, puwedeng i-pack/ship";
    case "PACKING":
      return "Pinapack na ang order";
    case "SHIPPED":
      return "Na-ship na, hintay ma-deliver";
    case "DELIVERED":
      return "Na-deliver na";
    default:
      return status;
  }
}

export function OrdersPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    undefined
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<OrderDetail | null>(
    null
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "ALL">(
    "ALL"
  );
  const [statusFilter, setStatusFilter] = useState<Order["status"] | "ALL">(
    "ALL"
  );

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [building, setBuilding] = useState(false);
  const [acceptedClaimsCount, setAcceptedClaimsCount] = useState(0);
  const [autoBuildAttempted, setAutoBuildAttempted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const { settings } = useAppSettings();
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState<string>("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const { notify } = useNotification();
  const [customerMap, setCustomerMap] = useState<
    Record<string, { displayName?: string }>
  >({});

  useEffect(() => {
    void (async () => {
      try {
        setLoadingSessions(true);
        const list = await listLiveSessions();
        const basics = await listCustomerBasics();
        setSessions(list);
        const map: Record<string, { displayName?: string }> = {};
        basics.forEach((c) => {
          map[c.id] = { displayName: c.displayName };
        });
        setCustomerMap(map);

        if (list.length > 0) {
          const live = list.find((s) => s.status === "LIVE");
          setActiveSessionId((live ?? list[0]).id);
        }
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load live sessions.");
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, []);

  const refreshOrders = useCallback(
    async (sessionId: string, preferOrderId?: string) => {
      try {
        setLoadingOrders(true);
        setError(null);
        const list = await listOrdersForSession(sessionId);
        setOrders(list);

        const existingId = preferOrderId ?? selectedOrderId;
        const fallbackId = list[0]?.id ?? null;
        const nextId =
          existingId && list.some((o) => o.id === existingId)
            ? existingId
            : fallbackId;

        setSelectedOrderId(nextId);

        if (nextId) {
          const detail = await getOrderDetail(nextId);
          setSelectedDetail(detail);
        } else {
          setSelectedDetail(null);
        }
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load orders.");
      } finally {
        setLoadingOrders(false);
      }
    },
    [selectedOrderId]
  );

  useEffect(() => {
    if (!activeSessionId) {
      setOrders([]);
      setSelectedOrderId(null);
      setSelectedDetail(null);
      setAcceptedClaimsCount(0);
      setAutoBuildAttempted(false);
      return;
    }
    void refreshOrders(activeSessionId);
    void (async () => {
      try {
        const claims = await listClaimsForSession(activeSessionId);
        const accepted = claims.filter((c) => c.status === "ACCEPTED").length;
        setAcceptedClaimsCount(accepted);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [activeSessionId, refreshOrders]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  useEffect(() => {
    if (selectedDetail?.order) {
      const current = selectedDetail.order.promoDiscountTotal ?? 0;
      setDiscountInput(current > 0 ? current.toFixed(2) : "");
    } else {
      setDiscountInput("");
    }
  }, [selectedDetail]);

  const loadOrderDetail = useCallback(
    async (orderId: string) => {
      try {
        setLoadingDetail(true);
        const detail = await getOrderDetail(orderId);
        setSelectedDetail(detail);
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load order details.");
      } finally {
        setLoadingDetail(false);
      }
    },
    []
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesPayment =
        paymentFilter === "ALL" ? true : order.paymentStatus === paymentFilter;
      const matchesStatus =
        statusFilter === "ALL" ? true : order.status === statusFilter;
      return matchesPayment && matchesStatus;
    });
  }, [orders, paymentFilter, statusFilter]);

  useEffect(() => {
    if (
      selectedOrderId &&
      !filteredOrders.some((o) => o.id === selectedOrderId)
    ) {
      const next = filteredOrders[0]?.id ?? null;
      setSelectedOrderId(next);
      if (next) {
        void loadOrderDetail(next);
      } else {
        setSelectedDetail(null);
      }
    } else if (!selectedOrderId && filteredOrders.length > 0) {
      const next = filteredOrders[0].id;
      setSelectedOrderId(next);
      void loadOrderDetail(next);
    }
  }, [filteredOrders, selectedOrderId, loadOrderDetail]);

  async function handleBuildFromClaims() {
    if (!activeSessionId) return;
    setBuilding(true);
    setError(null);
    setInfoMessage(null);

    try {
      const result = await buildOrdersFromClaims(activeSessionId);
      setInfoMessage(
        `Created ${result.createdOrders} order(s) with ${result.createdLines} line(s) from accepted claims.`
      );
      await refreshOrders(activeSessionId);
      setAutoBuildAttempted(true);
      notify("Orders built from claims", "success");
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to build orders from claims.");
      notify("Failed to build orders from claims", "error");
    } finally {
      setBuilding(false);
    }
  }

  async function applyDiscountAmount(amount: number) {
    if (!selectedDetail) return;
    try {
      setError(null);
      setInfoMessage(null);
      setApplyingDiscount(true);
      await updateOrderDiscount(selectedDetail.order.id, amount);
      setInfoMessage("Discount applied and totals updated.");
      await loadOrderDetail(selectedDetail.order.id);
      if (activeSessionId) {
        await refreshOrders(activeSessionId, selectedDetail.order.id);
      }
      notify(amount > 0 ? "Discount applied" : "Discount removed", "success");
    } catch (e) {
      console.error(e);
      setError("Failed to apply discount.");
      notify("Failed to apply discount", "error");
    } finally {
      setApplyingDiscount(false);
    }
  }

  async function handleApplyDiscount() {
    const raw = discountInput.replace(/,/g, "").trim();
    const amount = raw === "" ? 0 : parseFloat(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid discount (0 or above).");
      return;
    }
    await applyDiscountAmount(amount);
  }

  async function handleClearDiscount() {
    setDiscountInput("");
    await applyDiscountAmount(0);
  }

  function prePromoTotal(order: Order): number {
    const promo = order.promoDiscountTotal ?? 0;
    return (order.grandTotal ?? 0) + promo;
  }

  async function applyPercentPromo(percent: number) {
    if (!selectedDetail) return;
    const base = prePromoTotal(selectedDetail.order);
    const amount = Math.max(0, (base * percent) / 100);
    setDiscountInput(amount.toFixed(2));
    await applyDiscountAmount(amount);
  }

  async function applyFreeShipping() {
    if (!selectedDetail) return;
    try {
      setApplyingDiscount(true);
      await updateOrderFees(selectedDetail.order.id, { shippingFee: 0 });
      await loadOrderDetail(selectedDetail.order.id);
      if (activeSessionId) {
        await refreshOrders(activeSessionId, selectedDetail.order.id);
      }
      notify("Shipping fee set to 0 (promo)", "success");
    } catch (e) {
      console.error(e);
      notify("Failed to apply free shipping", "error");
    } finally {
      setApplyingDiscount(false);
    }
  }

  useEffect(() => {
    if (
      !building &&
      !autoBuildAttempted &&
      activeSessionId &&
      acceptedClaimsCount > 0 &&
      orders.length === 0
    ) {
      setAutoBuildAttempted(true);
      void handleBuildFromClaims();
    }
    // intentionally omit handleBuildFromClaims to avoid recreating the effect on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    acceptedClaimsCount,
    orders.length,
    building,
    autoBuildAttempted,
    activeSessionId,
  ]);

  const hasOrders = orders.length > 0;
  const paymentCounts = useMemo(() => {
    const counts: Record<PaymentStatus, number> = {
      UNPAID: 0,
      PARTIAL: 0,
      PAID: 0,
    };
    for (const o of orders) {
      counts[o.paymentStatus] = (counts[o.paymentStatus] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const businessName =
    settings?.businessName?.trim() || "Live Seller Command Center";
  const ownerName = settings?.ownerName?.trim() || "Owner not set";
  const contactEmail = settings?.contactEmail?.trim() || "Not set";
  const contactPhone = settings?.contactPhone?.trim() || "Not set";

  const receiptText = useMemo(() => {
    if (!selectedDetail) return "";
    const order = selectedDetail.order;
    const customer =
      selectedDetail.customer?.displayName ?? order.customerId ?? "Customer";
    const lines = selectedDetail.lines
      .map(
        (line) =>
          `- ${line.quantity}x ${line.nameSnapshot} @ ${formatCurrency(
            line.unitPrice
          )} = ${formatCurrency(line.lineTotal)}`
      )
      .join("\n");

    const discounts =
      (order.discountTotal ?? 0) + (order.promoDiscountTotal ?? 0);
    const shipping = (order.shippingFee ?? 0) + (order.codFee ?? 0);

    return [
      `Receipt - ${businessName}`,
      `Owner: ${ownerName}`,
      `Contact: ${contactEmail} | ${contactPhone}`,
      `Order #: ${order.orderNumber}`,
      `Date: ${formatDate(order.createdAt)}`,
      `Customer: ${customer}`,
      "",
      "Items:",
      lines || "- No items -",
      "",
      `Subtotal: ${formatCurrency(order.subtotal)}`,
      `Discounts: ${formatCurrency(discounts)}`,
      `Shipping + COD: ${formatCurrency(shipping)}`,
      `Grand total: ${formatCurrency(order.grandTotal)}`,
      `Paid: ${formatCurrency(order.amountPaid)}`,
      `Balance: ${formatCurrency(order.balanceDue)}`,
      `Payment status: ${order.paymentStatus}`,
      "",
      "Thank you for shopping with us!",
    ].join("\n");
  }, [
    businessName,
    contactEmail,
    contactPhone,
    ownerName,
    selectedDetail,
  ]);

  async function copyReceipt() {
    if (!receiptText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiptText);
      } else {
        throw new Error("Clipboard not available");
      }
      setReceiptMessage("Receipt text copied. Paste into chat or email.");
    } catch (err) {
      console.error(err);
      setReceiptMessage("Copy failed. Please copy manually.");
    } finally {
      setTimeout(() => setReceiptMessage(null), 2500);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-600">
            Auto-built mula sa accepted claims per customer. Dito mo makikita
            ang items, totals, hiwalay na katayuan ng bayad at padala.
          </p>
        </div>
      </div>

      {/* Business profile context */}
      <div className={`${MUTED_PANEL_CLASS} border border-slate-200 px-3 py-3 text-sm`}>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-600">
              Business
            </div>
            <div className="font-semibold text-slate-900">{businessName}</div>
            <div className="text-xs text-slate-600">Owner: {ownerName}</div>
          </div>
          <div className="text-xs text-slate-600">
            <div>
              Contact email:{" "}
              <span className="font-medium text-slate-900">{contactEmail}</span>
            </div>
            <div>
              Contact phone:{" "}
              <span className="font-medium text-slate-900">{contactPhone}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Tip: include these in receipts or follow-ups when confirming orders
            and payments.
          </div>
        </div>
      </div>

      {/* Session selector + build button */}
      <div
        className={`${PANEL_CLASS} flex flex-wrap items-center gap-3 p-3 text-sm`}
      >
        <div className="flex min-w-[260px] flex-1 items-center gap-2">
          <span className="text-slate-700">Live session:</span>
          <select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? e.target.value : undefined)
            }
            className={`${INPUT_CLASS} flex-1`}
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBuildFromClaims}
            disabled={!activeSessionId || building}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {building ? "Building..." : "Build from claims"}
          </button>
          <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
            <span>Payment:</span>
            {(["ALL", "UNPAID", "PARTIAL", "PAID"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  setPaymentFilter(p === "ALL" ? "ALL" : (p as PaymentStatus))
                }
                className={`rounded-full border px-2 py-0.5 ${
                  paymentFilter === p ||
                  (paymentFilter === "ALL" && p === "ALL")
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {p === "ALL" ? "All" : p.toLowerCase().replace("_", " ")} (
                {p === "ALL"
                  ? orders.length
                  : paymentCounts[p as PaymentStatus] ?? 0}
                )
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
            <span>Status:</span>
            {(
              [
                "ALL",
                "PENDING_PAYMENT",
                "PARTIALLY_PAID",
                "PAID",
                "PACKING",
                "SHIPPED",
                "DELIVERED",
              ] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s === "ALL" ? "ALL" : s)}
                className={`rounded-full border px-2 py-0.5 ${
                  statusFilter === s
                    ? "border-slate-900 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {s === "ALL" ? "All" : s.replace(/_/g, " ").toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeSession && (
        <div
          className={`${MUTED_PANEL_CLASS} border border-slate-200 px-2 py-2 text-xs text-slate-600`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Active session:{" "}
              <span className="font-semibold text-slate-900">
                {activeSession.title}
              </span>{" "}
              <span className="text-slate-500">
                ({activeSession.platform} | {activeSession.status})
              </span>
            </span>
            {activeSession.targetRevenue != null && (
              <span>
                Target sales:{" "}
                <span className="font-semibold text-emerald-700">
                  ₱{activeSession.targetRevenue.toLocaleString("en-PH")}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {infoMessage && (
        <div className="rounded-md border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Main content: orders list + details */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Orders list */}
        <div className={`${PANEL_CLASS} overflow-hidden`}>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Orders for session
          </div>
          <div className="hidden max-h-[420px] overflow-y-auto md:block">
            {loadingOrders ? (
              <div className="px-3 py-6 text-center text-sm text-slate-600">
                Loading orders...
              </div>
            ) : !hasOrders ? (
              <div className="px-3 py-6 text-center text-sm text-slate-600">
                Walang orders pa for this session. {acceptedClaimsCount} accepted
                claim(s) found — click "Build from claims" to generate orders.
              </div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className={TABLE_HEAD_CLASS}>
                  <tr>
                    <th className="px-3 py-2">Order #</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Grand total</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2">Bayad</th>
                    <th className="px-3 py-2">Padala</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const isSelected = order.id === selectedOrderId;
                    return (
                      <tr
                        key={order.id}
                        className={`border-t border-slate-200 hover:bg-slate-50 ${
                          isSelected ? "bg-slate-100" : "bg-transparent"
                        }`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          void loadOrderDetail(order.id);
                        }}
                      >
                        <td className="cursor-pointer px-3 py-2 text-xs font-semibold text-emerald-700">
                          {order.orderNumber}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-slate-900">
                          {formatCustomerLabel(
                            order.customerId,
                            customerMap[order.customerId ?? ""]?.displayName
                          )}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-right text-slate-900">
                          {formatCurrency(order.grandTotal)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-right text-slate-900">
                          {formatCurrency(order.amountPaid)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-right text-slate-900">
                          {formatCurrency(order.balanceDue)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-700">
                          {order.paymentStatus}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-700">
                          {order.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* Mobile cards */}
          <div className="block space-y-3 md:hidden">
            {loadingOrders ? (
              <div className="px-3 py-6 text-center text-sm text-slate-600">
                Loading orders...
              </div>
            ) : !hasOrders ? (
              <div className="px-3 py-6 text-center text-sm text-slate-600">
                Walang orders pa for this session.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = order.id === selectedOrderId;
                return (
                  <div
                    key={order.id}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      void loadOrderDetail(order.id);
                    }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-semibold text-emerald-700">
                        {order.orderNumber}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm text-slate-900">
                      {formatCustomerLabel(
                        order.customerId,
                        customerMap[order.customerId ?? ""]?.displayName
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>Grand: {formatCurrency(order.grandTotal)}</div>
                      <div>Paid: {formatCurrency(order.amountPaid)}</div>
                      <div>Bal: {formatCurrency(order.balanceDue)}</div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {order.paymentStatus}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Order detail */}
        <div className={`${PANEL_CLASS} flex flex-col`}>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Order details
          </div>

          {loadingDetail ? (
            <div className="flex-1 px-3 py-6 text-center text-sm text-slate-600">
              Loading order details...
            </div>
          ) : !selectedDetail ? (
            <div className="flex-1 px-3 py-6 text-center text-sm text-slate-600">
              Select an order to view details.
            </div>
          ) : (
            <div className="flex-1 space-y-3 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-600">
                  Kopyahin ang resibo (text) at ipadala sa chat/email ng customer.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyReceipt}
                    disabled={!receiptText}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Copy receipt
                  </button>
                </div>
              </div>
              {receiptMessage && (
                <div className="rounded-md border border-emerald-500/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {receiptMessage}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-600">
                      Order #
                    </div>
                    <div className="font-semibold text-emerald-700">
                      {selectedDetail.order.orderNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-600">
                      Created
                    </div>
                    <div className="text-xs text-slate-800">
                      {formatDate(selectedDetail.order.createdAt)}
                    </div>
                  </div>
                </div>

                <div
                  className={`${MUTED_PANEL_CLASS} mt-2 border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700`}
                >
                  <div className="font-semibold text-slate-900">
                    {formatCustomerLabel(
                      selectedDetail.order.customerId,
                      selectedDetail.customer?.displayName ??
                        customerMap[selectedDetail.order.customerId]?.displayName
                    )}
                  </div>
                  {selectedDetail.customer?.city && (
                    <div>{selectedDetail.customer.city}</div>
                  )}
                  {selectedDetail.customer?.province && (
                    <div>{selectedDetail.customer.province}</div>
                  )}
                </div>
              </div>

              {/* Status snapshots */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                <div className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Katayuan ng bayad
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {selectedDetail.order.paymentStatus}
                    </span>
                    <span className="text-[11px] text-slate-700">
                      {paymentLabel(selectedDetail.order.paymentStatus)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Paid: <span className="font-semibold text-slate-900">{formatCurrency(selectedDetail.order.amountPaid)}</span>{" "}
                    | Balance: <span className="font-semibold text-amber-700">{formatCurrency(selectedDetail.order.balanceDue)}</span>
                  </div>
                </div>

                <div className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Katayuan ng padala
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-900">
                      {selectedDetail.order.status}
                    </span>
                    <span className="text-[11px] text-slate-700">
                      {shippingLabel(selectedDetail.order.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Shipping + COD:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency((selectedDetail.order.shippingFee ?? 0) + (selectedDetail.order.codFee ?? 0))}
                    </span>
                    {" "}| Items:{" "}
                    <span className="font-semibold text-slate-900">{selectedDetail.lines.length}</span>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-slate-600">Subtotal</div>
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(selectedDetail.order.subtotal)}
                  </div>
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-slate-600">Discounts</div>
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(
                      (selectedDetail.order.discountTotal ?? 0) +
                        (selectedDetail.order.promoDiscountTotal ?? 0)
                    )}
                  </div>
                  {selectedDetail.order.promoDiscountTotal ? (
                    <div className="text-[10px] text-amber-700">
                      Promo discount applied
                    </div>
                  ) : null}
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-slate-600">Shipping + COD</div>
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(
                      (selectedDetail.order.shippingFee ?? 0) +
                        (selectedDetail.order.codFee ?? 0)
                    )}
                  </div>
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-slate-600">Grand total</div>
                  <div className="font-semibold text-emerald-700">
                    {formatCurrency(selectedDetail.order.grandTotal)}
                  </div>
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-slate-600">Paid</div>
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(selectedDetail.order.amountPaid)}
                  </div>
                </div>
                <div
                  className={`${MUTED_PANEL_CLASS} border border-slate-200 bg-slate-50 p-2`}
                >
                  <div className="text-slate-600">Balance</div>
                  <div className="font-semibold text-amber-700">
                    {formatCurrency(selectedDetail.order.balanceDue)}
                  </div>
                </div>
              </div>

              {/* Discount controls */}
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">
                      Apply discount / promo
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Deducted from grand total and balance due.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className={`${INPUT_CLASS} w-28 text-xs`}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={handleApplyDiscount}
                      disabled={applyingDiscount}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {applyingDiscount ? "Saving..." : "Apply"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleClearDiscount()}
                      disabled={applyingDiscount}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Remove / reset
                    </button>
                    <button
                      type="button"
                      disabled={applyingDiscount}
                      onClick={() => void applyPercentPromo(5)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      5% off
                    </button>
                    <button
                      type="button"
                      disabled={applyingDiscount}
                      onClick={() => void applyPercentPromo(10)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      10% off
                    </button>
                    <button
                      type="button"
                      disabled={applyingDiscount}
                      onClick={() => void applyFreeShipping()}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Free shipping
                    </button>
                  </div>
                </div>
              </div>

              {/* Lines */}
              <div className="mt-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Items
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50">
                  {selectedDetail.lines.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-600">
                      No items in this order.
                    </div>
                  ) : (
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-600">
                        <tr>
                          <th className="px-2 py-1">Item</th>
                          <th className="px-2 py-1 text-right">Qty</th>
                          <th className="px-2 py-1 text-right">Price</th>
                          <th className="px-2 py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.lines.map((line) => (
                          <tr
                            key={line.id}
                            className="border-t border-slate-200"
                          >
                            <td className="px-2 py-1 text-[11px] text-slate-900">
                              {line.itemCodeSnapshot} - {line.nameSnapshot}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px] text-slate-900">
                              {line.quantity}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px] text-slate-900">
                              {formatCurrency(line.unitPrice)}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px] text-slate-900">
                              {formatCurrency(line.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loadingSessions && (
        <div
          className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}
        >
          Loading sessions...
        </div>
      )}
    </div>
  );
}
