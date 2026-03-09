export function formatCurrency(value: string | number | null | undefined, currency = "USD") {
  const numeric = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}
