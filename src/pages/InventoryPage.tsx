import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryItem, InventoryVariant } from "../core/types";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  getStockStatus,
} from "../services/inventory.service";
import { PANEL_CLASS, INPUT_CLASS } from "../theme/classes";
import { useAppSettings } from "../hooks/useAppSettings";
import { useNotification } from "../components/NotificationProvider";

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
}

type VariantRow = {
  id: string;
  label: string;
  stock: string;
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
};

const FILTER_PANEL_CLASS = `${PANEL_CLASS} flex flex-wrap items-center gap-3 p-3 text-sm`;
const TABLE_WRAPPER_CLASS = `${PANEL_CLASS} overflow-x-auto`;
const TABLE_HEAD_CLASS =
  "border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600";
const TABLE_CELL_TEXT = "text-slate-900";
const LABEL_CLASS = "text-xs font-medium text-slate-700";

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

  const refreshItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listInventoryItems();
      setItems(data);
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
    setIsFormOpen(true);
  }

  function openEditForm(item: InventoryItem) {
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
      variants:
        item.variants?.map((v) => ({
          id: v.id,
          label: v.label,
          stock: String(v.stock),
          costPrice: v.costPrice != null ? String(v.costPrice) : "",
          sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : "",
          photoFile: null,
          photoPreview: null,
        })) ?? [],
      variantMode:
        item.variants && item.variants.length > 0 ? "MULTI" : "SINGLE",
      photoFile: null,
      photoPreview: null,
    });
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
          stock: "0",
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

    if (form.variantMode === "MULTI" && totalVariantStock <= 0) {
      setError("Maglagay ng stock sa kahit isang variant.");
      return;
    }
    if (form.variantMode === "SINGLE" && totalVariantStock === 0 && initialStock <= 0) {
      setError("Initial stock must be greater than 0 (or use variants).");
      return;
    }

    if (sellingPrice < costPrice) {
      setValidationHint(
        "Heads up: mas mababa ang selling price kaysa cost. Pwede pa rin, pero doble-check mo."
      );
    }

    try {
      if (isEditing && form.id) {
        await updateInventoryItem(form.id, {
          itemCode: form.itemCode.trim(),
          name: form.name.trim(),
          category: form.category.trim() || undefined,
          costPrice,
          sellingPrice,
          lowStockThreshold,
          status: form.status,
          variants: variants.length ? variants : undefined,
          initialStock: variants.length ? totalVariantStock : initialStock,
          currentStock: variants.length ? totalVariantStock : undefined,
        });
      } else {
        await createInventoryItem({
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

      const lowStock =
        item.currentStock <=
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

  const numericCost = Number(form.costPrice) || 0;
  const numericPrice = Number(form.sellingPrice) || 0;
  const numericInitialStock = Number(form.initialStock) || 0;
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

  function renderStockBadge(item: InventoryItem) {
    const status = getStockStatus(item);
    let label: string;
    let className: string;

    switch (status) {
      case "OUT":
        label = "Out of stock";
        className =
          "inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-500";
        break;
      case "LOW":
        label = "Low stock";
        className =
          "inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600";
        break;
      default:
        label = "In stock";
        className =
          "inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600";
    }

    return <span className={className}>{label}</span>;
  }

  function formatCurrency(value: number) {
    return `₱${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Inventory
          </h1>
          <p className="text-sm text-slate-600">
            Dito mo ilalagay lahat ng items na binebenta mo sa live - with
            codes, presyo, at stock. Connected to claims, orders, at finance.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-600"
        >
          + Add item
        </button>
      </div>

      {/* Filters */}
      <div className={FILTER_PANEL_CLASS}>
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <span className="text-slate-600">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Item code / name / category"
            className={`${INPUT_CLASS} flex-1`}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as InventoryStatusFilter)
            }
            className={`${INPUT_CLASS} w-[180px]`}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
            />
            Low stock
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showFastMovingOnly}
              onChange={(e) => setShowFastMovingOnly(e.target.checked)}
            />
            Fast-moving (many reserved)
          </label>
        </div>
      </div>

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
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Cost</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Stock status</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-sm text-slate-600"
                >
                  Loading inventory...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-sm text-slate-600"
                >
                  Walang items pa. Click "Add item" para magsimula.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const profitPerUnit = item.sellingPrice - item.costPrice;
                const totalStock = item.currentStock + item.reservedStock;
                const available = Math.max(
                  0,
                  item.currentStock - item.reservedStock
                );

                return (
                  <React.Fragment key={item.id}>
                    <tr className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs font-mono text-slate-700">
                        {item.itemCode}
                      </td>
                      <td className={`px-3 py-2 text-sm ${TABLE_CELL_TEXT}`}>
                        {item.name}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {item.category || "-"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {formatCurrency(item.costPrice)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {formatCurrency(item.sellingPrice)}{" "}
                        <span className="text-[11px] text-emerald-600">
                          ({formatCurrency(profitPerUnit)} / unit)
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <div className="flex flex-col">
                          <span>
                            Available:{" "}
                            <span className="font-semibold">{available}</span>
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Reserved: {item.reservedStock} | Physical:{" "}
                            {totalStock}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{renderStockBadge(item)}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {item.status}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {confirmDeleteId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] font-medium text-rose-700">
                              Permanently delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditForm(item)}
                              className="mr-2 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="rounded-md border border-rose-500 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>

                    {item.variants?.length
                      ? item.variants.map((variant) => {
                          const variantBadge = renderStockBadge({
                            ...item,
                            currentStock: variant.stock,
                            reservedStock: 0,
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
                              className="border-t border-slate-200 bg-slate-50 text-[12px]"
                            >
                              <td className="px-3 py-1 text-[11px] text-slate-400">
                                -
                              </td>
                              <td className="px-3 py-1 text-[12px] text-slate-900 pr-8">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                                    Variant
                                  </span>
                                  <span>{variant.label || "Variant"}</span>
                                </div>
                              </td>
                              <td className="px-3 py-1 text-[11px] text-slate-500">
                                {item.category || "-"}
                              </td>
                              <td className="px-3 py-1 text-[11px] text-slate-700">
                                {formatCurrency(variantCost)}{" "}
                                {variant.costPrice == null ? (
                                  <span className="text-[10px] text-slate-500">
                                    (default)
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-1 text-[11px] text-slate-700">
                                {formatCurrency(variantPrice)}{" "}
                                {variant.sellingPrice == null ? (
                                  <span className="text-[10px] text-slate-500">
                                    (default)
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-1 text-[11px] text-slate-800">
                                <div className="flex flex-col leading-tight">
                                  <span>
                                    Stock:{" "}
                                    <span className="font-semibold">
                                      {variant.stock}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-1">{variantBadge}</td>
                              <td className="px-3 py-1 text-[11px] text-slate-500">
                                {item.status}
                              </td>
                              <td className="px-3 py-1 text-right text-[11px] text-slate-400">
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
          <div className="flex h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
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
                        {form.variants.map((variant) => (
                          <div
                            key={variant.id}
                            className="grid grid-cols-[1fr_120px_120px_120px_140px_130px] items-start gap-2"
                          >
                            <input
                              type="text"
                              value={variant.label}
                              onChange={(e) =>
                                updateVariantRow(variant.id, "label", e.target.value)
                              }
                              className={INPUT_CLASS}
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
                              className={INPUT_CLASS}
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
                              className={INPUT_CLASS}
                              placeholder="Variant price (optional)"
                            />
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
                            <div className="flex flex-col gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleVariantPhotoChange(
                                    variant.id,
                                    e.target.files?.[0] ?? null
                                  )
                                )
                                className="text-[10px] text-slate-700 file:mr-1 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2 file:py-1 file:text-[10px] file:font-medium file:text-slate-800 hover:file:bg-slate-100 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-100"
                              />
                              {variant.photoPreview && (
                                <button
                                  type="button"
                                  onClick={() => handleVariantPhotoChange(variant.id, null)}
                                  className="w-fit rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
                                >
                                  Clear photo
                                </button>
                              )}
                            </div>
                            {variant.photoPreview ? (
                              <img
                                src={variant.photoPreview}
                                alt="Var preview"
                                className="h-12 w-12 rounded border border-slate-200 object-cover dark:border-slate-600"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded border border-dashed border-slate-200 text-center text-[10px] text-slate-400 dark:border-slate-600">
                                No photo
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeVariantRow(variant.id)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <div className="text-[11px] text-slate-600">
                          Total stock from variants:{" "}
                          <span className="font-semibold text-slate-900">
                            {totalVariantStock}
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
                <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-3">
                  <label className={LABEL_CLASS}>Low stock warning</label>
                  <div className="space-y-1">
                    <input
                      type="number"
                      min={0}
                      value={form.lowStockThreshold}
                      onChange={(e) =>
                        handleFormChange("lowStockThreshold", e.target.value)
                      }
                      className={INPUT_CLASS}
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
                            className="h-16 w-16 rounded-md border border-slate-200 object-cover dark:border-slate-700"
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
                      <label className={LABEL_CLASS}>Initial stock (on hand)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.initialStock}
                        onChange={(e) =>
                          handleFormChange("initialStock", e.target.value)
                        }
                        disabled={isEditing}
                        className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60`}
                      />
                      <p className="text-[10px] text-slate-500">
                        Ilagay ang kasalukuyang bilang. Nag-a-adjust ito kapag may claims/orders.
                      </p>
                      {isEditing && (
                        <p className="text-[10px] text-slate-500">
                          Initial stock cannot be changed after creation.
                        </p>
                      )}
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
    </div>
  );
}
