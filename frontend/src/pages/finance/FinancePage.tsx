import { useEffect, useState } from "react";
import { AlertTriangle, BadgeDollarSign, Landmark, ReceiptText } from "lucide-react";
import { Panel } from "../../components/Panel";
import { useAuthStore } from "../../stores/auth";
import { useFinanceStore } from "../../stores/finance";
import { formatCurrency } from "../../utils/currency";

const DEFAULT_BILL_FORM = {
  name: "",
  amount: "",
  frequency: "monthly",
  next_due_at: "",
};

const DEFAULT_CATEGORY_FORM = {
  name: "",
  monthly_limit: "",
};

export function FinancePage() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const userRole = useAuthStore((state) => state.user?.role);
  const {
    settings,
    summary,
    bills,
    categories,
    subscriptionAudit,
    isLoading,
    isLocked,
    error,
    fetchFinance,
    createBill,
    createCategory,
  } = useFinanceStore();

  const [billForm, setBillForm] = useState(DEFAULT_BILL_FORM);
  const [categoryForm, setCategoryForm] = useState(DEFAULT_CATEGORY_FORM);

  useEffect(() => {
    if (householdId) {
      void fetchFinance(householdId);
    }
  }, [fetchFinance, householdId]);

  if (isLocked) {
    return (
      <Panel title="Finance Locked" eyebrow="Access">
        <div className="rounded-2xl bg-white p-5">
          <p className="font-semibold">This household has not unlocked finance access for your role.</p>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            Admins always have access. Members need the household finance setting switched to read-only or full.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[36px] border border-[color:var(--color-border)] bg-[linear-gradient(135deg,rgba(34,93,97,0.14),rgba(255,255,255,0.92))] p-8 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--color-secondary)]">
          Finance
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">Bills, budgets, subscriptions, and actual spend.</h1>
        <p className="mt-4 max-w-2xl text-[color:var(--color-muted)]">
          This first pass implements finance settings, bills and payment logs, budget categories, expenses, subscriptions, and a summary layer.
        </p>
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">
          Role: <span className="font-semibold capitalize text-[color:var(--color-ink)]">{userRole ?? "unknown"}</span>
          {settings ? (
            <>
              {" "}
              · Member access policy: <span className="font-semibold">{settings.member_access}</span>
            </>
          ) : null}
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-4">
        <Panel title="Budget" eyebrow="Month">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <Landmark className="size-5 text-[color:var(--color-secondary)]" />
            <div>
              <p className="text-sm text-[color:var(--color-muted)]">Budgeted</p>
              <p className="font-semibold">{formatCurrency(summary?.total_budget)}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Spent" eyebrow="Month">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <ReceiptText className="size-5 text-[color:var(--color-accent)]" />
            <div>
              <p className="text-sm text-[color:var(--color-muted)]">Actual</p>
              <p className="font-semibold">{formatCurrency(summary?.total_spent)}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Subscriptions" eyebrow="Monthly">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <BadgeDollarSign className="size-5 text-[color:var(--color-success)]" />
            <div>
              <p className="text-sm text-[color:var(--color-muted)]">Equivalent total</p>
              <p className="font-semibold">{formatCurrency(summary?.total_subscriptions_monthly)}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Bills Due" eyebrow="7 Days">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <AlertTriangle className="size-5 text-[color:var(--color-accent)]" />
            <div>
              <p className="text-sm text-[color:var(--color-muted)]">Upcoming</p>
              <p className="font-semibold">{summary?.bills_due_soon.length ?? 0} bills</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Bills" eyebrow="Track">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={billForm.name}
              onChange={(event) => setBillForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Mortgage"
              className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
            <input
              value={billForm.amount}
              onChange={(event) => setBillForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="1250.00"
              className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
            <select
              value={billForm.frequency}
              onChange={(event) => setBillForm((current) => ({ ...current, frequency: event.target.value }))}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none"
            >
              <option value="monthly">monthly</option>
              <option value="weekly">weekly</option>
              <option value="biweekly">biweekly</option>
              <option value="quarterly">quarterly</option>
              <option value="semi-annual">semi-annual</option>
              <option value="annual">annual</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (householdId && billForm.name.trim() && billForm.amount.trim()) {
                  void createBill(householdId, billForm);
                  setBillForm(DEFAULT_BILL_FORM);
                }
              }}
              className="rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white"
            >
              Add bill
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {bills.map((bill) => (
              <div key={bill.id} className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{bill.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      {bill.is_variable ? "Variable bill" : formatCurrency(bill.amount, bill.currency)} · {bill.frequency}
                    </p>
                  </div>
                  <div className="text-right text-sm text-[color:var(--color-muted)]">
                    <p>Due</p>
                    <p className="font-semibold text-[color:var(--color-ink)]">
                      {bill.next_due_at ? new Date(bill.next_due_at).toLocaleDateString() : "unscheduled"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {!bills.length && !isLoading ? (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-[color:var(--color-muted)]">
                No bills configured yet.
              </div>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Budget Categories" eyebrow="Plan">
            <div className="flex gap-3">
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Groceries"
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              />
              <input
                value={categoryForm.monthly_limit}
                onChange={(event) => setCategoryForm((current) => ({ ...current, monthly_limit: event.target.value }))}
                placeholder="600"
                className="w-32 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (householdId && categoryForm.name.trim() && categoryForm.monthly_limit.trim()) {
                    void createCategory(householdId, categoryForm);
                    setCategoryForm(DEFAULT_CATEGORY_FORM);
                  }
                }}
                className="rounded-2xl border border-[color:var(--color-border)] px-4 py-3 font-semibold"
              >
                Add
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {summary?.budget_progress.map((row) => {
                const spent = Number(row.spent ?? 0);
                const limit = Number(row.monthly_limit);
                const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

                return (
                  <div key={row.id} className="rounded-2xl bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-sm text-[color:var(--color-muted)]">
                        {formatCurrency(row.spent)} / {formatCurrency(row.monthly_limit)}
                      </p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[color:var(--color-accent-soft)]">
                      <div
                        className={`h-2 rounded-full ${spent > limit ? "bg-red-500" : "bg-[color:var(--color-secondary)]"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Subscription Audit" eyebrow="Review">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-[color:var(--color-muted)]">Active subscriptions</p>
                <p className="mt-1 text-2xl font-bold">{subscriptionAudit?.summary.active_count ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-[color:var(--color-muted)]">Annual projection</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(subscriptionAudit?.summary.annual_projection)}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-sm font-medium text-[color:var(--color-muted)]">Duplicate categories</p>
              <p className="mt-2 text-sm">
                {subscriptionAudit?.duplicates_by_category.length
                  ? subscriptionAudit.duplicates_by_category.join(", ")
                  : "No duplicate subscription categories flagged yet."}
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Backend Slice Status" eyebrow="Implemented">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            `${categories.length} budget categories`,
            `${bills.length} bills tracked`,
            `${summary?.bills_due_soon.length ?? 0} due soon`,
            `${subscriptionAudit?.summary.active_count ?? 0} subscriptions audited`,
          ].map((item) => (
            <div key={item} className="rounded-2xl bg-white p-4 text-sm font-medium">
              {item}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
