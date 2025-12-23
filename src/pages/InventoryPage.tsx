import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryItem, InventoryVariant } from "../core/types";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  getStockStatus,
} from "../services/inventory.service";
import {
  getItemImage,
  getVariantImage,
  removeItemImage,
  removeVariantImage,
  saveItemImage,
  saveVariantImage,
} from "../services/imageStore";
import { INPUT_CLASS } from "../theme/classes";
import { useAppSettings } from "../hooks/useAppSettings";
import { useNotification } from "../hooks/useNotification";
import { Page } from "../components/layout/Page";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Card,
} from "../components/ui/Card";

type InventoryStatusFilter = "ALL" | InventoryItem["status"];

interface FormState {
  id?: string;
  itemCode: string;
  name: string;
  category: string;
  costPrice: string;
  sellingPrice: string;
  initialStock: string;
  lowStockThreshold: string;
  status: InventoryItem["status"];
  variants: VariantRow[];
  variantMode: "SINGLE" | "MULTI";
  photoFile: File | null;
  photoPreview: string | null;
  prevStock?: number;
  prevReserved?: number;
}

type VariantRow = {
  id: string;
  label: string;
  stock: string;
  reservedStock: number;
  costPrice: string;
  sellingPrice: string;
  photoFile?: File | null;
  photoPreview?: string | null;
};

const emptyForm: FormState = {
  id: undefined,
  itemCode: "",
  name: "",
  category: "",
  costPrice: "0",
  sellingPrice: "0",
  initialStock: "0",
  lowStockThreshold: "0",
  status: "ACTIVE",
  variants: [],
  variantMode: "SINGLE",
  photoFile: null,
  photoPreview: null,
  prevStock: 0,
  prevReserved: 0,
};

const TABLE_WRAPPER_CLASS =
  "rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto md:max-h-[65vh] md:overflow-y-auto";
const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 sticky top-0 z-10";
const LABEL_CLASS = "text-xs font-medium text-slate-600";
const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500";

function loadRestockHistory(itemId: string) {
  try {
    const raw = localStorage.getItem(`restock-log:${itemId}`);
    return raw ? (JSON.parse(raw) as { timestamp: number; delta: number; newStock: number }[]) : [];
  } catch {
    return [];
  }
}

