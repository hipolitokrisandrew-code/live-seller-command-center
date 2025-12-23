import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  getAppSettings,
  updateAppSettings,
} from "../services/settings.service";
import { Page } from "../components/layout/Page";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardHint,
  CardTitle,
} from "../components/ui/Card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SettingsFormState = any;

const LABEL_CLASS = "text-xs font-medium text-slate-600";
const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500";
const CHECKBOX_LABEL_CLASS = "text-xs text-slate-700";

function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getVatRateError(value: unknown): string | null {
  if (value === "" || value == null) {
    return "VAT rate is required.";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "VAT rate must be a valid number.";
  }
  if (num < 0 || num > 30) {
    return "VAT rate must be between 0 and 30%.";
  }
  return null;
}

export function SettingsPage() {
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vatRateError = form ? getVatRateError(form.taxIncludedRatePct) : null;

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

  async function handleLogoFileChange(file: File | null) {
    if (!form) return;
    if (!file) {
      setForm((prev) => (prev ? { ...prev, logoUrl: "" } : prev));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => (prev ? { ...prev, logoUrl: dataUrl } : prev));
    } catch (err) {
      console.error(err);
      setError("Failed to load logo image.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const rateError = getVatRateError(form.taxIncludedRatePct);
      if (rateError) {
        return;
      }
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
      <Page className="space-y-6">
        <Card className="bg-slate-50">
          <CardContent className="py-3 text-xs text-slate-600">
            Loading settings...
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (!form) {
    return (
      <Page className="space-y-6">
        <Card>
          <CardContent className="py-3 text-sm text-rose-700">
            Unable to load settings. Please refresh the page.
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Appearance (informational) */}
        <Card>
          <CardHeader className="items-start border-b-0">
            <CardTitle>Appearance</CardTitle>
            <CardHint>
              The system uses a fixed Light theme for clarity and consistency.
            </CardHint>
          </CardHeader>
        </Card>

        {/* Profile & Business */}
        <Card>
          <CardHeader className="items-start">
            <div>
              <CardTitle>Profile &amp; Business</CardTitle>
              <CardHint>
                Used across the app (sidebar, Finance header, future exports).
              </CardHint>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Business name</label>
                <input
                  type="text"
                  name="businessName"
                  className={CONTROL_CLASS}
                  value={form.businessName ?? ""}
                  onChange={handleInputChange}
                  placeholder="Maria's Closet Live"
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Owner / User name</label>
                <input
                  type="text"
                  name="ownerName"
                  className={CONTROL_CLASS}
                  value={form.ownerName ?? ""}
                  onChange={handleInputChange}
                  placeholder="Maria Espinosa"
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Contact email (optional)</label>
                <input
                  type="email"
                  name="contactEmail"
                  className={CONTROL_CLASS}
                  value={form.contactEmail ?? ""}
                  onChange={handleInputChange}
                  placeholder="liveseller@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Contact phone (optional)</label>
                <input
                  type="tel"
                  name="contactPhone"
                  className={CONTROL_CLASS}
                  value={form.contactPhone ?? ""}
                  onChange={handleInputChange}
                  placeholder="09XX-XXX-XXXX"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className={LABEL_CLASS}>Logo image</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-emerald-500 text-xs font-bold text-slate-950">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Business logo preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(form.businessName ?? "") || "LS"
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className={CONTROL_CLASS}
                    onChange={(e) =>
                      void handleLogoFileChange(e.target.files?.[0] ?? null)
                    }
                  />
                  {form.logoUrl ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleLogoFileChange(null)}
                      className="sm:w-auto"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  Upload a square image for best results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice template */}
        <Card>
          <CardHeader className="items-start">
            <div>
              <CardTitle>Invoice template</CardTitle>
              <CardHint>Choose a layout for invoice PDF receipts.</CardHint>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Template style</label>
                <select
                  name="invoiceTemplate"
                  className={CONTROL_CLASS}
                  value={form.invoiceTemplate ?? "EMERALD"}
                  onChange={handleInputChange}
                >
                  <option value="CLASSIC">Classic</option>
                  <option value="MODERN">Modern</option>
                  <option value="MINIMAL">Minimal</option>
                  <option value="EMERALD">Emerald</option>
                  <option value="NOIR">Noir</option>
                </select>
              </div>
              <div className="text-xs text-slate-500">
                The invoice PDF uses your logo, business name, contact email,
                and phone.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taxes (VAT) */}
        <Card id="taxes">
          <CardHeader className="items-start">
            <div>
              <CardTitle>Taxes (VAT)</CardTitle>
              <CardHint>
                Configure VAT-inclusive breakdowns shown in Orders and invoices.
              </CardHint>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="taxIncludedEnabled"
                  className={CHECKBOX_CLASS}
                  checked={Boolean(form.taxIncludedEnabled)}
                  onChange={handleInputChange}
                />
                <span className={CHECKBOX_LABEL_CLASS}>
                  Enable VAT (included)
                </span>
              </label>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>VAT rate (%)</label>
                <input
                  type="number"
                  name="taxIncludedRatePct"
                  className={CONTROL_CLASS}
                  value={form.taxIncludedRatePct ?? ""}
                  onChange={handleInputChange}
                  min={0}
                  max={30}
                  step="0.01"
                />
                {vatRateError ? (
                  <div className="text-xs text-rose-600">{vatRateError}</div>
                ) : null}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="shippingTaxable"
                  className={CHECKBOX_CLASS}
                  checked={Boolean(form.shippingTaxable)}
                  onChange={handleInputChange}
                />
                <span className={CHECKBOX_LABEL_CLASS}>
                  Shipping is VAT taxable
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="codTaxable"
                  className={CHECKBOX_CLASS}
                  checked={Boolean(form.codTaxable)}
                  onChange={handleInputChange}
                />
                <span className={CHECKBOX_LABEL_CLASS}>
                  COD fee is VAT taxable
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Defaults & Behavior */}
        <Card>
          <CardHeader className="items-start">
            <div>
              <CardTitle>Defaults &amp; Behavior</CardTitle>
              <CardHint>
                These defaults affect new Inventory items, Live Sessions, Orders,
                and Finance calculations.
              </CardHint>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Default platform</label>
                <select
                  name="defaultPlatform"
                  className={CONTROL_CLASS}
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

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Default payment method</label>
                <select
                  name="defaultPaymentMethod"
                  className={CONTROL_CLASS}
                  value={form.defaultPaymentMethod ?? ""}
                  onChange={handleInputChange}
                >
                  <option value="">None</option>
                  <option value="gcash">GCash</option>
                  <option value="bank-transfer">Bank transfer</option>
                  <option value="cod">COD</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Low stock threshold (qty)</label>
                <input
                  type="number"
                  name="lowStockThreshold"
                  className={CONTROL_CLASS}
                  value={form.lowStockThreshold ?? 0}
                  onChange={handleInputChange}
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Default shipping fee (PHP)</label>
                <input
                  type="number"
                  name="defaultShippingFee"
                  className={CONTROL_CLASS}
                  value={form.defaultShippingFee ?? 0}
                  onChange={handleInputChange}
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Default COD fee (%)</label>
                <input
                  type="number"
                  name="defaultCodFee"
                  className={CONTROL_CLASS}
                  value={form.defaultCodFee ?? 0}
                  onChange={handleInputChange}
                  min={0}
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
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
          </CardContent>
        </Card>

        {/* Date / Time & Notifications */}
        <Card>
          <CardHeader className="items-start">
            <div>
              <CardTitle>Date / Time &amp; Notifications</CardTitle>
              <CardHint>
                Controls how dates are displayed and how notifications behave.
              </CardHint>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Date format</label>
                <select
                  name="dateFormat"
                  className={CONTROL_CLASS}
                  value={form.dateFormat ?? "DD/MM/YYYY"}
                  onChange={handleInputChange}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Time format</label>
                <select
                  name="timeFormat"
                  className={CONTROL_CLASS}
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
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-xs">
            {error && <p className="text-rose-600">{error}</p>}
            {message && !error && <p className="text-emerald-600">{message}</p>}
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </form>
    </Page>
  );
}
