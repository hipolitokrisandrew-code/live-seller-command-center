// src/pages/OrdersPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveSession, Order } from "../core/types";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  buildOrdersFromClaims,
  getOrderDetail,
  listOrdersForSession,
  type OrderDetail,
} from "../services/orders.service";

function formatCurrency(value: number | undefined | null): string {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
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

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [building, setBuilding] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Initial load: live sessions
  useEffect(() => {
    void (async () => {
      try {
        setLoadingSessions(true);
        const list = await listLiveSessions();
        setSessions(list);

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

  // Reusable function to load orders for a session
  const refreshOrders = useCallback(
    async (sessionId: string) => {
      try {
        setLoadingOrders(true);
        setError(null);
        const list = await listOrdersForSession(sessionId);
        setOrders(list);

        if (list.length > 0) {
          const first = list[0];
          setSelectedOrderId(first.id);
          const detail = await getOrderDetail(first.id);
          setSelectedDetail(detail);
        } else {
          setSelectedOrderId(null);
          setSelectedDetail(null);
        }
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load orders.");
      } finally {
        setLoadingOrders(false);
      }
    },
    [] // setState functions are stable, so empty deps is safe here
  );

  // Load orders whenever the active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setOrders([]);
      setSelectedOrderId(null);
      setSelectedDetail(null);
      return;
    }
    void refreshOrders(activeSessionId);
  }, [activeSessionId, refreshOrders]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  async function loadOrderDetail(orderId: string) {
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
  }

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
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to build orders from claims.");
    } finally {
      setBuilding(false);
    }
  }

  const hasOrders = orders.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Orders</h1>
          <p className="text-sm text-slate-400">
            Auto-built from accepted claims per customer. Dito mo makikita per
            customer ang items, totals, payments, at shipping.
          </p>
        </div>
      </div>

      {/* Session selector + build button */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="flex min-w-[260px] flex-1 items-center gap-2">
          <span className="text-slate-400">Live session:</span>
          <select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? e.target.value : undefined)
            }
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
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
        </div>

        <button
          type="button"
          onClick={handleBuildFromClaims}
          disabled={!activeSessionId || building}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {building ? "Building from claims…" : "Build orders from claims"}
        </button>
      </div>

      {activeSession && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Active session:{" "}
              <span className="font-semibold text-slate-200">
                {activeSession.title}
              </span>{" "}
              <span className="text-slate-500">
                ({activeSession.platform} · {activeSession.status})
              </span>
            </span>
            {activeSession.targetRevenue != null && (
              <span>
                Target sales:{" "}
                <span className="font-semibold text-emerald-400">
                  ₱{activeSession.targetRevenue.toLocaleString("en-PH")}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {infoMessage && (
        <div className="rounded-md border border-emerald-500/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Main content: orders list + details */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Orders list */}
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Orders for session
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loadingOrders ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">
                Loading orders…
              </div>
            ) : !hasOrders ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                Walang orders pa for this session. Build from claims para
                mag-generate.
              </div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Order #</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Grand total</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isSelected = order.id === selectedOrderId;
                    return (
                      <tr
                        key={order.id}
                        className={`border-t border-slate-800 hover:bg-slate-900/70 ${
                          isSelected ? "bg-slate-900/80" : "bg-transparent"
                        }`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          void loadOrderDetail(order.id);
                        }}
                      >
                        <td className="cursor-pointer px-3 py-2 text-xs text-emerald-300">
                          {order.orderNumber}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-slate-100">
                          {order.customerId}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-right text-slate-100">
                          {formatCurrency(order.grandTotal)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-right text-slate-100">
                          {formatCurrency(order.amountPaid)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-xs text-right text-slate-100">
                          {formatCurrency(order.balanceDue)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-300">
                          {order.paymentStatus}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-300">
                          {order.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Order detail */}
        <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-950/60">
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Order details
          </div>

          {loadingDetail ? (
            <div className="flex-1 px-3 py-6 text-center text-sm text-slate-400">
              Loading order details…
            </div>
          ) : !selectedDetail ? (
            <div className="flex-1 px-3 py-6 text-center text-sm text-slate-500">
              Select an order to view details.
            </div>
          ) : (
            <div className="flex-1 space-y-3 p-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Order #
                    </div>
                    <div className="font-semibold text-emerald-300">
                      {selectedDetail.order.orderNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Created
                    </div>
                    <div className="text-xs text-slate-200">
                      {formatDate(selectedDetail.order.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 rounded-md border border-slate-800 bg-slate-900/60 p-2 text-xs text-slate-300">
                  <div className="font-semibold text-slate-100">
                    {selectedDetail.customer?.displayName ?? "Unknown customer"}
                  </div>
                  {selectedDetail.customer?.city && (
                    <div>{selectedDetail.customer.city}</div>
                  )}
                  {selectedDetail.customer?.province && (
                    <div>{selectedDetail.customer.province}</div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                  <div className="text-slate-400">Subtotal</div>
                  <div className="font-semibold text-slate-100">
                    {formatCurrency(selectedDetail.order.subtotal)}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                  <div className="text-slate-400">Discounts</div>
                  <div className="font-semibold text-slate-100">
                    {formatCurrency(
                      (selectedDetail.order.discountTotal ?? 0) +
                        (selectedDetail.order.promoDiscountTotal ?? 0)
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                  <div className="text-slate-400">Shipping + COD</div>
                  <div className="font-semibold text-slate-100">
                    {formatCurrency(
                      (selectedDetail.order.shippingFee ?? 0) +
                        (selectedDetail.order.codFee ?? 0)
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                  <div className="text-slate-400">Grand total</div>
                  <div className="font-semibold text-emerald-300">
                    {formatCurrency(selectedDetail.order.grandTotal)}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                  <div className="text-slate-400">Paid</div>
                  <div className="font-semibold text-slate-100">
                    {formatCurrency(selectedDetail.order.amountPaid)}
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                  <div className="text-slate-400">Balance</div>
                  <div className="font-semibold text-amber-300">
                    {formatCurrency(selectedDetail.order.balanceDue)}
                  </div>
                </div>
              </div>

              {/* Lines */}
              <div className="mt-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Items
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border border-slate-800 bg-slate-900/60">
                  {selectedDetail.lines.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-500">
                      No items in this order.
                    </div>
                  ) : (
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
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
                            className="border-t border-slate-800"
                          >
                            <td className="px-2 py-1 text-[11px] text-slate-100">
                              {line.itemCodeSnapshot} – {line.nameSnapshot}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px] text-slate-100">
                              {line.quantity}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px] text-slate-100">
                              {formatCurrency(line.unitPrice)}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px] text-slate-100">
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
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          Loading sessions…
        </div>
      )}
    </div>
  );
}
