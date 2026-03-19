import { create } from "zustand";
import { env } from "../config/env";

type CapabilitiesState = {
  dbBackend: "postgres" | "rustdb" | null;
  financeEnabled: boolean;
  fetchCapabilities: () => Promise<void>;
};

export const useCapabilitiesStore = create<CapabilitiesState>((set) => ({
  dbBackend: null,
  financeEnabled: true,
  fetchCapabilities: async () => {
    try {
      const response = await fetch(`${env.apiBaseUrl}/health`);
      if (response.ok) {
        const data = (await response.json()) as { db_backend?: string };
        const backend = data.db_backend === "rustdb" ? "rustdb" : "postgres";
        set({
          dbBackend: backend,
          financeEnabled: backend === "postgres",
        });
      }
    } catch {
      // Health check failed — assume postgres (default).
    }
  },
}));
