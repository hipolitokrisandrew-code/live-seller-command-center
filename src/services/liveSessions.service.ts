// src/services/liveSessions.service.ts
import { db } from "../core/db";
import type { LiveSession } from "../core/types";

const nowIso = () => new Date().toISOString();

/**
 * Simple ID generator (same pattern as inventory service).
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `live_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type CreateLiveSessionInput = {
  title: string;
  platform: LiveSession["platform"];
  channelName: string;
  targetRevenue?: number;
  targetViewers?: number;
  notes?: string;
};

export type UpdateLiveSessionInput = Partial<
  Pick<
    LiveSession,
    | "title"
    | "platform"
    | "channelName"
    | "targetRevenue"
    | "targetViewers"
    | "notes"
  >
>;

/**
 * Create a new live session in PLANNED status.
 */
export async function createLiveSession(
  input: CreateLiveSessionInput
): Promise<LiveSession> {
  const id = generateId();
  const now = nowIso();

  const session: LiveSession = {
    id,
    title: input.title,
    platform: input.platform,
    channelName: input.channelName,
    startTime: undefined,
    endTime: undefined,
    status: "PLANNED",
    targetRevenue: input.targetRevenue,
    targetViewers: input.targetViewers,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  await db.liveSessions.add(session);
  return session;
}

/**
 * Update basic properties of a live session (not status).
 */
export async function updateLiveSession(
  id: string,
  changes: UpdateLiveSessionInput
): Promise<LiveSession | undefined> {
  const existing = await db.liveSessions.get(id);
  if (!existing) {
    throw new Error("Live session not found");
  }

  const updated: LiveSession = {
    ...existing,
    ...changes,
    updatedAt: nowIso(),
  };

  await db.liveSessions.put(updated);
  return updated;
}

/**
 * Change the status of a live session, with start/end timestamps.
 */
export async function setLiveSessionStatus(
  id: string,
  status: LiveSession["status"]
): Promise<LiveSession | undefined> {
  const existing = await db.liveSessions.get(id);
  if (!existing) {
    throw new Error("Live session not found");
  }

  const now = nowIso();

  let startTime = existing.startTime;
  let endTime = existing.endTime;

  // When going LIVE for the first time, set startTime
  if (status === "LIVE" && !startTime) {
    startTime = now;
  }

  // When ending/closing, ensure endTime is set
  if ((status === "ENDED" || status === "CLOSED") && !endTime) {
    endTime = now;
  }

  const updated: LiveSession = {
    ...existing,
    status,
    startTime,
    endTime,
    updatedAt: now,
  };

  await db.liveSessions.put(updated);
  return updated;
}

/**
 * Get single session by ID.
 */
export async function getLiveSession(
  id: string
): Promise<LiveSession | undefined> {
  return db.liveSessions.get(id);
}

/**
 * List sessions, newest first.
 */
export async function listLiveSessions(): Promise<LiveSession[]> {
  const sessions = await db.liveSessions.toArray();
  return sessions.sort((a, b) => {
    const aKey = a.createdAt ?? "";
    const bKey = b.createdAt ?? "";
    return bKey.localeCompare(aKey);
  });
}

/**
 * (Optional) Delete a live session.
 * For now we won't expose this in UI, to keep history safe.
 */
export async function deleteLiveSession(id: string): Promise<void> {
  await db.liveSessions.delete(id);
}
