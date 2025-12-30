import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveSession } from "../core/types";
import {
  createLiveSession,
  listLiveSessions,
  setLiveSessionStatus,
  updateLiveSession,
  deleteLiveSession,
} from "../services/liveSessions.service";
import { PANEL_CLASS, INPUT_CLASS } from "../theme/classes";
import { useNotification } from "../hooks/useNotification";
import { LiveSessionsHelpButton } from "../components/liveSessions/LiveSessionsHelpButton";
import { LiveSessionsTutorialOverlay } from "../components/liveSessions/LiveSessionsTutorialOverlay";
import { useLiveSessionsTutorial } from "../hooks/useLiveSessionsTutorial";

type PlatformFilter = "ALL" | LiveSession["platform"];
type StatusFilter = "ALL" | LiveSession["status"];

interface FormState {
  id?: string;
  title: string;
  platform: LiveSession["platform"];
  platformOther: string;
  channelName: string;
  targetRevenue: string;
  targetViewers: string;
  notes: string;
}

const defaultForm: FormState = {
  id: undefined,
  title: "",
  platform: "FACEBOOK",
  platformOther: "",
  channelName: "",
  targetRevenue: "",
  targetViewers: "",
  notes: "",
};

const FILTER_PANEL_CLASS = `${PANEL_CLASS} flex flex-wrap items-center gap-3 p-3 text-sm`;
const TABLE_WRAPPER_CLASS = `${PANEL_CLASS} overflow-x-auto`;
const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600";
const LABEL_CLASS =
  "text-xs font-medium text-slate-700";
const LIVE_SESSIONS_FORM_STEPS = new Set([
  "live-sessions-form",
  "live-sessions-form-title",
  "live-sessions-form-platform",
  "live-sessions-form-targets",
  "live-sessions-form-notes",
  "live-sessions-form-save",
]);

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
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
      className += " bg-slate-100 text-slate-700";
      label = "PLANNED";
      break;
    case "LIVE":
      className += " bg-emerald-100 text-emerald-700";
      label = "LIVE";
      break;
    case "PAUSED":
      className += " bg-amber-100 text-amber-700";
      label = "PAUSED";
      break;
    case "ENDED":
      className += " bg-sky-100 text-sky-700";
      label = "ENDED";
      break;
    case "CLOSED":
      className += " bg-slate-100 text-slate-700";
      label = "CLOSED";
      break;
  }

  return <span className={className}>{label}</span>;
}

