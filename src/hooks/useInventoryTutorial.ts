import { useCallback, useEffect, useMemo, useState } from "react";

export type InventoryTutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  mediaLabel?: string;
  spotlightPadding?: number;
};

// Update this key to re-trigger onboarding for everyone.
// Stored in localStorage as a simple flag to avoid auto-showing again.
const STORAGE_KEY = "inventoryTutorialSeen:v1";

// Reads the localStorage flag to decide if we should auto-open the tutorial.
function readSeenFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Inventory tutorial state + persistence.
 * To add/reorder steps, edit the `steps` array below.
 * To reuse for other modules, copy this hook + overlay and change STORAGE_KEY and selectors.
 */
export function useInventoryTutorial() {
  const steps = useMemo<InventoryTutorialStep[]>(
    () => [
      {
        id: "inventory-add",
        title: "Add new item",
        description:
          "Click Add item para mag-create ng product with price, stock, variants, at photos.",
        targetSelector: '[data-tour="inventory-add-button"]',
        mediaLabel: "Add item screenshot placeholder",
        spotlightPadding: 12,
      },
      {
        id: "inventory-add-form",
        title: "Add item modal",
        description:
          "Ito ang Add Item form. Dito mo ilalagay ang product details bago i-save.",
        targetSelector: '[data-tour="inventory-add-form"]',
        mediaLabel: "Add item form placeholder",
        spotlightPadding: 12,
      },
      {
        id: "inventory-add-essentials",
        title: "Essentials",
        description:
          "Lagyan ng item code, name, status, at category. Ito ang core details ng product.",
        targetSelector: '[data-tour="inventory-add-essentials"]',
        mediaLabel: "Essentials placeholder",
      },
      {
        id: "inventory-add-variants",
        title: "Variants",
        description:
          "Kung may size/color, gamitin ang variants. Dito rin naka-set ang low stock warning.",
        targetSelector: '[data-tour="inventory-add-variants"]',
        mediaLabel: "Variants placeholder",
      },
      {
        id: "inventory-add-pricing",
        title: "Pricing & stock",
        description:
          "Set cost price, selling price, at stock. Optional din ang product photo.",
        targetSelector: '[data-tour="inventory-add-pricing"]',
        mediaLabel: "Pricing placeholder",
      },
      {
        id: "inventory-add-save",
        title: "Save item",
        description:
          "Kapag ready na, i-click ang Add item para ma-save ang product.",
        targetSelector: '[data-tour="inventory-add-save"]',
        mediaLabel: "Save button placeholder",
      },
      {
        id: "inventory-header",
        title: "Inventory overview",
        description:
          "Dito mo makikita ang buong listahan ng items, stock status, at key actions for live selling.",
        targetSelector: '[data-tour="inventory-header"]',
        mediaLabel: "Header screenshot placeholder",
        spotlightPadding: 10,
      },
      {
        id: "inventory-filters",
        title: "Search & filters",
        description:
          "Hanapin ang items mabilis gamit ang search, status filter, at low stock / fast-moving toggles.",
        targetSelector: '[data-tour="inventory-filters"]',
        mediaLabel: "Filters screenshot placeholder",
      },
      {
        id: "inventory-table",
        title: "Item list",
        description:
          "Table shows item code, price, stock, status, at mabilis na overview ng inventory health.",
        targetSelector: '[data-tour="inventory-table"]',
      },
      {
        id: "inventory-actions",
        title: "Row actions",
        description:
          "Gamitin ang Edit, Delete, at Variants buttons para i-update ang item details.",
        targetSelector: '[data-tour="inventory-row-actions"]',
        mediaLabel: "Row actions screenshot placeholder",
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

  const startIndex = useMemo(() => {
    const idx = steps.findIndex((step) => step.id === "inventory-add");
    return idx >= 0 ? idx : 0;
  }, [steps]);

  // Auto-open on first visit to Inventory.
  useEffect(() => {
    if (!hasSeen) {
      setCurrentStep(startIndex);
      setIsOpen(true);
    }
  }, [hasSeen, startIndex]);

  const open = useCallback(() => {
    setIsOpen(true);
    setCurrentStep(startIndex);
  }, [startIndex]);

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
