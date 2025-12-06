// src/pages/ClaimsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Claim, InventoryItem, LiveSession } from "../core/types";
import { listInventoryItems } from "../services/inventory.service";
import { listLiveSessions } from "../services/liveSessions.service";
import {
  createClaim,
  listClaimsForSession,
  promoteWaitlistedClaimsForSession,
  updateClaimStatus,
} from "../services/claims.service";

type StatusFilter = "ALL" | Claim["status"];

interface ClaimFormState {
  temporaryName: string;
  inventoryItemId: string;
  quantity: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-PH", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderStatusBadge(status: Claim["status"]) {
  // label is a plain string so we can use nice display text
  let label: string = status;
  let className =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

  switch (status) {
    case "ACCEPTED":
      className += " bg-emerald-500/10 text-emerald-400";
      label = "Accepted";
      break;
    case "WAITLIST":
      className += " bg-amber-500/10 text-amber-400";
      label = "Waitlist";
      break;
    case "REJECTED":
      className += " bg-rose-500/10 text-rose-400";
      label = "Rejected";
      break;
    case "CANCELLED":
      className += " bg-slate-700/40 text-slate-400";
      label = "Cancelled";
      break;
    case "PENDING":
      className += " bg-slate-500/10 text-slate-300";
      label = "Pending";
      break;
  }

  return <span className={className}>{label}</span>;
}

