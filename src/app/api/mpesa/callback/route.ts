import {
  confirmBookingPaid,
  failMpesaBooking,
  findBookingByCheckoutId,
} from "@/lib/payments";

/**
 * Safaricom Daraja STK Push result callback.
 * Success → confirm booking. Failure → cancel booking and store why.
 * Always responds 200 with the acknowledgement shape Daraja expects.
 */
export async function POST(request: Request) {
  const ack = { ResultCode: 0, ResultDesc: "Accepted" };
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      Body?: {
        stkCallback?: {
          MerchantRequestID?: string;
          CheckoutRequestID?: string;
          ResultCode?: number;
          ResultDesc?: string;
          CallbackMetadata?: {
            Item?: Array<{ Name: string; Value?: unknown }>;
          };
        };
      };
    };

    const cb = payload.Body?.stkCallback;
    const checkoutId = cb?.CheckoutRequestID;
    if (!checkoutId) return Response.json(ack);

    const match = await findBookingByCheckoutId(checkoutId);
    if (!match) return Response.json(ack);

    if (cb?.ResultCode === 0) {
      const receipt = cb.CallbackMetadata?.Item?.find(
        (i) => i.Name === "MpesaReceiptNumber",
      )?.Value;
      const amountItem = cb.CallbackMetadata?.Item?.find(
        (i) => i.Name === "Amount",
      )?.Value;
      await confirmBookingPaid(match.bookingId, {
        method: "MPESA",
        providerRef: receipt ? String(receipt) : checkoutId,
        amount: amountItem != null ? Number(amountItem) : match.amount,
        amountReceived:
          amountItem != null ? Number(amountItem) : match.amount,
      });
    } else {
      await failMpesaBooking(
        match.bookingId,
        cb?.ResultDesc || "Payment declined",
        { resultCode: cb?.ResultCode },
      );
    }
    return Response.json(ack);
  } catch (error) {
    console.error("mpesa callback failed", error);
    return Response.json(ack);
  }
}
