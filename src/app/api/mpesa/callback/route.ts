import {
  confirmBookingPaid,
  confirmPackageBookingPaid,
  failMpesaBooking,
  failMpesaPackageBooking,
  findBookingByCheckoutId,
} from "@/lib/payments";

/**
 * Safaricom Daraja STK Push result callback.
 * Success → confirm listing or package booking. Failure → cancel and store why.
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
      const providerRef = receipt ? String(receipt) : checkoutId;
      const amount =
        amountItem != null ? Number(amountItem) : match.amount;

      if (match.kind === "package") {
        await confirmPackageBookingPaid(match.packageBookingId, {
          method: "MPESA",
          providerRef,
          amount,
          amountReceived: amount,
        });
      } else {
        await confirmBookingPaid(match.bookingId, {
          method: "MPESA",
          providerRef,
          amount,
          amountReceived: amount,
        });
      }
    } else if (match.kind === "package") {
      await failMpesaPackageBooking(
        match.packageBookingId,
        cb?.ResultDesc || "Payment declined",
        { resultCode: cb?.ResultCode },
      );
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
