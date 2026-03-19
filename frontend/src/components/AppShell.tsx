import { useEffect } from "react";
import { Home, Landmark, ListChecks, LogOut, ShoppingBasket } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { useCapabilitiesStore } from "../stores/capabilities";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/shopping", label: "Shopping", icon: ShoppingBasket },
  { to: "/finance", label: "Finance", icon: Landmark },
];

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const financeEnabled = useCapabilitiesStore((state) => state.financeEnabled);
  const fetchCapabilities = useCapabilitiesStore((state) => state.fetchCapabilities);

  useEffect(() => {
    void fetchCapabilities();
  }, [fetchCapabilities]);

  const visibleNavigation = navigation.filter((item) => {
    if (item.to === "/finance") {
      if (!financeEnabled) return false;
      return user?.role === "admin" || user?.role === "member";
    }
    return true;
  });

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[32px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.7))] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-secondary)]">
            Household Dashboard
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">
            One surface for the family’s moving parts.
          </h1>
          <div className="mt-6 rounded-3xl bg-[color:var(--color-accent-soft)]/70 p-4">
            <p className="text-sm font-medium text-[color:var(--color-muted)]">Signed in as</p>
            <p className="mt-1 text-lg font-bold">{user?.display_name}</p>
            <p className="text-sm capitalize text-[color:var(--color-muted)]">{user?.role ?? "no role yet"}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {visibleNavigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "text-[color:var(--color-muted)] hover:bg-white/70"
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void logout()}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:bg-white/70"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </aside>

        <main className="space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