export function ClaimsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    undefined
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [form, setForm] = useState<ClaimFormState>({
    temporaryName: "",
    inventoryItemId: "",
    quantity: "1",
  });

  // Load sessions + inventory on mount
  useEffect(() => {
    void initData();
  }, []);

  async function initData() {
    try {
      setLoading(true);
      const [sessionList, inventoryList] = await Promise.all([
        listLiveSessions(),
        listInventoryItems(),
      ]);

      setSessions(sessionList);
      setInventory(inventoryList);

      // Choose default active session: LIVE first, else latest
      if (sessionList.length > 0) {
        const live = sessionList.find((s) => s.status === "LIVE");
        setActiveSessionId((live ?? sessionList[0]).id);
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load sessions or inventory.");
    } finally {
      setLoading(false);
    }
  }

  // Load claims whenever active session changes
  useEffect(() => {
    if (!activeSessionId) return;
    void refreshClaims(activeSessionId);
  }, [activeSessionId]);

  async function refreshClaims(sessionId: string) {
    try {
      setClaimsLoading(true);
      const data = await listClaimsForSession(sessionId);
      setClaims(data);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load claims.");
    } finally {
      setClaimsLoading(false);
    }
  }

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventory) {
      map.set(item.id, item);
    }
    return map;
  }, [inventory]);

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

  function getAvailableForSelectedItem(): number | null {
    if (!form.inventoryItemId) return null;
    const item = inventoryMap.get(form.inventoryItemId);
    if (!item) return null;
    return Math.max(0, item.currentStock - item.reservedStock);
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

    try {
      const claim = await createClaim({
        liveSessionId: activeSessionId,
        inventoryItemId: form.inventoryItemId,
        quantity: qty,
        temporaryName: form.temporaryName,
      });

      await refreshClaims(activeSessionId);

      // Reset quantity only; keep name and item for fast entry
      setForm((prev) => ({ ...prev, quantity: "1" }));

      if (claim.status === "WAITLIST") {
        setInfoMessage(
          `Claim for ${claim.temporaryName} is WAITLISTED (kulang ang stock).`
        );
      } else if (claim.status === "REJECTED") {
        setInfoMessage("Claim was REJECTED (no stock available).");
      } else if (claim.status === "ACCEPTED") {
        setInfoMessage(
          `Claim for ${claim.temporaryName} ACCEPTED and stock reserved.`
        );
      }
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof Error) {
        setFormError(e.message);
      } else {
        setFormError("Failed to create claim.");
      }
    }
  }

  async function handlePromoteWaitlist() {
    if (!activeSessionId) return;
    setInfoMessage(null);
    setError(null);

    try {
      const promoted = await promoteWaitlistedClaimsForSession(activeSessionId);
      await refreshClaims(activeSessionId);
      if (promoted === 0) {
        setInfoMessage(
          "No waitlisted claims were promoted (baka kulang pa stock)."
        );
      } else {
        setInfoMessage(`Promoted ${promoted} waitlisted claim(s) to ACCEPTED.`);
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to promote waitlisted claims.");
    }
  }

  async function handleCancelClaim(claim: Claim) {
    if (!activeSessionId) return;
    try {
      await updateClaimStatus(claim.id, "CANCELLED");
      await refreshClaims(activeSessionId);
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to cancel claim.");
    }
  }

  async function handleAcceptWaitlisted(claim: Claim) {
    if (!activeSessionId) return;
    setError(null);
    setInfoMessage(null);

    try {
      await updateClaimStatus(claim.id, "ACCEPTED");
      await refreshClaims(activeSessionId);
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
    return list;
  }, [claims, statusFilter]);

  const availableForItem = getAvailableForSelectedItem();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Claims</h1>
          <p className="text-sm text-slate-400">
            Dito mo ita-type ang &quot;mine&quot; claims ng customers habang
            live. Auto-accept / waitlist / reject based sa stock.
          </p>
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          Loading sessions and inventory…
        </div>
      )}

      {/* Session selector + controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="flex min-w-[260px] flex-1 items-center gap-2">
          <span className="text-slate-400">Live session:</span>
          <select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? e.target.value : undefined)
            }
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {sessions.length === 0 && <option value="">No sessions yet</option>}
            {sessions.length > 0 && activeSessionId == null && (
              <option value="">Select session…</option>
            )}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.platform})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Filter status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="WAITLIST">Waitlist</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handlePromoteWaitlist}
          disabled={!activeSessionId}
          className="rounded-md border border-amber-500/70 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          Promote waitlist
        </button>
      </div>

      {activeSession && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Active session:{" "}
              <span className="font-semibold text-slate-200">
                {activeSession.title}
              </span>{" "}
              <span className="text-slate-500">
                ({activeSession.platform} · {activeSession.status})
              </span>
            </span>
            {activeSession.targetRevenue != null && (
              <span>
                Target sales:{" "}
                <span className="font-semibold text-emerald-400">
                  ₱{activeSession.targetRevenue.toLocaleString("en-PH")}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Manual claim entry */}
      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Manual claim entry (type habang nagla-live)
          </span>
          {availableForItem != null && (
            <span className="text-[11px] text-slate-400">
              Available stock for selected item:{" "}
              <span className="font-semibold text-emerald-400">
                {availableForItem}
              </span>
            </span>
          )}
        </div>

        <form
          onSubmit={handleSubmitClaim}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-200">
              Customer (comment name)
            </label>
            <input
              type="text"
              value={form.temporaryName}
              onChange={(e) =>
                handleFormChange("temporaryName", e.target.value)
              }
              placeholder="e.g., Maria Santos"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex min-w-[220px] flex-[1.3] flex-col gap-1">
            <label className="text-xs font-medium text-slate-200">Item</label>
            <select
              value={form.inventoryItemId}
              onChange={(e) =>
                handleFormChange("inventoryItemId", e.target.value)
              }
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Select item…</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemCode} – {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-[90px] flex-col gap-1">
            <label className="text-xs font-medium text-slate-200">Qty</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => handleFormChange("quantity", e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!activeSessionId || inventory.length === 0}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            Add claim
          </button>
        </form>

        {formError && (
          <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {formError}
          </div>
        )}

        {infoMessage && (
          <div className="rounded-md border border-emerald-500/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
            {infoMessage}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Claims table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claimsLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-slate-400"
                >
                  Loading claims…
                </td>
              </tr>
            ) : filteredClaims.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-slate-500"
                >
                  Walang claims pa for this session.
                </td>
              </tr>
            ) : (
              filteredClaims.map((claim) => {
                const item = inventoryMap.get(claim.inventoryItemId);
                const itemLabel = item
                  ? `${item.itemCode} – ${item.name}`
                  : "Item not found";

                return (
                  <tr
                    key={claim.id}
                    className="border-t border-slate-800 hover:bg-slate-900/60"
                  >
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {formatTime(claim.timestamp)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-100">
                      {claim.temporaryName}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {itemLabel}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-100">
                      {claim.quantity}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {renderStatusBadge(claim.status)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-400">
                      {claim.reason || "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <div className="flex flex-wrap justify-end gap-1">
                        {claim.status === "WAITLIST" && (
                          <button
                            type="button"
                            onClick={() => void handleAcceptWaitlisted(claim)}
                            className="rounded-md border border-emerald-500/70 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-900/40"
                          >
                            Accept
                          </button>
                        )}
                        {claim.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => void handleCancelClaim(claim)}
                            className="rounded-md border border-rose-600 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-900/70"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
