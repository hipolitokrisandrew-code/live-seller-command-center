// src/services/settings.service.ts
//
// Global settings + preferences for the whole app.
//
// Keeps the original AppSettings fields (used by Inventory / Claims / Orders)
// but extends them with extra user preferences such as theme, profile,
// default platform, notification toggles, etc.

import { db } from "../core/db";
import type { AppSettings } from "../core/types";

const SETTINGS_ID = "app-settings";

// Theme mode used across the app
export type ThemeMode = "light" | "dark";

// Extended preferences on top of AppSettings
export type UserPreferences = AppSettings & {
  // Basic profile / business info
  businessName?: string;
  ownerName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Global defaults
  defaultPlatform?: "FACEBOOK" | "TIKTOK" | "SHOPEE" | "OTHER";
  defaultPaymentMethod?: "GCASH" | "MAYA" | "BANK" | "COD" | "CASH" | "OTHER";

  // Whether staff see supplier cost in Inventory
  showCostInInventory?: boolean;

  // Formatting preferences
  dateFormat?: "DMY" | "MDY" | "YMD";
  timeFormat?: "12H" | "24H";

  // Notifications
  enableSoundNotifications?: boolean;
  enableDesktopNotifications?: boolean;

  // UI theme
  theme?: ThemeMode;
};

// LocalStorage key for the theme
const THEME_STORAGE_KEY = "lscc-theme";

/**
 * Default settings & preferences.
 * We keep AppSettings fields + fill sensible defaults for new preferences.
 */
export function createDefaultAppSettings(): UserPreferences {
  const base: AppSettings = {
    id: SETTINGS_ID,
    lowStockDefaultThreshold: 5,
    autoWaitlist: true,
    maxReservationsMinutes: 30,
    defaultShippingFee: 0,
    defaultCodFeePercent: 2,
    // Per original blueprint, currency is fixed to PHP.
    currency: "PHP" as AppSettings["currency"],
  };

  const extended: UserPreferences = {
    ...base,
    businessName: "",
    ownerName: "",
    contactEmail: "",
    contactPhone: "",
    defaultPlatform: "FACEBOOK",
    defaultPaymentMethod: "GCASH",
    showCostInInventory: true,
    dateFormat: "DMY",
    timeFormat: "24H",
    enableSoundNotifications: false,
    enableDesktopNotifications: false,
    theme: "dark",
  };

  return extended;
}

/**
 * Ensure there is a single settings row in Dexie, and migrate any older rows
 * to include the new preference fields.
 */
export async function ensureAppSettings(): Promise<UserPreferences> {
  const existingRaw = (await db.settings.get(SETTINGS_ID)) as
    | (AppSettings & Partial<UserPreferences>)
    | undefined;

  if (!existingRaw) {
    const defaults = createDefaultAppSettings();
    await db.settings.put(defaults);
    return defaults;
  }

  // Merge with defaults so new fields always have values.
  const defaults = createDefaultAppSettings();
  const merged: UserPreferences = {
    ...defaults,
    ...existingRaw,
    id: SETTINGS_ID,
  };

  await db.settings.put(merged);
  return merged;
}

/**
 * Get the current settings (creating defaults if they don't exist).
 */
export async function getAppSettings(): Promise<UserPreferences> {
  return ensureAppSettings();
}

/**
 * Update settings with a partial patch. Returns the updated object.
 */
export async function updateAppSettings(
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await ensureAppSettings();

  const updated: UserPreferences = {
    ...current,
    ...patch,
    id: SETTINGS_ID, // never allow changing id
  };

  await db.settings.put(updated);
  return updated;
}

/**
 * Reset settings back to default values.
 */
export async function resetAppSettings(): Promise<UserPreferences> {
  const defaults = createDefaultAppSettings();
  await db.settings.put(defaults);
  return defaults;
}

/**
 * Decide what theme to use given an optional preference.
 * Falls back to saved localStorage value or OS preference.
 */
export function getEffectiveTheme(
  pref: ThemeMode | undefined | null
): ThemeMode {
  if (pref === "light" || pref === "dark") {
    return pref;
  }

  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "dark" : "light";
}

/**
 * Apply the selected theme to the <html> element and persist it.
 * This will affect all pages and modules since they share the same root.
 *
 * - Adds `theme-light` / `theme-dark` for our CSS variable-based styling.
 * - Adds `dark` class so Tailwind ` variants work.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Remove previous theme classes
  root.classList.remove("theme-light", "theme-dark", "dark");

  const finalTheme: ThemeMode = theme === "light" ? "light" : "dark";

  // Our own theme classes (used by index.css / custom styles)
  root.classList.add(`theme-${finalTheme}`);

  // Tailwind dark-mode class
  if (finalTheme === "dark") {
    root.classList.add("dark");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, finalTheme);
  }
}
