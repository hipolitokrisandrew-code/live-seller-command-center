// src/pages/InventoryPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { InventoryItem } from "../core/types";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  getStockStatus,
} from "../services/inventory.service";

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
}

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
};

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<InventoryStatusFilter>("ALL");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load items on first render
  useEffect(() => {
    void refreshItems();
  }, []);

  async function refreshItems() {
    try {
      setLoading(true);
      const data = await listInventoryItems();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory items.");
    } finally {
      setLoading(false);
    }
  }

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
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.itemCode.trim() || !form.name.trim()) {
      setError("Item code at name ay required.");
      return;
    }

    const costPrice = Number(form.costPrice) || 0;
    const sellingPrice = Number(form.sellingPrice) || 0;
    const initialStock = Number(form.initialStock) || 0;
    const lowStockThreshold = Number(form.lowStockThreshold) || 0;

    try {
      if (isEditing && form.id) {
        // Editing: we do NOT change initialStock / currentStock here
        await updateInventoryItem(form.id, {
          itemCode: form.itemCode.trim(),
          name: form.name.trim(),
          category: form.category.trim() || undefined,
          costPrice,
          sellingPrice,
          lowStockThreshold,
          status: form.status,
        });
      } else {
        // Creating new item
        await createInventoryItem({
          itemCode: form.itemCode.trim(),
          name: form.name.trim(),
          category: form.category.trim() || undefined,
          description: undefined,
          variantGroup: undefined,
          variants: [],
          costPrice,
          sellingPrice,
          initialStock,
          lowStockThreshold,
          status: form.status,
        });
      }

      await refreshItems();
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save item. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this item? This will not affect past orders but removes it from inventory."
    );
    if (!confirmed) return;

    try {
      await deleteInventoryItem(id);
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError("Failed to delete item.");
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

      return matchesStatus && matchesSearch;
    });
  }, [items, search, statusFilter]);

  function renderStockBadge(item: InventoryItem) {
    const status = getStockStatus(item);
    let label: string;
    let className: string;

    switch (status) {
      case "OUT":
        label = "Out of stock";
        className =
          "inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400";
        break;
      case "LOW":
        label = "Low stock";
        className =
          "inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400";
        break;
      default:
        label = "In stock";
        className =
          "inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400";
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
          <h1 className="text-2xl font-semibold text-slate-50">Inventory</h1>
          <p className="text-sm text-slate-400">
            Dito mo ilalagay lahat ng items na binebenta mo sa live — with
            codes, presyo, at stock. Connected to claims, orders, at finance.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-emerald-600"
        >
          + Add item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <span className="text-slate-400">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Item code / name / category"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as InventoryStatusFilter)
            }
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400">
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
                  className="px-3 py-6 text-center text-sm text-slate-400"
                >
                  Loading inventory…
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-sm text-slate-500"
                >
                  Walang items pa. Click &quot;Add item&quot; para magsimula.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const profitPerUnit = item.sellingPrice - item.costPrice;
                const totalStock = item.currentStock + item.reservedStock;

                return (
                  <tr
                    key={item.id}
                    className="border-t border-slate-800 hover:bg-slate-900/60"
                  >
                    <td className="px-3 py-2 text-xs font-mono text-slate-200">
                      {item.itemCode}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-100">
                      {item.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {item.category || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {formatCurrency(item.costPrice)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {formatCurrency(item.sellingPrice)}{" "}
                      <span className="text-[11px] text-emerald-400">
                        ({formatCurrency(profitPerUnit)} / unit)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      <div className="flex flex-col">
                        <span>
                          On hand:{" "}
                          <span className="font-semibold">
                            {item.currentStock}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Reserved: {item.reservedStock} · Total: {totalStock}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{renderStockBadge(item)}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {item.status}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="mr-2 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-rose-600 px-2 py-1 text-xs text-rose-200 hover:bg-rose-900/70"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over style form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  {isEditing ? "Edit item" : "Add new item"}
                </h2>
                <p className="text-xs text-slate-400">
                  Item codes should match your live selling codes (e.g., D01,
                  TOP-001).
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="flex flex-1 flex-col gap-3 overflow-y-auto scroll-thin"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Item code
                </label>
                <input
                  type="text"
                  value={form.itemCode}
                  onChange={(e) =>
                    handleFormChange("itemCode", e.target.value.toUpperCase())
                  }
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="D01, TOP-001, BAG-03..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Oversized white tee"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => handleFormChange("category", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Tops, Dresses, Skincare..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Cost price (bili kay supplier)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) =>
                      handleFormChange("costPrice", e.target.value)
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Selling price (benta sa live)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={(e) =>
                      handleFormChange("sellingPrice", e.target.value)
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Initial stock (on hand)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.initialStock}
                    onChange={(e) =>
                      handleFormChange("initialStock", e.target.value)
                    }
                    disabled={isEditing}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 disabled:cursor-not-allowed disabled:bg-slate-900/60 focus:border-emerald-500 focus:outline-none"
                  />
                  {isEditing && (
                    <p className="text-[10px] text-slate-500">
                      Initial stock cannot be changed after creation. Stock will
                      be adjusted automatically by claims and orders.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Low stock warning threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.lowStockThreshold}
                    onChange={(e) =>
                      handleFormChange("lowStockThreshold", e.target.value)
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    Kapag current stock &lt;= threshold, lalabas as &quot;Low
                    stock&quot;.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    handleFormChange(
                      "status",
                      e.target.value as InventoryItem["status"]
                    )
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (currently selling)</option>
                  <option value="INACTIVE">INACTIVE (pause selling)</option>
                  <option value="DISCONTINUED">
                    DISCONTINUED (no longer selling)
                  </option>
                </select>
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-600"
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
