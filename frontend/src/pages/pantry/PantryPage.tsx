import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Package, Plus, Tag, Trash2, X } from "lucide-react";
import { ScanButton } from "../../components/ScanButton";
import { parsePantryItem } from "../../utils/ocr-parsers";
import { useAuthStore } from "../../stores/auth";
import { usePantryStore } from "../../stores/pantry";
import type { PantryItem } from "../../types/api";

export function PantryPage() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const categories = usePantryStore((state) => state.categories);
  const items = usePantryStore((state) => state.items);
  const photos = usePantryStore((state) => state.photos);
  const isLoading = usePantryStore((state) => state.isLoading);
  const fetchCategories = usePantryStore((state) => state.fetchCategories);
  const fetchItems = usePantryStore((state) => state.fetchItems);
  const fetchPhotos = usePantryStore((state) => state.fetchPhotos);
  const createCategory = usePantryStore((state) => state.createCategory);
  const createItem = usePantryStore((state) => state.createItem);
  const updateItem = usePantryStore((state) => state.updateItem);
  const deleteItem = usePantryStore((state) => state.deleteItem);
  const deleteCategory = usePantryStore((state) => state.deleteCategory);
  const uploadPhoto = usePantryStore((state) => state.uploadPhoto);
  const deletePhoto = usePantryStore((state) => state.deletePhoto);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemExpires, setNewItemExpires] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (householdId) {
      void fetchCategories(householdId);
      void fetchItems(householdId);
    }
  }, [fetchCategories, fetchItems, householdId]);

  // Fetch photos when an item is expanded
  useEffect(() => {
    if (expandedItem && householdId && !photos[expandedItem]) {
      void fetchPhotos(householdId, expandedItem);
    }
  }, [expandedItem, householdId, fetchPhotos, photos]);

  const handleCreateCategory = async () => {
    if (!householdId || !newCategoryName.trim()) return;
    await createCategory(householdId, newCategoryName.trim());
    setNewCategoryName("");
  };

  const handleCreateItem = async () => {
    if (!householdId || !newItemName.trim()) return;
    await createItem(householdId, {
      name: newItemName.trim(),
      quantity: newItemQty ? Number(newItemQty) : undefined,
      unit: newItemUnit || undefined,
      category_id: newItemCategory || undefined,
      expires_at: newItemExpires ? new Date(newItemExpires).toISOString() : undefined,
    });
    setNewItemName("");
    setNewItemQty("");
    setNewItemUnit("");
    setNewItemCategory("");
    setNewItemExpires("");
  };

  const handleUpdateQty = async (item: PantryItem) => {
    if (!householdId || !editQty) return;
    await updateItem(householdId, item.id, { quantity: Number(editQty) });
    setEditingItem(null);
    setEditQty("");
  };

  const handleUploadPhoto = async (itemId: string, file: File) => {
    if (!householdId) return;
    setUploading(true);
    try {
      await uploadPhoto(householdId, itemId, file);
    } finally {
      setUploading(false);
    }
  };

  const filteredItems =
    filterCategory === "all"
      ? items
      : filterCategory === "uncategorized"
        ? items.filter((i) => !i.category_id)
        : items.filter((i) => i.category_id === filterCategory);

  const isExpiringSoon = (item: PantryItem) => {
    if (!item.expires_at) return false;
    const days = (new Date(item.expires_at).getTime() - Date.now()) / 86_400_000;
    return days <= 3 && days >= 0;
  };

  const isExpired = (item: PantryItem) => {
    if (!item.expires_at) return false;
    return new Date(item.expires_at).getTime() < Date.now();
  };

  const isLow = (item: PantryItem) => {
    if (item.low_threshold == null) return false;
    return item.quantity <= item.low_threshold;
  };

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const lowItems = items.filter(isLow);
  const expiringItems = items.filter((i) => isExpiringSoon(i) || isExpired(i));

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(lowItems.length > 0 || expiringItems.length > 0) && (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="size-5" />
            <h3 className="font-semibold">Attention needed</h3>
          </div>
          <div className="mt-3 space-y-1 text-sm text-amber-800">
            {lowItems.map((item) => (
              <p key={`low-${item.id}`}>
                <span className="font-medium">{item.name}</span> is running low ({item.quantity}{" "}
                {item.unit ?? "left"})
              </p>
            ))}
            {expiringItems.map((item) => (
              <p key={`exp-${item.id}`}>
                <span className="font-medium">{item.name}</span>{" "}
                {isExpired(item) ? "has expired" : "expires soon"} (
                {new Date(item.expires_at!).toLocaleDateString()})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Left panel: Add item + categories */}
        <div className="space-y-6">
          {/* Add Item */}
          <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
            <div className="flex items-center gap-2">
              <Package className="size-5 text-[color:var(--color-accent)]" />
              <h2 className="text-lg font-bold">Add Item</h2>
              <div className="ml-auto">
                <ScanButton
                  parser={parsePantryItem}
                  onResult={(fields) => {
                    if (fields.name) setNewItemName(fields.name);
                    if (fields.qty) setNewItemQty(fields.qty);
                    if (fields.unit) setNewItemUnit(fields.unit);
                    if (fields.expires) setNewItemExpires(fields.expires);
                  }}
                />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name"
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                onKeyDown={(e) => e.key === "Enter" && void handleCreateItem()}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  placeholder="Qty"
                  type="number"
                  min="0"
                  step="any"
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                />
                <input
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="Unit (oz, lbs…)"
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                />
              </div>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newItemExpires}
                onChange={(e) => setNewItemExpires(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => void handleCreateItem()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white"
              >
                <Plus className="size-4" />
                Add to pantry
              </button>
            </div>
          </section>

          {/* Categories */}
          <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
            <div className="flex items-center gap-2">
              <Tag className="size-5 text-[color:var(--color-accent)]" />
              <h2 className="text-lg font-bold">Categories</h2>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category"
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                onKeyDown={(e) => e.key === "Enter" && void handleCreateCategory()}
              />
              <button
                type="button"
                onClick={() => void handleCreateCategory()}
                className="rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 text-white"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-white/70"
                >
                  <span>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => householdId && void deleteCategory(householdId, c.id)}
                    className="text-[color:var(--color-muted)] hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
              {categories.length === 0 && (
                <li className="py-2 text-sm text-[color:var(--color-muted)]">No categories yet</li>
              )}
            </ul>
          </section>
        </div>

        {/* Right panel: Inventory list */}
        <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Inventory{" "}
              <span className="text-sm font-normal text-[color:var(--color-muted)]">
                ({filteredItems.length} items)
              </span>
            </h2>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="all">All categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="mt-8 text-center text-sm text-[color:var(--color-muted)]">Loading…</p>
          ) : filteredItems.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-2 text-[color:var(--color-muted)]">
              <Package className="size-10 opacity-40" />
              <p className="text-sm">Your pantry is empty</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {filteredItems.map((item) => {
                const itemPhotos = photos[item.id] ?? [];
                const isExpanded = expandedItem === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition ${
                      isExpired(item)
                        ? "border-red-200 bg-red-50"
                        : isExpiringSoon(item)
                          ? "border-amber-200 bg-amber-50"
                          : isLow(item)
                            ? "border-orange-200 bg-orange-50"
                            : "border-[color:var(--color-border)] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          <span className="rounded-full bg-[color:var(--color-accent-soft)] px-2 py-0.5 text-xs text-[color:var(--color-accent)]">
                            {categoryName(item.category_id)}
                          </span>
                          {itemPhotos.length > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-[color:var(--color-muted)]">
                              <Camera className="size-3" />
                              {itemPhotos.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-[color:var(--color-muted)]">
                          <span>{item.quantity} {item.unit ?? "×"}</span>
                          {item.expires_at && (
                            <span>Exp: {new Date(item.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </button>
                      <div className="ml-3 flex items-center gap-2">
                        {editingItem === item.id ? (
                          <form
                            className="flex items-center gap-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void handleUpdateQty(item);
                            }}
                          >
                            <input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="w-16 rounded-lg border px-2 py-1 text-xs"
                              autoFocus
                            />
                            <button type="submit" className="text-xs text-[color:var(--color-accent)]">
                              save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItem(null)}
                              className="text-xs text-[color:var(--color-muted)]"
                            >
                              cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem(item.id);
                              setEditQty(String(item.quantity));
                            }}
                            className="rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-white/70"
                          >
                            Edit qty
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => householdId && void deleteItem(householdId, item.id)}
                          className="text-[color:var(--color-muted)] hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded photo section */}
                    {isExpanded && (
                      <div className="border-t border-[color:var(--color-border)] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Photos</p>
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleUploadPhoto(item.id, file);
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={uploading}
                              onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-white/70 disabled:opacity-50"
                            >
                              <Camera className="size-3.5" />
                              {uploading ? "Uploading…" : "Add photo"}
                            </button>
                          </div>
                        </div>
                        {itemPhotos.length === 0 ? (
                          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                            No photos yet. Add one to keep track of labels, expiry dates, or quantities.
                          </p>
                        ) : (
                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {itemPhotos.map((photo) => (
                              <div key={photo.id} className="group relative">
                                <img
                                  src={`/uploads/${photo.file_name}`}
                                  alt={item.name}
                                  className="aspect-square w-full rounded-xl object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    householdId &&
                                    void deletePhoto(householdId, item.id, photo.id)
                                  }
                                  className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
