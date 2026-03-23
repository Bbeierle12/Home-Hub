import { create } from "zustand";
import type { PantryCategory, PantryItem, PantryPhoto } from "../types/api";
import { apiFetch } from "../api/client";
import { useAuthStore } from "./auth";

type PantryState = {
  categories: PantryCategory[];
  items: PantryItem[];
  photos: Record<string, PantryPhoto[]>; // keyed by item_id
  isLoading: boolean;
  fetchCategories: (householdId: string) => Promise<void>;
  createCategory: (householdId: string, name: string, icon?: string) => Promise<void>;
  deleteCategory: (householdId: string, categoryId: string) => Promise<void>;
  fetchItems: (householdId: string) => Promise<void>;
  createItem: (
    householdId: string,
    input: { name: string; category_id?: string; quantity?: number; unit?: string; expires_at?: string; low_threshold?: number; notes?: string },
  ) => Promise<void>;
  updateItem: (
    householdId: string,
    itemId: string,
    input: Partial<Omit<PantryItem, "id" | "household_id" | "added_by" | "created_at" | "updated_at">>,
  ) => Promise<void>;
  deleteItem: (householdId: string, itemId: string) => Promise<void>;
  fetchPhotos: (householdId: string, itemId: string) => Promise<void>;
  uploadPhoto: (householdId: string, itemId: string, file: File) => Promise<void>;
  deletePhoto: (householdId: string, itemId: string, photoId: string) => Promise<void>;
  ingestPantryEvent: (eventType: string, payload: unknown) => void;
};

export const usePantryStore = create<PantryState>((set) => ({
  categories: [],
  items: [],
  photos: {},
  isLoading: false,
  fetchCategories: async (householdId) => {
    const response = await apiFetch<{ categories: PantryCategory[] }>(
      `/households/${householdId}/pantry/categories`,
    );
    set({ categories: response.categories });
  },
  createCategory: async (householdId, name, icon) => {
    const category = await apiFetch<PantryCategory>(
      `/households/${householdId}/pantry/categories`,
      { method: "POST", body: JSON.stringify({ name, icon }) },
    );
    set((state) => ({ categories: [...state.categories, category] }));
  },
  deleteCategory: async (householdId, categoryId) => {
    await apiFetch(`/households/${householdId}/pantry/categories/${categoryId}`, {
      method: "DELETE",
    });
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== categoryId),
    }));
  },
  fetchItems: async (householdId) => {
    set({ isLoading: true });
    const response = await apiFetch<{ items: PantryItem[] }>(
      `/households/${householdId}/pantry/items`,
    );
    set({ items: response.items, isLoading: false });
  },
  createItem: async (householdId, input) => {
    const item = await apiFetch<PantryItem>(
      `/households/${householdId}/pantry/items`,
      { method: "POST", body: JSON.stringify(input) },
    );
    set((state) => ({ items: [item, ...state.items] }));
  },
  updateItem: async (householdId, itemId, input) => {
    const item = await apiFetch<PantryItem>(
      `/households/${householdId}/pantry/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    set((state) => ({
      items: state.items.map((i) => (i.id === item.id ? item : i)),
    }));
  },
  deleteItem: async (householdId, itemId) => {
    await apiFetch(`/households/${householdId}/pantry/items/${itemId}`, {
      method: "DELETE",
    });
    set((state) => ({
      items: state.items.filter((i) => i.id !== itemId),
      photos: Object.fromEntries(
        Object.entries(state.photos).filter(([key]) => key !== itemId),
      ),
    }));
  },
  fetchPhotos: async (householdId, itemId) => {
    const response = await apiFetch<{ photos: PantryPhoto[] }>(
      `/households/${householdId}/pantry/items/${itemId}/photos`,
    );
    set((state) => ({
      photos: { ...state.photos, [itemId]: response.photos },
    }));
  },
  uploadPhoto: async (householdId, itemId, file) => {
    const token = useAuthStore.getState().accessToken;
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `/api/households/${householdId}/pantry/items/${itemId}/photos`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? "Upload failed");
    }

    const photo = (await response.json()) as PantryPhoto;
    set((state) => ({
      photos: {
        ...state.photos,
        [itemId]: [...(state.photos[itemId] ?? []), photo],
      },
    }));
  },
  deletePhoto: async (householdId, itemId, photoId) => {
    await apiFetch(
      `/households/${householdId}/pantry/items/${itemId}/photos/${photoId}`,
      { method: "DELETE" },
    );
    set((state) => ({
      photos: {
        ...state.photos,
        [itemId]: (state.photos[itemId] ?? []).filter((p) => p.id !== photoId),
      },
    }));
  },
  ingestPantryEvent: (eventType, payload) => {
    set((state) => {
      if (eventType === "pantry_item.deleted") {
        return {
          items: state.items.filter((i) => i.id !== (payload as { id: string }).id),
        };
      }
      const item = payload as PantryItem;
      const existing = state.items.find((i) => i.id === item.id);
      if (!existing) {
        return { items: [item, ...state.items] };
      }
      return {
        items: state.items.map((i) => (i.id === item.id ? item : i)),
      };
    });
  },
}));
