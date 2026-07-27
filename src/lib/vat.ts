import { getPlatformSettings, numberSetting } from "@/lib/settings";

export type MoneyBreakdown = {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
};

/**
 * VAT is added on top of the room/stay subtotal (exclusive), using the rate from
 * Admin → Settings → fees.vatRate (Kenya default 16%).
 */
export async function breakdownWithVat(subtotal: number): Promise<MoneyBreakdown> {
  const settings = await getPlatformSettings();
  const vatRate = Math.max(0, numberSetting(settings, "fees.vatRate") || 0);
  const vatAmount = Math.round((subtotal * vatRate) / 100);
  return {
    subtotal,
    vatRate,
    vatAmount,
    total: subtotal + vatAmount,
  };
}

export function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString()}`;
}
