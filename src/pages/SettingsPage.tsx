import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  getAppSettings,
  updateAppSettings,
} from "../services/settings.service";
import { CARD_CLASS, INPUT_CLASS, CHECKBOX_CLASS } from "../theme/classes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SettingsFormState = any;

const LABEL_CLASS =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600";
const CHECKBOX_LABEL_CLASS = "text-xs text-slate-700";

export function SettingsPage() {
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const settings = await getAppSettings();
        if (!cancelled) {
          setForm({ ...settings });
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load settings.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleInputChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    if (!form) return;

    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;

    let next: unknown = value;

    if (type === "checkbox" && "checked" in target) {
      next = (target as HTMLInputElement).checked;
    } else if (type === "number") {
      next = value === "" ? "" : Number(value);
    }

    setForm((prev: SettingsFormState | null) =>
      prev ? { ...prev, [name]: next } : prev
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateAppSettings(form as any);
      setMessage("Settings saved successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Settings
        </h1>
        <div className={CARD_CLASS}>
          <p className="text-sm text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-red-600">
          Unable to load settings. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Global preferences that affect Inventory, Live Sessions, Orders,
          Customers, Payments, and Finance.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Appearance (informational) */}
        <section className={CARD_CLASS}>
          <header>
            <h2 className="text-sm font-semibold text-slate-900">Appearance</h2>
            <p className="mt-1 text-xs text-slate-600">
              The system uses a fixed Light theme for clarity and consistency.
            </p>
          </header>
        </section>

        {/* Profile & Business */}
        <section className={CARD_CLASS}>
          <header>
            <h2 className="text-sm font-semibold text-slate-900">
              Profile &amp; Business
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Used across the app (sidebar, Finance header, future exports).
            </p>
          </header>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Business name</label>
              <input
                type="text"
                name="businessName"
                className={INPUT_CLASS}
                value={form.businessName ?? ""}
                onChange={handleInputChange}
                placeholder="Maria's Closet Live"
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Owner / User name</label>
              <input
                type="text"
                name="ownerName"
                className={INPUT_CLASS}
                value={form.ownerName ?? ""}
                onChange={handleInputChange}
                placeholder="Maria Espinosa"
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Contact email (optional)</label>
              <input
                type="email"
                name="contactEmail"
                className={INPUT_CLASS}
                value={form.contactEmail ?? ""}
                onChange={handleInputChange}
                placeholder="liveseller@example.com"
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Contact phone (optional)</label>
              <input
                type="tel"
                name="contactPhone"
                className={INPUT_CLASS}
                value={form.contactPhone ?? ""}
                onChange={handleInputChange}
                placeholder="09XX-XXX-XXXX"
              />
            </div>
          </div>
        </section>

        {/* Defaults & Behavior */}
        <section className={CARD_CLASS}>
          <header>
            <h2 className="text-sm font-semibold text-slate-900">
              Defaults &amp; Behavior
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              These defaults affect new Inventory items, Live Sessions, Orders,
              and Finance calculations.
            </p>
          </header>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL_CLASS}>Default platform</label>
              <select
                name="defaultPlatform"
                className={INPUT_CLASS}
                value={form.defaultPlatform ?? ""}
                onChange={handleInputChange}
              >
                <option value="">None</option>
                <option value="facebook">Facebook Live</option>
                <option value="tiktok">TikTok Live</option>
                <option value="shopee">Shopee Live</option>
                <option value="instagram">IG Live</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Default payment method</label>
              <select
                name="defaultPaymentMethod"
                className={INPUT_CLASS}
                value={form.defaultPaymentMethod ?? ""}
                onChange={handleInputChange}
              >
                <option value="">None</option>
                <option value="gcash">GCash</option>
                <option value="bank-transfer">Bank transfer</option>
                <option value="cod">COD</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Low stock threshold (qty)</label>
              <input
                type="number"
                name="lowStockThreshold"
                className={INPUT_CLASS}
                value={form.lowStockThreshold ?? 0}
                onChange={handleInputChange}
                min={0}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Default shipping fee (PHP)</label>
              <input
                type="number"
                name="defaultShippingFee"
                className={INPUT_CLASS}
                value={form.defaultShippingFee ?? 0}
                onChange={handleInputChange}
                min={0}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Default COD fee (%)</label>
              <input
                type="number"
                name="defaultCodFee"
                className={INPUT_CLASS}
                value={form.defaultCodFee ?? 0}
                onChange={handleInputChange}
                min={0}
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                id="showSupplierCost"
                type="checkbox"
                name="showSupplierCost"
                className={CHECKBOX_CLASS}
                checked={Boolean(form.showSupplierCost)}
                onChange={handleInputChange}
              />
              <label htmlFor="showSupplierCost" className={CHECKBOX_LABEL_CLASS}>
                Show supplier cost in Inventory list
              </label>
            </div>
          </div>
        </section>

        {/* Date / Time & Notifications */}
        <section className={CARD_CLASS}>
          <header>
            <h2 className="text-sm font-semibold text-slate-900">
              Date / Time &amp; Notifications
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Controls how dates are displayed and how notifications behave.
            </p>
          </header>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL_CLASS}>Date format</label>
              <select
                name="dateFormat"
                className={INPUT_CLASS}
                value={form.dateFormat ?? "DD/MM/YYYY"}
                onChange={handleInputChange}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Time format</label>
              <select
                name="timeFormat"
                className={INPUT_CLASS}
                value={form.timeFormat ?? "24-hour"}
                onChange={handleInputChange}
              >
                <option value="24-hour">24-hour</option>
                <option value="12-hour">12-hour</option>
              </select>
            </div>

            <div className="flex flex-col justify-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  name="enableSoundNotifications"
                  className={CHECKBOX_CLASS}
                  checked={Boolean(form.enableSoundNotifications)}
                  onChange={handleInputChange}
                />
                Enable sound notifications (e.g., for new claims / orders)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  name="enableDesktopNotifications"
                  className={CHECKBOX_CLASS}
                  checked={Boolean(form.enableDesktopNotifications)}
                  onChange={handleInputChange}
                />
                Enable desktop notifications (browser permission required)
              </label>
            </div>
          </div>
        </section>

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-xs">
            {error && <p className="text-red-600">{error}</p>}
            {message && !error && <p className="text-emerald-600">{message}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
