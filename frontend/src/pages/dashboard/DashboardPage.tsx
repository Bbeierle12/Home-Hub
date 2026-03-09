import { useEffect } from "react";
import { CalendarDays, CheckCircle2, ShoppingCart } from "lucide-react";
import { Panel } from "../../components/Panel";
import { useAuthStore } from "../../stores/auth";
import { useDashboardStore } from "../../stores/dashboard";

export function DashboardPage() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const data = useDashboardStore((state) => state.data);
  const isLoading = useDashboardStore((state) => state.isLoading);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);

  useEffect(() => {
    if (householdId) {
      void fetchDashboard(householdId);
    }
  }, [fetchDashboard, householdId]);

  return (
    <div className="space-y-6">
      <section className="rounded-[36px] border border-[color:var(--color-border)] bg-[linear-gradient(135deg,rgba(199,108,58,0.16),rgba(255,255,255,0.9))] p-8 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--color-secondary)]">
          Unified digest
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Show what needs action, hide what can wait.
        </h1>
        <p className="mt-4 max-w-2xl text-[color:var(--color-muted)]">
          The dashboard endpoint is intentionally thin: today’s date, tasks that matter now, and shopping lists with open item counts.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Today's Snapshot" eyebrow="System">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4">
            <CalendarDays className="size-5 text-[color:var(--color-secondary)]" />
            <div>
              <p className="text-sm text-[color:var(--color-muted)]">Today</p>
              <p className="font-semibold">{data?.today ?? (isLoading ? "Loading..." : "No data")}</p>
            </div>
          </div>
        </Panel>

        <Panel title="My Tasks" eyebrow="Action">
          <div className="space-y-3">
            {data?.my_tasks.length ? (
              data.my_tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4">
                  <p className="font-semibold">{task.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    Due {task.due_at ? new Date(task.due_at).toLocaleString() : "whenever needed"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-[color:var(--color-muted)]">
                No actionable tasks right now.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Shopping Lists" eyebrow="Live">
          <div className="space-y-3">
            {data?.shopping_lists.length ? (
              data.shopping_lists.map((list) => (
                <div key={list.id} className="flex items-center justify-between rounded-2xl border border-[color:var(--color-border)] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="size-4 text-[color:var(--color-accent)]" />
                    <p className="font-semibold">{list.name}</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--color-accent-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--color-accent)]">
                    {list.open_items} open
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-[color:var(--color-muted)]">
                Shopping is all clear.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="MVP Status" eyebrow="Scope">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Auth + 2FA challenge path",
            "Household creation and invite join",
            "Tasks and shopping real-time sync",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl bg-white p-4">
              <CheckCircle2 className="size-4 text-[color:var(--color-success)]" />
              <p className="text-sm font-medium">{item}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
