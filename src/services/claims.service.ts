// src/services/claims.service.ts
import { db } from "../core/db";
import type { Claim } from "../core/types";
import { ensureAppSettings } from "./settings.service";
import { adjustStock } from "./inventory.service";

const nowIso = () => new Date().toISOString();

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `claim_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type CreateClaimInput = {
  liveSessionId: string;
  inventoryItemId: string;
  variantId?: string;
  customerId?: string;
  temporaryName: string;
  quantity: number;
  source?: Claim["source"];
};

export type ClaimStatusUpdate =
  | "PENDING"
  | "ACCEPTED"
  | "WAITLIST"
  | "REJECTED"
  | "CANCELLED";

/**
 * Helper: compute available stock (current - reserved, never below 0).
 */
async function getAvailableStock(
  inventoryItemId: string
): Promise<{ available: number; current: number; reserved: number }> {
  const item = await db.inventory.get(inventoryItemId);
  if (!item) {
    throw new Error("Inventory item not found");
  }
  const available = Math.max(0, item.currentStock - item.reservedStock);
  return {
    available,
    current: item.currentStock,
    reserved: item.reservedStock,
  };
}

/**
 * Create a claim and apply stock-reservation logic:
 *
 *  - available = currentStock - reservedStock
 *  - If available >= quantity → ACCEPTED, reservedStock + quantity
 *  - Else if autoWaitlist → WAITLIST (no stock change)
 *  - Else → REJECTED (no stock change)
 */
export async function createClaim(input: CreateClaimInput): Promise<Claim> {
  if (!input.temporaryName.trim()) {
    throw new Error("Customer name is required.");
  }
  if (input.quantity <= 0) {
    throw new Error("Quantity must be at least 1.");
  }

  const settings = await ensureAppSettings();
  const { available } = await getAvailableStock(input.inventoryItemId);

  let status: Claim["status"];
  let reason: string | undefined = undefined;

  if (available >= input.quantity) {
    status = "ACCEPTED";
    // reserve stock
    await adjustStock(input.inventoryItemId, {
      reservedDelta: input.quantity,
    });
  } else if (settings.autoWaitlist) {
    status = "WAITLIST";
    reason = "Auto-waitlist: not enough stock available.";
  } else {
    status = "REJECTED";
    reason = "Not enough stock available.";
  }

  const claim: Claim = {
    id: generateId(),
    liveSessionId: input.liveSessionId,
    inventoryItemId: input.inventoryItemId,
    variantId: input.variantId,
    customerId: input.customerId,
    temporaryName: input.temporaryName.trim(),
    quantity: input.quantity,
    timestamp: nowIso(),
    source: input.source ?? "MANUAL",
    status,
    reason,
  };

  await db.claims.add(claim);
  return claim;
}

/**
 * List claims for a specific live session, oldest first.
 */
export async function listClaimsForSession(
  liveSessionId: string
): Promise<Claim[]> {
  const claims = await db.claims
    .where("liveSessionId")
    .equals(liveSessionId)
    .toArray();

  return claims.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Update claim status and adjust reservedStock when needed.
 *
 * Rules:
 *  - ACCEPTED -> CANCELLED/REJECTED: release reserved stock.
 *  - WAITLIST -> ACCEPTED: check available stock, reserve if enough.
 *  - ACCEPTED -> WAITLIST: release reserved stock.
 *  - Others: no stock change.
 */
export async function updateClaimStatus(
  claimId: string,
  newStatus: ClaimStatusUpdate,
  reason?: string
): Promise<Claim> {
  const existing = await db.claims.get(claimId);
  if (!existing) {
    throw new Error("Claim not found");
  }

  if (existing.status === newStatus) {
    return existing;
  }

  const itemId = existing.inventoryItemId;

  // Handle stock adjustments based on transition
  if (
    existing.status === "ACCEPTED" &&
    (newStatus === "CANCELLED" ||
      newStatus === "REJECTED" ||
      newStatus === "WAITLIST")
  ) {
    // Release reserved stock
    await adjustStock(itemId, { reservedDelta: -existing.quantity });
  } else if (existing.status === "WAITLIST" && newStatus === "ACCEPTED") {
    const { available } = await getAvailableStock(itemId);
    if (available < existing.quantity) {
      throw new Error("Not enough stock to accept this waitlisted claim.");
    }
    await adjustStock(itemId, { reservedDelta: existing.quantity });
  }

  const updated: Claim = {
    ...existing,
    status: newStatus,
    reason: reason ?? existing.reason,
  };

  await db.claims.put(updated);
  return updated;
}

/**
 * Promote waitlisted claims for a session to ACCEPTED (if stock allows).
 * Returns how many were successfully promoted.
 */
export async function promoteWaitlistedClaimsForSession(
  liveSessionId: string
): Promise<number> {
  const claims = await listClaimsForSession(liveSessionId);
  const waitlisted = claims.filter((c) => c.status === "WAITLIST");

  let promoted = 0;

  for (const claim of waitlisted) {
    try {
      await updateClaimStatus(claim.id, "ACCEPTED");
      promoted += 1;
    } catch {
      // Not enough stock for this claim; skip
    }
  }

  return promoted;
}
