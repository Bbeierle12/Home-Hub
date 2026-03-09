import type { ReactNode } from "react";

export function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)] backdrop-blur-sm">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-secondary)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
