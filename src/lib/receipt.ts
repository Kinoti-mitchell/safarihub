import { createId } from "@/lib/ids";
import { db } from "@/lib/supabase";

/** Short human receipt number, e.g. SH-A1B2C3D4 */
export function makeReceiptNumber(): string {
  const id = createId().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `SH-${id.slice(-8)}`;
}

/**
 * Ensure a booking has a receipt number. Idempotent — does not overwrite an
 * existing receiptNumber.
 */
export async function ensureReceiptNumber(bookingId: string): Promise<string> {
  const { data } = await db
    .from("Booking")
    .select("receiptNumber")
    .eq("id", bookingId)
    .maybeSingle();
  if (data?.receiptNumber) return data.receiptNumber as string;

  const receiptNumber = makeReceiptNumber();
  await db
    .from("Booking")
    .update({
      receiptNumber,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .is("receiptNumber", null);

  // Re-read in case of race
  const { data: again } = await db
    .from("Booking")
    .select("receiptNumber")
    .eq("id", bookingId)
    .maybeSingle();
  return (again?.receiptNumber as string) || receiptNumber;
}
