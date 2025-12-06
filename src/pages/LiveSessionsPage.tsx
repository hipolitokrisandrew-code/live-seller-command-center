// src/pages/LiveSessionsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { LiveSession } from "../core/types";
import {
  createLiveSession,
  listLiveSessions,
  setLiveSessionStatus,
  updateLiveSession,
} from "../services/liveSessions.service";

type PlatformFilter = "ALL" | LiveSession["platform"];
type StatusFilter = "ALL" | LiveSession["status"];

interface FormState {
  id?: string;
  title: string;
  platform: LiveSession["platform"];
  channelName: string;
  targetRevenue: string;
  targetViewers: string;
  notes: string;
}

const defaultForm: FormState = {
  id: undefined,
  title: "",
  platform: "FACEBOOK",
  channelName: "",
  targetRevenue: "",
  targetViewers: "",
  notes: "",
};

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDurationMinutes(session: LiveSession): number | null {
  if (!session.startTime) return null;
  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  return Math.round(ms / 60000);
}

function renderStatusBadge(status: LiveSession["status"]) {
  let label = status;
  let className =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

  switch (status) {
    case "PLANNED":
      className += " bg-slate-500/10 text-slate-300";
      label = "PLANNED";
      break;
    case "LIVE":
      className += " bg-emerald-500/10 text-emerald-400";
      label = "LIVE";
      break;
    case "PAUSED":
      className += " bg-amber-500/10 text-amber-400";
      label = "PAUSED";
      break;
    case "ENDED":
      className += " bg-sky-500/10 text-sky-400";
      label = "ENDED";
      break;
    case "CLOSED":
      className += " bg-slate-700/40 text-slate-400";
      label = "CLOSED";
      break;
  }

  return <span className={className}>{label}</span>;
}

