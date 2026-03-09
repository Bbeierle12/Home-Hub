import { useState } from "react";
import { House } from "lucide-react";
import { apiFetch } from "../../api/client";
import { useAuthStore } from "../../stores/auth";
import type { HouseholdRole } from "../../types/api";

type HouseholdResponse = {
  household: {
    id: string;
    name: string;
  };
};

export function HouseholdPage() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const patchUser = (householdId: string, role: HouseholdRole = "admin") => {
    useAuthStore.setState((state) => ({
      accessToken: state.accessToken,
      user: state.user
        ? {
            ...state.user,
            household_id: householdId,
            role,
          }
        : state.user,
    }));
  };

  const createHousehold = async () => {
    setError(null);
    try {
      const response = await apiFetch<HouseholdResponse>("/households", {
        method: "POST",
        body: JSON.stringify({ name: createName }),
      });

      patchUser(response.household.id, "admin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create household");
    }
  };

  const joinHousehold = async () => {
    setError(null);
    try {
      const response = await apiFetch<HouseholdResponse>("/households/join", {
        method: "POST",
        body: JSON.stringify({ token: inviteCode }),
      });

      patchUser(response.household.id, user?.role ?? "member");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to join household");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
        <section className="rounded-[36px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[color:var(--color-accent-soft)] p-3 text-[color:var(--color-accent)]">
              <House className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[color:var(--color-muted)]">Step 2</p>
              <h2 className="text-2xl font-bold">Create your household</h2>
            </div>
          </div>
          <p className="mt-4 text-sm text-[color:var(--color-muted)]">
            Start a new home space, become the first admin, and unlock tasks, shopping, and the dashboard digest.
          </p>
          <label className="mt-8 block">
            <span className="mb-2 block text-sm font-medium">Household name</span>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void createHousehold()}
            className="mt-4 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white"
          >
            Create household
          </button>
        </section>

        <section className="rounded-[36px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <p className="text-sm font-medium text-[color:var(--color-muted)]">Invite flow</p>
          <h2 className="mt-2 text-2xl font-bold">Join with an invite token</h2>
          <p className="mt-4 text-sm text-[color:var(--color-muted)]">
            Use the backend-issued invite token to join an existing household without asking the frontend to manage role assignment.
          </p>
          <label className="mt-8 block">
            <span className="mb-2 block text-sm font-medium">Invite token</span>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void joinHousehold()}
            className="mt-4 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 font-semibold text-[color:var(--color-ink)]"
          >
            Join household
          </button>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          <p className="mt-8 text-xs text-[color:var(--color-muted)]">
            Access token present: {accessToken ? "yes" : "no"}
          </p>
        </section>
      </div>
    </div>
  );
}
