import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../stores/auth";

export function AuthPage() {
  const register = useAuthStore((state) => state.register);
  const login = useAuthStore((state) => state.login);
  const pendingTwoFactor = useAuthStore((state) => state.pendingTwoFactor);
  const completeTwoFactor = useAuthStore((state) => state.completeTwoFactor);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    password: "",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (pendingTwoFactor) {
        await completeTwoFactor(code);
      } else if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[36px] border border-[color:var(--color-border)] bg-[linear-gradient(135deg,rgba(34,93,97,0.95),rgba(31,42,34,0.96))] p-8 text-white shadow-[0_24px_80px_rgba(31,42,34,0.15)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">MVP Focus</p>
          <h1 className="mt-4 max-w-xl text-5xl font-bold leading-[1.02]">
            Real-time family operations without the usual app sprawl.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/75">
            Tasks, shopping, household setup, dashboard aggregation, and 2FA-aware auth are wired for the MVP path.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {["JWT + refresh", "Household roles", "Task and shopping sync"].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/6 p-4">
                <p className="text-sm font-medium text-white/85">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[36px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 shadow-[0_24px_80px_rgba(31,42,34,0.08)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[color:var(--color-accent-soft)] p-3 text-[color:var(--color-accent)]">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[color:var(--color-muted)]">Secure entry</p>
              <h2 className="text-2xl font-bold">
                {pendingTwoFactor ? "Two-factor challenge" : mode === "login" ? "Sign in" : "Create account"}
              </h2>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {!pendingTwoFactor && mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Display name</span>
                <input
                  value={form.display_name}
                  onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
            ) : null}

            {!pendingTwoFactor ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Email</span>
                  <input
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Authenticator code</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 tracking-[0.36em] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
            )}

            {error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void submit()}
              className="w-full rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Working..." : pendingTwoFactor ? "Verify code" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </div>

          {!pendingTwoFactor ? (
            <button
              type="button"
              onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
              className="mt-6 text-sm font-medium text-[color:var(--color-secondary)]"
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
