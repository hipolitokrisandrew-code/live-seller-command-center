// src/services/inventory.service.ts
import { db } from "../core/db";
import type { InventoryItem } from "../core/types";

export type StockStatus = "OK" | "LOW" | "OUT";

export type CreateInventoryItemInput = Omit<
  InventoryItem,
  "id" | "createdAt" | "updatedAt" | "currentStock" | "reservedStock"
>;

export type UpdateInventoryItemInput = Partial<
  Omit<InventoryItem, "id" | "createdAt" | "updatedAt">
>;

const nowIso = () => new Date().toISOString();

/**
 * Simple ID generator.
 * Uses crypto.randomUUID when available (browser),
 * falls back to a timestamp-based ID.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Returns OK / LOW / OUT based on currentStock and lowStockThreshold.
 */
export function getStockStatus(item: InventoryItem): StockStatus {
  const available = Math.max(0, item.currentStock - item.reservedStock);
  if (available <= 0) return "OUT";
  if (available <= item.lowStockThreshold) return "LOW";
  return "OK";
}

/**
 * Create a new inventory item.
 * - Sets currentStock = initialStock
 * - Sets reservedStock = 0
 * - Fills createdAt / updatedAt
 */
export async function createInventoryItem(
  input: CreateInventoryItemInput
): Promise<InventoryItem> {
  const code = input.itemCode.trim().toLowerCase();
  const existing = await db.inventory
    .filter((i) => i.itemCode.trim().toLowerCase() === code)
    .first();
  if (existing) {
    throw new Error("Item code must be unique.");
  }

  const totalVariantStock = Array.isArray(input.variants)
    ? input.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : 0;

  const id = generateId();
  const now = nowIso();
  const initialStock =
    totalVariantStock > 0 ? totalVariantStock : input.initialStock;

  const item: InventoryItem = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
    initialStock,
    currentStock: initialStock,
    reservedStock: 0,
    variants: input.variants,
  };

  await db.inventory.add(item);
  return item;
}

/**
 * Update an existing inventory item.
 * Does NOT touch currentStock/reservedStock unless included in `changes`.
 */
export async function updateInventoryItem(
  id: string,
  changes: UpdateInventoryItemInput
): Promise<InventoryItem | undefined> {
  const existing = await db.inventory.get(id);
  if (!existing) {
    throw new Error("Inventory item not found");
  }

  if (changes.itemCode) {
    const code = changes.itemCode.trim().toLowerCase();
    const duplicate = await db.inventory
      .filter((i) => i.id !== id && i.itemCode.trim().toLowerCase() === code)
      .first();
    if (duplicate) {
      throw new Error("Item code must be unique.");
    }
  }

  const totalVariantStock = Array.isArray(changes.variants)
    ? changes.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : undefined;

  const nextReserved = existing.reservedStock;
  const nextCurrent =
    totalVariantStock != null
      ? Math.max(totalVariantStock, nextReserved)
      : changes.currentStock ?? existing.currentStock;

  const updated: InventoryItem = {
    ...existing,
    ...changes,
    initialStock:
      totalVariantStock != null ? totalVariantStock : existing.initialStock,
    currentStock: nextCurrent,
    updatedAt: nowIso(),
  };

  await db.inventory.put(updated);
  return updated;
}

/**
 * Delete an inventory item.
 * (Later we can add a safety check for items already used in orders.)
 */
export async function deleteInventoryItem(id: string): Promise<void> {
  await db.inventory.delete(id);
}

/**
 * Get a single inventory item by ID.
 */
export async function getInventoryItem(
  id: string
): Promise<InventoryItem | undefined> {
  return db.inventory.get(id);
}

/**
 * List all inventory items ordered by itemCode.
 * Filtering/search is done in the UI for now.
 */
export async function listInventoryItems(): Promise<InventoryItem[]> {
  return db.inventory.orderBy("itemCode").toArray();
}

/**
 * Adjust stock for current/reserved quantities.
 * This will be used by the claims/orders logic.
 */
export async function adjustStock(
  itemId: string,
  options: { currentDelta?: number; reservedDelta?: number; variantId?: string }
): Promise<InventoryItem | undefined> {
  const item = await db.inventory.get(itemId);
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const currentDelta = options.currentDelta ?? 0;
  const reservedDelta = options.reservedDelta ?? 0;
  const variantId = options.variantId;

  const nextCurrent = Math.max(0, item.currentStock + currentDelta);
  const nextReserved = Math.max(0, item.reservedStock + reservedDelta);

  let nextVariants = item.variants;
  if (variantId && item.variants && item.variants.length > 0) {
    nextVariants = item.variants.map((v) => {
      if (v.id !== variantId) return v;
      const nextStock = Math.max(
        0,
        v.stock + currentDelta - reservedDelta // reservedDelta reduces available stock, releasing adds back
      );
      return { ...v, stock: nextStock };
    });
  }

  const updated: InventoryItem = {
    ...item,
    currentStock: nextCurrent,
    reservedStock: nextReserved,
    variants: nextVariants,
    updatedAt: nowIso(),
  };

  await db.inventory.put(updated);
  return updated;
}
