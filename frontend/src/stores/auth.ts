import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AuthResponse,
  AuthenticatedUser,
  LoginChallengeResponse,
} from "../types/api";
import { apiFetch } from "../api/client";

type PendingTwoFactor = {
  email: string;
  tempToken: string;
};

type AuthState = {
  accessToken: string | null;
  user: AuthenticatedUser | null;
  pendingTwoFactor: PendingTwoFactor | null;
  isHydrated: boolean;
  setHydrated: () => void;
  register: (input: { email: string; password: string; display_name: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  completeTwoFactor: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      pendingTwoFactor: null,
      isHydrated: false,
      setHydrated: () => set({ isHydrated: true }),
      register: async (input) => {
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify(input),
          auth: false,
        });
        await get().login({ email: input.email, password: input.password });
      },
      login: async (input) => {
        const response = await apiFetch<AuthResponse | LoginChallengeResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
          auth: false,
        });

        if ("status" in response && response.status === "2fa_required") {
          set({
            pendingTwoFactor: {
              email: input.email,
              tempToken: response.temp_token,
            },
          });
          return;
        }

        if (!("tokens" in response)) {
          throw new Error("Unexpected login response shape");
        }

        set({
          accessToken: response.tokens.access_token,
          user: response.user,
          pendingTwoFactor: null,
        });
      },
      completeTwoFactor: async (code) => {
        const pending = get().pendingTwoFactor;
        if (!pending) {
          throw new Error("No pending 2FA challenge");
        }

        const response = await apiFetch<AuthResponse>("/auth/2fa/challenge", {
          method: "POST",
          body: JSON.stringify({
            temp_token: pending.tempToken,
            code,
          }),
          auth: false,
        });

        set({
          accessToken: response.tokens.access_token,
          user: response.user,
          pendingTwoFactor: null,
        });
      },
      logout: async () => {
        try {
          await apiFetch("/auth/logout", { method: "POST" });
        } finally {
          set({ accessToken: null, user: null, pendingTwoFactor: null });
        }
      },
    }),
    {
      name: "household-dashboard-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
