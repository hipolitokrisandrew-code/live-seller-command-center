import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type ItemSearchSelectOption = {
  id: string;
  code: string;
  name: string;
  category?: string;
  onHand: number;
  reserved: number;
  available: number;
};

type ItemSearchSelectProps = {
  items: ItemSearchSelectOption[];
  value: string;
  onChange: (nextId: string) => void;
  includeOutOfStock: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
};

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatStockMeta(option: ItemSearchSelectOption) {
  if (option.available <= 0) {
    return { label: "Out of stock", className: "text-rose-600" };
  }
  return {
    label: `On hand: ${option.onHand} | Reserved: ${option.reserved}`,
    className: "text-slate-500",
  };
}

export function ItemSearchSelect({
  items,
  value,
  onChange,
  includeOutOfStock,
  placeholder,
  disabled,
  error,
}: ItemSearchSelectProps) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const prevValueRef = useRef(value);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === value) ?? null,
    [items, value]
  );
  const selectedLabel = selectedItem
    ? `${selectedItem.code} - ${selectedItem.name}`
    : "";

  useEffect(() => {
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;

    if (!isOpen && selectedItem) {
      setQuery(selectedLabel);
    }

    if (!isOpen && !value && prevValue) {
      setQuery("");
    }
  }, [isOpen, selectedItem, selectedLabel, value]);

  // Search & filtering: case-insensitive match on code/name/category.
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let list = items;
    if (!includeOutOfStock) {
      list = list.filter((item) => item.available > 0);
    }
    if (!normalizedQuery) return list;
    return list.filter((item) => {
      const haystack = `${item.code} ${item.name} ${item.category ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, includeOutOfStock, query]);

  const visibleItems = useMemo(() => {
    if (query.trim()) return filteredItems;
    return filteredItems.slice(0, 8);
  }, [filteredItems, query]);

  // Adjust this copy to change the empty-state messaging.
  const noResultsMessage = useMemo(() => {
    const normalizedQuery = query.trim();
    if (includeOutOfStock) {
      return normalizedQuery
        ? "Walang nahanap na item sa inventory. Check spelling or add this item sa Inventory tab."
        : "Walang items sa inventory.";
    }
    return normalizedQuery
      ? "Walang in-stock item na tugma. Subukan i-toggle ang include out-of-stock items."
      : "Walang in-stock items. Subukan i-toggle ang include out-of-stock items.";
  }, [includeOutOfStock, query]);

  useEffect(() => {
    if (!isOpen) return;
    if (visibleItems.length === 0) {
      setHighlightIndex(-1);
      return;
    }
    setHighlightIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= visibleItems.length) return visibleItems.length - 1;
      return prev;
    });
  }, [visibleItems.length, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(option: ItemSearchSelectOption) {
    onChange(option.id);
    setQuery(`${option.code} - ${option.name}`);
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (visibleItems.length === 0) return;
      setIsOpen(true);
      setHighlightIndex((prev) =>
        Math.min(Math.max(prev, -1) + 1, visibleItems.length - 1)
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleItems.length === 0) return;
      setIsOpen(true);
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (isOpen && highlightIndex >= 0 && visibleItems[highlightIndex]) {
        event.preventDefault();
        handleSelect(visibleItems[highlightIndex]);
      } else {
        setIsOpen(true);
      }
      return;
    }
    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative" ref={wrapperRef}>
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            highlightIndex >= 0 ? `${listboxId}-option-${highlightIndex}` : undefined
          }
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            setIsOpen(true);
            setHighlightIndex(0);
            if (value) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Search by code/name"}
          disabled={disabled}
          className={cn(
            INPUT_CLASS,
            "pr-9",
            error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30" : ""
          )}
        />
        {query && !disabled ? (
          <button
            type="button"
            aria-label="Clear item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              onChange("");
              setIsOpen(true);
              setHighlightIndex(0);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="text-sm leading-none">×</span>
          </button>
        ) : null}

        {isOpen && !disabled ? (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
            {visibleItems.length === 0 ? (
              <div className="space-y-2 p-3 text-xs text-slate-500">
                <p>{noResultsMessage}</p>
                <a
                  href="/inventory"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  Open Inventory in new tab
                </a>
              </div>
            ) : (
              <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-1">
                {visibleItems.map((option, index) => {
                  const isActive = index === highlightIndex;
                  const stockMeta = formatStockMeta(option);
                  const isOut = option.available <= 0;

                  return (
                    <li
                      key={option.id}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={value === option.id}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(option)}
                        onMouseEnter={() => setHighlightIndex(index)}
                        className={cn(
                          "w-full text-left px-3 py-2",
                          isActive ? "bg-emerald-50" : "bg-white",
                          isOut ? "text-slate-500" : "text-slate-900"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {option.code} - {option.name}
                            </div>
                            {option.category ? (
                              <div className="truncate text-xs text-slate-500">
                                {option.category}
                              </div>
                            ) : null}
                          </div>
                          <div className={cn("text-xs font-medium", stockMeta.className)}>
                            {stockMeta.label}
                          </div>
                        </div>
                        {/* Add more metadata here by extending ItemSearchSelectOption. */}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
