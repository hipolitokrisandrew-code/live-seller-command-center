// src/services/inventory.service.ts
import { db } from "../core/db";
import type { InventoryItem, InventoryVariant } from "../core/types";

export type StockStatus = "OK" | "LOW" | "OUT";

export type CreateInventoryItemInput = Omit<
  InventoryItem,
  "id" | "createdAt" | "updatedAt" | "currentStock" | "reservedStock"
>;

export type UpdateInventoryItemInput = Partial<
  Omit<InventoryItem, "id" | "createdAt" | "updatedAt">
>;

const nowIso = () => new Date().toISOString();
let didNormalizeVariants = false;

function toNonNegative(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sumVariantTotals(variants: InventoryVariant[]): {
  totalStock: number;
  totalReserved: number;
} {
  return variants.reduce(
    (acc, variant) => {
      acc.totalStock += toNonNegative(variant.stock);
      acc.totalReserved += toNonNegative(variant.reservedStock ?? 0);
      return acc;
    },
    { totalStock: 0, totalReserved: 0 }
  );
}

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
  const available = item.variants?.length
    ? item.variants.reduce(
        (sum, variant) =>
          sum +
          Math.max(
            0,
            toNonNegative(variant.stock) -
              toNonNegative(variant.reservedStock ?? 0)
          ),
        0
      )
    : Math.max(0, item.currentStock - item.reservedStock);
  if (available <= 0) return "OUT";
  if (available <= item.lowStockThreshold) return "LOW";
  return "OK";
}

async function normalizeVariantInventory(
  items: InventoryItem[]
): Promise<InventoryItem[]> {
  if (didNormalizeVariants) return items;
  didNormalizeVariants = true;

  const itemsWithVariants = items.filter((item) => item.variants?.length);
  if (itemsWithVariants.length === 0) return items;

  const needsLegacyMigration = itemsWithVariants.some((item) =>
    item.variants?.some((variant) => variant.reservedStock == null)
  );

  const reservedByVariant = new Map<string, number>();
  if (needsLegacyMigration) {
    const claims = await db.claims
      .where("status")
      .equals("ACCEPTED")
      .toArray();

    for (const claim of claims) {
      if (!claim.variantId) continue;
      const qty = toNonNegative(claim.quantity);
      if (qty <= 0) continue;
      const key = `${claim.inventoryItemId}:${claim.variantId}`;
      reservedByVariant.set(key, (reservedByVariant.get(key) ?? 0) + qty);
    }
  }

  const updates: InventoryItem[] = [];
  const normalizedItems = items.map((item) => {
    if (!item.variants?.length) return item;

    const nextVariants = item.variants.map((variant) => {
      const key = `${item.id}:${variant.id}`;
      const reservedFromClaims = reservedByVariant.get(key) ?? 0;
      const reserved =
        variant.reservedStock == null && needsLegacyMigration
          ? reservedFromClaims
          : toNonNegative(variant.reservedStock ?? reservedFromClaims);
      const stockBase = toNonNegative(variant.stock);
      let stock =
        variant.reservedStock == null && needsLegacyMigration
          ? stockBase + reserved
          : stockBase;
      if (reserved > stock) stock = reserved;

      return { ...variant, stock, reservedStock: reserved };
    });

    const totals = sumVariantTotals(nextVariants);
    const nextCurrent = totals.totalStock;
    const nextReserved = totals.totalReserved;

    const variantsChanged = nextVariants.some((variant, idx) => {
      const existing = item.variants![idx];
      return (
        variant.stock !== existing.stock ||
        (variant.reservedStock ?? 0) !== (existing.reservedStock ?? 0)
      );
    });

    const needsUpdate =
      variantsChanged ||
      item.currentStock !== nextCurrent ||
      item.reservedStock !== nextReserved ||
      item.initialStock !== nextCurrent;

    if (needsUpdate) {
      const updated: InventoryItem = {
        ...item,
        variants: nextVariants,
        currentStock: nextCurrent,
        reservedStock: nextReserved,
        initialStock: nextCurrent,
        updatedAt: nowIso(),
      };
      updates.push(updated);
      return updated;
    }

    return item;
  });

  if (updates.length > 0) {
    await db.inventory.bulkPut(updates);
  }

  return normalizedItems;
}

