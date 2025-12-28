import { useCallback, useMemo, useState } from "react";

export type FinanceTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

const STORAGE_KEY = "financeTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useFinanceTutorial() {
  const steps = useMemo<FinanceTutorialStep[]>(
    () => [
      {
        id: "finance-header",
        title: "Finance overview",
        description:
          "Dito makikita mo yung period, platform, at net profit ng range na pinili mo.",
        targetSelector: '[data-tour="finance-header"]',
      },
      {
        id: "finance-filters",
        title: "Period & platform filters",
        description:
          "Piliin mo yung period at platform para mas makit mo yung tamang finance result.",
        targetSelector: '[data-tour="finance-filters"]',
      },
      {
        id: "finance-hero-stats",
        title: "Key stats",
        description:
          "Dito mo agad makikita yung total sales, gross profit, net profit, at cash out.",
        targetSelector: '[data-tour="finance-hero-stats"]',
      },
      {
        id: "finance-trend",
        title: "Daily profit trend",
        description:
          "Trend line na nagpapakita ng net profit kada araw, kasama yung area para makita yung momentum.",
        targetSelector: '[data-tour="finance-trend"]',
      },
      {
        id: "finance-top-items",
        title: "Top items highlight",
        description:
          "Leaderboard ng mga top earners sa period na ito.",
        targetSelector: '[data-tour="finance-top-items"]',
      },
      {
        id: "finance-profit",
        title: "Profit by product",
        description:
          "Toggle mo yung Profit, Revenue, at Margin % para makita kung alin ang mas tumataas.",
        targetSelector: '[data-tour="finance-profit"]',
        spotlightPadding: 12,
      },
      {
        id: "finance-margin",
        title: "Margin % by product",
        description:
          "Makikita mo yung products na may pinakamalakas na margin at ikukumpara sa average.",
        targetSelector: '[data-tour="finance-margin"]',
      },
      {
        id: "finance-pareto",
        title: "Contribution to total profit",
        description:
          "Combo chart ng profit bars at cumulative percent line para makita kung sino ang top performers.",
        targetSelector: '[data-tour="finance-pareto"]',
      },
      {
        id: "finance-cash-flow",
        title: "Cash flow snapshot",
        description:
          "Bar chart ng pasok kontra labas ng pera para makita yung cash movement.",
        targetSelector: '[data-tour="finance-cash-flow"]',
      },
      {
        id: "finance-tables",
        title: "Per-session & per-product tables",
        description:
          "I-scroll ang tables para makita yung session at product performance ng mas detalyado.",
        targetSelector: '[data-tour="finance-tables"]',
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
