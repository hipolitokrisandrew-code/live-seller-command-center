import { useCallback, useMemo, useState } from "react";

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
          "Piliin mo yung date range para sa sales summary. Yung mga ibang tiles, real-time ang update.",
        targetSelector: '[data-tour="dashboard-range"]',
        mediaLabel: "Date range placeholder",
      },
      {
        id: "dashboard-stats",
        title: "Key tiles",
        description:
          "Pindutin mo yung tiles para makita ang detalye ng sales, pending payments, to-ship, at low stock.",
        targetSelector: '[data-tour="dashboard-stats"]',
        mediaLabel: "Tiles placeholder",
      },
      {
        id: "dashboard-low-stock",
        title: "Low stock list",
        description:
          "Mabilis na view ng items na mababa na ang stock. Punta ka sa Inventory para mag-restock.",
        targetSelector: '[data-tour="dashboard-low-stock"]',
        mediaLabel: "Low stock placeholder",
      },
      {
        id: "dashboard-recent-sessions",
        title: "Recent live sessions",
        description:
          "Quick summary ng recent live sessions at performance per session—sales, profit, at status.",
        targetSelector: '[data-tour="dashboard-recent-sessions"]',
        mediaLabel: "Sessions placeholder",
      },
    ],
    []
  );

  const initialSeen = readSeenFlag();
  const [isOpen, setIsOpen] = useState(!initialSeen);
  const [currentStep, setCurrentStep] = useState(0);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
  }, []);

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