/**
 * Create a new inventory item.
 * - Sets currentStock = initialStock
 * - Sets reservedStock = 0 (or variant totals if provided)
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

  const normalizedVariants = Array.isArray(input.variants)
    ? input.variants.map((variant) => {
        const reserved = toNonNegative(variant.reservedStock ?? 0);
        const stockBase = toNonNegative(variant.stock);
        const stock = stockBase < reserved ? reserved : stockBase;
        return { ...variant, stock, reservedStock: reserved };
      })
    : undefined;
  const totals = normalizedVariants
    ? sumVariantTotals(normalizedVariants)
    : { totalStock: 0, totalReserved: 0 };

  const id = generateId();
  const now = nowIso();
  const baseInitialStock =
    totals.totalStock > 0 ? totals.totalStock : input.initialStock;
  const initialStock = Math.max(baseInitialStock, totals.totalReserved);

  const item: InventoryItem = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
    initialStock,
    currentStock: initialStock,
    reservedStock: normalizedVariants ? totals.totalReserved : 0,
    variants: normalizedVariants,
  };

  await db.inventory.add(item);
  return item;
}

/**
 * Update an existing inventory item.
 * If variants exist, totals are recomputed from variant stock/reserved.
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

  const incomingVariants = changes.variants;
  const isVariantEdit = Array.isArray(incomingVariants);
  const nextVariants = isVariantEdit
    ? incomingVariants.map((variant) => {
        const existingVariant = existing.variants?.find(
          (v) => v.id === variant.id
        );
        const reserved = toNonNegative(
          variant.reservedStock ?? existingVariant?.reservedStock ?? 0
        );
        const stockBase = toNonNegative(variant.stock);
        if (isVariantEdit && stockBase < reserved) {
          const label = variant.label?.trim() || "Variant";
          throw new Error(
            `Reserved stock exceeds on-hand stock for ${label}.`
          );
        }
        const stock = stockBase < reserved ? reserved : stockBase;
        return { ...variant, stock, reservedStock: reserved };
      })
    : existing.variants;

  const hasVariants = Boolean(nextVariants && nextVariants.length > 0);
  const nextTotals = hasVariants
    ? sumVariantTotals(nextVariants as InventoryVariant[])
    : null;
  const nextCurrent = hasVariants
    ? nextTotals!.totalStock
    : changes.currentStock ?? existing.currentStock;
  const nextReserved = hasVariants
    ? nextTotals!.totalReserved
    : changes.reservedStock ?? existing.reservedStock;

  if (!hasVariants && nextReserved > nextCurrent) {
    throw new Error("Reserved stock cannot exceed on-hand stock.");
  }

  const updated: InventoryItem = {
    ...existing,
    ...changes,
    variants: hasVariants ? (nextVariants as InventoryVariant[]) : undefined,
    initialStock: hasVariants
      ? nextTotals!.totalStock
      : changes.initialStock ?? existing.initialStock,
    currentStock: nextCurrent,
    reservedStock: nextReserved,
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
  const item = await db.inventory.get(id);
  if (!item) return undefined;
  const [normalized] = await normalizeVariantInventory([item]);
  return normalized;
}

/**
 * List all inventory items ordered by itemCode.
 * Filtering/search is done in the UI for now.
 */
export async function listInventoryItems(): Promise<InventoryItem[]> {
  const items = await db.inventory.orderBy("itemCode").toArray();
  return normalizeVariantInventory(items);
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

  const hasVariants = Boolean(item.variants && item.variants.length > 0);
  const targetVariantId =
    hasVariants && item.variants
      ? item.variants.some((v) => v.id === variantId)
        ? variantId
        : item.variants[0].id
      : undefined;

  if (hasVariants && targetVariantId && item.variants) {
    const nextVariants = item.variants.map((variant) => {
      const reservedBase = toNonNegative(variant.reservedStock ?? 0);
      if (variant.id !== targetVariantId) {
        return { ...variant, reservedStock: reservedBase };
      }
      const nextStock = Math.max(0, toNonNegative(variant.stock) + currentDelta);
      const nextReserved = Math.max(0, reservedBase + reservedDelta);
      if (nextReserved > nextStock) {
        throw new Error("Not enough stock available for this adjustment.");
      }
      return { ...variant, stock: nextStock, reservedStock: nextReserved };
    });

    const totals = sumVariantTotals(nextVariants);
    const updated: InventoryItem = {
      ...item,
      currentStock: totals.totalStock,
      reservedStock: totals.totalReserved,
      variants: nextVariants,
      updatedAt: nowIso(),
    };

    await db.inventory.put(updated);
    return updated;
  }

  const nextCurrent = Math.max(0, item.currentStock + currentDelta);
  const nextReserved = Math.max(0, item.reservedStock + reservedDelta);
  if (nextReserved > nextCurrent) {
    throw new Error("Not enough stock available for this adjustment.");
  }

  const updated: InventoryItem = {
    ...item,
    currentStock: nextCurrent,
    reservedStock: nextReserved,
    updatedAt: nowIso(),
  };

  await db.inventory.put(updated);
  return updated;
}
