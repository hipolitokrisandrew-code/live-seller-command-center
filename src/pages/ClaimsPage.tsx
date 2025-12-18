import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Claim, InventoryItem, LiveSession } from "../core/types";
import { listInventoryItems } from "../services/inventory.service";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  createClaim,
  listClaimsForSession,
  updateClaimStatus,
  deleteClaim,
} from "../services/claims.service";
import {
  PANEL_CLASS,
  MUTED_PANEL_CLASS,
  INPUT_CLASS,
} from "../theme/classes";
import { useNotification } from "../components/NotificationProvider";
import { getItemImage, getVariantImage } from "../services/imageStore";

type StatusFilter = "ALL" | Claim["status"];

interface ClaimFormState {
  temporaryName: string;
  inventoryItemId: string;
  quantity: string;
  variantId?: string;
  soldOnline: boolean;
}

const FILTER_PANEL_CLASS = `${PANEL_CLASS} flex flex-wrap items-center gap-3 p-3 text-sm`;
const TABLE_WRAPPER_CLASS = `${PANEL_CLASS} overflow-x-auto overflow-y-auto max-h-[65vh] bg-white shadow-sm`;
const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600 sticky top-0 z-10";
const LABEL_CLASS = "text-xs font-medium text-slate-700";

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

function renderStatusBadge(status: Claim["status"]) {
  let label: string = status;
  let className =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

  switch (status) {
    case "ACCEPTED":
      className += " bg-emerald-100 text-emerald-700";
      label = "Accepted";
      break;
    case "WAITLIST":
      className += " bg-amber-100 text-amber-700";
      label = "Waitlist";
      break;
    case "REJECTED":
      className += " bg-rose-100 text-rose-700";
      label = "Rejected";
      break;
    case "CANCELLED":
      className += " bg-slate-100 text-slate-700";
      label = "Cancelled";
      break;
    case "PENDING":
      className += " bg-slate-100 text-slate-700";
      label = "Pending";
      break;
  }

  return <span className={className}>{label}</span>;
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
    return item?.variants ?? [];
  }, [form.inventoryItemId, inventoryMap]);

  const availableInventory = useMemo(() => {
    return inventory.filter(
      (item) =>
        item.status === "ACTIVE" &&
        Math.max(0, item.currentStock - item.reservedStock) > 0
    );
  }, [inventory]);

  const variantAvailable = useMemo(() => {
    if (!form.inventoryItemId || !form.variantId) return null;
    const item = inventoryMap.get(form.inventoryItemId);
    const variant = item?.variants?.find((v) => v.id === form.variantId);
    if (!variant) return null;
    return Math.max(0, variant.stock);
  }, [form.inventoryItemId, form.variantId, inventoryMap]);

  function itemOptionLabel(item: InventoryItem): string {
    return `${item.itemCode} - ${item.name}`;
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
          available: Math.max(0, variant.stock ?? 0),
          label: variant.label,
        };
      }
    }

    const available = Math.max(0, item.currentStock - item.reservedStock);
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

  const availableForItem = getAvailableForSelectedItem();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Claims</h1>
          <p className="text-sm text-slate-600">
            Dito mo ita-type ang "mine" claims ng customers habang live.
            Auto-accept / waitlist / reject based sa stock.
          </p>
        </div>
      </div>

      {loading && (
        <div className={`${MUTED_PANEL_CLASS} px-3 py-2 text-xs text-slate-600`}>
          Loading sessions and inventory...
        </div>
      )}

      {/* Session selector + controls */}
      <div className={`${FILTER_PANEL_CLASS} flex-col gap-3 md:flex-row md:items-center`}>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <span className="text-slate-600">Live session:</span>
          <select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? e.target.value : undefined)
            }
            className={`${INPUT_CLASS} w-full md:w-auto`}
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

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span>Status:</span>
          {(
            ["ALL", "PENDING", "ACCEPTED", "WAITLIST", "REJECTED", "CANCELLED"] as const
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s as StatusFilter)}
              className={`rounded-full border px-2 py-0.5 ${
                statusFilter === s
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {s === "ALL" ? "All" : s.toLowerCase()} (
              {s === "ALL"
                ? claims.length
                : statusCounts[s as Claim["status"]] ?? 0}
              )
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-1 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={hideCancelledJoy}
            onChange={(e) => setHideCancelledJoy(e.target.checked)}
          />
          Hide cancelled / joy reserve
        </label>
      </div>

      {activeSession && (
        <div
          className={`${MUTED_PANEL_CLASS} border border-slate-200 px-2 py-2 text-xs text-slate-600`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Active session:{" "}
              <span className="font-semibold text-slate-900">
                {activeSession.title}
              </span>{" "}
              <span className="text-slate-500">
                ({activeSession.platform} | {activeSession.status})
              </span>
            </span>
            {activeSession.targetRevenue != null && (
              <span>
                Target sales:{" "}
                <span className="font-semibold text-emerald-700">
                  ₱{activeSession.targetRevenue.toLocaleString("en-PH")}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Manual claim entry */}
      <div className={`${PANEL_CLASS} space-y-3 p-3 text-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Manual claim entry (type habang nagla-live)
          </span>
          {availableForItem != null && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
              Available stock{availableForItem.label ? ` (${availableForItem.label})` : ""}:{" "}
              <span className="text-lg text-emerald-700">
                {availableForItem.available}
              </span>
            </span>
          )}
        </div>

        <form
          onSubmit={handleSubmitClaim}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className={LABEL_CLASS}>Customer (comment name)</label>
            <input
              type="text"
              value={form.temporaryName}
              onChange={(e) =>
                handleFormChange("temporaryName", e.target.value)
              }
              placeholder="e.g., Maria Santos"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex min-w-[260px] flex-[1.6] flex-col gap-1">
            <label className={LABEL_CLASS}>Item (search by code/name)</label>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Type to filter items (active & in stock)"
              className={INPUT_CLASS}
            />
            <select
              value={form.inventoryItemId}
              onChange={(e) =>
                handleFormChange("inventoryItemId", e.target.value)
              }
              className={INPUT_CLASS}
            >
              <option value="">Select item...</option>
              {filteredInventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {itemOptionLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[180px] flex-col gap-1">
            <label className={LABEL_CLASS}>Variant</label>
            <select
              value={form.variantId ?? ""}
              onChange={(e) =>
                handleFormChange("variantId", e.target.value || undefined)
              }
              className={INPUT_CLASS}
              disabled={variantOptions.length === 0}
            >
              <option value="">
                {variantOptions.length ? "Select variant..." : "No variants"}
              </option>
              {variantOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-600">
              {variantAvailable != null ? (
                <>
                  Variant stock:{" "}
                  <span className="font-semibold text-slate-900">
                    {variantAvailable}
                  </span>
                </>
              ) : (
                "Select a variant to see variant stock."
              )}
            </div>
          </div>

          <div className="flex w-[90px] flex-col gap-1">
            <label className={LABEL_CLASS}>Qty</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => handleFormChange("quantity", e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-1 items-center text-[11px] text-slate-600">
            {availableForItem ? (
              <span className="rounded-md bg-slate-50 px-2 py-2 text-slate-700">
                Available stock:{" "}
                <span className="font-semibold text-slate-900">
                  {availableForItem.available}
                </span>
                {form.variantId && (
                  <span className="ml-1 text-slate-600">
                    (variant:{" "}
                    {
                      inventoryMap
                        .get(form.inventoryItemId!)
                        ?.variants?.find((v) => v.id === form.variantId)?.label
                    }
                    )
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-500">Select an item to see stock.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!activeSessionId || inventory.length === 0}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            Add claim
          </button>
        </form>

        {formError && (
          <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {formError}
          </div>
        )}

        {infoMessage && (
          <div className="rounded-md border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {infoMessage}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Claims table */}
      <div className={`${TABLE_WRAPPER_CLASS} hidden md:block`}>
        <table className="min-w-full text-left text-sm">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Variant</th>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claimsLoading ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-sm text-slate-600"
                >
                  Loading claims...
                </td>
              </tr>
            ) : filteredClaims.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-sm text-slate-600"
                >
                  Walang claims pa for this session.
                </td>
              </tr>
            ) : (
              filteredClaims.map((claim) => {
                const item = inventoryMap.get(claim.inventoryItemId);
                const itemLabel = item
                  ? `${item.itemCode} - ${item.name}`
                  : "Item not found";
                const variantLabel =
                  item?.variants?.find((v) => v.id === claim.variantId)?.label ??
                  "-";
                const mainImage = item ? imageMap[item.id] : null;
                const variantImage =
                  claim.variantId && variantImages[claim.variantId]
                    ? variantImages[claim.variantId]
                    : null;
                const categoryLabel = item?.category ?? "-";

                return (
                  <tr
                    key={claim.id}
                    className="border-t border-slate-200 odd:bg-slate-50/50 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {formatTime(claim.timestamp)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-900">
                      {claim.temporaryName}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {itemLabel}
                      {claim.soldOnline ? (
                        <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-700">
                          Online
                        </span>
                      ) : null}
                      {claim.joyReserve ? (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                          Joy reserve
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {variantLabel}
                    </td>
                    <td className="px-3 py-2">
                      {variantImage || mainImage ? (
                        <img
                          src={(variantImage || mainImage) as string}
                          alt={item?.name || variantLabel}
                          className="h-10 w-10 cursor-zoom-in rounded border border-slate-200 object-cover"
                          onClick={() =>
                            setLightbox({
                              src: (variantImage || mainImage) as string,
                              alt: item?.name || variantLabel,
                            })
                          }
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-400">
                          No photo
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {categoryLabel}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-900">
                      {claim.quantity}
                    </td>
                    <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
                      {renderStatusBadge(claim.status)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">
                      {claim.reason || "-"}
                    </td>
                      <td className="px-3 py-2 text-right text-xs">
                      <div className="flex flex-wrap justify-end gap-1">
                        {claim.status === "WAITLIST" && (
                          <button
                            type="button"
                            onClick={() => void handleAcceptWaitlisted(claim)}
                            className="rounded-md border border-emerald-500/70 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50"
                          >
                            Accept
                          </button>
                        )}
                        {claim.status === "ACCEPTED" && !claim.joyReserve && (
                          <button
                            type="button"
                            onClick={() => void handleJoyReserveClaim(claim)}
                            className="rounded-md border border-amber-500 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-50"
                          >
                            Joy reserve
                          </button>
                        )}
                        {claim.status !== "CANCELLED" || claim.joyReserve ? (
                          <button
                            type="button"
                            onClick={() => void handleCancelClaim(claim)}
                            className="rounded-md border border-rose-600 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                          ) : null}
                        {claim.status === "CANCELLED" &&
                          (confirmDeleteId === claim.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-rose-700">
                                Permanently delete?
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteClaim(claim)}
                                className="rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(claim.id)}
                              className="rounded-md border border-rose-500 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          ))}
                      </div>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile card view */}
      <div className="block space-y-3 md:hidden">
        {claimsLoading ? (
          <div className={`${PANEL_CLASS} px-3 py-4 text-sm text-slate-600`}>Loading claims...</div>
        ) : filteredClaims.length === 0 ? (
          <div className={`${PANEL_CLASS} px-3 py-4 text-sm text-slate-600`}>
            Walang claims pa for this session.
          </div>
        ) : (
          filteredClaims.map((claim) => {
            const item = inventoryMap.get(claim.inventoryItemId);
            const itemLabel = item ? `${item.itemCode} - ${item.name}` : "Item not found";
            const variantLabel =
              item?.variants?.find((v) => v.id === claim.variantId)?.label ?? "-";
            const categoryLabel = item?.category ?? "-";
            const mainImage = item ? imageMap[item.id] : null;
            const variantImage =
              claim.variantId && variantImages[claim.variantId]
                ? variantImages[claim.variantId]
                : null;

            return (
              <div key={claim.id} className={`${PANEL_CLASS} space-y-2`}>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>{formatTime(claim.timestamp)}</span>
                  <span>{renderStatusBadge(claim.status)}</span>
                </div>
                <div className="flex gap-3">
                  {variantImage || mainImage ? (
                    <img
                      src={(variantImage || mainImage) as string}
                      alt={item?.name || variantLabel}
                      className="h-12 w-12 cursor-zoom-in rounded border border-slate-200 object-cover"
                      onClick={() =>
                        setLightbox({
                          src: (variantImage || mainImage) as string,
                          alt: item?.name || variantLabel,
                        })
                      }
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-400">
                      No photo
                    </div>
                  )}
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-slate-900">{claim.temporaryName}</div>
                    <div className="text-slate-700">{itemLabel}</div>
                    <div className="text-slate-500">Variant: {variantLabel}</div>
                    <div className="text-slate-500">Category: {categoryLabel}</div>
                    <div className="text-slate-500">Qty: {claim.quantity}</div>
                    {claim.reason && (
                      <div className="text-[11px] text-slate-500">Reason: {claim.reason}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                  {claim.status === "WAITLIST" && (
                    <button
                      type="button"
                      onClick={() => void handleAcceptWaitlisted(claim)}
                      className="rounded-md border border-emerald-500 px-2 py-1 text-emerald-700 hover:bg-emerald-50"
                    >
                      Accept
                    </button>
                  )}
                  {claim.status === "ACCEPTED" && !claim.joyReserve && (
                    <button
                      type="button"
                      onClick={() => void handleJoyReserveClaim(claim)}
                      className="rounded-md border border-amber-500 px-2 py-1 text-amber-700 hover:bg-amber-50"
                    >
                      Joy reserve
                    </button>
                  )}
                  {claim.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      onClick={() => void handleCancelClaim(claim)}
                      className="rounded-md border border-rose-500 px-2 py-1 text-rose-700 hover:bg-rose-50"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
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
    </div>
  );
}
