import { create } from "zustand";
import type { CalendarEvent, MealPlan } from "../types/api";
import { apiFetch } from "../api/client";

type CalendarState = {
  events: CalendarEvent[];
  meals: MealPlan[];
  selectedDate: string; // ISO date string YYYY-MM-DD
  view: "month" | "week" | "day";
  setView: (view: "month" | "week" | "day") => void;
  setSelectedDate: (date: string) => void;
  fetchEvents: (householdId: string, start: string, end: string) => Promise<void>;
  createEvent: (householdId: string, input: Partial<CalendarEvent> & { title: string; start_at: string; end_at: string }) => Promise<void>;
  updateEvent: (householdId: string, eventId: string, input: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (householdId: string, eventId: string) => Promise<void>;
  fetchMeals: (householdId: string, start: string, end: string) => Promise<void>;
  createMeal: (householdId: string, input: {
    date: string; meal_type: string; recipe_name: string;
    recipe_url?: string; servings?: number; prep_minutes?: number; notes?: string;
    ingredients?: { ingredient_name: string; quantity?: number; unit?: string; pantry_item_id?: string }[];
  }) => Promise<void>;
  updateMeal: (householdId: string, mealId: string, input: Partial<MealPlan>) => Promise<void>;
  deleteMeal: (householdId: string, mealId: string) => Promise<void>;
  ingestCalendarEvent: (eventType: string, payload: unknown) => void;
};

const today = new Date().toISOString().slice(0, 10);

export const useCalendarStore = create<CalendarState>((set) => ({
  events: [],
  meals: [],
  selectedDate: today,
  view: "month",
  setView: (view) => set({ view }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  fetchEvents: async (householdId, start, end) => {
    const response = await apiFetch<{ events: CalendarEvent[] }>(
      `/households/${householdId}/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    set({ events: response.events });
  },
  createEvent: async (householdId, input) => {
    const event = await apiFetch<CalendarEvent>(
      `/households/${householdId}/calendar/events`,
      { method: "POST", body: JSON.stringify(input) },
    );
    set((state) => ({ events: [...state.events, event] }));
  },
  updateEvent: async (householdId, eventId, input) => {
    const event = await apiFetch<CalendarEvent>(
      `/households/${householdId}/calendar/events/${eventId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    set((state) => ({ events: state.events.map((e) => (e.id === event.id ? event : e)) }));
  },
  deleteEvent: async (householdId, eventId) => {
    await apiFetch(`/households/${householdId}/calendar/events/${eventId}`, { method: "DELETE" });
    set((state) => ({ events: state.events.filter((e) => e.id !== eventId) }));
  },
  fetchMeals: async (householdId, start, end) => {
    const response = await apiFetch<{ meals: MealPlan[] }>(
      `/households/${householdId}/calendar/meals?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    set({ meals: response.meals });
  },
  createMeal: async (householdId, input) => {
    const meal = await apiFetch<MealPlan>(
      `/households/${householdId}/calendar/meals`,
      { method: "POST", body: JSON.stringify(input) },
    );
    set((state) => ({ meals: [...state.meals, meal] }));
  },
  updateMeal: async (householdId, mealId, input) => {
    const meal = await apiFetch<MealPlan>(
      `/households/${householdId}/calendar/meals/${mealId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    set((state) => ({ meals: state.meals.map((m) => (m.id === meal.id ? meal : m)) }));
  },
  deleteMeal: async (householdId, mealId) => {
    await apiFetch(`/households/${householdId}/calendar/meals/${mealId}`, { method: "DELETE" });
    set((state) => ({ meals: state.meals.filter((m) => m.id !== mealId) }));
  },
  ingestCalendarEvent: (eventType, payload) => {
    set((state) => {
      if (eventType === "calendar_event.deleted") {
        return { events: state.events.filter((e) => e.id !== (payload as { id: string }).id) };
      }
      if (eventType === "meal_plan.deleted") {
        return { meals: state.meals.filter((m) => m.id !== (payload as { id: string }).id) };
      }
      if (eventType.startsWith("calendar_event.")) {
        const event = payload as CalendarEvent;
        const exists = state.events.find((e) => e.id === event.id);
        if (!exists) return { events: [...state.events, event] };
        return { events: state.events.map((e) => (e.id === event.id ? event : e)) };
      }
      if (eventType.startsWith("meal_plan.")) {
        const meal = payload as MealPlan;
        const exists = state.meals.find((m) => m.id === meal.id);
        if (!exists) return { meals: [...state.meals, meal] };
        return { meals: state.meals.map((m) => (m.id === meal.id ? meal : m)) };
      }
      return state;
    });
  },
}));
