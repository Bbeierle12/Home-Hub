import { create } from "zustand";
import { apiFetch } from "../api/client";
import type { ShoppingItem, ShoppingList } from "../types/api";

type ShoppingState = {
  lists: ShoppingList[];
  activeList: ShoppingList | null;
  items: ShoppingItem[];
  fetchLists: (householdId: string) => Promise<void>;
  fetchListDetail: (householdId: string, listId: string) => Promise<void>;
  createList: (householdId: string, name: string, store?: string) => Promise<void>;
  addItem: (householdId: string, listId: string, name: string) => Promise<void>;
  toggleItem: (householdId: string, listId: string, item: ShoppingItem) => Promise<void>;
  ingestShoppingEvent: (eventType: string, payload: unknown) => void;
};

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  lists: [],
  activeList: null,
  items: [],
  fetchLists: async (householdId) => {
    const response = await apiFetch<{ lists: ShoppingList[] }>(
      `/households/${householdId}/shopping-lists`,
    );
    set({ lists: response.lists });
  },
  fetchListDetail: async (householdId, listId) => {
    const response = await apiFetch<{ list: ShoppingList; items: ShoppingItem[] }>(
      `/households/${householdId}/shopping-lists/${listId}`,
    );
    set({ activeList: response.list, items: response.items });
  },
  createList: async (householdId, name, store) => {
    const response = await apiFetch<{ list: ShoppingList }>(
      `/households/${householdId}/shopping-lists`,
      {
        method: "POST",
        body: JSON.stringify({ name, store }),
      },
    );

    set((state) => ({ lists: [response.list, ...state.lists] }));
  },
  addItem: async (householdId, listId, name) => {
    const response = await apiFetch<{ item: ShoppingItem }>(
      `/households/${householdId}/shopping-lists/${listId}/items`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );

    set((state) => ({ items: [...state.items, response.item] }));
  },
  toggleItem: async (householdId, listId, item) => {
    const response = await apiFetch<{ item: ShoppingItem }>(
      `/households/${householdId}/shopping-lists/${listId}/items/${item.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ checked: !item.checked }),
      },
    );

    set((state) => ({
      items: state.items.map((entry) => (entry.id === item.id ? response.item : entry)),
    }));
  },
  ingestShoppingEvent: (eventType, payload) => {
    set((state) => {
      if (eventType === "shopping_item.deleted") {
        return {
          items: state.items.filter((item) => item.id !== (payload as { id: string }).id),
        };
      }

      const item = payload as ShoppingItem;
      const existing = state.items.find((entry) => entry.id === item.id);
      if (!existing) {
        return { items: [...state.items, item] };
      }

      return {
        items: state.items.map((entry) => (entry.id === item.id ? item : entry)),
      };
    });
  },
}));
