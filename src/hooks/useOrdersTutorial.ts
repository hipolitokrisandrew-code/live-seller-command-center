import { useCallback, useMemo, useState } from "react";

export type OrdersTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

// Update this key to re-trigger onboarding for everyone.
// Stored in localStorage as a simple flag to avoid auto-showing again.
const STORAGE_KEY = "ordersTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Orders tutorial state + persistence.
 * To add/reorder steps, edit the `steps` array below.
 * To reuse for other modules, copy this hook + overlay and change STORAGE_KEY and selectors.
 */
export function useOrdersTutorial() {
  const steps = useMemo<OrdersTutorialStep[]>(
    () => [
      {
        id: "orders-header",
        title: "Orders overview",
        description:
          "Dito mo makikita ang auto-built orders mula sa accepted claims.",
        targetSelector: '[data-tour="orders-header"]',
        spotlightPadding: 10,
      },
      {
        id: "orders-business",
        title: "Business details",
        description:
          "Ito ang business name at contact details na lalabas sa invoices.",
        targetSelector: '[data-tour="orders-business"]',
      },
      {
        id: "orders-filters",
        title: "Live session & filters",
        description:
          "Piliin ang live session para makita ang tamang orders at statuses.",
        targetSelector: '[data-tour="orders-filters"]',
      },
      {
        id: "orders-build",
        title: "Build from claims",
        description:
          "Kapag may accepted claims, pindutin ito para auto-generate ang orders.",
        targetSelector: '[data-tour="orders-build"]',
        spotlightPadding: 10,
      },
      {
        id: "orders-payment-filter",
        title: "Payment filters",
        description:
          "Filter agad kung unpaid, partial, o paid para mabilis ang follow-ups.",
        targetSelector: '[data-tour="orders-payment-filter"]',
      },
      {
        id: "orders-status-filter",
        title: "Shipping status filters",
        description:
          "I-track kung pending payment, packing, shipped, o delivered na.",
        targetSelector: '[data-tour="orders-status-filter"]',
      },
      {
        id: "orders-active-session",
        title: "Active session summary",
        description:
          "Quick view ng active session at target sales para may context.",
        targetSelector: '[data-tour="orders-active-session"]',
      },
      {
        id: "orders-list",
        title: "Orders list",
        description:
          "Pumili ng order dito para makita ang full details sa kanan.",
        targetSelector: '[data-tour="orders-list"]',
      },
      {
        id: "orders-details",
        title: "Order details",
        description:
          "Makikita dito ang customer info, payment/shipping status, at totals.",
        targetSelector: '[data-tour="orders-details"]',
      },
      {
        id: "orders-invoice",
        title: "Invoice PDF",
        description:
          "Generate ng invoice PDF once naka-select na ang order.",
        targetSelector: '[data-tour="orders-invoice"]',
        spotlightPadding: 10,
      },
      {
        id: "orders-discount",
        title: "Discounts & promos",
        description:
          "Apply manual discount, percent promos, or free shipping.",
        targetSelector: '[data-tour="orders-discount"]',
      },
      {
        id: "orders-lines",
        title: "Items list",
        description:
          "Listahan ng items sa order, qty, at price breakdown.",
        targetSelector: '[data-tour="orders-lines"]',
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
