import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Claim,
  InventoryItem,
  InventoryVariant,
  LiveSession,
} from "../core/types";
import { listInventoryItems } from "../services/inventory.service";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  createClaim,
  deleteClaim,
  listClaimsForSession,
  updateClaimStatus,
} from "../services/claims.service";
import { useNotification } from "../hooks/useNotification";
import { getItemImage, getVariantImage } from "../services/imageStore";
import { Page } from "../components/layout/Page";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardHint,
  CardTitle,
} from "../components/ui/Card";

type StatusFilter = "ALL" | Claim["status"];

interface ClaimFormState {
  temporaryName: string;
  inventoryItemId: string;
  quantity: string;
  variantId?: string;
  soldOnline: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const TABLE_WRAPPER_CLASS =
  "rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto md:max-h-[65vh] md:overflow-y-auto";
const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 sticky top-0 z-10";
const LABEL_CLASS = "text-xs font-medium text-slate-600";
const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500";

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("en-PH", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCurrencyCompact(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return `\u20B1${num.toLocaleString("en-PH")}`;
}

function getVariantAvailable(variant: InventoryVariant): number {
  return Math.max(
    0,
    (variant.stock ?? 0) - (variant.reservedStock ?? 0)
  );
}

function getItemAvailable(item: InventoryItem): number {
  if (item.variants?.length) {
    return item.variants.reduce(
      (sum, variant) => sum + getVariantAvailable(variant),
      0
    );
  }
  return Math.max(0, item.currentStock - item.reservedStock);
}

function renderStatusBadge(status: Claim["status"]) {
  switch (status) {
    case "ACCEPTED":
      return (
        <Badge variant="success" className="text-[10px] uppercase tracking-wide">
          Accepted
        </Badge>
      );
    case "WAITLIST":
      return (
        <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
          Waitlist
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="danger" className="text-[10px] uppercase tracking-wide">
          Rejected
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="neutral" className="text-[10px] uppercase tracking-wide">
          Cancelled
        </Badge>
      );
    case "PENDING":
    default:
      return (
        <Badge variant="neutral" className="text-[10px] uppercase tracking-wide">
          Pending
        </Badge>
      );
  }
}

export function ClaimsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    undefined
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [hideCancelledJoy, setHideCancelledJoy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const { notify } = useNotification();
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});
  const [variantImages, setVariantImages] = useState<
    Record<string, string | null>
  >({});
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );

  const [form, setForm] = useState<ClaimFormState>({
    temporaryName: "",
    inventoryItemId: "",
    quantity: "1",
    variantId: undefined,
    soldOnline: false,
  });
  const isOnlineSession = useMemo(() => {
    const title = activeSessionId
      ? sessions.find((s) => s.id === activeSessionId)?.title || ""
      : "";
    return title.toLowerCase().includes("online");
  }, [activeSessionId, sessions]);

  const initData = useCallback(async () => {
    try {
      setLoading(true);
        const [sessionList, inventoryList] = await Promise.all([
          listLiveSessions(),
          listInventoryItems(),
        ]);

        setSessions(sessionList);
      setInventory(inventoryList);
      const entries = await Promise.all(
        inventoryList.map(async (item) => {
          const img = await getItemImage(item.id);
          return [item.id, img] as const;
        })
      );
      setImageMap(Object.fromEntries(entries));
      const variantEntries: Array<[string, string | null]> = [];
      for (const item of inventoryList) {
        if (item.variants) {
          for (const v of item.variants) {
            const img = await getVariantImage(item.id, v.id);
            variantEntries.push([v.id, img]);
          }
        }
      }
      setVariantImages(Object.fromEntries(variantEntries));

      if (sessionList.length > 0) {
        const live = sessionList.find((s) => s.status === "LIVE");
        setActiveSessionId((live ?? sessionList[0]).id);
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load sessions or inventory.");
      notify("Failed to load sessions or inventory", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const refreshInventory = useCallback(async () => {
    const inventoryList = await listInventoryItems();
    setInventory(inventoryList);
    const entries = await Promise.all(
      inventoryList.map(async (item) => {
        const img = await getItemImage(item.id);
        return [item.id, img] as const;
      })
    );
    setImageMap(Object.fromEntries(entries));
    const variantEntries: Array<[string, string | null]> = [];
    for (const item of inventoryList) {
      if (item.variants) {
        for (const v of item.variants) {
          const img = await getVariantImage(item.id, v.id);
          variantEntries.push([v.id, img]);
        }
      }
    }
    setVariantImages(Object.fromEntries(variantEntries));
  }, []);

  useEffect(() => {
    void initData();
  }, [initData]);

  const statusCounts = useMemo(() => {
    const counts: Record<Claim["status"], number> = {
      PENDING: 0,
      ACCEPTED: 0,
      WAITLIST: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    for (const c of claims) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [claims]);

  const refreshClaims = useCallback(async (sessionId: string) => {
    try {
      setClaimsLoading(true);
      const data = await listClaimsForSession(sessionId);
      setClaims(data);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load claims.");
      notify("Failed to load claims", "error");
    } finally {
      setClaimsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (!activeSessionId) return;
    void refreshClaims(activeSessionId);
  }, [activeSessionId, refreshClaims]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, soldOnline: isOnlineSession }));
  }, [isOnlineSession]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventory) {
      map.set(item.id, item);
    }
    return map;
  }, [inventory]);

  const variantOptions = useMemo(() => {
    if (!form.inventoryItemId) return [];
    const item = inventoryMap.get(form.inventoryItemId);
    if (!item?.variants?.length) return [];
    return item.variants.map((variant) => ({
      variant,
      available: getVariantAvailable(variant),
    }));
  }, [form.inventoryItemId, inventoryMap]);

  const availableInventory = useMemo(() => {
    return inventory.filter(
      (item) => item.status === "ACTIVE" && getItemAvailable(item) > 0
    );
  }, [inventory]);

  const variantAvailable = useMemo(() => {
    if (!form.inventoryItemId || !form.variantId) return null;
    const item = inventoryMap.get(form.inventoryItemId);
    const variant = item?.variants?.find((v) => v.id === form.variantId);
    if (!variant) return null;
    return getVariantAvailable(variant);
  }, [form.inventoryItemId, form.variantId, inventoryMap]);

  function itemOptionLabel(item: InventoryItem): string {
    const available = getItemAvailable(item);
    return `${item.itemCode} - ${item.name} (${available} avail)`;
  }

  const filteredInventory = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return availableInventory;
    return availableInventory.filter(
      (item) =>
        item.itemCode.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.category ?? "").toLowerCase().includes(term)
    );
  }, [availableInventory, itemSearch]);

  useEffect(() => {
    if (
      form.inventoryItemId &&
      !availableInventory.some((i) => i.id === form.inventoryItemId)
    ) {
      // Clear selection if item went out of stock
      setForm((prev) => ({ ...prev, inventoryItemId: "", variantId: undefined }));
    }
  }, [availableInventory, form.inventoryItemId]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  function handleFormChange<K extends keyof ClaimFormState>(
    key: K,
    value: ClaimFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getAvailableForSelectedItem():
    | { available: number; label?: string }
    | null {
    if (!form.inventoryItemId) return null;
    const item = inventoryMap.get(form.inventoryItemId);
    if (!item) return null;

    if (form.variantId && item.variants && item.variants.length > 0) {
      const variant = item.variants.find((v) => v.id === form.variantId);
      if (variant) {
        return {
          available: getVariantAvailable(variant),
          label: variant.label,
        };
      }
    }

    const available = getItemAvailable(item);
    return { available };
  }

  async function handleSubmitClaim(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    if (!activeSessionId) {
      setFormError("Please select a live session first.");
      return;
    }
    if (!form.inventoryItemId) {
      setFormError("Please select an item.");
      return;
    }
    if (!form.temporaryName.trim()) {
      setFormError("Customer (comment name) is required.");
      return;
    }

    const qty = Number(form.quantity) || 0;
    if (qty <= 0) {
      setFormError("Quantity must be at least 1.");
      return;
    }

    const item = inventoryMap.get(form.inventoryItemId);
    if (item?.variants?.length && !form.variantId) {
      setFormError("Select a variant for this item.");
      return;
    }

    const availableInfo = getAvailableForSelectedItem();
    if (availableInfo && qty > availableInfo.available) {
      setFormError(
        `Not enough stock. Available: ${availableInfo.available}${
          availableInfo.label ? ` (${availableInfo.label})` : ""
        }.`
      );
      return;
    }

    try {
      const claim = await createClaim({
        liveSessionId: activeSessionId,
        inventoryItemId: form.inventoryItemId,
        variantId: form.variantId,
        quantity: qty,
        temporaryName: form.temporaryName,
        soldOnline: isOnlineSession,
      });

      await refreshClaims(activeSessionId);
      await refreshInventory();
      setForm((prev) => ({ ...prev, quantity: "1", variantId: undefined }));

      setInfoMessage(
        `Claim for ${claim.temporaryName} ACCEPTED and stock reserved.`
      );
      notify("Claim added", "success");
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof Error) {
        setFormError(e.message);
      } else {
        setFormError("Failed to create claim.");
      }
      notify("Failed to add claim", "error");
    }
  }

  async function handleCancelClaim(claim: Claim) {
    if (!activeSessionId) return;
    try {
      await updateClaimStatus(claim.id, "CANCELLED", undefined, {
        joyReserve: false,
      });
      await refreshClaims(activeSessionId);
      await refreshInventory();
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to cancel claim.");
    }
  }

  async function handleJoyReserveClaim(claim: Claim) {
    if (!activeSessionId) return;
    try {
      await updateClaimStatus(claim.id, "CANCELLED", "Marked as joy reserve", {
        joyReserve: true,
      });
      await refreshClaims(activeSessionId);
      await refreshInventory();
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to mark claim as joy reserve.");
    }
  }

  async function handleDeleteClaim(claim: Claim) {
    if (!activeSessionId) return;
    // Two-step inline confirmation
    if (confirmDeleteId !== claim.id) {
      setConfirmDeleteId(claim.id);
      return;
    }
    try {
      await deleteClaim(claim.id);
      await refreshClaims(activeSessionId);
      await refreshInventory();
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to delete claim.");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function handleAcceptWaitlisted(claim: Claim) {
    if (!activeSessionId) return;
    setError(null);
    setInfoMessage(null);

    try {
      await updateClaimStatus(claim.id, "ACCEPTED");
      await refreshClaims(activeSessionId);
      await refreshInventory();
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to accept waitlisted claim.");
      }
    }
  }

  const filteredClaims = useMemo(() => {
    let list = claims
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (statusFilter !== "ALL") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (hideCancelledJoy) {
      list = list.filter(
        (c) => !(c.status === "CANCELLED" || c.joyReserve === true)
      );
    }
    return list;
  }, [claims, statusFilter, hideCancelledJoy]);

  const selectedItem = form.inventoryItemId
    ? inventoryMap.get(form.inventoryItemId)
    : undefined;
  const selectedItemAvailable = selectedItem
    ? getItemAvailable(selectedItem)
    : null;
  const selectedHasVariants = Boolean(selectedItem?.variants?.length);

  return (
    <Page className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Claims
          </h1>
          <p className="text-sm text-slate-600">
            Dito mo ita-type ang "mine" claims ng customers habang live.
            Auto-accept / waitlist / reject based sa stock.
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="bg-slate-50">
          <CardContent className="py-3 text-xs text-slate-600">
            Loading sessions and inventory...
          </CardContent>
        </Card>
      ) : null}

      {/* Session selector + controls */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-1">
              <label className={LABEL_CLASS}>Live session</label>
              <select
                value={activeSessionId ?? ""}
                onChange={(e) =>
                  setActiveSessionId(e.target.value ? e.target.value : undefined)
                }
                className={CONTROL_CLASS}
              >
                <option value="ONLINE">Online / not during live</option>
                {sessions.length === 0 && <option value="">No sessions yet</option>}
                {sessions.length > 0 && activeSessionId == null && (
                  <option value="">Select session...</option>
                )}
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.platform})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 lg:items-end">
              <div className="flex items-center justify-between gap-3">
                <span className={LABEL_CLASS}>Status</span>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={hideCancelledJoy}
                    onChange={(e) => setHideCancelledJoy(e.target.checked)}
                    className={CHECKBOX_CLASS}
                  />
                  Hide cancelled / joy reserve
                </label>
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {(
                  ["ALL", "PENDING", "ACCEPTED", "WAITLIST", "REJECTED", "CANCELLED"] as const
                ).map((s) => {
                  const count =
                    s === "ALL" ? claims.length : statusCounts[s as Claim["status"]] ?? 0;
                  const active = statusFilter === s;
                  const label = s === "ALL" ? "All" : s.toLowerCase();

                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant="secondary"
                      onClick={() => setStatusFilter(s as StatusFilter)}
                      className={cn(
                        "rounded-full font-medium",
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span className="capitalize">{label}</span>
                      <span
                        className={cn(
                          "ml-1 tabular-nums",
                          active ? "text-emerald-700/80" : "text-slate-500",
                        )}
                      >
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeSession ? (
        <Card className="bg-slate-50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Active session:{" "}
                <span className="font-semibold text-slate-900">
                  {activeSession.title}
                </span>{" "}
                <span className="text-slate-500">
                  ({activeSession.platform} | {activeSession.status})
                </span>
              </span>
              {activeSession.targetRevenue != null ? (
                <span>
                  Target sales:{" "}
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {formatCurrencyCompact(activeSession.targetRevenue)}
                  </span>
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Manual claim entry */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Manual claim entry</CardTitle>
            <CardHint>Type habang nagla-live. Auto rules based sa stock.</CardHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmitClaim} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
              <div className="space-y-1 sm:col-span-1 lg:col-span-3">
                <label className={LABEL_CLASS}>Customer (comment name)</label>
                <input
                  type="text"
                  value={form.temporaryName}
                  onChange={(e) =>
                    handleFormChange("temporaryName", e.target.value)
                  }
                  placeholder="e.g., Maria Santos"
                  className={CONTROL_CLASS}
                />
              </div>

              <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                <label className={LABEL_CLASS}>Item</label>
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search by code/name (in-stock)"
                  className={CONTROL_CLASS}
                />
                <select
                  value={form.inventoryItemId}
                  onChange={(e) =>
                    handleFormChange("inventoryItemId", e.target.value)
                  }
                  className={CONTROL_CLASS}
                >
                  <option value="">Select item...</option>
                  {filteredInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {itemOptionLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 sm:col-span-1 lg:col-span-2">
                <label className={LABEL_CLASS}>Variant</label>
                <select
                  value={form.variantId ?? ""}
                  onChange={(e) =>
                    handleFormChange("variantId", e.target.value || undefined)
                  }
                  className={CONTROL_CLASS}
                  disabled={variantOptions.length === 0}
                >
                  <option value="">
                    {variantOptions.length ? "Select variant..." : "No variants"}
                  </option>
                  {variantOptions.map(({ variant, available }) => {
                    const label =
                      available > 0
                        ? `${variant.label} (${available} avail)`
                        : `${variant.label} (Out of stock)`;
                    return (
                      <option
                        key={variant.id}
                        value={variant.id}
                        disabled={available <= 0}
                      >
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1 sm:col-span-1 lg:col-span-1 lg:w-24">
                <label className={LABEL_CLASS}>Qty</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => handleFormChange("quantity", e.target.value)}
                  className={CONTROL_CLASS}
                />
              </div>

              <div className="sm:col-span-1 lg:col-span-2 lg:justify-self-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!activeSessionId || inventory.length === 0}
                  className="w-full whitespace-nowrap lg:w-auto"
                >
                  Add claim
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-slate-500">
              {selectedItem ? (
                <>
                  <div>
                    Total available{selectedHasVariants ? " (all variants)" : ""}:{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {selectedItemAvailable ?? 0}
                    </span>
                  </div>
                  {selectedHasVariants ? (
                    <div>
                      {variantAvailable != null ? (
                        <>
                          Selected variant available:{" "}
                          <span className="font-semibold tabular-nums text-slate-900">
                            {variantAvailable}
                          </span>
                        </>
                      ) : (
                        "Select a variant to see its availability."
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div>Select an item to see available stock.</div>
              )}
            </div>

            {formError ? (
              <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {formError}
              </div>
            ) : null}

            {infoMessage ? (
              <div className="rounded-md border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {infoMessage}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Claims table */}
      <div className={TABLE_WRAPPER_CLASS}>
        <table className="min-w-full text-left">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Variant</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-center">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {claimsLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-slate-600"
                >
                  Loading claims...
                </td>
              </tr>
            ) : filteredClaims.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-slate-600"
                >
                  Walang claims pa for this session.
                </td>
              </tr>
            ) : (
              filteredClaims.map((claim) => {
                const item = inventoryMap.get(claim.inventoryItemId);
                const variantLabel =
                  item?.variants?.find((v) => v.id === claim.variantId)?.label ??
                  "-";
                const mainImage = item ? imageMap[item.id] : null;
                const variantImage =
                  claim.variantId && variantImages[claim.variantId]
                    ? variantImages[claim.variantId]
                    : null;
                const thumb = (variantImage || mainImage) as string | null;

                return (
                  <tr
                    key={claim.id}
                    className="border-t border-slate-200 odd:bg-slate-50/50 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {formatTime(claim.timestamp)}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-900">
                      {claim.temporaryName}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-start gap-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item?.name || variantLabel}
                            className="mt-0.5 h-8 w-8 cursor-zoom-in rounded-md border border-slate-200 object-cover"
                            onClick={() =>
                              setLightbox({
                                src: thumb,
                                alt: item?.name || variantLabel,
                              })
                            }
                          />
                        ) : (
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-slate-200 text-[10px] text-slate-400">
                            No photo
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {item?.name ?? "Item not found"}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            <span className="font-mono">
                              {item?.itemCode ?? "N/A"}
                            </span>
                            <span className="mx-1 text-slate-300">
                              {"\u2022"}
                            </span>
                            {item?.category ?? "-"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {claim.soldOnline ? (
                              <Badge
                                variant="neutral"
                                className="text-[10px] uppercase tracking-wide"
                              >
                                Online
                              </Badge>
                            ) : null}
                            {claim.joyReserve ? (
                              <Badge
                                variant="warning"
                                className="text-[10px] uppercase tracking-wide"
                              >
                                Joy reserve
                              </Badge>
                            ) : null}
                            {claim.reason ? (
                              <span className="truncate text-xs text-slate-500">
                                Reason: {claim.reason}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-700">
                      {variantLabel}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {claim.quantity}
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      {renderStatusBadge(claim.status)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-nowrap justify-end gap-2">
                        {claim.status === "WAITLIST" ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => void handleAcceptWaitlisted(claim)}
                          >
                            Accept
                          </Button>
                        ) : null}
                        {claim.status === "ACCEPTED" && !claim.joyReserve ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleJoyReserveClaim(claim)}
                            className="border-amber-500/80 text-amber-700 hover:bg-amber-50"
                          >
                            Joy reserve
                          </Button>
                        ) : null}
                        {claim.status !== "CANCELLED" || claim.joyReserve ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => void handleCancelClaim(claim)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                        {claim.status === "CANCELLED" ? (
                          confirmDeleteId === claim.id ? (
                            <>
                              <span className="self-center text-[11px] font-medium text-rose-700">
                                Permanently delete?
                              </span>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => void handleDeleteClaim(claim)}
                                className="border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700"
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => void handleDeleteClaim(claim)}
                            >
                              Delete
                            </Button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-[90vh] max-w-[90vw]">
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="max-h-[90vh] max-w-[90vw] rounded shadow-2xl"
            />
          </div>
        </div>
      )}
    </Page>
  );
}
