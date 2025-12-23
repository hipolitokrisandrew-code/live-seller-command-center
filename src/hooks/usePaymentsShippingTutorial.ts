import { useCallback, useEffect, useMemo, useState } from "react";

export type PaymentsShippingTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

// Update this key to re-trigger onboarding for everyone.
// Stored in localStorage as a simple flag to avoid auto-showing again.
const STORAGE_KEY = "paymentsShippingTutorialSeen:v1";

function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Payments & Shipping tutorial state + persistence.
 * To add/reorder steps, edit the `steps` array below.
 * To reuse for other modules, copy this hook + overlay and change STORAGE_KEY and selectors.
 */
export function usePaymentsShippingTutorial() {
  const steps = useMemo<PaymentsShippingTutorialStep[]>(
    () => [
      {
        id: "payments-shipping-header",
        title: "Payments & Shipping overview",
        description:
          "Workspace para mag-record ng payments at i-update ang shipping status per order.",
        targetSelector: '[data-tour="payments-shipping-header"]',
        spotlightPadding: 10,
      },
      {
        id: "payments-shipping-session",
        title: "Live session selector",
        description:
          "Piliin ang live session para lumabas ang tamang orders sa queue.",
        targetSelector: '[data-tour="payments-shipping-session"]',
      },
      {
        id: "payments-shipping-order",
        title: "Order selector",
        description:
          "Piliin ang order para ma-load ang payments at shipment details.",
        targetSelector: '[data-tour="payments-shipping-order"]',
      },
      {
        id: "payments-shipping-payment-filter",
        title: "Payment filters",
        description:
          "Filter agad kung unpaid, partial, o paid para mabilis ang follow-ups.",
        targetSelector: '[data-tour="payments-shipping-payment-filter"]',
      },
      {
        id: "payments-shipping-summary",
        title: "Order summary",
        description:
          "Totals, balance, at status overview ng selected order.",
        targetSelector: '[data-tour="payments-shipping-summary"]',
      },
      {
        id: "payments-shipping-payments",
        title: "Payments list",
        description:
          "Listahan ng payments for this order. Dito rin makikita kung may voided.",
        targetSelector: '[data-tour="payments-shipping-payments"]',
      },
      {
        id: "payments-shipping-add-payment",
        title: "Add payment",
        description:
          "I-encode ang amount, method, date, at reference bago i-save.",
        targetSelector: '[data-tour="payments-shipping-add-payment"]',
      },
      {
        id: "payments-shipping-shipment",
        title: "Shipment details",
        description:
          "Ilagay ang courier, tracking, status, dates, at notes ng shipment.",
        targetSelector: '[data-tour="payments-shipping-shipment"]',
      },
      {
        id: "payments-shipping-queue",
        title: "Shipping queue",
        description:
          "Queue ng orders sa session. Click a row para palitan ang active order.",
        targetSelector: '[data-tour="payments-shipping-queue"]',
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

  // Auto-open on first visit to Payments & Shipping.
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
