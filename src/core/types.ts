// src/core/types.ts

// 2.2 InventoryItem
export interface InventoryVariant {
  id: string;
  label: string;
  stock: number;
  costPrice?: number;
  sellingPrice?: number;
}

export interface InventoryItem {
  id: string;
  itemCode: string; // e.g., "D01"
  name: string;
  description?: string;
  category?: string; // e.g., Dresses, Tops, Skincare
  variantGroup?: string;
  variants?: InventoryVariant[];
  costPrice: number; // supplier cost per unit, in PHP
  sellingPrice: number; // standard selling price per unit
  initialStock: number;
  currentStock: number;
  reservedStock: number;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

// 2.3 LiveSession
export interface LiveSession {
  id: string;
  title: string; // e.g., "FB Live 2025-12-10 - Evening"
  platform: "FACEBOOK" | "TIKTOK" | "SHOPEE" | "OTHER";
  channelName: string;
  startTime?: string;
  endTime?: string;
  status: "PLANNED" | "LIVE" | "PAUSED" | "ENDED" | "CLOSED";
  targetRevenue?: number;
  targetViewers?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 2.4 LiveSessionItem
export interface LiveSessionItem {
  id: string;
  liveSessionId: string;
  inventoryItemId: string;
  displayOrder: number;
  plannedQuantityToSell?: number;
  actualQuantitySold: number;
  remainingQuantityAfterLive: number;
}

// 2.5 Claim
export interface Claim {
  id: string;
  liveSessionId: string;
  inventoryItemId: string;
  variantId?: string;
  soldOnline?: boolean; // true if sale happened outside live (e.g., online shop)
  joyReserve?: boolean; // marked as joy reserve / no-pay
  customerId?: string;
  temporaryName: string;
  quantity: number;
  timestamp: string;
  source: "MANUAL" | "IMPORT";
  status: "PENDING" | "ACCEPTED" | "WAITLIST" | "REJECTED" | "CANCELLED";
  reason?: string;
}

// 2.6 Order
export type OrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface Order {
  id: string;
  customerId: string;
  liveSessionId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  promoDiscountTotal: number;
  shippingFee: number;
  codFee: number;
  otherFees: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  shipmentId?: string;
  createdAt: string;
  updatedAt: string;
}

// 2.7 OrderLine
export interface OrderLine {
  id: string;
  orderId: string;
  inventoryItemId: string;
  variantId?: string;
  itemCodeSnapshot: string;
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
}

// 2.8 Customer
export interface Customer {
  id: string;
  displayName: string; // FB/TikTok name
  realName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate?: string;
  lastOrderDate?: string;
  noPayCount?: number; // for joy reservers
}

// 2.9 Payment
export type PaymentMethod =
  | "GCASH"
  | "MAYA"
  | "BANK"
  | "COD"
  | "CASH"
  | "OTHER";

export interface Payment {
  id: string;
  orderId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  status: "POSTED" | "VOIDED";
  notes?: string;
}

// 2.10 Shipment
export type ShipmentStatus =
  | "PENDING"
  | "BOOKED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RETURNED"
  | "LOST";

export interface Shipment {
  id: string;
  orderId: string;
  courier: string; // J&T, JRS, LBC, etc.
  trackingNumber: string;
  shippingFee: number;
  bookingDate?: string;
  shipDate?: string;
  deliveryDate?: string;
  status: ShipmentStatus;
  notes?: string;
}

// 2.11 PromoRule
export type PromoRuleType =
  | "BUY_X_GET_Y"
  | "PERCENT_DISCOUNT"
  | "FREE_SHIPPING";

export interface PromoRule {
  id: string;
  name: string;
  type: PromoRuleType;
  conditions: Record<string, unknown>;
  discountValue: number;
  isActive: boolean;
}

// 2.12 AppSettings
export interface AppSettings {
  id: "app-settings";
  lowStockDefaultThreshold: number;
  autoWaitlist: boolean;
  maxReservationsMinutes: number;
  defaultShippingFee: number;
  defaultCodFeePercent: number;
  currency: "PHP"; // fixed
}

// 2.13 FinanceSnapshot (computed, not stored permanently)
export interface FinanceSnapshotTopProduct {
  itemCode: string;
  name: string;
  qtySold: number;
  revenue: number;
  profit: number;
}

export interface FinanceSnapshotTopSession {
  liveSessionId: string;
  title: string;
  revenue: number;
  profit: number;
}

export interface FinanceSnapshot {
  periodLabel: string; // e.g., "Today", "This Week", "Mar 2025"
  totalSales: number;
  totalCostOfGoods: number;
  totalShippingCost: number;
  totalOtherExpenses: number;
  grossProfit: number;
  netProfit: number;
  profitMarginPercent: number;
  topProducts: FinanceSnapshotTopProduct[];
  topSessions: FinanceSnapshotTopSession[];
  cashIn: number; // sum of payments
  cashOut: number; // cost + shipping + other expenses
  balanceChange: number; // cashIn - cashOut
}
