import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveSession, Order, Payment, Shipment } from "../core/types";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  getOrderDetail,
  listOrdersForSession,
  type OrderDetail,
} from "../services/orders.service";
import {
  listPaymentsForOrder,
  recordPayment,
  type RecordPaymentInput,
  voidPayment,
} from "../services/payments.service";
import {
  createOrUpdateShipment,
  getShipmentForOrder,
  updateShipmentStatus,
  type UpsertShipmentPayload,
} from "../services/shipments.service";
import { listCustomerBasics } from "../services/customers.service";
import { useLiveSessionSelection } from "./useLiveSessionSelection";

type CustomerNameMap = Record<
  string,
  { displayName?: string | null; realName?: string | null }
>;

export interface UseOrderPaymentsAndShipping {
  sessions: LiveSession[];
  activeSessionId?: string;
  setActiveSessionId: (id?: string) => void;
  orders: Order[];
  queueOrders: Order[];
  activeOrderId?: string;
  setActiveOrderId: (id?: string) => void;
  customerMap: CustomerNameMap;
  orderDetail: OrderDetail | null;
  payments: Payment[];
  shipment: Shipment | null;
  loadingSessions: boolean;
  loadingOrders: boolean;
  loadingOrderData: boolean;
  savingPayment: boolean;
  voidingPaymentId: string | null;
  savingShipment: boolean;
  updatingShipmentStatus: boolean;
  error: string | null;
  infoMessage: string | null;
  setError: (msg: string | null) => void;
  setInfoMessage: (msg: string | null) => void;
  refreshOrdersForSession: (sessionId: string) => Promise<void>;
  refreshOrderData: (orderId: string) => Promise<void>;
  addPayment: (
    payload: Omit<RecordPaymentInput, "orderId">,
    options?: { suppressInfo?: boolean }
  ) => Promise<void>;
  voidExistingPayment: (paymentId: string) => Promise<void>;
  saveShipmentDetails: (
    payload: UpsertShipmentPayload,
    options?: { suppressInfo?: boolean }
  ) => Promise<void>;
  quickUpdateShipmentStatus: (status: Shipment["status"]) => Promise<void>;
}

/**
 * Shared data layer for the combined Payments + Shipping workspace.
 * Reuses existing services so totals/status changes remain centralized.
 */