function saveRestockHistory(
  itemId: string,
  entries: { timestamp: number; delta: number; newStock: number }[]
) {
  try {
    localStorage.setItem(`restock-log:${itemId}`, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<InventoryStatusFilter>("ALL");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showFastMovingOnly, setShowFastMovingOnly] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const { settings } = useAppSettings();
  const { notify } = useNotification();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [itemImages, setItemImages] = useState<Record<string, string | null>>(
    {}
  );
  const [variantImages, setVariantImages] = useState<
    Record<string, string | null>
  >({});
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );
  const [restockHistory, setRestockHistory] = useState<
    { timestamp: number; delta: number; newStock: number }[]
  >([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    () => new Set()
  );

  const refreshItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listInventoryItems();
      setItems(data);
      const entries = await Promise.all(
        data.map(async (item) => {
          const img = await getItemImage(item.id);
          return [item.id, img] as const;
        })
      );
      setItemImages(Object.fromEntries(entries));
      const variantEntries: Array<[string, string | null]> = [];
      for (const item of data) {
        if (item.variants) {
          for (const v of item.variants) {
            const img = await getVariantImage(item.id, v.id);
            variantEntries.push([v.id, img]);
          }
        }
      }
      setVariantImages(Object.fromEntries(variantEntries));
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory items.");
      notify("Failed to load inventory items", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refreshItems();
  }, [refreshItems]);

  function openCreateForm() {
    setForm(emptyForm);
    setIsEditing(false);
    setError(null);
    setRestockHistory([]);
    setIsFormOpen(true);
  }

  async function openEditForm(item: InventoryItem) {
    const mainImage = await getItemImage(item.id);
    const variantsWithImages =
      item.variants?.map((v) => ({
        id: v.id,
        label: v.label,
        stock: String(v.stock),
        reservedStock: v.reservedStock ?? 0,
        costPrice: v.costPrice != null ? String(v.costPrice) : "",
        sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : "",
        photoFile: null,
        photoPreview: undefined as string | null | undefined,
      })) ?? [];

    for (const v of variantsWithImages) {
      const stored = await getVariantImage(item.id, v.id);
      if (stored) v.photoPreview = stored;
    }

    setForm({
      id: item.id,
      itemCode: item.itemCode,
      name: item.name,
      category: item.category ?? "",
      costPrice: String(item.costPrice),
      sellingPrice: String(item.sellingPrice),
      initialStock: String(item.initialStock),
      lowStockThreshold: String(item.lowStockThreshold),
      status: item.status,
      variants: variantsWithImages,
      variantMode:
        item.variants && item.variants.length > 0 ? "MULTI" : "SINGLE",
      photoFile: null,
      photoPreview: mainImage ?? null,
      prevStock: item.currentStock,
      prevReserved: item.reservedStock,
    });
    setRestockHistory(loadRestockHistory(item.id));
    setIsEditing(true);
    setError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
  }

  function handleFormChange<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "variantMode" && value === "SINGLE") {
        next.variants = [];
      }
      return next;
    });
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function handlePhotoChange(file: File | null) {
    if (!file) {
      setForm((prev) => ({ ...prev, photoFile: null, photoPreview: null }));
      return;
    }
    const preview = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, photoFile: file, photoPreview: preview }));
  }

  function handleVariantPhotoChange(id: string, file: File | null) {
    const preview = file ? URL.createObjectURL(file) : null;
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) =>
        variant.id === id
          ? { ...variant, photoFile: file, photoPreview: preview }
          : variant
      ),
    }));
  }

  function addVariantRow() {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: crypto.randomUUID(),
          label: "",
          stock: "",
          reservedStock: 0,
          costPrice: "",
          sellingPrice: "",
          photoFile: null,
          photoPreview: null,
        },
      ],
    }));
  }

  function updateVariantRow(
    id: string,
    key:
      | "label"
      | "stock"
      | "sellingPrice"
      | "costPrice"
      | "photoFile"
      | "photoPreview",
    value: string | File | null
  ) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.id === id ? { ...v, [key]: value } : v
      ),
    }));
  }

  function removeVariantRow(id: string) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== id),
    }));
  }

  // Suggest an auto-generated code based on name/category.
  function generateCodeSuggestion() {
    if (form.itemCode.trim()) return;
    const base =
      form.name.trim() ||
      form.category.trim() ||
      "ITEM";
    const words = base
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, "")
      .split(/\s+/)
      .filter(Boolean);
    const prefix =
      words.length >= 2
        ? `${words[0].slice(0, 3)}-${words[1].slice(0, 3)}`
        : words[0]?.slice(0, 6) || "ITEM";
    const suffix = String(Math.floor(Math.random() * 900 + 100));
    const code = `${prefix}-${suffix}`.replace(/--+/g, "-");
    setForm((prev) => ({ ...prev, itemCode: code }));
  }

  async function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setValidationHint(null);

    if (!form.itemCode.trim() || !form.name.trim()) {
      setError("Item code at name ay required.");
      return;
    }

    const costPrice = Number(form.costPrice) || 0;
    const sellingPrice = Number(form.sellingPrice) || 0;
    const initialStock = Number(form.initialStock) || 0;
    const lowStockThreshold = Number(form.lowStockThreshold) || 0;
    const variants: InventoryVariant[] =
      form.variants.length > 0
        ? form.variants.map((v) => ({
            id: v.id || crypto.randomUUID(),
            label: v.label.trim(),
            stock: Number(v.stock) || 0,
            reservedStock: v.reservedStock ?? 0,
            costPrice:
              v.costPrice.trim() === ""
                ? undefined
                : Number(v.costPrice) || 0,
            sellingPrice:
              v.sellingPrice.trim() === ""
                ? undefined
                : Number(v.sellingPrice) || 0,
          }))
        : [];
    const totalVariantStock =
      variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : 0;

    if (variants.some((v) => !v.label.trim())) {
      setError("Variant label is required.");
      return;
    }
    const invalidVariant = variants.find(
      (v) => (v.reservedStock ?? 0) > v.stock
    );
    if (invalidVariant) {
      setError(
        `Cannot set stock below reserved for ${
          invalidVariant.label || "variant"
        }.`
      );
      return;
    }

    if (form.variantMode === "MULTI" && totalVariantStock <= 0) {
      setError("Maglagay ng stock sa kahit isang variant.");
      return;
    }
    if (form.variantMode === "SINGLE" && totalVariantStock === 0 && initialStock <= 0) {
      setError("Initial stock must be greater than 0 (or use variants).");
      return;
    }
    if (
      form.variantMode === "SINGLE" &&
      (form.prevReserved ?? 0) > 0 &&
      numericInitialStock < (form.prevReserved ?? 0)
    ) {
      setError(
        `Current stock cannot be lower than reserved stock (${
          form.prevReserved ?? 0
        }).`
      );
      return;
    }

    if (sellingPrice < costPrice) {
      setValidationHint(
        "Heads up: mas mababa ang selling price kaysa cost. Pwede pa rin, pero doble-check mo."
      );
    }

    try {
      let savedItem: InventoryItem | undefined;
      if (isEditing && form.id) {
        const updates = {
          itemCode: form.itemCode.trim(),
          name: form.name.trim(),
          category: form.category.trim() || undefined,
          costPrice,
          sellingPrice,
          lowStockThreshold,
          status: form.status,
          variants: variants.length ? variants : undefined,
          initialStock: variants.length ? totalVariantStock : initialStock,
        };
        if (!variants.length) {
          (updates as { currentStock: number }).currentStock =
            numericInitialStock;
        }
        savedItem = await updateInventoryItem(form.id, updates);
      } else {
        savedItem = await createInventoryItem({
          itemCode: form.itemCode.trim(),
          name: form.name.trim(),
          category: form.category.trim() || undefined,
          description: undefined,
          variantGroup: undefined,
          costPrice,
          sellingPrice,
          initialStock: variants.length ? totalVariantStock : initialStock,
          lowStockThreshold,
          status: form.status,
          variants: variants.length ? variants : undefined,
        });
      }

      // Persist images outside Dexie
      if (form.photoFile && savedItem?.id) {
        const dataUrl = await fileToDataUrl(form.photoFile);
        await saveItemImage(savedItem.id, dataUrl);
      } else if (savedItem?.id && form.photoPreview === null) {
        await removeItemImage(savedItem.id);
      }

      if (savedItem?.id) {
        if (
          form.prevStock != null &&
          form.variantMode === "SINGLE" &&
          numericInitialStock !== form.prevStock
        ) {
          const delta = numericInitialStock - form.prevStock;
          const history = loadRestockHistory(savedItem.id);
          history.push({
            timestamp: Date.now(),
            delta,
            newStock: numericInitialStock,
          });
          saveRestockHistory(savedItem.id, history.slice(-10));
        }
        for (const v of form.variants) {
          if (v.photoFile) {
            const dataUrl = await fileToDataUrl(v.photoFile);
            await saveVariantImage(savedItem.id, v.id, dataUrl);
          } else if (v.photoPreview === null) {
            await removeVariantImage(savedItem.id, v.id);
          }
        }
      }

      await refreshItems();
      setIsFormOpen(false);
      notify(isEditing ? "Item updated" : "Item added", "success");
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to save item. Please try again.";
      setError(msg);
      notify(msg, "error");
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    try {
      await deleteInventoryItem(id);
      await removeItemImage(id);
      await refreshItems();
      notify("Item deleted", "success");
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to delete item. Please try again.";
      setError(msg);
      notify(msg, "error");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;
      const matchesSearch =
        !term ||
        item.itemCode.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.category ?? "").toLowerCase().includes(term);

      const available = Math.max(0, item.currentStock - item.reservedStock);
      const lowStock =
        available <=
        (item.lowStockThreshold || settings?.lowStockDefaultThreshold || 0);
      const fastMoving =
        item.reservedStock > 0 &&
        item.reservedStock >= Math.max(1, item.currentStock / 2);

      const passesLowStock = showLowStockOnly ? lowStock : true;
      const passesFastMoving = showFastMovingOnly ? fastMoving : true;

      return (
        matchesStatus &&
        matchesSearch &&
        passesLowStock &&
        passesFastMoving
      );
    });
  }, [
    items,
    search,
    statusFilter,
    showLowStockOnly,
    showFastMovingOnly,
    settings?.lowStockDefaultThreshold,
  ]);

  const totalVariantStock = useMemo(
    () => form.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
    [form.variants]
  );
  const totalVariantReserved = useMemo(
    () => form.variants.reduce((sum, v) => sum + (v.reservedStock || 0), 0),
    [form.variants]
  );
  const totalVariantAvailable = Math.max(
    0,
    totalVariantStock - totalVariantReserved
  );

  const numericCost = Number(form.costPrice) || 0;
  const numericPrice = Number(form.sellingPrice) || 0;
  const numericInitialStock = Number(form.initialStock) || 0;
  const singleReserved = form.prevReserved ?? 0;
  const singleAvailable = Math.max(0, numericInitialStock - singleReserved);
  const sellingBelowCost = numericPrice > 0 && numericPrice < numericCost;
  const hasStock =
    form.variantMode === "MULTI"
      ? totalVariantStock > 0
      : numericInitialStock > 0;

  const canSubmit =
    form.itemCode.trim() !== "" &&
    form.name.trim() !== "" &&
    numericPrice >= 0 &&
    numericCost >= 0 &&
    hasStock &&
    !loading;

  function toggleExpanded(itemId: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function renderStockBadge(item: InventoryItem) {
    const status = getStockStatus(item);
    switch (status) {
      case "OUT":
        return (
          <Badge variant="danger" className="text-[11px]">
            Out of stock
          </Badge>
        );
      case "LOW":
        return (
          <Badge variant="warning" className="text-[11px]">
            Low stock
          </Badge>
        );
      default:
        return (
          <Badge variant="success" className="text-[11px]">
            In stock
          </Badge>
        );
    }
  }

  function formatCurrency(value: number) {
    return `\u20B1${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const showSupplierCost = (
    settings as unknown as { showSupplierCost?: boolean } | null
  )?.showSupplierCost;
  const showCostInList = showSupplierCost ?? settings?.showCostInInventory ?? true;
  const tableColumnCount = showCostInList ? 7 : 6;

  return (
    <Page className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Inventory
          </h1>
          <p className="text-sm text-slate-600">
            Dito mo ilalagay lahat ng items na binebenta mo sa live - with
            codes, presyo, at stock. Connected to claims, orders, at finance.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={openCreateForm}
          className="w-full sm:w-auto"
        >
          + Add item
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1">
            <label className={LABEL_CLASS}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Item code / name / category"
              className={CONTROL_CLASS}
            />
          </div>
          <div className="w-full space-y-1 lg:w-40">
            <label className={LABEL_CLASS}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as InventoryStatusFilter)
              }
              className={CONTROL_CLASS}
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISCONTINUED">Discontinued</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:ml-auto lg:justify-end">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              Low stock
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showFastMovingOnly}
                onChange={(e) => setShowFastMovingOnly(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              Fast-moving (many reserved)
            </label>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className={TABLE_WRAPPER_CLASS}>
        <table className="min-w-full text-left text-sm">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-4 py-2">Item</th>
              {showCostInList ? (
                <th className="px-4 py-2 text-right">Cost</th>
              ) : null}
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2 text-center">Stock status</th>
              <th className="px-4 py-2 text-center">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td
                  colSpan={tableColumnCount}
                  className="px-4 py-6 text-center text-sm text-slate-600"
                >
                  Loading inventory...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumnCount}
                  className="px-4 py-6 text-center text-sm text-slate-600"
                >
                  Walang items pa. Click "Add item" para magsimula.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const profitPerUnit = item.sellingPrice - item.costPrice;
                const onHand = item.currentStock;
                const reserved = item.reservedStock;
                const available = Math.max(0, onHand - reserved);

                return (
                  <React.Fragment key={item.id}>
                    <tr className="border-t border-slate-200 odd:bg-slate-50/50 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          {itemImages[item.id] ? (
                            <img
                              src={itemImages[item.id] as string}
                              alt={item.name}
                              className="h-10 w-10 cursor-zoom-in rounded-md border border-slate-200 object-cover"
                              onClick={() =>
                                setLightbox({
                                  src: itemImages[item.id] as string,
                                  alt: item.name,
                                })
                              }
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-slate-200 text-[10px] text-slate-400">
                              No photo
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {item.name}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              <span className="font-mono">{item.itemCode}</span>
                              <span className="mx-1 text-slate-300">
                                {"\u2022"}
                              </span>
                              {item.category || "-"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {showCostInList ? (
                        <td className="px-4 py-2 text-right text-xs text-slate-700 whitespace-nowrap">
                          {formatCurrency(item.costPrice)}
                        </td>
                      ) : null}

                      <td className="px-4 py-2 text-right text-xs whitespace-nowrap">
                        <div className="flex flex-col items-end leading-tight">
                          <span className="font-semibold tabular-nums text-slate-900">
                            {formatCurrency(item.sellingPrice)}
                          </span>
                          {showCostInList ? (
                            <span className="text-[11px] text-emerald-600">
                              Profit: {formatCurrency(profitPerUnit)} / unit
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-2 text-xs text-slate-700">
                        <div className="flex flex-col">
                          <span>
                            Available:{" "}
                            <span className="font-semibold tabular-nums text-slate-900">
                              {available}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Reserved: <span className="tabular-nums">{reserved}</span>
                            <span className="mx-1 text-slate-300">
                              {"\u2022"}
                            </span>
                            On hand: <span className="tabular-nums">{onHand}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-2 text-center">{renderStockBadge(item)}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge
                          variant="neutral"
                          className="text-[11px] uppercase tracking-wide"
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {confirmDeleteId === item.id ? (
                          <div className="flex flex-nowrap items-center justify-end gap-2">
                            <span className="text-[11px] font-medium text-rose-700">
                              Permanently delete?
                            </span>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => void handleDelete(item.id)}
                              className="border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700"
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-nowrap justify-end gap-2">
                            {item.variants?.length ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => toggleExpanded(item.id)}
                              >
                                {expandedItems.has(item.id)
                                  ? "Hide variants"
                                  : `Variants (${item.variants.length})`}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditForm(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => void handleDelete(item.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {item.variants?.length && expandedItems.has(item.id)
                      ? item.variants.map((variant) => {
                          const variantReserved = variant.reservedStock ?? 0;
                          const variantAvailable = Math.max(
                            0,
                            variant.stock - variantReserved
                          );
                          const variantBadge = renderStockBadge({
                            ...item,
                            currentStock: variant.stock,
                            reservedStock: variantReserved,
                            variants: undefined,
                          });
                          const variantPrice =
                            variant.sellingPrice != null
                              ? variant.sellingPrice
                              : item.sellingPrice;
                          const variantCost =
                            variant.costPrice != null
                              ? variant.costPrice
                              : item.costPrice;

                          return (
                            <tr
                              key={`${item.id}-${variant.id}`}
                              className="border-t border-slate-200 bg-slate-50 text-xs"
                            >
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-3 pl-4">
                                  {variantImages[variant.id] ? (
                                    <img
                                      src={variantImages[variant.id] as string}
                                      alt={variant.label || "Variant"}
                                      className="h-9 w-9 cursor-zoom-in rounded-md border border-slate-200 object-cover"
                                      onClick={() =>
                                        setLightbox({
                                          src: variantImages[variant.id] as string,
                                          alt: variant.label || "Variant",
                                        })
                                      }
                                    />
                                  ) : (
                                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-slate-200 text-[10px] text-slate-400">
                                      No photo
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="neutral"
                                        className="text-[10px] uppercase tracking-wide"
                                      >
                                        Variant
                                      </Badge>
                                      <span className="truncate font-medium text-slate-900">
                                        {variant.label || "Variant"}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 truncate text-xs text-slate-500">
                                      <span className="font-mono">{item.itemCode}</span>
                                      <span className="mx-1 text-slate-300">
                                        {"\u2022"}
                                      </span>
                                      {item.category || "-"}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {showCostInList ? (
                                <td className="px-4 py-2 text-right text-xs text-slate-700 whitespace-nowrap">
                                  {formatCurrency(variantCost)}
                                  {variant.costPrice == null ? (
                                    <span className="ml-1 text-[10px] text-slate-500">
                                      (default)
                                    </span>
                                  ) : null}
                                </td>
                              ) : null}

                              <td className="px-4 py-2 text-right text-xs text-slate-700 whitespace-nowrap">
                                {formatCurrency(variantPrice)}
                                {variant.sellingPrice == null ? (
                                  <span className="ml-1 text-[10px] text-slate-500">
                                    (default)
                                  </span>
                                ) : null}
                              </td>

                              <td className="px-4 py-2 text-xs text-slate-700">
                                <div className="flex flex-col leading-tight">
                                  <span>
                                    Available:{" "}
                                    <span className="font-semibold tabular-nums text-slate-900">
                                      {variantAvailable}
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    Reserved:{" "}
                                    <span className="tabular-nums">{variantReserved}</span>
                                    <span className="mx-1 text-slate-300">
                                      {"\u2022"}
                                    </span>
                                    On hand:{" "}
                                    <span className="tabular-nums">{variant.stock}</span>
                                  </span>
                                </div>
                              </td>

                              <td className="px-4 py-2 text-center">{variantBadge}</td>
                              <td className="px-4 py-2 text-center">
                                <Badge
                                  variant="neutral"
                                  className="text-[11px] uppercase tracking-wide"
                                >
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-right text-[11px] text-slate-500">
                                Edit via parent
                              </td>
                            </tr>
                          );
                        })
                      : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over style form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isEditing ? "Edit item" : "Add new item"}
                </h2>
                <p className="text-xs text-slate-600">
                  Item codes should match your live selling codes (e.g., D01,
                  TOP-001).
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="flex flex-1 flex-col gap-3 overflow-y-auto"
            >
              {/* Essentials map directly to InventoryItem fields (itemCode, name, category, status). */}
              {/* Essentials */}
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Essentials
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Ilagay ang pangunahing detalye. Kopyahin ang live code / SKU para madaling hanapin sa live.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={generateCodeSuggestion}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
                  >
                    Auto-generate code
                  </button>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Item code / Live code*</label>
                    <input
                      type="text"
                      value={form.itemCode}
                      onChange={(e) =>
                        handleFormChange("itemCode", e.target.value.toUpperCase())
                      }
                      required
                      className={INPUT_CLASS}
                      placeholder="D01, TOP-001, BAG-03..."
                    />
                    <p className="text-[10px] text-slate-500">
                      Unique code na binabanggit mo sa live (SKU).
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        handleFormChange(
                          "status",
                          e.target.value as InventoryItem["status"]
                        )
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="ACTIVE">Active (for selling)</option>
                      <option value="INACTIVE">Inactive / Draft</option>
                      <option value="DISCONTINUED">Discontinued</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Item name*</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleFormChange("name", e.target.value)}
                      required
                      className={INPUT_CLASS}
                      placeholder="Oversized white tee, Beige shoulder bag"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Category (optional)</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => handleFormChange("category", e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Tops, Bags, Skincare..."
                    />
                  </div>
                </div>
              </div>

              {/* Variants (after essentials) */}
              <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Variants (size/color)
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Piliin kung single item o may variants. Stock totals follow variants kapag naka-multiple.
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-700 dark:text-slate-300">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="variantMode"
                          value="SINGLE"
                          checked={form.variantMode === "SINGLE"}
                          onChange={() => handleFormChange("variantMode", "SINGLE")}
                        />
                        Single item (no variants)
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="variantMode"
                          value="MULTI"
                          checked={form.variantMode === "MULTI"}
                          onChange={() => handleFormChange("variantMode", "MULTI")}
                        />
                        Multiple variants (size/color)
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    disabled={form.variantMode === "SINGLE"}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-600 dark:text-slate-100"
                  >
                    + Add variant
                  </button>
                </div>

                {form.variantMode === "MULTI" && (
                  <>
                    {/* Variants map to InventoryVariant rows; totalVariantStock feeds InventoryItem initial/current stock. */}
                    {form.variants.length === 0 && (
                      <p className="text-[11px] text-slate-600">
                        Add options like size or color, tap "+ Add variant", then set stock per option.
                      </p>
                    )}

                    {form.variants.length > 0 && (
                      <div className="space-y-2">
                        {form.variants.map((variant) => {
                          const reservedCount = variant.reservedStock ?? 0;
                          const availableCount = Math.max(
                            0,
                            (Number(variant.stock) || 0) - reservedCount
                          );
                          return (
                            <div
                              key={variant.id}
                              className="grid w-full grid-cols-12 gap-3 rounded-md bg-slate-50 p-3"
                            >
                              <input
                                type="text"
                                value={variant.label}
                                onChange={(e) =>
                                  updateVariantRow(variant.id, "label", e.target.value)
                                }
                                className={`${INPUT_CLASS} col-span-12 min-w-0`}
                                placeholder="e.g., Small / Beige"
                              />
                              <input
                                type="number"
                                min={0}
                                step="1"
                                value={variant.costPrice}
                                onChange={(e) =>
                                  updateVariantRow(
                                    variant.id,
                                    "costPrice",
                                    e.target.value
                                  )
                                }
                                className={`${INPUT_CLASS} col-span-6 md:col-span-2 min-w-0`}
                                placeholder="Variant cost (optional)"
                              />
                              <input
                                type="number"
                                min={0}
                                step="1"
                                value={variant.sellingPrice}
                                onChange={(e) =>
                                  updateVariantRow(
                                    variant.id,
                                    "sellingPrice",
                                    e.target.value
                                  )
                                }
                                className={`${INPUT_CLASS} col-span-6 md:col-span-2 min-w-0`}
                                placeholder="Variant price (optional)"
                              />
                              <div className="col-span-6 md:col-span-2 min-w-0 space-y-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={variant.stock}
                                  onChange={(e) =>
                                    updateVariantRow(variant.id, "stock", e.target.value)
                                  }
                                  className={INPUT_CLASS}
                                  placeholder="Stock"
                                />
                                <div className="text-[10px] text-slate-500">
                                  Reserved:{" "}
                                  <span className="tabular-nums">{reservedCount}</span>
                                  <span className="mx-1 text-slate-300">
                                    {"\u2022"}
                                  </span>
                                  Available:{" "}
                                  <span className="tabular-nums">{availableCount}</span>
                                </div>
                              </div>
                              <div className="col-span-12 md:col-span-2 flex flex-wrap items-center gap-3">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleVariantPhotoChange(
                                      variant.id,
                                      e.target.files?.[0] ?? null
                                    )
                                  }
                                  className="text-[10px] text-slate-700 file:mr-1 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2 file:py-1 file:text-[10px] file:font-medium file:text-slate-800 hover:file:bg-slate-100 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-100"
                                />
                              </div>
                              <div className="col-span-12 md:col-span-2 flex items-center justify-start md:justify-center">
                                {variant.photoPreview ? (
                                  <img
                                    src={variant.photoPreview}
                                    alt="Var preview"
                                    className="h-16 w-16 cursor-zoom-in rounded border border-slate-200 object-cover dark:border-slate-600"
                                    onClick={() =>
                                      setLightbox({
                                        src: variant.photoPreview as string,
                                        alt: `${variant.label || "Variant"} photo`,
                                      })
                                    }
                                  />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-slate-200 text-center text-[10px] text-slate-400 dark:border-slate-600">
                                    No photo
                                  </div>
                                )}
                              </div>
                              <div className="col-span-12 md:col-span-2 flex items-center gap-2">
                                {variant.photoPreview && (
                                  <button
                                    type="button"
                                    onClick={() => handleVariantPhotoChange(variant.id, null)}
                                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
                                  >
                                    Clear photo
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeVariantRow(variant.id)}
                                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="text-[11px] text-slate-600">
                          Total on-hand from variants:{" "}
                          <span className="font-semibold text-slate-900">
                            {totalVariantStock}
                          </span>
                          <span className="mx-1 text-slate-300">
                            {"\u2022"}
                          </span>
                          Reserved:{" "}
                          <span className="font-semibold text-slate-900">
                            {totalVariantReserved}
                          </span>
                          <span className="mx-1 text-slate-300">
                            {"\u2022"}
                          </span>
                          Available:{" "}
                          <span className="font-semibold text-slate-900">
                            {totalVariantAvailable}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Variant photos are preview-only; current schema does not store images.
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Leave variant price/cost blank to use the main price/cost.
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3">
                  <label className={LABEL_CLASS}>Low stock warning</label>
                  <div className="space-y-1">
                    <input
                      type="number"
                      min={0}
                      value={form.lowStockThreshold}
                      onChange={(e) =>
                        handleFormChange("lowStockThreshold", e.target.value)
                      }
                      className={`${INPUT_CLASS} max-w-md`}
                    />
                    <p className="text-[10px] text-slate-500">
                      Kapag total stock &lt;= threshold, lalabas as "Low stock" sa list.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pricing & Stock */}
              {form.variantMode === "SINGLE" && (
                <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        Pricing & stock (Single item)
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Bili kay supplier, benta sa live, at starting stock para sa single item. Kung mag-switch sa variants, totals will follow variant stock.
                      </p>
                    </div>
                  </div>
                  {/* Cost/Selling/Stock still map to InventoryItem costPrice, sellingPrice, initialStock/lowStockThreshold. */}
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Photo (optional)</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handlePhotoChange(e.target.files?.[0] ?? null)
                        }
                        className="text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-100 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-100"
                      />
                      {form.photoPreview && (
                        <div className="flex items-center gap-2">
                          <img
                            src={form.photoPreview}
                            alt="Preview"
                            className="h-16 w-16 cursor-zoom-in rounded-md border border-slate-200 object-cover dark:border-slate-700"
                            onClick={() =>
                              setLightbox({
                                src: form.photoPreview as string,
                                alt: form.name || "Item photo",
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handlePhotoChange(null)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  <p className="text-[10px] text-slate-500">
                    Optional preview only; current schema does not store photos. Use this as the main product photo for the single item.
                  </p>
                  <p className="text-[10px] text-slate-500">
                    If you switch to variants, add per-variant previews in the variants table.
                  </p>
                  {isEditing && restockHistory.length > 0 && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                      <div className="font-semibold text-slate-800">Restock history</div>
                      <ul className="mt-1 space-y-1">
                        {restockHistory
                          .slice()
                          .reverse()
                          .map((entry, idx) => (
                            <li key={idx} className="flex justify-between">
                              <span>
                                {entry.delta > 0 ? "+" : ""}
                                {entry.delta} stock
                              </span>
                              <span className="text-slate-500">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Cost price (bili kay supplier)</label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={form.costPrice}
                        onChange={(e) => handleFormChange("costPrice", e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Selling price (benta sa live)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.sellingPrice}
                        onChange={(e) =>
                          handleFormChange("sellingPrice", e.target.value)
                        }
                        className={INPUT_CLASS}
                      />
                      {sellingBelowCost && (
                        <p className="text-[10px] text-amber-600">
                          Mas mababa sa cost. Pwede pa rin, pero doble-check mo.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Current stock (editable)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.initialStock}
                      onChange={(e) =>
                        handleFormChange("initialStock", e.target.value)
                      }
                      className={INPUT_CLASS}
                    />
                    <p className="text-[10px] text-slate-500">
                      Reserved:{" "}
                      <span className="tabular-nums">{singleReserved}</span>
                      <span className="mx-1 text-slate-300">
                        {"\u2022"}
                      </span>
                      Available:{" "}
                      <span className="tabular-nums">{singleAvailable}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Update on-hand stock; this also logs a restock entry when increased.
                    </p>
                  </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}
              {validationHint && (
                <div className="rounded-md border border-amber-500/60 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {validationHint}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isEditing ? "Save changes" : "Add item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-[90vh] max-w-[90vw]">
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="max-h-[90vh] max-w-[90vw] rounded shadow-2xl"
            />
          </div>
        </div>
      )}
    </Page>
  );
}
