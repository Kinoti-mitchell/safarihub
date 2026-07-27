/** Approximate FX for tourist display only — charges stay in KES ledger.
 * Safe for client components (no server-only imports).
 */
const FX_FROM_KES: Record<string, number> = {
  KES: 1,
  USD: 1 / 129,
  EUR: 1 / 140,
};

export function formatMoney(
  amountKes: number,
  currency: string = "KES",
): string {
  const code = currency.toUpperCase();
  if (code === "KES") {
    return `KES ${Math.round(amountKes).toLocaleString()}`;
  }
  const rate = FX_FROM_KES[code] ?? 1;
  const converted = amountKes * rate;
  const formatted = converted.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${code} ${formatted}`;
}

/** Primary amount + optional approx foreign currency for tourists. */
export function formatPriceTourist(
  amountKes: number,
  displayCurrency: string = "KES",
): { primary: string; approx: string | null } {
  const primary = formatMoney(amountKes, "KES");
  const code = displayCurrency.toUpperCase();
  if (code === "KES") return { primary, approx: null };
  return {
    primary,
    approx: `≈ ${formatMoney(amountKes, code)}`,
  };
}