export function useOrderPaymentsAndShipping(): UseOrderPaymentsAndShipping {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const {
    sessionId: activeSessionId,
    setSessionId: setActiveSessionId,
    ensureValidSession,
  } = useLiveSessionSelection("payments-shipping");

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(
    undefined
  );

  const [customerMap, setCustomerMap] = useState<CustomerNameMap>({});

  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipment, setShipment] = useState<Shipment | null>(null);

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrderData, setLoadingOrderData] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [savingShipment, setSavingShipment] = useState(false);
  const [updatingShipmentStatus, setUpdatingShipmentStatus] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const queueOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== "CANCELLED" && o.status !== "RETURNED"
      ),
    [orders]
  );

  useEffect(() => {
    void (async () => {
      try {
        setLoadingSessions(true);
        setError(null);

        const [sessionList, basics] = await Promise.all([
          listLiveSessions(),
          listCustomerBasics(),
        ]);

        setSessions(sessionList);
        const map: CustomerNameMap = {};
        basics.forEach((c) => {
          map[c.id] = { displayName: c.displayName, realName: c.realName };
        });
        setCustomerMap(map);

        ensureValidSession(sessionList);
      } catch (e) {
        console.error(e);
        setError("Failed to load live sessions.");
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [ensureValidSession]);

  const refreshOrdersForSession = useCallback(async (sessionId: string) => {
    try {
      setLoadingOrders(true);
      setError(null);

      const list = await listOrdersForSession(sessionId);
      setOrders(list);

      setActiveOrderId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list[0]?.id;
      });

      if (list.length === 0) {
        setOrderDetail(null);
        setPayments([]);
        setShipment(null);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load orders for session.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      setOrders([]);
      setActiveOrderId(undefined);
      setOrderDetail(null);
      setPayments([]);
      setShipment(null);
      return;
    }
    void refreshOrdersForSession(activeSessionId);
  }, [activeSessionId, refreshOrdersForSession]);

  const refreshOrderData = useCallback(async (orderId: string) => {
    try {
      setLoadingOrderData(true);
      setError(null);

      const [detail, paymentList, shipmentRecord] = await Promise.all([
        getOrderDetail(orderId),
        listPaymentsForOrder(orderId),
        getShipmentForOrder(orderId),
      ]);

      setOrderDetail(detail);
      setPayments(paymentList);
      setShipment(shipmentRecord ?? null);
    } catch (e) {
      console.error(e);
      setError("Failed to load order details, payments, or shipment.");
    } finally {
      setLoadingOrderData(false);
    }
  }, []);

  useEffect(() => {
    if (!activeOrderId) {
      setOrderDetail(null);
      setPayments([]);
      setShipment(null);
      return;
    }
    void refreshOrderData(activeOrderId);
  }, [activeOrderId, refreshOrderData]);

  const addPayment = useCallback(
    async (
      payload: Omit<RecordPaymentInput, "orderId">,
      options?: { suppressInfo?: boolean }
    ) => {
      if (!activeOrderId) {
        setError("Please select an order first.");
        return;
      }

      try {
        setSavingPayment(true);
        setInfoMessage(null);
        setError(null);

        await recordPayment({ orderId: activeOrderId, ...payload });

        if (!options?.suppressInfo) {
          setInfoMessage("Payment recorded successfully.");
        }
        await refreshOrderData(activeOrderId);
        if (activeSessionId) {
          await refreshOrdersForSession(activeSessionId);
        }
      } catch (e) {
        console.error(e);
        setError("Failed to record payment.");
      } finally {
        setSavingPayment(false);
      }
    },
    [
      activeOrderId,
      activeSessionId,
      refreshOrderData,
      refreshOrdersForSession,
    ]
  );

  const voidExistingPayment = useCallback(
    async (paymentId: string) => {
      if (!paymentId) return;

      try {
        setVoidingPaymentId(paymentId);
        setInfoMessage(null);
        setError(null);

        await voidPayment(paymentId);

        if (activeOrderId) {
          await refreshOrderData(activeOrderId);
        }
        if (activeSessionId) {
          await refreshOrdersForSession(activeSessionId);
        }

        setInfoMessage("Payment voided and totals updated.");
      } catch (e) {
        console.error(e);
        setError("Failed to void payment.");
      } finally {
        setVoidingPaymentId(null);
      }
    },
    [
      activeOrderId,
      activeSessionId,
      refreshOrderData,
      refreshOrdersForSession,
    ]
  );

  const saveShipmentDetails = useCallback(
    async (
      payload: UpsertShipmentPayload,
      options?: { suppressInfo?: boolean }
    ) => {
      if (!activeOrderId) {
        setError("Please select an order first.");
        return;
      }

      try {
        setSavingShipment(true);
        setInfoMessage(null);
        setError(null);

        const { shipment: updatedShipment } = await createOrUpdateShipment(
          activeOrderId,
          payload
        );

        setShipment(updatedShipment);

        await refreshOrderData(activeOrderId);
        if (activeSessionId) {
          await refreshOrdersForSession(activeSessionId);
        }

        if (!options?.suppressInfo) {
          setInfoMessage("Shipment saved and order totals updated.");
        }
      } catch (e) {
        console.error(e);
        setError("Failed to save shipment.");
      } finally {
        setSavingShipment(false);
      }
    },
    [
      activeOrderId,
      activeSessionId,
      refreshOrderData,
      refreshOrdersForSession,
    ]
  );

  const quickUpdateShipmentStatus = useCallback(
    async (status: Shipment["status"]) => {
      if (!shipment) return;

      try {
        setUpdatingShipmentStatus(true);
        setInfoMessage(null);
        setError(null);

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
        }

        if (activeOrderId) {
          await refreshOrderData(activeOrderId);
        }
        if (activeSessionId) {
          await refreshOrdersForSession(activeSessionId);
        }

        setInfoMessage("Shipment status updated.");
      } catch (e) {
        console.error(e);
        setError("Failed to update shipment status.");
      } finally {
        setUpdatingShipmentStatus(false);
      }
    },
    [
      shipment,
      activeOrderId,
      activeSessionId,
      refreshOrderData,
      refreshOrdersForSession,
    ]
  );

  return {
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
  };
}
