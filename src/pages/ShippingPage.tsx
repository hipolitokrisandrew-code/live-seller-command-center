// src/pages/ShippingPage.tsx
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveSession, Order, Shipment } from "../core/types";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  getOrderDetail,
  listOrdersForSession,
} from "../services/orders.service";
import {
  createOrUpdateShipment,
  getShipmentForOrder,
  updateShipmentStatus,
} from "../services/shipments.service";

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
  return new Date().toISOString().slice(0, 10);
}

export function ShippingPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    undefined
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(
    undefined
  );

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [orderTotals, setOrderTotals] = useState<{
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: Order["paymentStatus"];
    status: Order["status"];
  } | null>(null);

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingShipment, setLoadingShipment] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [formCourier, setFormCourier] = useState("");
  const [formTracking, setFormTracking] = useState("");
  const [formShippingFee, setFormShippingFee] = useState("");
  const [formStatus, setFormStatus] = useState<Shipment["status"]>("PENDING");
  const [formBookingDate, setFormBookingDate] = useState("");
  const [formShipDate, setFormShipDate] = useState("");
  const [formDeliveryDate, setFormDeliveryDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
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

  const refreshOrdersForSession = useCallback(async (sessionId: string) => {
    try {
      setLoadingOrders(true);
      setError(null);
      const list = await listOrdersForSession(sessionId);

      // Focus on orders that are not cancelled/returned
      const filtered = list.filter(
        (o) => o.status !== "CANCELLED" && o.status !== "RETURNED"
      );

      setOrders(filtered);

      if (filtered.length > 0) {
        setActiveOrderId(filtered[0].id);
      } else {
        setActiveOrderId(undefined);
        setShipment(null);
        setOrderTotals(null);
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
      setShipment(null);
      setOrderTotals(null);
      return;
    }
    void refreshOrdersForSession(activeSessionId);
  }, [activeSessionId, refreshOrdersForSession]);

  const fillFormFromShipment = useCallback((s: Shipment | null) => {
    if (!s) {
      setFormCourier("");
      setFormTracking("");
      setFormShippingFee("");
      setFormStatus("PENDING");
      setFormBookingDate("");
      setFormShipDate("");
      setFormDeliveryDate("");
      setFormNotes("");
    } else {
      setFormCourier(s.courier ?? "");
      setFormTracking(s.trackingNumber ?? "");
      setFormShippingFee(
        Number.isFinite(s.shippingFee as number)
          ? (s.shippingFee as number).toFixed(2)
          : ""
      );
      setFormStatus(s.status);
      setFormBookingDate(s.bookingDate?.slice(0, 10) ?? "");
      setFormShipDate(s.shipDate?.slice(0, 10) ?? "");
      setFormDeliveryDate(s.deliveryDate?.slice(0, 10) ?? "");
      setFormNotes(s.notes ?? "");
    }
  }, []);

  const refreshShipmentForOrder = useCallback(
    async (orderId: string) => {
      try {
        setLoadingShipment(true);
        setError(null);

        const [detail, existingShipment] = await Promise.all([
          getOrderDetail(orderId),
          getShipmentForOrder(orderId),
        ]);

        if (detail) {
          setOrderTotals({
            grandTotal: detail.order.grandTotal,
            amountPaid: detail.order.amountPaid,
            balanceDue: detail.order.balanceDue,
            paymentStatus: detail.order.paymentStatus,
            status: detail.order.status,
          });
        } else {
          setOrderTotals(null);
        }

        if (existingShipment) {
          setShipment(existingShipment);
          fillFormFromShipment(existingShipment);
        } else {
          setShipment(null);
          fillFormFromShipment(null);

          // default shipping booking date = today
          setFormBookingDate(todayDateInput());
        }
      } catch (e: unknown) {
        console.error(e);
        setError("Failed to load shipment info for this order.");
      } finally {
        setLoadingShipment(false);
      }
    },
    [fillFormFromShipment]
  );

  // When active order changes → load shipment
  useEffect(() => {
    if (!activeOrderId) {
      setShipment(null);
      setOrderTotals(null);
      return;
    }
    void refreshShipmentForOrder(activeOrderId);
  }, [activeOrderId, refreshShipmentForOrder]);

  async function handleSaveShipment(e: FormEvent) {
    e.preventDefault();
    if (!activeOrderId) return;

    setError(null);
    setInfoMessage(null);

    const feeValue = parseFloat(
      formShippingFee.replace(/,/g, "").trim() || "0"
    );
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      setError("Please enter a valid shipping fee (0 or above).");
      return;
    }

    try {
      setSavingShipment(true);

      const payload = {
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
        notes: formNotes || undefined,
      };

      const { shipment: updatedShipment } = await createOrUpdateShipment(
        activeOrderId,
        payload
      );

      setShipment(updatedShipment);
      fillFormFromShipment(updatedShipment);

      // Refresh totals + orders list so status changes are visible
      await refreshShipmentForOrder(activeOrderId);
      if (activeSessionId) {
        await refreshOrdersForSession(activeSessionId);
      }

      setInfoMessage("Shipment saved and order totals updated.");
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to save shipment.");
    } finally {
      setSavingShipment(false);
    }
  }

  async function handleQuickStatusChange(status: Shipment["status"]) {
    if (!shipment || !activeOrderId) return;
    setError(null);
    setInfoMessage(null);

    try {
      setUpdatingStatus(true);

      const dates: { shipDate?: string; deliveryDate?: string } = {};
      if (status === "IN_TRANSIT" && !shipment.shipDate) {
        dates.shipDate = new Date().toISOString();
      }
      if (status === "DELIVERED" && !shipment.deliveryDate) {
        dates.deliveryDate = new Date().toISOString();
      }

      const { shipment: updatedShipment } = await updateShipmentStatus(
        shipment.id,
        status,
        dates
      );

      if (updatedShipment) {
        setShipment(updatedShipment);
        fillFormFromShipment(updatedShipment);
      }

      // Refresh totals + orders list
      if (activeOrderId) {
        await refreshShipmentForOrder(activeOrderId);
      }
      if (activeSessionId) {
        await refreshOrdersForSession(activeSessionId);
      }

      setInfoMessage("Shipment status updated.");
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to update shipment status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Shipping</h1>
        <p className="text-sm text-slate-400">
          Manage shipping queue: courier, tracking number, shipping fee, and
          delivery status. Orders auto-update to PACKING, SHIPPED, or DELIVERED
          based on shipment status and payment.
        </p>
      </div>

      {/* Filter bar */}
      <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
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
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Order in queue
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
                {o.orderNumber} – {o.customerId} ({o.status})
              </option>
            ))}
          </select>
          {orderTotals && (
            <p className="text-xs text-slate-500">
              Order:{" "}
              <span className="font-medium text-slate-200">
                {orderTotals.status}
              </span>{" "}
              · Payment:{" "}
              <span className="font-medium text-slate-200">
                {orderTotals.paymentStatus}
              </span>{" "}
              · Balance:{" "}
              <span className="font-medium text-amber-300">
                {formatCurrency(orderTotals.balanceDue)}
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

      {/* Main layout: queue + shipment form */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Left: queue table */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60">
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Shipping queue for this session
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loadingOrders ? (
              <div className="px-3 py-4 text-sm text-slate-400">
                Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">
                Walang orders pa for this session (or all are cancelled /
                returned).
              </div>
            ) : (
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400">
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
                  {orders.map((o) => {
                    const isActive = o.id === activeOrderId;
                    return (
                      <tr
                        key={o.id}
                        className={`border-t border-slate-800 hover:bg-slate-900/70 ${
                          isActive ? "bg-slate-900/80" : ""
                        }`}
                        onClick={() => setActiveOrderId(o.id)}
                      >
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-emerald-300">
                          {o.orderNumber}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-100">
                          {o.customerId}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(o.grandTotal)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(o.amountPaid)}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-100">
                          {o.paymentStatus}
                        </td>
                        <td className="cursor-pointer px-3 py-2 text-[11px] text-slate-100">
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

        {/* Right: shipment form */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60">
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Shipment details
          </div>

          <form onSubmit={handleSaveShipment} className="space-y-3 p-3 text-sm">
            {!activeOrderId ? (
              <p className="text-sm text-slate-500">
                Select an order from the queue to create or edit its shipment.
              </p>
            ) : loadingShipment ? (
              <p className="text-sm text-slate-400">Loading shipment info…</p>
            ) : (
              <>
                {orderTotals && (
                  <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <div className="text-slate-400">Grand total</div>
                      <div className="font-semibold text-emerald-300">
                        {formatCurrency(orderTotals.grandTotal)}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <div className="text-slate-400">Balance</div>
                      <div className="font-semibold text-amber-300">
                        {formatCurrency(orderTotals.balanceDue)}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <div className="text-slate-400">Payment status</div>
                      <div className="font-semibold text-slate-100">
                        {orderTotals.paymentStatus}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <div className="text-slate-400">Order status</div>
                      <div className="font-semibold text-slate-100">
                        {orderTotals.status}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Courier <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formCourier}
                    onChange={(e) => setFormCourier(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="J&T, JRS, LBC, etc."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Tracking number
                  </label>
                  <input
                    type="text"
                    value={formTracking}
                    onChange={(e) => setFormTracking(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="Tracking number from courier"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Shipping fee
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={formShippingFee}
                    onChange={(e) => setFormShippingFee(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as Shipment["status"])
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
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
                    <label className="text-xs font-medium text-slate-300">
                      Booking date
                    </label>
                    <input
                      type="date"
                      value={formBookingDate}
                      onChange={(e) => setFormBookingDate(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Ship date
                    </label>
                    <input
                      type="date"
                      value={formShipDate}
                      onChange={(e) => setFormShipDate(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Delivery date
                    </label>
                    <input
                      type="date"
                      value={formDeliveryDate}
                      onChange={(e) => setFormDeliveryDate(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
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
                    placeholder="Optional notes (ex: rider, special instructions, RTD reason, etc.)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingShipment}
                  className="w-full rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {savingShipment ? "Saving shipment…" : "Save shipment"}
                </button>

                {shipment && (
                  <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-xs">
                    <div className="text-slate-400">Quick status:</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => void handleQuickStatusChange("BOOKED")}
                        className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        Mark as booked
                      </button>
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() =>
                          void handleQuickStatusChange("IN_TRANSIT")
                        }
                        className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        Mark as in transit
                      </button>
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() =>
                          void handleQuickStatusChange("DELIVERED")
                        }
                        className="rounded border border-emerald-500/70 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        Mark as delivered
                      </button>
                    </div>
                    {shipment && (
                      <p className="text-xs text-slate-500">
                        Current status:{" "}
                        <span className="font-medium text-slate-100">
                          {shipment.status}
                        </span>{" "}
                        · Last updated:{" "}
                        <span className="font-medium text-slate-100">
                          {formatDateTime(
                            shipment.deliveryDate ?? shipment.shipDate
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                )}
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
      {loadingOrders && !loadingSessions && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          Loading orders…
        </div>
      )}
    </div>
  );
}
