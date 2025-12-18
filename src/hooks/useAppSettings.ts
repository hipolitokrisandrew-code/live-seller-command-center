import { useEffect, useState } from "react";
import { getAppSettings, type UserPreferences } from "../services/settings.service";

type AppSettingsState = {
  settings: UserPreferences | null;
  loading: boolean;
  error: string | null;
};

/**
 * Load app settings once and share basic profile info across pages.
 * Uses in-memory state only; does not subscribe to live updates.
 */
export function useAppSettings(): AppSettingsState {
  const [state, setState] = useState<AppSettingsState>({
    settings: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getAppSettings();
        if (cancelled) return;
        setState({ settings: data, loading: false, error: null });
      } catch (err) {
        console.error("Failed to load app settings", err);
        if (cancelled) return;
        setState({
          settings: null,
          loading: false,
          error: "Failed to load settings",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
