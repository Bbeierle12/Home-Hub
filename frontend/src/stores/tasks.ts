import { create } from "zustand";
import { apiFetch } from "../api/client";
import type { Task } from "../types/api";

type TasksState = {
  tasks: Task[];
  isLoading: boolean;
  fetchTasks: (householdId: string) => Promise<void>;
  createTask: (householdId: string, input: Partial<Task> & { title: string }) => Promise<void>;
  completeTask: (householdId: string, taskId: string) => Promise<void>;
  ingestTaskEvent: (eventType: string, payload: unknown) => void;
};

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  fetchTasks: async (householdId) => {
    set({ isLoading: true });
    try {
      const response = await apiFetch<{ tasks: Task[] }>(`/households/${householdId}/tasks`);
      set({ tasks: response.tasks });
    } finally {
      set({ isLoading: false });
    }
  },
  createTask: async (householdId, input) => {
    const response = await apiFetch<{ task: Task }>(`/households/${householdId}/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    });

    set((state) => ({ tasks: [response.task, ...state.tasks] }));
  },
  completeTask: async (householdId, taskId) => {
    const response = await apiFetch<{ task: Task }>(
      `/households/${householdId}/tasks/${taskId}/complete`,
      { method: "POST" },
    );

    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? response.task : task)),
    }));
  },
  ingestTaskEvent: (eventType, payload) => {
    const task = payload as Task;

    set((state) => {
      if (eventType === "task.deleted") {
        return {
          tasks: state.tasks.filter((item) => item.id !== (payload as { id: string }).id),
        };
      }

      const existing = state.tasks.find((item) => item.id === task.id);
      if (!existing) {
        return { tasks: [task, ...state.tasks] };
      }

      return {
        tasks: state.tasks.map((item) => (item.id === task.id ? task : item)),
      };
    });
  },
}));
