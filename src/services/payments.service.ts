// src/services/payments.service.ts
import { db } from "../core/db";
import type { Order, Payment } from "../core/types";
import { recalculateOrderTotals } from "./orders.service";

const nowIso = () => new Date().toISOString();

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export interface RecordPaymentInput {
  orderId: string;
  amount: number;
  method: Payment["method"];
  date?: string; // ISO
  referenceNumber?: string;
  notes?: string;
}

/**
 * List all payments for a given order, sorted by date ascending.
 */
export async function listPaymentsForOrder(
  orderId: string
): Promise<Payment[]> {
  const list = await db.payments.where("orderId").equals(orderId).toArray();

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Record a new posted payment for an order and recalc totals.
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<{ payment: Payment; order: Order }> {
  const { orderId, amount, method, date, referenceNumber, notes } = input;

  if (!orderId) {
    throw new Error("Order ID is required.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error("Order not found.");
  }

  const payment: Payment = {
    id: generateId("pay"),
    orderId,
    date: date ?? nowIso(),
    amount,
    method,
    referenceNumber,
    status: "POSTED",
    notes,
  };

  await db.payments.add(payment);
  const updatedOrder = await recalculateOrderTotals(orderId);

  return { payment, order: updatedOrder };
}

/**
 * Void an existing payment (do not delete rows) and recalc totals.
 */
export async function voidPayment(
  paymentId: string
): Promise<{ payment?: Payment; order?: Order }> {
  const existing = await db.payments.get(paymentId);
  if (!existing) {
    return {};
  }

  if (existing.status === "VOIDED") {
    const order = await recalculateOrderTotals(existing.orderId);
    return { payment: existing, order };
  }

  const updated: Payment = {
    ...existing,
    status: "VOIDED",
  };

  await db.payments.put(updated);
  const order = await recalculateOrderTotals(updated.orderId);

  return { payment: updated, order };
}
