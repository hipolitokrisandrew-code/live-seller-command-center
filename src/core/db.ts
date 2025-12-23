// src/core/db.ts
import { Dexie, type EntityTable } from "dexie";
import type {
  InventoryItem,
  LiveSession,
  LiveSessionItem,
  Claim,
  Order,
  OrderLine,
  Customer,
  Payment,
  Shipment,
  PromoRule,
  AppSettings,
} from "./types";

// Typed Dexie instance with all tables
const db = new Dexie("LiveSellerCommandCenter") as Dexie & {
  inventory: EntityTable<InventoryItem, "id">;
  liveSessions: EntityTable<LiveSession, "id">;
  liveSessionItems: EntityTable<LiveSessionItem, "id">;
  claims: EntityTable<Claim, "id">;
  orders: EntityTable<Order, "id">;
  orderLines: EntityTable<OrderLine, "id">;
  customers: EntityTable<Customer, "id">;
  payments: EntityTable<Payment, "id">;
  shipments: EntityTable<Shipment, "id">;
  promoRules: EntityTable<PromoRule, "id">;
  settings: EntityTable<AppSettings, "id">;
};

db.version(1).stores({
  inventory: "id, itemCode, status",
  liveSessions: "id, status, startTime",
  liveSessionItems: "id, liveSessionId, inventoryItemId, displayOrder",
  claims: "id, liveSessionId, inventoryItemId, customerId, timestamp, status",
  orders: "id, liveSessionId, customerId, status, paymentStatus, orderNumber",
  orderLines: "id, orderId, inventoryItemId",
  customers: "id, displayName, realName, phone",
  payments: "id, orderId, date, method",
  shipments: "id, orderId, status, courier, trackingNumber",
  promoRules: "id, type, isActive",
  settings: "id",
});

// Keep version 2 aligned with version 1 to avoid downgrading existing databases.
db.version(2).stores({
  inventory: "id, itemCode, status",
  liveSessions: "id, status, startTime",
  liveSessionItems: "id, liveSessionId, inventoryItemId, displayOrder",
  claims: "id, liveSessionId, inventoryItemId, customerId, timestamp, status",
  orders: "id, liveSessionId, customerId, status, paymentStatus, orderNumber",
  orderLines: "id, orderId, inventoryItemId",
  customers: "id, displayName, realName, phone",
  payments: "id, orderId, date, method",
  shipments: "id, orderId, status, courier, trackingNumber",
  promoRules: "id, type, isActive",
  settings: "id",
});

export { db };
