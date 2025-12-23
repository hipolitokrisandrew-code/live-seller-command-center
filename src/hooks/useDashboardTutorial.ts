import { useCallback, useEffect, useMemo, useState } from "react";

export type DashboardTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

// Update this key to re-trigger onboarding for everyone.
// Stored in localStorage as a simple flag to avoid auto-showing again.
const STORAGE_KEY = "dashboardTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Dashboard tutorial state + persistence.
 * To add/reorder steps, edit the `steps` array below.
 * To reuse for other modules, copy this hook + overlay and change STORAGE_KEY and selectors.
 */
export function useDashboardTutorial() {
  const steps = useMemo<DashboardTutorialStep[]>(
    () => [
      {
        id: "dashboard-header",
        title: "Dashboard overview",
        description:
          "Ito ang summary ng live selling performance mo: benta, pending payments, to-ship, at low stock.",
        targetSelector: '[data-tour="dashboard-header"]',
        mediaLabel: "Header placeholder",
        spotlightPadding: 10,
      },
      {
        id: "dashboard-range",
        title: "Sales date range",
        description:
          "Piliin ang date range para sa sales summary. Other tiles are real-time.",
        targetSelector: '[data-tour="dashboard-range"]',
        mediaLabel: "Date range placeholder",
      },
      {
        id: "dashboard-stats",
        title: "Key tiles",
        description:
          "Tap any tile to drill down: sales, pending payments, to-ship, at low stock.",
        targetSelector: '[data-tour="dashboard-stats"]',
        mediaLabel: "Tiles placeholder",
      },
      {
        id: "dashboard-low-stock",
        title: "Low stock list",
        description:
          "Quick view ng items na mababa na ang stock. Use Inventory to restock.",
        targetSelector: '[data-tour="dashboard-low-stock"]',
        mediaLabel: "Low stock placeholder",
      },
      {
        id: "dashboard-recent-sessions",
        title: "Recent live sessions",
        description:
          "Summary ng live sessions at performance per session (revenue/profit/status).",
        targetSelector: '[data-tour="dashboard-recent-sessions"]',
        mediaLabel: "Sessions placeholder",
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

  // Auto-open on first visit to Dashboard.
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