export function LiveSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [form, setForm] = useState<FormState>(defaultForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    void refreshSessions();
  }, []);

  async function refreshSessions() {
    try {
      setLoading(true);
      const data = await listLiveSessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load live sessions.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setForm(defaultForm);
    setIsEditing(false);
    setIsFormOpen(true);
    setError(null);
  }

  function openEditForm(session: LiveSession) {
    setForm({
      id: session.id,
      title: session.title,
      platform: session.platform,
      channelName: session.channelName,
      targetRevenue:
        session.targetRevenue != null ? String(session.targetRevenue) : "",
      targetViewers:
        session.targetViewers != null ? String(session.targetViewers) : "",
      notes: session.notes ?? "",
    });
    setIsEditing(true);
    setIsFormOpen(true);
    setError(null);
  }

  function closeForm() {
    setIsFormOpen(false);
  }

  function handleFormChange<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!form.channelName.trim()) {
      setError("Channel name is required.");
      return;
    }

    const targetRevenue = form.targetRevenue
      ? Number(form.targetRevenue)
      : undefined;
    const targetViewers = form.targetViewers
      ? Number(form.targetViewers)
      : undefined;

    try {
      if (isEditing && form.id) {
        await updateLiveSession(form.id, {
          title: form.title.trim(),
          platform: form.platform,
          channelName: form.channelName.trim(),
          targetRevenue,
          targetViewers,
          notes: form.notes.trim() || undefined,
        });
      } else {
        await createLiveSession({
          title: form.title.trim(),
          platform: form.platform,
          channelName: form.channelName.trim(),
          targetRevenue,
          targetViewers,
          notes: form.notes.trim() || undefined,
        });
      }

      await refreshSessions();
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save live session.");
    }
  }

  async function handleStatusChange(id: string, status: LiveSession["status"]) {
    try {
      await setLiveSessionStatus(id, status);
      await refreshSessions();
    } catch (err) {
      console.error(err);
      setError("Failed to update session status.");
    }
  }

  const filteredSessions = useMemo(() => {
    const term = search.toLowerCase();
    return sessions.filter((s) => {
      const matchesPlatform =
        platformFilter === "ALL" ? true : s.platform === platformFilter;
      const matchesStatus =
        statusFilter === "ALL" ? true : s.status === statusFilter;

      const matchesSearch =
        !term ||
        s.title.toLowerCase().includes(term) ||
        s.channelName.toLowerCase().includes(term);

      return matchesPlatform && matchesStatus && matchesSearch;
    });
  }, [sessions, search, platformFilter, statusFilter]);

  function renderActions(session: LiveSession) {
    const buttons: React.ReactNode[] = [];

    const makeBtn = (
      label: string,
      status: LiveSession["status"],
      key: string
    ) => (
      <button
        key={key}
        type="button"
        onClick={() => void handleStatusChange(session.id, status)}
        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
      >
        {label}
      </button>
    );

    if (session.status === "PLANNED") {
      buttons.push(makeBtn("Start live", "LIVE", "start"));
    } else if (session.status === "LIVE") {
      buttons.push(makeBtn("Pause", "PAUSED", "pause"));
      buttons.push(makeBtn("End live", "ENDED", "end"));
    } else if (session.status === "PAUSED") {
      buttons.push(makeBtn("Resume", "LIVE", "resume"));
      buttons.push(makeBtn("End live", "ENDED", "end"));
    } else if (session.status === "ENDED") {
      buttons.push(makeBtn("Close session", "CLOSED", "close"));
    }

    // Edit is always allowed
    buttons.push(
      <button
        key="edit"
        type="button"
        onClick={() => openEditForm(session)}
        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
      >
        Edit
      </button>
    );

    return <div className="flex flex-wrap justify-end gap-1">{buttons}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            Live Sessions
          </h1>
          <p className="text-sm text-slate-400">
            Planuhin at i-track ang bawat live: platform, target sales, at
            status (Planned, Live, Paused, Ended, Closed).
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-emerald-600"
        >
          + New session
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <span className="text-slate-400">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or channel name"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Platform:</span>
          <select
            value={platformFilter}
            onChange={(e) =>
              setPlatformFilter(e.target.value as PlatformFilter)
            }
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SHOPEE">Shopee</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All</option>
            <option value="PLANNED">Planned</option>
            <option value="LIVE">Live</option>
            <option value="PAUSED">Paused</option>
            <option value="ENDED">Ended</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Sessions table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Targets</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-slate-400"
                >
                  Loading live sessions…
                </td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-slate-500"
                >
                  Walang sessions pa. Click &quot;New session&quot; para
                  mag-setup ng unang live mo.
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => {
                const duration = getDurationMinutes(session);
                return (
                  <tr
                    key={session.id}
                    className="border-t border-slate-800 hover:bg-slate-900/60"
                  >
                    <td className="px-3 py-2 text-sm text-slate-100">
                      {session.title}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {session.platform}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {session.channelName}
                    </td>
                    <td className="px-3 py-2">
                      {renderStatusBadge(session.status)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {session.startTime
                        ? formatDateTime(session.startTime)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {duration != null ? `${duration} min` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {session.targetRevenue != null && (
                        <div>
                          Target sales:{" "}
                          <span className="font-semibold">
                            ₱{session.targetRevenue.toLocaleString("en-PH")}
                          </span>
                        </div>
                      )}
                      {session.targetViewers != null && (
                        <div className="text-[11px] text-slate-400">
                          Target viewers: {session.targetViewers}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {renderActions(session)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  {isEditing ? "Edit live session" : "New live session"}
                </h2>
                <p className="text-xs text-slate-400">
                  Lagyan ng malinaw na title para madaling i-link sa claims at
                  orders.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="flex flex-1 flex-col gap-3 overflow-y-auto scroll-thin"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="FB Live – 8PM Dresses Sale"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Platform
                </label>
                <select
                  value={form.platform}
                  onChange={(e) =>
                    handleFormChange(
                      "platform",
                      e.target.value as LiveSession["platform"]
                    )
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="FACEBOOK">Facebook Live</option>
                  <option value="TIKTOK">TikTok Live</option>
                  <option value="SHOPEE">Shopee Live</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Channel / page name
                </label>
                <input
                  type="text"
                  value={form.channelName}
                  onChange={(e) =>
                    handleFormChange("channelName", e.target.value)
                  }
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="FB Page or TikTok shop name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Target sales (PHP, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.targetRevenue}
                    onChange={(e) =>
                      handleFormChange("targetRevenue", e.target.value)
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Target viewers (optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.targetViewers}
                    onChange={(e) =>
                      handleFormChange("targetViewers", e.target.value)
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Promo details (Buy 3 free shipping, etc.)"
                />
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  {isEditing ? "Save changes" : "Create session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
