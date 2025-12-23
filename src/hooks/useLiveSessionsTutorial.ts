import { useCallback, useEffect, useMemo, useState } from "react";

export type LiveSessionsTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

// Update this key to re-trigger onboarding for everyone.
// Stored in localStorage as a simple flag to avoid auto-showing again.
const STORAGE_KEY = "liveSessionsTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Live Sessions tutorial state + persistence.
 * To add/reorder steps, edit the `steps` array below.
 * To reuse for other modules, copy this hook + overlay and change STORAGE_KEY and selectors.
 */
export function useLiveSessionsTutorial() {
  const steps = useMemo<LiveSessionsTutorialStep[]>(
    () => [
      {
        id: "live-sessions-header",
        title: "Live sessions overview",
        description:
          "Dito mo tina-track ang live schedule: status, targets, at results per session.",
        targetSelector: '[data-tour="live-sessions-header"]',
        mediaLabel: "Header placeholder",
        spotlightPadding: 10,
      },
      {
        id: "live-sessions-add",
        title: "Create a new session",
        description:
          "Click + New session para mag-set ng title, platform, at targets bago mag-live.",
        targetSelector: '[data-tour="live-sessions-add-button"]',
        mediaLabel: "New session placeholder",
        spotlightPadding: 12,
      },
      {
        id: "live-sessions-form",
        title: "New session form",
        description:
          "Ito ang form para sa bagong live session. Dito mo ilalagay ang details.",
        targetSelector: '[data-tour="live-sessions-form"]',
        mediaLabel: "Form placeholder",
        spotlightPadding: 12,
      },
      {
        id: "live-sessions-form-title",
        title: "Session title",
        description:
          "Maglagay ng malinaw na title para madaling mahanap sa claims at orders.",
        targetSelector: '[data-tour="live-sessions-form-title"]',
      },
      {
        id: "live-sessions-form-platform",
        title: "Platform & channel",
        description:
          "Piliin ang platform at ilagay ang page/channel name ng live.",
        targetSelector: '[data-tour="live-sessions-form-platform"]',
      },
      {
        id: "live-sessions-form-targets",
        title: "Targets",
        description:
          "Optional: ilagay ang target sales at target viewers para sa session.",
        targetSelector: '[data-tour="live-sessions-form-targets"]',
      },
      {
        id: "live-sessions-form-notes",
        title: "Notes",
        description:
          "Optional notes para sa promos, reminders, o special mechanics.",
        targetSelector: '[data-tour="live-sessions-form-notes"]',
      },
      {
        id: "live-sessions-form-save",
        title: "Create session",
        description:
          "I-click ang Create session para ma-save at lumabas sa list.",
        targetSelector: '[data-tour="live-sessions-form-save"]',
      },
      {
        id: "live-sessions-filters",
        title: "Search & filters",
        description:
          "Gamitin ang search, platform, at status filters para mabilis makahanap.",
        targetSelector: '[data-tour="live-sessions-filters"]',
        mediaLabel: "Filters placeholder",
      },
      {
        id: "live-sessions-table",
        title: "Sessions list",
        description:
          "Makikita dito ang title, platform, status, start time, at targets.",
        targetSelector: '[data-tour="live-sessions-table"]',
      },
      {
        id: "live-sessions-actions",
        title: "Row actions",
        description:
          "Start, pause, end, edit, o delete ng session gamit ang actions column.",
        targetSelector: '[data-tour="live-sessions-row-actions"]',
        mediaLabel: "Actions placeholder",
        spotlightPadding: 6,
      },
    ],
    []
  );

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeen, setHasSeen] = useState(() => readSeenFlag());

  const markSeen = useCallback(() => {
    setHasSeen(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-open on first visit to Live Sessions.
  useEffect(() => {
    if (!hasSeen) {
      setIsOpen(true);
      setCurrentStep(0);
    }
  }, [hasSeen]);

  const open = useCallback(() => {
    setIsOpen(true);
    setCurrentStep(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    markSeen();
  }, [markSeen]);

  const skip = useCallback(() => {
    setIsOpen(false);
    markSeen();
  }, [markSeen]);

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        markSeen();
        setIsOpen(false);
        return prev;
      }
      return prev + 1;
    });
  }, [markSeen, steps.length]);

  const prev = useCallback(() => {
    setCurrentStep((prevStep) => Math.max(0, prevStep - 1));
  }, []);

  return {
    steps,
    isOpen,
    currentStep,
    open,
    close,
    skip,
    next,
    prev,
  };
}
