import { getPlatformSettings, numberSetting } from "@/lib/settings";

export type MoneyBreakdown = {
  subtotal: number;
  serviceFeeRate: number;
  serviceFeeAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
};

/**
 * Service fee (Admin → fees.serviceFee) then VAT (fees.vatRate) on
 * (subtotal + service fee). Kenya VAT default 16%.
 */
export async function breakdownWithVat(subtotal: number): Promise<MoneyBreakdown> {
  const settings = await getPlatformSettings();
  const serviceFeeRate = Math.max(
    0,
    numberSetting(settings, "fees.serviceFee") || 0,
  );
  const vatRate = Math.max(0, numberSetting(settings, "fees.vatRate") || 0);
  const serviceFeeAmount = Math.round((subtotal * serviceFeeRate) / 100);
  const taxable = subtotal + serviceFeeAmount;
  const vatAmount = Math.round((taxable * vatRate) / 100);
  return {
    subtotal,
    serviceFeeRate,
    serviceFeeAmount,
    vatRate,
    vatAmount,
    total: taxable + vatAmount,
  };
}

export function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString()}`;
}
