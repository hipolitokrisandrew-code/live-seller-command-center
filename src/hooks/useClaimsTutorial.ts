import { useCallback, useEffect, useMemo, useState } from "react";

export type ClaimsTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

// Update this key to re-trigger onboarding for everyone.
// Stored in localStorage as a simple flag to avoid auto-showing again.
const STORAGE_KEY = "claimsTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Claims tutorial state + persistence.
 * To add/reorder steps, edit the `steps` array below.
 * To reuse for other modules, copy this hook + overlay and change STORAGE_KEY and selectors.
 */
export function useClaimsTutorial() {
  const steps = useMemo<ClaimsTutorialStep[]>(
    () => [
      {
        id: "claims-header",
        title: "Claims overview",
        description:
          "Dito mo tina-type ang “mine” claims habang live. Auto-accept/waitlist/reject based sa stock.",
        targetSelector: '[data-tour="claims-header"]',
        mediaLabel: "Header placeholder",
        spotlightPadding: 10,
      },
      {
        id: "claims-session",
        title: "Live session selector",
        description:
          "Piliin ang live session para makita ang tamang claims at inventory.",
        targetSelector: '[data-tour="claims-session"]',
        mediaLabel: "Session selector placeholder",
      },
      {
        id: "claims-status",
        title: "Status filters",
        description:
          "Gamitin ang status pills at hide toggle para mabilis ma-filter ang claims.",
        targetSelector: '[data-tour="claims-status"]',
        mediaLabel: "Status filter placeholder",
      },
      {
        id: "claims-active-session",
        title: "Active session summary",
        description:
          "Quick summary ng active session at target sales.",
        targetSelector: '[data-tour="claims-active-session"]',
      },
      {
        id: "claims-entry",
        title: "Manual claim entry",
        description:
          "I-type ang customer, item, variant, at quantity habang nagla-live.",
        targetSelector: '[data-tour="claims-entry"]',
        mediaLabel: "Entry form placeholder",
      },
      {
        id: "claims-add-button",
        title: "Add claim",
        description:
          "Kapag complete ang details, i-click ang Add claim para ma-save.",
        targetSelector: '[data-tour="claims-add-button"]',
        mediaLabel: "Add claim button placeholder",
        spotlightPadding: 12,
      },
      {
        id: "claims-table",
        title: "Claims list",
        description:
          "Makikita dito ang listahan ng claims, status, at quantities.",
        targetSelector: '[data-tour="claims-table"]',
      },
      {
        id: "claims-actions",
        title: "Row actions",
        description:
          "Accept, joy reserve, cancel, o delete claim from the actions column.",
        targetSelector: '[data-tour="claims-actions"]',
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

  // Auto-open on first visit to Claims.
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
