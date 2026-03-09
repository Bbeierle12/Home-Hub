import { create } from "zustand";
import { apiFetch } from "../api/client";
import type { DashboardResponse } from "../types/api";

type DashboardState = {
  data: DashboardResponse | null;
  isLoading: boolean;
  fetchDashboard: (householdId: string) => Promise<void>;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,
  fetchDashboard: async (householdId) => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<DashboardResponse>(`/households/${householdId}/dashboard`);
      set({ data });
    } finally {
      set({ isLoading: false });
    }
  },
}));
