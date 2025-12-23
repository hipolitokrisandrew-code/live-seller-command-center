import { useCallback, useMemo, useState } from "react";
import type { LiveSession } from "../core/types";

const STORAGE_PREFIX = "liveSession:last:";

function readStoredSessionId(storageKey: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const value = window.localStorage.getItem(storageKey);
  return value ?? undefined;
}

/**
 * Persist the last selected live session per module.
 * Uses localStorage so the selection survives navigation + refresh.
 */
export function useLiveSessionSelection(moduleKey: string) {
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}${moduleKey}`,
    [moduleKey]
  );

  const [sessionId, setSessionIdState] = useState<string | undefined>(() =>
    readStoredSessionId(storageKey)
  );

  const setSessionId = useCallback(
    (next?: string) => {
      setSessionIdState(next);
      if (typeof window === "undefined") return;
      if (next) {
        window.localStorage.setItem(storageKey, next);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    },
    [storageKey]
  );

  const ensureValidSession = useCallback(
    (sessions: LiveSession[]) => {
      if (sessions.length === 0) {
        setSessionId(undefined);
        return;
      }

      if (sessionId && sessions.some((s) => s.id === sessionId)) {
        return;
      }

      const live = sessions.find((s) => s.status === "LIVE");
      setSessionId((live ?? sessions[0]).id);
    },
    [sessionId, setSessionId]
  );

  return { sessionId, setSessionId, ensureValidSession };
}
