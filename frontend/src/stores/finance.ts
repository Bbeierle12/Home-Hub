import { create } from "zustand";
import { ApiError, apiFetch } from "../api/client";
import type {
  Bill,
  BudgetCategory,
  FinanceSettings,
  FinanceSummaryResponse,
  SubscriptionAuditResponse,
} from "../types/api";

type FinanceState = {
  settings: FinanceSettings | null;
  summary: FinanceSummaryResponse | null;
  bills: Bill[];
  categories: BudgetCategory[];
  subscriptionAudit: SubscriptionAuditResponse | null;
  isLoading: boolean;
  isLocked: boolean;
  error: string | null;
  fetchFinance: (householdId: string) => Promise<void>;
  createBill: (householdId: string, input: { name: string; amount: string; frequency: string; next_due_at?: string }) => Promise<void>;
  createCategory: (householdId: string, input: { name: string; monthly_limit: string }) => Promise<void>;
};

export const useFinanceStore = create<FinanceState>((set, get) => ({
  settings: null,
  summary: null,
  bills: [],
  categories: [],
  subscriptionAudit: null,
  isLoading: false,
  isLocked: false,
  error: null,
  fetchFinance: async (householdId) => {
    set({ isLoading: true, error: null });
    try {
      const [settings, summary, bills, categories, subscriptionAudit] = await Promise.all([
        apiFetch<{ settings: FinanceSettings }>(`/households/${householdId}/finance/settings`),
        apiFetch<FinanceSummaryResponse>(`/households/${householdId}/finance/summary`),
        apiFetch<{ bills: Bill[] }>(`/households/${householdId}/finance/bills`),
        apiFetch<{ categories: BudgetCategory[] }>(`/households/${householdId}/finance/budget/categories`),
        apiFetch<SubscriptionAuditResponse>(`/households/${householdId}/finance/subscriptions/audit`),
      ]);

      set({
        settings: settings.settings,
        summary,
        bills: bills.bills,
        categories: categories.categories,
        subscriptionAudit,
        isLocked: false,
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        set({ isLocked: true, error: null });
      } else {
        set({ error: caught instanceof Error ? caught.message : "Finance request failed" });
      }
    } finally {
      set({ isLoading: false });
    }
  },
  createBill: async (householdId, input) => {
    await apiFetch(`/households/${householdId}/finance/bills`, {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        amount: input.amount,
        frequency: input.frequency,
        next_due_at: input.next_due_at || null,
      }),
    });

    await get().fetchFinance(householdId);
  },
  createCategory: async (householdId, input) => {
    await apiFetch(`/households/${householdId}/finance/budget/categories`, {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        monthly_limit: input.monthly_limit,
      }),
    });

    await get().fetchFinance(householdId);
  },
}));