export function LiveSessionsPage() {
  const tutorial = useLiveSessionsTutorial();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [form, setForm] = useState<FormState>(defaultForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { notify } = useNotification();
  const tutorialInitialFormOpen = useRef<boolean | null>(null);
  const tutorialAutoOpened = useRef(false);

  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listLiveSessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load live sessions.");
      notify("Failed to load live sessions", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const openCreateForm = useCallback(() => {
    setForm(defaultForm);
    setIsEditing(false);
    setIsFormOpen(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (tutorial.isOpen) {
      if (tutorialInitialFormOpen.current === null) {
        tutorialInitialFormOpen.current = isFormOpen;
        tutorialAutoOpened.current = false;
      }
      return;
    }

    if (
      tutorialAutoOpened.current &&
      !tutorialInitialFormOpen.current &&
      isFormOpen
    ) {
      setIsFormOpen(false);
    }

    tutorialInitialFormOpen.current = null;
    tutorialAutoOpened.current = false;
  }, [tutorial.isOpen, isFormOpen]);

  useEffect(() => {
    if (!tutorial.isOpen) return;
    const stepId = tutorial.steps[tutorial.currentStep]?.id;
    const shouldShowForm = stepId ? LIVE_SESSIONS_FORM_STEPS.has(stepId) : false;

    if (shouldShowForm && !isFormOpen) {
      openCreateForm();
      tutorialAutoOpened.current = true;
      return;
    }

    if (
      !shouldShowForm &&
      tutorialAutoOpened.current &&
      !tutorialInitialFormOpen.current &&
      isFormOpen
    ) {
      setIsFormOpen(false);
    }
  }, [
    tutorial.isOpen,
    tutorial.currentStep,
    tutorial.steps,
    isFormOpen,
    openCreateForm,
  ]);

  function openEditForm(session: LiveSession) {
    setForm({
      id: session.id,
      title: session.title,
      platform: session.platform,
      platformOther: "",
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
    const otherPlatformNote =
      form.platform === "OTHER" && form.platformOther.trim()
        ? `Other platform: ${form.platformOther.trim()}`
        : "";
    const combinedNotes = [otherPlatformNote, form.notes.trim()]
      .filter(Boolean)
      .join("\n");

    try {
      if (isEditing && form.id) {
        await updateLiveSession(form.id, {
          title: form.title.trim(),
          platform: form.platform,
          channelName: form.channelName.trim(),
          targetRevenue,
          targetViewers,
          notes: combinedNotes || undefined,
        });
      } else {
        await createLiveSession({
          title: form.title.trim(),
          platform: form.platform,
          channelName: form.channelName.trim(),
          targetRevenue,
          targetViewers,
          notes: combinedNotes || undefined,
        });
      }

      await refreshSessions();
      setIsFormOpen(false);
      notify(isEditing ? "Session updated" : "Session created", "success");
    } catch (err) {
      console.error(err);
      setError("Failed to save live session.");
      notify("Failed to save live session", "error");
    }
  }

  async function handleStatusChange(id: string, status: LiveSession["status"]) {
    try {
      await setLiveSessionStatus(id, status);
      await refreshSessions();
      notify(`Status set to ${status}`, "success");
    } catch (err) {
      console.error(err);
      setError("Failed to update session status.");
      notify("Failed to update session status", "error");
    }
  }

  async function handleDeleteSession(session: LiveSession) {
    if (confirmDeleteId !== session.id) {
      setConfirmDeleteId(session.id);
      return;
    }
    try {
      await deleteLiveSession(session.id);
      await refreshSessions();
      notify("Live session permanently deleted", "success");
    } catch (err) {
      console.error(err);
      setError("Failed to delete live session.");
      notify("Failed to delete live session", "error");
    } finally {
      setConfirmDeleteId(null);
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
        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-800 hover:bg-slate-100"
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

    buttons.push(
      <button
        key="edit"
        type="button"
        onClick={() => openEditForm(session)}
        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-800 hover:bg-slate-100"
      >
        Edit
      </button>
    );

    if (confirmDeleteId === session.id) {
      buttons.push(
        <div key="confirm-delete" className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-rose-700">
            Permanently delete?
          </span>
          <button
            type="button"
            onClick={() => void handleDeleteSession(session)}
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
      );
    } else {
      buttons.push(
        <button
          key="delete"
          type="button"
          onClick={() => setConfirmDeleteId(session.id)}
          className="rounded-md border border-rose-500 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      );
    }

    return <div className="flex flex-wrap justify-end gap-1">{buttons}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreateForm}
          className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-600 sm:w-auto"
          data-tour="live-sessions-add-button"
        >
          + New session
        </button>
      </div>

      {/* Filters */}
      <div className={FILTER_PANEL_CLASS} data-tour="live-sessions-filters">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <span className="text-slate-600">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or channel name"
            className={`${INPUT_CLASS} flex-1`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-600">Platform:</span>
          <select
            value={platformFilter}
            onChange={(e) =>
              setPlatformFilter(e.target.value as PlatformFilter)
            }
            className={INPUT_CLASS}
          >
            <option value="ALL">All</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SHOPEE">Shopee</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={INPUT_CLASS}
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
        <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Sessions table */}
      <div className={TABLE_WRAPPER_CLASS} data-tour="live-sessions-table">
        <table className="min-w-full text-left text-sm">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Targets</th>
              <th className="px-3 py-2 text-right" data-tour="live-sessions-row-actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-slate-600"
                >
                  Loading live sessions...
                </td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-slate-600"
                >
                  Walang sessions pa. Click "New session" para mag-setup ng
                  unang live mo.
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => {
                const duration = getDurationMinutes(session);
                return (
                  <tr
                    key={session.id}
                    className="border-t border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-sm text-slate-900">
                      {session.title}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {session.platform}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {session.channelName}
                    </td>
                    <td className="px-3 py-2">{renderStatusBadge(session.status)}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {session.startTime
                        ? formatDateTime(session.startTime)
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {duration != null ? `${duration} min` : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {session.targetRevenue != null && (
                        <div>
                          Target sales:{" "}
                          <span className="font-semibold text-slate-900">
                            ₱{session.targetRevenue.toLocaleString("en-PH")}
                          </span>
                        </div>
                      )}
                      {session.targetViewers != null && (
                        <div className="text-[11px] text-slate-500">
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div
            className="flex h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
            data-tour="live-sessions-form"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isEditing ? "Edit live session" : "New live session"}
                </h2>
                <p className="text-xs text-slate-600">
                  Lagyan ng malinaw na title para madaling i-link sa claims at
                  orders.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="flex flex-1 flex-col gap-3 overflow-y-auto"
            >
              <div className="space-y-1" data-tour="live-sessions-form-title">
                <label className={LABEL_CLASS}>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  required
                  className={INPUT_CLASS}
                  placeholder='FB Live "8PM Dresses Sale"'
                />
              </div>

              <div className="space-y-1" data-tour="live-sessions-form-platform">
                <label className={LABEL_CLASS}>Platform</label>
                <select
                  value={form.platform}
                  onChange={(e) =>
                    handleFormChange(
                      "platform",
                      e.target.value as LiveSession["platform"]
                    )
                  }
                  className={INPUT_CLASS}
                >
                  <option value="FACEBOOK">Facebook Live</option>
                  <option value="TIKTOK">TikTok Live</option>
                  <option value="SHOPEE">Shopee Live</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {form.platform === "OTHER" && (
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Specify (optional)</label>
                  <input
                    type="text"
                    value={form.platformOther}
                    onChange={(e) =>
                      handleFormChange("platformOther", e.target.value)
                    }
                    className={INPUT_CLASS}
                    placeholder="Hal. Kumu, YouTube, IG Live"
                  />
                </div>
              )}

              <div className="space-y-1" data-tour="live-sessions-form-platform">
                <label className={LABEL_CLASS}>Channel / page name</label>
                <input
                  type="text"
                  value={form.channelName}
                  onChange={(e) =>
                    handleFormChange("channelName", e.target.value)
                  }
                  required
                  className={INPUT_CLASS}
                  placeholder="FB Page or TikTok shop name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3" data-tour="live-sessions-form-targets">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>
                    Target sales (PHP, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.targetRevenue}
                    onChange={(e) =>
                      handleFormChange("targetRevenue", e.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>
                    Target viewers (optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.targetViewers}
                    onChange={(e) =>
                      handleFormChange("targetViewers", e.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="space-y-1" data-tour="live-sessions-form-notes">
                <label className={LABEL_CLASS}>Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  rows={3}
                  className={`${INPUT_CLASS} min-h-[90px]`}
                  placeholder="Promo details (Buy 3 free shipping, etc.)"
                />
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <div
                className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-3"
                data-tour="live-sessions-form-save"
              >
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-600"
                >
                  {isEditing ? "Save changes" : "Create session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <LiveSessionsHelpButton onClick={tutorial.open} />
      <LiveSessionsTutorialOverlay
        isOpen={tutorial.isOpen}
        steps={tutorial.steps}
        currentIndex={tutorial.currentStep}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onClose={tutorial.close}
        onSkip={tutorial.skip}
      />
    </div>
  );
}
