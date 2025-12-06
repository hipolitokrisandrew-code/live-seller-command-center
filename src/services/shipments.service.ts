// src/services/shipments.service.ts
import { db } from "../core/db";
import type { Order, Shipment } from "../core/types";
import { recalculateOrderTotals } from "./orders.service";

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export interface UpsertShipmentPayload {
  courier: string;
  trackingNumber: string;
  shippingFee: number;
  status: Shipment["status"];
  bookingDate?: string;
  shipDate?: string;
  deliveryDate?: string;
  notes?: string;
}

/**
 * Get shipment linked to an order, if any.
 */
export async function getShipmentForOrder(
  orderId: string
): Promise<Shipment | undefined> {
  if (!orderId) return undefined;
  return db.shipments.where("orderId").equals(orderId).first();
}

/**
 * Create or update a shipment for an order.
 *
 * - Saves shipping data in "shipments" table
 * - Mirrors shippingFee into the Order
 * - Recalculates order totals (grandTotal, balance, etc.)
 * - Updates Order.status based on shipment status + payment status
 */
export async function createOrUpdateShipment(
  orderId: string,
  payload: UpsertShipmentPayload
): Promise<{ shipment: Shipment; order: Order }> {
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error("Order not found.");
  }

  const shippingFee = Number(payload.shippingFee) || 0;

  const existing = await getShipmentForOrder(orderId);

  const shipment: Shipment = {
    id: existing?.id ?? generateId("ship"),
    orderId,
    courier: payload.courier.trim(),
    trackingNumber: payload.trackingNumber.trim(),
    shippingFee,
    bookingDate: payload.bookingDate,
    shipDate: payload.shipDate,
    deliveryDate: payload.deliveryDate,
    status: payload.status,
    notes: payload.notes,
  };

  if (existing) {
    await db.shipments.put(shipment);
  } else {
    await db.shipments.add(shipment);
  }

  // Mirror shipping fee to order and recalc totals
  const orderWithShipping: Order = {
    ...order,
    shippingFee,
  };
  await db.orders.put(orderWithShipping);

  let updatedOrder = await recalculateOrderTotals(orderId);

  // Update order.status based on shipment status + paymentStatus
  if (shipment.status === "DELIVERED") {
    updatedOrder = {
      ...updatedOrder,
      status: "DELIVERED",
    };
    await db.orders.put(updatedOrder);
  } else if (
    shipment.status === "IN_TRANSIT" &&
    updatedOrder.paymentStatus === "PAID"
  ) {
    updatedOrder = {
      ...updatedOrder,
      status: "SHIPPED",
    };
    await db.orders.put(updatedOrder);
  } else if (
    (shipment.status === "PENDING" || shipment.status === "BOOKED") &&
    updatedOrder.status === "PENDING_PAYMENT"
  ) {
    // Prepping / packing while waiting for payment confirmation
    updatedOrder = {
      ...updatedOrder,
      status: "PACKING",
    };
    await db.orders.put(updatedOrder);
  }

  return { shipment, order: updatedOrder };
}

/**
 * Update shipment status only, and synchronize order status.
 */
export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: Shipment["status"],
  dates?: { shipDate?: string; deliveryDate?: string }
): Promise<{ shipment?: Shipment; order?: Order }> {
  const existing = await db.shipments.get(shipmentId);
  if (!existing) return {};

  const shipment: Shipment = {
    ...existing,
    status: newStatus,
    shipDate: dates?.shipDate ?? existing.shipDate,
    deliveryDate: dates?.deliveryDate ?? existing.deliveryDate,
  };

  await db.shipments.put(shipment);

  const order = await db.orders.get(shipment.orderId);
  if (!order) return { shipment };

  let updatedOrder: Order = { ...order };

  if (newStatus === "DELIVERED") {
    updatedOrder = { ...updatedOrder, status: "DELIVERED" };
  } else if (newStatus === "IN_TRANSIT" && order.paymentStatus === "PAID") {
    updatedOrder = { ...updatedOrder, status: "SHIPPED" };
  }

  if (updatedOrder !== order) {
    await db.orders.put(updatedOrder);
  }

  return { shipment, order: updatedOrder };
}
