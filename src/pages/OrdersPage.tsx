import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LiveSession, Order, PaymentStatus } from "../core/types";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  buildOrdersFromClaims,
  getOrderDetail,
  listOrdersForSession,
  syncUnpaidOrdersForSession,
  updateOrderDiscount,
  updateOrderFees,
  type OrderDetail,
} from "../services/orders.service";
import { listClaimsForSession } from "../services/claims.service";
import { listCustomerBasics } from "../services/customers.service";
import { listPaymentsForOrder } from "../services/payments.service";
import { getShipmentForOrder } from "../services/shipments.service";
import { type InvoiceTemplate } from "../services/settings.service";
import { useAppSettings } from "../hooks/useAppSettings";
import { useNotification } from "../hooks/useNotification";
import { useOrdersTutorial } from "../hooks/useOrdersTutorial";
import { useLiveSessionSelection } from "../hooks/useLiveSessionSelection";
import { useScrollRetention } from "../hooks/useScrollRetention";
import {
  calcIncludedTaxFromTotals,
  clampRatePct,
  fromCents,
} from "../lib/taxIncluded";
import { Page } from "../components/layout/Page";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardHint,
  CardTitle,
} from "../components/ui/Card";
import { OrdersHelpButton } from "../components/orders/OrdersHelpButton";
import { OrdersTutorialOverlay } from "../components/orders/OrdersTutorialOverlay";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500";

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `\u20B1${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number): string {
  const clamped = clampRatePct(value);
  const fixed = clamped.toFixed(2);
  return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
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

function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInvoiceHtml(params: {
  template: InvoiceTemplate;
  logoUrl: string;
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  paymentMethod: string;
  shippingCourier: string;
  order: Order;
  customerName: string;
  customerLocation: string[];
  discounts: number;
  shipping: number;
  vatEnabled: boolean;
  vatRatePct: number;
  vatAmount: number;
  netOfVat: number;
  lines: OrderDetail["lines"];
}): string {
  const {
    template,
    logoUrl,
    businessName,
    contactEmail,
    contactPhone,
    paymentMethod,
    shippingCourier,
    order,
    customerName,
    customerLocation,
    discounts,
    shipping,
    vatEnabled,
    vatRatePct,
    vatAmount,
    netOfVat,
    lines,
  } = params;
  const templateClass = `template-${template.toLowerCase()}`;
  const safeBusinessName = escapeHtml(businessName);
  const emailValue = contactEmail === "Not set" ? "" : contactEmail;
  const phoneValue = contactPhone === "Not set" ? "" : contactPhone;
  const contactParts = [emailValue, phoneValue].filter(Boolean) as string[];
  const safeContactLine = contactParts.length
    ? contactParts.map((value) => escapeHtml(value)).join(" | ")
    : "-";
  const safeCustomer = escapeHtml(customerName);
  const safeOrderNumber = escapeHtml(order.orderNumber);
  const safeOrderDate = escapeHtml(formatDate(order.createdAt));
  const logoFallback = escapeHtml(getInitials(businessName) || "LS");
  const customerLocationHtml = customerLocation
    .filter(Boolean)
    .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
    .join("");
  const safePaymentStatus = escapeHtml(order.paymentStatus);
  const safeShippingStatus = escapeHtml(order.status);
  const safePaymentMethod = paymentMethod
    ? escapeHtml(paymentMethod)
    : "-";
  const safeShippingCourier = shippingCourier
    ? escapeHtml(shippingCourier)
    : "-";
  const vatLabel = vatEnabled
    ? `VAT (${formatPercent(vatRatePct)}%) Included`
    : "VAT";
  const vatDisplay = vatEnabled
    ? formatCurrency(vatAmount)
    : `${formatCurrency(0)} (Not applied)`;
  const netOfVatRow = vatEnabled
    ? `<tr>
              <td class="label">Net of VAT</td>
              <td class="value">${formatCurrency(netOfVat)}</td>
            </tr>`
    : "";
  const lineRows = lines.length
    ? lines
        .map((line) => {
          const name = `${line.itemCodeSnapshot} - ${line.nameSnapshot}`;
          return `<tr>
  <td>${escapeHtml(name)}</td>
  <td class="num">${line.quantity}</td>
  <td class="num">${formatCurrency(line.unitPrice)}</td>
  <td class="num">${formatCurrency(line.lineTotal)}</td>
</tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="muted">No items</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice ${safeOrderNumber}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        font-family: "Arial", "Helvetica", sans-serif;
        line-height: 1.4;
        color: #0f172a;
        background: var(--page-bg, #ffffff);
        --accent: #0f766e;
        --accent-strong: #065f46;
        --accent-soft: #ecfdf5;
        --line: #e2e8f0;
        --muted: #64748b;
        --table-header-bg: #f1f5f9;
        --table-header-text: #334155;
        --row-alt: #f8fafc;
        --panel-bg: #ffffff;
      }
      .invoice {
        width: 100%;
        max-width: 920px;
        margin: 0 auto;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 28px 32px;
        background: #ffffff;
      }
      .invoice-header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .brand-block {
        display: flex;
        gap: 16px;
        align-items: center;
      }
      .logo {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--accent);
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 20px;
      }
      .logo img { width: 100%; height: 100%; object-fit: cover; }
      .brand-label {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .brand-name {
        font-size: 16px;
        font-weight: 700;
      }
      .brand-contact {
        font-size: 12px;
        color: var(--muted);
      }
      .invoice-title-block {
        text-align: right;
      }
      .invoice-title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .invoice-subtitle {
        font-size: 12px;
        color: var(--muted);
        margin-top: 6px;
      }
      .muted { color: var(--muted); font-size: 12px; }
      .section { margin-top: 22px; }
      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        align-items: stretch;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px;
        background: var(--panel-bg);
      }
      .panel-label {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .panel-value {
        font-weight: 600;
        margin-top: 6px;
      }
      .meta-list {
        margin-top: 10px;
        display: grid;
        gap: 8px;
        font-size: 12px;
      }
      .meta-line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .meta-line span:first-child {
        color: var(--muted);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .items-table th {
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--table-header-text);
        background: var(--table-header-bg);
        border-bottom: 1px solid var(--line);
        padding: 12px 14px;
      }
      .items-table td {
        padding: 11px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      .items-table col.col-qty { width: 70px; }
      .items-table col.col-price { width: 120px; }
      .items-table col.col-total { width: 130px; }
      .items-table .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .items-table tbody tr:nth-child(even) {
        background: var(--row-alt);
      }
      .right { text-align: right; }
      .totals-wrap {
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
      }
      .totals-table {
        width: 100%;
        max-width: 320px;
        font-size: 12px;
        border-collapse: collapse;
      }
      .totals-table td { padding: 6px 0; }
      .totals-table .label { color: var(--muted); }
      .totals-table .value { text-align: right; font-weight: 600; }
      .totals-table .grand { font-size: 14px; color: var(--accent); }

      body.template-modern {
        --accent: #2563eb;
        --accent-strong: #1e3a8a;
        --accent-soft: #dbeafe;
        --page-bg: #f8fafc;
        --panel-bg: #f8fafc;
        --table-header-bg: #e0e7ff;
        --table-header-text: #1e3a8a;
        --row-alt: #eef2ff;
      }
      body.template-modern .invoice {
        border: none;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      }

      body.template-minimal {
        --accent: #0f172a;
        --accent-strong: #0f172a;
        --accent-soft: #f8fafc;
        --page-bg: #ffffff;
        --panel-bg: #ffffff;
        --line: #f1f5f9;
        --table-header-bg: transparent;
        --table-header-text: #64748b;
        --row-alt: #ffffff;
      }
      body.template-minimal .invoice {
        border: none;
        padding: 24px;
      }

      body.template-emerald {
        --accent: #1f7a3a;
        --accent-strong: #155d2a;
        --accent-soft: #eaf7ee;
        --page-bg: #ffffff;
        --panel-bg: #ffffff;
        --table-header-bg: #1f7a3a;
        --table-header-text: #ffffff;
        --row-alt: #f1f5f2;
      }
      body.template-emerald .invoice-title {
        font-size: 32px;
      }
      body.template-emerald .brand-name {
        color: var(--accent);
      }
      body.template-emerald .totals-table tr {
        border-bottom: 1px solid var(--accent);
      }

      body.template-noir {
        --accent: #111827;
        --accent-strong: #111827;
        --accent-soft: #e2e8f0;
        --page-bg: #f8fafc;
        --panel-bg: #ffffff;
        --table-header-bg: #111827;
        --table-header-text: #ffffff;
        --row-alt: #f1f5f9;
      }
      body.template-noir .invoice {
        border: none;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.2);
      }

      @page {
        size: A4;
        margin: 10mm;
      }

      @media print {
        body { padding: 0; background: #ffffff; }
        .invoice {
          border: none;
          border-radius: 0;
          box-shadow: none;
          max-width: none;
          width: 100%;
          padding: 20px 18px;
        }
      }
    </style>
  </head>
  <body class="${templateClass}">
    <div class="invoice">
      <div class="invoice-header">
        <div class="brand-block">
          <div class="logo">
            ${
              logoUrl
                ? `<img src="${logoUrl}" alt="${safeBusinessName} logo" />`
                : logoFallback
            }
          </div>
          <div>
            <div class="brand-label">Business</div>
            <div class="brand-name">${safeBusinessName}</div>
            <div class="brand-contact">${safeContactLine}</div>
          </div>
        </div>
        <div class="invoice-title-block">
          <div class="invoice-title">Invoice</div>
          <div class="invoice-subtitle">Order #${safeOrderNumber}</div>
        </div>
      </div>

      <div class="section info-grid">
        <div class="panel">
          <div class="panel-label">Bill To</div>
          <div class="panel-value">${safeCustomer}</div>
          ${customerLocationHtml}
        </div>
        <div class="panel">
          <div class="panel-label">Invoice Details</div>
          <div class="meta-list">
            <div class="meta-line">
              <span>Invoice #</span>
              <span>${safeOrderNumber}</span>
            </div>
            <div class="meta-line">
              <span>Date</span>
              <span>${safeOrderDate}</span>
            </div>
            <div class="meta-line">
              <span>Payment</span>
              <span>${safePaymentStatus}</span>
            </div>
            <div class="meta-line">
              <span>Shipping</span>
              <span>${safeShippingStatus}</span>
            </div>
            <div class="meta-line">
              <span>Payment method</span>
              <span>${safePaymentMethod}</span>
            </div>
            <div class="meta-line">
              <span>Courier</span>
              <span>${safeShippingCourier}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <table class="items-table">
          <colgroup>
            <col />
            <col class="col-qty" />
            <col class="col-price" />
            <col class="col-total" />
          </colgroup>
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Qty</th>
              <th class="num">Price</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>

        <div class="totals-wrap">
          <table class="totals-table">
            <tr>
              <td class="label">Subtotal</td>
              <td class="value">${formatCurrency(order.subtotal)}</td>
            </tr>
            <tr>
              <td class="label">Discounts</td>
              <td class="value">${formatCurrency(discounts)}</td>
            </tr>
            <tr>
              <td class="label">Shipping + COD</td>
              <td class="value">${formatCurrency(shipping)}</td>
            </tr>
            <tr>
              <td class="label">${vatLabel}</td>
              <td class="value">${vatDisplay}</td>
            </tr>
            ${netOfVatRow}
            <tr>
              <td class="label">Grand total</td>
              <td class="value grand">${formatCurrency(order.grandTotal)}</td>
            </tr>
            <tr>
              <td class="label">Paid</td>
              <td class="value">${formatCurrency(order.amountPaid)}</td>
            </tr>
            <tr>
              <td class="label">Balance</td>
              <td class="value">${formatCurrency(order.balanceDue)}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </body>
</html>`;
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

function paymentBadgeVariant(
  status: PaymentStatus,
): "neutral" | "success" | "warning" | "danger" {
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

function shippingBadgeVariant(
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

export function OrdersPage() {
  const tutorial = useOrdersTutorial();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const {
    sessionId: activeSessionId,
    setSessionId: setActiveSessionId,
    ensureValidSession,
  } = useLiveSessionSelection("orders");

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
  const infoTimeoutRef = useRef<number | null>(null);
  const buildMessageRef = useRef<string | null>(null);
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

        ensureValidSession(list);
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load live sessions.");
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [ensureValidSession]);

  const refreshOrders = useCallback(
    async (sessionId: string, preferOrderId?: string) => {
      try {
        setLoadingOrders(true);
        setError(null);
        await syncUnpaidOrdersForSession(sessionId);
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

  const ordersListRef = useScrollRetention<HTMLDivElement>(
    !loadingOrders,
    [loadingOrders, filteredOrders.length]
  );

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

  async function handleBuildFromClaims(options?: { silent?: boolean }) {
    if (!activeSessionId) return;
    setBuilding(true);
    setError(null);
    setInfoMessage(null);

    try {
      const result = await buildOrdersFromClaims(activeSessionId);
      if (!options?.silent) {
        if (result.createdLines === 0) {
          setTimedBuildMessage("No new accepted claims to build.");
        } else {
          setTimedBuildMessage(
            `Created ${result.createdOrders} order(s) with ${result.createdLines} line(s) from accepted claims.`
          );
        }
      }
      await refreshOrders(activeSessionId);
      setAutoBuildAttempted(true);
      if (!options?.silent) {
        notify(
          result.createdLines === 0
            ? "No new accepted claims to build"
            : "Orders built from claims",
          "success"
        );
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to build orders from claims.");
      if (!options?.silent) {
        notify("Failed to build orders from claims", "error");
      }
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
      void handleBuildFromClaims({ silent: true });
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
  const logoUrl = settings?.logoUrl?.trim() || "";
  const invoiceTemplate = (settings?.invoiceTemplate ??
    "EMERALD") as InvoiceTemplate;
  const taxConfig = {
    enabled: settings?.taxIncludedEnabled ?? false,
    ratePct: settings?.taxIncludedRatePct ?? 12,
    shippingTaxable: settings?.shippingTaxable ?? true,
    codTaxable: settings?.codTaxable ?? false,
  };
  const includedTax = selectedDetail
    ? calcIncludedTaxFromTotals({
        itemsSubtotal: selectedDetail.order.subtotal ?? 0,
        discountTotal: selectedDetail.order.discountTotal ?? 0,
        promoDiscountTotal: selectedDetail.order.promoDiscountTotal ?? 0,
        shippingFee: selectedDetail.order.shippingFee ?? 0,
        codFee: selectedDetail.order.codFee ?? 0,
        shippingTaxable: taxConfig.shippingTaxable,
        codTaxable: taxConfig.codTaxable,
        enabled: taxConfig.enabled,
        ratePct: taxConfig.ratePct,
      })
    : { grossTaxableCents: 0, taxCents: 0, netCents: 0 };
  const vatLabel = taxConfig.enabled
    ? `VAT (${formatPercent(taxConfig.ratePct)}%) \u2022 Included`
    : "VAT \u2022 Not applied";
  const vatAmountValue = fromCents(includedTax.taxCents);
  const vatNetValue = fromCents(includedTax.netCents);

  useEffect(() => {
    return () => {
      if (infoTimeoutRef.current) {
        window.clearTimeout(infoTimeoutRef.current);
        infoTimeoutRef.current = null;
      }
    };
  }, []);

  const setTimedBuildMessage = useCallback((message: string | null) => {
    if (infoTimeoutRef.current) {
      window.clearTimeout(infoTimeoutRef.current);
      infoTimeoutRef.current = null;
    }

    buildMessageRef.current = message;
    setInfoMessage(message);

    if (!message) return;

    infoTimeoutRef.current = window.setTimeout(() => {
      setInfoMessage((current) =>
        current === buildMessageRef.current ? null : current
      );
      buildMessageRef.current = null;
      infoTimeoutRef.current = null;
    }, 4500);
  }, []);

  async function openInvoicePdf() {
    if (!selectedDetail) return;

    const order = selectedDetail.order;
    const customerName = formatCustomerLabel(
      order.customerId,
      selectedDetail.customer?.displayName ??
        customerMap[order.customerId ?? ""]?.displayName,
    );
    const customerLocation = [
      selectedDetail.customer?.city,
      selectedDetail.customer?.province,
    ].filter(Boolean) as string[];
    const discounts =
      (order.discountTotal ?? 0) + (order.promoDiscountTotal ?? 0);
    const shipping = (order.shippingFee ?? 0) + (order.codFee ?? 0);
    let paymentMethod = "-";
    let shippingCourier = "-";

    try {
      const [payments, shipment] = await Promise.all([
        listPaymentsForOrder(order.id),
        getShipmentForOrder(order.id),
      ]);
      const postedMethods = payments
        .filter((p) => p.status === "POSTED")
        .map((p) => p.method);
      const uniqueMethods = Array.from(new Set(postedMethods));
      paymentMethod = uniqueMethods.length ? uniqueMethods.join(", ") : "-";
      shippingCourier = shipment?.courier?.trim() || "-";

      const html = buildInvoiceHtml({
        template: invoiceTemplate,
        logoUrl,
        businessName,
        contactEmail,
        contactPhone,
        paymentMethod,
        shippingCourier,
        order,
        customerName,
        customerLocation,
        discounts,
        shipping,
        vatEnabled: taxConfig.enabled,
        vatRatePct: taxConfig.ratePct,
        vatAmount: vatAmountValue,
        netOfVat: vatNetValue,
        lines: selectedDetail.lines,
      });

      openInvoiceInCurrentTab(html);
      setReceiptMessage("Invoice opened. Use Print to save as PDF.");
      setTimeout(() => setReceiptMessage(null), 2500);
    } catch (err) {
      console.error(err);
      setReceiptMessage("Invoice generation failed. Try again.");
      setTimeout(() => setReceiptMessage(null), 2500);
    }
  }

  function openInvoiceInCurrentTab(html: string) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <Page className="space-y-6">
      {/* Business profile context */}
      <Card className="bg-slate-50" data-tour="orders-business">
        <CardContent className="py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-600">Business</div>
              <div className="truncate text-sm font-semibold text-slate-900">
                {businessName}
              </div>
              <div className="text-xs text-slate-600">Owner: {ownerName}</div>
            </div>
            <div className="text-xs text-slate-600">
              <div className="break-words">
                Contact email:{" "}
                <span className="font-medium text-slate-900">{contactEmail}</span>
              </div>
              <div className="break-words">
                Contact phone:{" "}
                <span className="font-medium text-slate-900">{contactPhone}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Tip: include these in receipts or follow-ups.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter bar */}
      <Card className="p-4" data-tour="orders-filters">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-1">
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
            </div>

            <div className="flex flex-col items-start gap-1 lg:items-end">
              <Button
                variant="primary"
                onClick={() => void handleBuildFromClaims()}
                disabled={!activeSessionId || building}
                data-tour="orders-build"
                className="w-full sm:w-auto"
              >
                {building ? "Building..." : "Build from claims"}
              </Button>
              <span className="text-[11px] text-slate-500">
                Build new orders from accepted claims.
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2" data-tour="orders-payment-filter">
              <span className="text-xs font-medium text-slate-600">Payment</span>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {(["ALL", "UNPAID", "PARTIAL", "PAID"] as const).map((p) => {
                  const active =
                    paymentFilter === p ||
                    (paymentFilter === "ALL" && p === "ALL");
                  const count =
                    p === "ALL"
                      ? orders.length
                      : paymentCounts[p as PaymentStatus] ?? 0;

                  return (
                    <Button
                      key={p}
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setPaymentFilter(p === "ALL" ? "ALL" : (p as PaymentStatus))
                      }
                      className={cn(
                        "rounded-full font-medium",
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span className="capitalize">
                        {p === "ALL" ? "All" : p.toLowerCase()}
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
                })}
              </div>
            </div>

            <div className="flex items-center gap-2" data-tour="orders-status-filter">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
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
                ).map((s) => {
                  const active = statusFilter === s;
                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant="secondary"
                      onClick={() => setStatusFilter(s === "ALL" ? "ALL" : s)}
                      className={cn(
                        "rounded-full font-medium whitespace-nowrap",
                        active
                          ? "border-slate-900 bg-slate-100 text-slate-900 hover:bg-slate-200"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {s === "ALL" ? "All" : s.replace(/_/g, " ").toLowerCase()}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {activeSession ? (
        <Card className="bg-slate-50" data-tour="orders-active-session">
          <CardContent className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="min-w-0">
                Active session:{" "}
                <span className="font-semibold text-slate-900">
                  {activeSession.title}
                </span>{" "}
                <span className="text-slate-500">
                  ({activeSession.platform} | {activeSession.status})
                </span>
              </span>
              {activeSession.targetRevenue != null ? (
                <span className="shrink-0">
                  Target sales:{" "}
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(activeSession.targetRevenue)}
                  </span>
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Orders list */}
        <Card
          className="flex min-h-0 flex-col overflow-hidden lg:col-span-5"
          data-tour="orders-list"
        >
          <CardHeader className="items-start">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardHint>
                {activeSession
                  ? "Click an order to view details."
                  : "Select a session to view orders."}
              </CardHint>
            </div>
            <span className="text-xs text-slate-500">
              {filteredOrders.length} order(s)
            </span>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {loadingOrders ? (
              <div className="flex h-full items-center justify-center px-4 py-6 text-center text-sm text-slate-600">
                Loading orders...
              </div>
            ) : !hasOrders ? (
              <div className="flex h-full items-center justify-center px-4 py-6 text-center text-sm text-slate-600">
                Walang orders pa for this session. {acceptedClaimsCount} accepted
                claim(s) found — click "Build from claims" to generate orders.
              </div>
            ) : (
              <div ref={ordersListRef} className="flex-1 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className={TABLE_HEAD_CLASS}>
                      <tr>
                        <th className="px-4 py-2">Order #</th>
                        <th className="px-4 py-2">Customer</th>
                        <th className="px-4 py-2 text-right">Grand total</th>
                        <th className="px-4 py-2 text-right">Paid</th>
                        <th className="px-4 py-2 text-right">Balance</th>
                        <th className="px-4 py-2">Payment</th>
                        <th className="px-4 py-2">Shipping</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredOrders.map((order) => {
                        const isSelected = order.id === selectedOrderId;
                        return (
                          <tr
                            key={order.id}
                            className={cn(
                              "border-t border-slate-200 hover:bg-slate-50",
                              isSelected && "bg-emerald-50",
                            )}
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              void loadOrderDetail(order.id);
                            }}
                          >
                            <td
                              className={cn(
                                "cursor-pointer px-4 py-2 text-xs",
                                isSelected && "border-l-4 border-emerald-500",
                              )}
                            >
                              <div className="font-semibold text-emerald-700">
                                {order.orderNumber}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDate(order.createdAt)}
                              </div>
                            </td>
                            <td className="cursor-pointer px-4 py-2 text-xs text-slate-900">
                              <div className="font-medium">
                                {formatCustomerLabel(
                                  order.customerId,
                                  customerMap[order.customerId ?? ""]
                                    ?.displayName,
                                )}
                              </div>
                            </td>
                            <td className="cursor-pointer px-4 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                              {formatCurrency(order.grandTotal)}
                            </td>
                            <td className="cursor-pointer px-4 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                              {formatCurrency(order.amountPaid)}
                            </td>
                            <td className="cursor-pointer px-4 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                              {formatCurrency(order.balanceDue)}
                            </td>
                            <td className="cursor-pointer px-4 py-2 text-xs text-slate-700">
                              <Badge
                                variant={paymentBadgeVariant(order.paymentStatus)}
                                className="text-[10px] uppercase tracking-wide"
                              >
                                {order.paymentStatus}
                              </Badge>
                            </td>
                            <td className="cursor-pointer px-4 py-2 text-xs text-slate-700">
                              <Badge
                                variant={shippingBadgeVariant(order.status)}
                                className="text-[10px] uppercase tracking-wide"
                              >
                                {order.status}
                              </Badge>
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

        {/* Order detail */}
        <Card
          className="flex flex-col overflow-hidden lg:col-span-7"
          data-tour="orders-details"
        >
          <CardHeader className="items-start">
            <div>
              <CardTitle>Order details</CardTitle>
              <CardHint>
                Generate a PDF invoice with logo and business details.
              </CardHint>
            </div>
            <Button
              size="md"
              variant="secondary"
              onClick={openInvoicePdf}
              disabled={!selectedDetail}
              data-tour="orders-invoice"
            >
              Invoice PDF
            </Button>
          </CardHeader>

          {loadingDetail ? (
            <div className="flex-1 px-4 py-6 text-center text-sm text-slate-600">
              Loading order details...
            </div>
          ) : !selectedDetail ? (
            <div className="flex-1 px-4 py-6 text-center text-sm text-slate-600">
              Select an order to view details.
            </div>
          ) : (
            <CardContent className="flex-1 space-y-4">
              {receiptMessage && (
                <div className="rounded-md border border-emerald-500/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {receiptMessage}
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-600">Order #</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {selectedDetail.order.orderNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-600">Created</div>
                  <div className="text-xs text-slate-700">
                    {formatDate(selectedDetail.order.createdAt)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">
                  {formatCustomerLabel(
                    selectedDetail.order.customerId,
                    selectedDetail.customer?.displayName ??
                      customerMap[selectedDetail.order.customerId]?.displayName,
                  )}
                </div>
                {selectedDetail.customer?.city && (
                  <div>{selectedDetail.customer.city}</div>
                )}
                {selectedDetail.customer?.province && (
                  <div>{selectedDetail.customer.province}</div>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Status
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                      <span className="text-xs font-medium text-slate-600">
                        Payment
                      </span>
                      <Badge
                        variant={paymentBadgeVariant(
                          selectedDetail.order.paymentStatus,
                        )}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {selectedDetail.order.paymentStatus}
                      </Badge>
                      <span className="text-[11px] text-slate-500">
                        {paymentLabel(selectedDetail.order.paymentStatus)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                      <span className="text-xs font-medium text-slate-600">
                        Shipping
                      </span>
                      <Badge
                        variant={shippingBadgeVariant(selectedDetail.order.status)}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {selectedDetail.order.status}
                      </Badge>
                      <span className="text-[11px] text-slate-500">
                        {shippingLabel(selectedDetail.order.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Subtotal
                  </div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatCurrency(selectedDetail.order.subtotal)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Discounts
                  </div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatCurrency(
                      (selectedDetail.order.discountTotal ?? 0) +
                        (selectedDetail.order.promoDiscountTotal ?? 0),
                    )}
                  </div>
                  {selectedDetail.order.promoDiscountTotal ? (
                    <div className="text-[10px] text-amber-700">
                      Promo discount applied
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Shipping + COD
                  </div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatCurrency(
                      (selectedDetail.order.shippingFee ?? 0) +
                        (selectedDetail.order.codFee ?? 0),
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-slate-600">
                      {vatLabel}
                    </div>
                    <Link
                      to="/settings#taxes"
                      className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Edit VAT
                    </Link>
                  </div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatCurrency(vatAmountValue)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Net of VAT: {formatCurrency(vatNetValue)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Grand total
                  </div>
                  <div className="mt-1 font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(selectedDetail.order.grandTotal)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">Paid</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatCurrency(selectedDetail.order.amountPaid)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs font-medium text-slate-600">
                    Balance
                  </div>
                  <div className="mt-1 font-semibold tabular-nums text-amber-700">
                    {formatCurrency(selectedDetail.order.balanceDue)}
                  </div>
                </div>
              </div>

              {/* Discount controls */}
              <div
                className="rounded-lg bg-slate-50 px-3 py-3 text-xs"
                data-tour="orders-discount"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-600">
                      Apply discount / promo
                    </div>
                    <p className="text-xs text-slate-500">
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
                      className={cn(CONTROL_CLASS, "w-28 text-xs")}
                      placeholder="0.00"
                    />
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={handleApplyDiscount}
                      disabled={applyingDiscount}
                      className="text-xs"
                    >
                      {applyingDiscount ? "Saving..." : "Apply"}
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => void handleClearDiscount()}
                      disabled={applyingDiscount}
                      className="text-xs"
                    >
                      Remove / reset
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      disabled={applyingDiscount}
                      onClick={() => void applyPercentPromo(5)}
                      className="text-xs"
                    >
                      5% off
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      disabled={applyingDiscount}
                      onClick={() => void applyPercentPromo(10)}
                      className="text-xs"
                    >
                      10% off
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      disabled={applyingDiscount}
                      onClick={() => void applyFreeShipping()}
                      className="text-xs"
                    >
                      Free shipping
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-2" data-tour="orders-lines">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-600">Items</div>
                  <div className="text-xs text-slate-500">
                    {selectedDetail.lines.length} item(s)
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  {selectedDetail.lines.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-600">
                      No items in this order.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className={TABLE_HEAD_CLASS}>
                          <tr>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDetail.lines.map((line) => (
                            <tr
                              key={line.id}
                              className="border-t border-slate-200 hover:bg-slate-50"
                            >
                              <td className="px-3 py-2 text-[11px] text-slate-900">
                                {line.itemCodeSnapshot} - {line.nameSnapshot}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                                {line.quantity}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                                {formatCurrency(line.unitPrice)}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums text-slate-900">
                                {formatCurrency(line.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {loadingSessions && (
        <Card className="bg-slate-50">
          <CardContent className="py-2 text-xs text-slate-600">
            Loading sessions...
          </CardContent>
        </Card>
      )}
      <OrdersHelpButton onClick={tutorial.open} />
      <OrdersTutorialOverlay
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
