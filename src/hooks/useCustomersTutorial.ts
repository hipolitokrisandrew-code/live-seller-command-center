import { useCallback, useMemo, useState } from "react";

export type CustomersTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

const STORAGE_KEY = "customersTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useCustomersTutorial() {
  const steps = useMemo<CustomersTutorialStep[]>(
    () => [
      {
        id: "customers-stats",
        title: "Customers at a glance",
        description:
          "Quick stats for active shoppers, joy reserves, and how much they spent.",
        targetSelector: '[data-tour="customers-stats"]',
      },
      {
        id: "customers-list-filters",
        title: "Search & joy filters",
        description:
          "Search a name or toggle to focus on customers with joy reserves.",
        targetSelector: '[data-tour="customers-list-filters"]',
      },
      {
        id: "customers-list",
        title: "Customer list",
        description:
          "Select a customer to see their purchase journey and payment history.",
        targetSelector: '[data-tour="customers-list"]',
      },
      {
        id: "customers-detail",
        title: "Customer profile",
        description:
          "Details like contact info, total spent, and joy status update when you pick someone.",
        targetSelector: '[data-tour="customers-detail"]',
      },
      {
        id: "customers-detail-metrics",
        title: "Customer metrics",
        description:
          "See total orders, paid orders, and joy reserve count for the selected customer.",
        targetSelector: '[data-tour="customers-detail-metrics"]',
      },
      {
        id: "customers-history",
        title: "Recent orders",
        description:
          "Review the latest orders, totals, payment, and status history for quick follow-up.",
        targetSelector: '[data-tour="customers-history"]',
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
