import { getPlatformSettings, type SettingValue } from "@/lib/settings";
import { normalizePhone } from "@/lib/sms";
import { appUrl } from "@/lib/email";

function str(settings: Record<string, SettingValue>, key: string): string {
  const v = settings[key];
  return v == null ? "" : String(v);
}

function darajaBase(env: string): string {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/**
 * True when Daraja STK Push is fully configured (keys + shortcode + passkey).
 * When false, M-Pesa bookings are rejected — we never fake a successful payment.
 */
export async function isDarajaConfigured(): Promise<boolean> {
  const s = await getPlatformSettings();
  return Boolean(
    str(s, "daraja.consumerKey") &&
      str(s, "daraja.consumerSecret") &&
      str(s, "daraja.shortcode") &&
      str(s, "daraja.passkey"),
  );
}

async function getAccessToken(
  s: Record<string, SettingValue>,
): Promise<string | null> {
  const env = str(s, "daraja.environment") || "sandbox";
  const key = str(s, "daraja.consumerKey");
  const secret = str(s, "daraja.consumerSecret");
  if (!key || !secret) return null;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${darajaBase(env)}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export type StkPushResult = {
  ok: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  error?: string;
};

/**
 * Map Safaricom STK ResultCode / ResultDesc to a clear message for the guest.
 * Common codes from Lipa na M-Pesa Online.
 */
export function explainStkFailure(
  resultCode?: number | string | null,
  resultDesc?: string | null,
): string {
  const code =
    resultCode == null || resultCode === ""
      ? null
      : Number(resultCode);
  const desc = (resultDesc || "").trim();

  const byCode: Record<number, string> = {
    1: "Payment failed — insufficient M-Pesa balance.",
    1001: "Another M-Pesa request is already open on this phone. Close it and try again.",
    1019: "The M-Pesa prompt expired. Try booking again.",
    1025: "M-Pesa timed out (network). Check signal and try again.",
    1032: "You cancelled the M-Pesa prompt on your phone. Booking was not confirmed.",
    1037: "No response on your phone (PIN not entered in time). Booking was not confirmed.",
    2001: "Wrong M-Pesa PIN. Booking was not confirmed — try again with the correct PIN.",
  };

  if (code != null && !Number.isNaN(code) && byCode[code]) {
    return byCode[code];
  }

  const lower = desc.toLowerCase();
  if (lower.includes("cancel") || lower.includes("1032")) {
    return byCode[1032];
  }
  if (lower.includes("timeout") || lower.includes("1037") || lower.includes("ds timeout")) {
    return byCode[1037];
  }
  if (lower.includes("pin") || lower.includes("2001")) {
    return byCode[2001];
  }
  if (lower.includes("balance") || lower.includes("insufficient")) {
    return byCode[1];
  }
  if (lower.includes("network") || lower.includes("unreachable")) {
    return "M-Pesa could not reach your phone (network). Check coverage and try again.";
  }
  if (desc) return `M-Pesa payment failed: ${desc}`;
  return "M-Pesa payment failed. Booking was not confirmed.";
}

/**
 * Initiate an M-Pesa STK Push (Lipa na M-Pesa Online). On success the customer
 * gets a PIN prompt and Safaricom later POSTs the result to our callback route,
 * which confirms the booking. Returns the CheckoutRequestID we can correlate on.
 */
export async function stkPush(opts: {
  phone: string;
  amount: number;
  reference: string;
  description?: string;
}): Promise<StkPushResult> {
  try {
    const s = await getPlatformSettings();
    const env = str(s, "daraja.environment") || "sandbox";
    const shortcode = str(s, "daraja.shortcode");
    const passkey = str(s, "daraja.passkey");
    const txnType =
      str(s, "daraja.transactionType") || "CustomerPayBillOnline";
    const phone = normalizePhone(opts.phone);
    if (!phone) {
      return {
        ok: false,
        error:
          "Invalid M-Pesa phone number. Use a Safaricom number like 07… or 2547…",
      };
    }

    const token = await getAccessToken(s);
    if (!token) {
      return {
        ok: false,
        error:
          "Could not connect to M-Pesa (Daraja). Try again in a moment.",
      };
    }

    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString(
      "base64",
    );
    const callbackUrl =
      str(s, "daraja.callbackUrl") || appUrl("/api/mpesa/callback");

    const res = await fetch(`${darajaBase(env)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: txnType,
        Amount: Math.max(1, Math.round(opts.amount)),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: opts.reference.slice(0, 12),
        TransactionDesc: (opts.description || opts.reference).slice(0, 20),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
      errorMessage?: string;
      errorCode?: string;
    };
    if (!res.ok || data.ResponseCode !== "0") {
      const raw =
        data.errorMessage ||
        data.ResponseDescription ||
        data.CustomerMessage ||
        "Could not send M-Pesa prompt to your phone";
      return { ok: false, error: explainStkFailure(null, raw) };
    }
    return {
      ok: true,
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
    };
  } catch (error) {
    console.error("stkPush failed", error);
    return {
      ok: false,
      error:
        "Could not reach M-Pesa (network). Check your connection and try again.",
    };
  }
}

export type StkQueryResult = {
  resultCode: number | null;
  resultDesc: string;
  done: boolean;
  success: boolean;
};

/**
 * Query STK Push status when the callback is slow or missing (e.g. local tunnel).
 */
export async function queryStkStatus(
  checkoutRequestId: string,
): Promise<StkQueryResult | { error: string }> {
  try {
    const s = await getPlatformSettings();
    const env = str(s, "daraja.environment") || "sandbox";
    const shortcode = str(s, "daraja.shortcode");
    const passkey = str(s, "daraja.passkey");
    const token = await getAccessToken(s);
    if (!token) return { error: "Could not authenticate with Daraja" };

    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString(
      "base64",
    );

    const res = await fetch(
      `${darajaBase(env)}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: ts,
          CheckoutRequestID: checkoutRequestId,
        }),
      },
    );

    const data = (await res.json().catch(() => ({}))) as {
      ResultCode?: string | number;
      ResultDesc?: string;
      errorMessage?: string;
      ResponseCode?: string;
    };

    // Still processing
    if (
      String(data.ResponseCode) === "500.001.1001" ||
      (data.ResultDesc || "").toLowerCase().includes("being processed")
    ) {
      return {
        resultCode: null,
        resultDesc: "Waiting for you to enter your M-Pesa PIN…",
        done: false,
        success: false,
      };
    }

    const code =
      data.ResultCode == null || data.ResultCode === ""
        ? null
        : Number(data.ResultCode);
    const desc = data.ResultDesc || data.errorMessage || "";
    if (code == null || Number.isNaN(code)) {
      return { error: desc || "Could not check M-Pesa status" };
    }
    return {
      resultCode: code,
      resultDesc: desc,
      done: true,
      success: code === 0,
    };
  } catch (error) {
    console.error("queryStkStatus failed", error);
    return { error: "Could not check M-Pesa status" };
  }
}

export async function isB2cConfigured(): Promise<boolean> {
  const s = await getPlatformSettings();
  return Boolean(
    (await isDarajaConfigured()) &&
      str(s, "daraja.initiatorName") &&
      str(s, "daraja.securityCredential"),
  );
}

export type B2cResult =
  | { ok: true; conversationId?: string; originatorConversationId?: string }
  | { ok: false; error: string };

/**
 * Send money to a provider phone via Daraja B2C (Business to Customer).
 * Used when admin triggers "Pay via M-Pesa" on a payout.
 */
export async function b2cPayment(opts: {
  phone: string;
  amount: number;
  reference: string;
  remarks?: string;
}): Promise<B2cResult> {
  try {
    const s = await getPlatformSettings();
    if (!(await isB2cConfigured())) {
      return {
        ok: false,
        error:
          "B2C is not configured. Add initiator name + security credential under Settings → M-Pesa.",
      };
    }
    const phone = normalizePhone(opts.phone);
    if (!phone) {
      return { ok: false, error: "Provider needs a valid M-Pesa phone number" };
    }

    const token = await getAccessToken(s);
    if (!token) return { ok: false, error: "Could not authenticate with Daraja" };

    const env = str(s, "daraja.environment") || "sandbox";
    const shortcode = str(s, "daraja.shortcode");
    const initiator = str(s, "daraja.initiatorName");
    const securityCredential = str(s, "daraja.securityCredential");
    const resultUrl =
      str(s, "daraja.resultUrl") || appUrl("/api/mpesa/b2c-result");
    const timeoutUrl =
      str(s, "daraja.timeoutUrl") || appUrl("/api/mpesa/b2c-timeout");
    const command =
      str(s, "daraja.b2cCommandId") || "BusinessPayment";

    const res = await fetch(`${darajaBase(env)}/mpesa/b2c/v1/paymentrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        InitiatorName: initiator,
        SecurityCredential: securityCredential,
        CommandID: command,
        Amount: Math.max(1, Math.round(opts.amount)),
        PartyA: shortcode,
        PartyB: phone,
        Remarks: (opts.remarks || opts.reference).slice(0, 100),
        QueueTimeOutURL: timeoutUrl,
        ResultURL: resultUrl,
        Occasion: opts.reference.slice(0, 100),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ConversationID?: string;
      OriginatorConversationID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!res.ok || (data.ResponseCode && data.ResponseCode !== "0")) {
      return {
        ok: false,
        error:
          data.errorMessage ||
          data.ResponseDescription ||
          "B2C payment request failed",
      };
    }

    return {
      ok: true,
      conversationId: data.ConversationID,
      originatorConversationId: data.OriginatorConversationID,
    };
  } catch (error) {
    console.error("b2cPayment failed", error);
    return { ok: false, error: "Could not reach M-Pesa for payout" };
  }
}

export type ReversalResult =
  | { ok: true; conversationId?: string; originatorConversationId?: string }
  | { ok: false; error: string };

/**
 * Daraja Transaction Reversal — reverse a completed C2B/STK payment back to the customer.
 * Requires initiator + security credential (same as B2C).
 */
export async function reverseMpesaTransaction(opts: {
  transactionId: string;
  amount: number;
  remarks?: string;
  occasion?: string;
}): Promise<ReversalResult> {
  try {
    const s = await getPlatformSettings();
    if (!(await isB2cConfigured())) {
      return {
        ok: false,
        error:
          "Reversal needs Daraja initiator + security credential (Settings → M-Pesa).",
      };
    }
    const token = await getAccessToken(s);
    if (!token) return { ok: false, error: "Could not authenticate with Daraja" };

    const env = str(s, "daraja.environment") || "sandbox";
    const shortcode = str(s, "daraja.shortcode");
    const initiator = str(s, "daraja.initiatorName");
    const securityCredential = str(s, "daraja.securityCredential");
    const resultUrl =
      str(s, "daraja.reversalResultUrl") ||
      str(s, "daraja.resultUrl") ||
      appUrl("/api/mpesa/reversal-result");
    const timeoutUrl =
      str(s, "daraja.reversalTimeoutUrl") ||
      str(s, "daraja.timeoutUrl") ||
      appUrl("/api/mpesa/reversal-timeout");

    const res = await fetch(`${darajaBase(env)}/mpesa/reversal/v1/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Initiator: initiator,
        SecurityCredential: securityCredential,
        CommandID: "TransactionReversal",
        TransactionID: opts.transactionId,
        Amount: Math.max(1, Math.round(opts.amount)),
        ReceiverParty: shortcode,
        RecieverIdentifierType: "11",
        ResultURL: resultUrl,
        QueueTimeOutURL: timeoutUrl,
        Remarks: (opts.remarks || "Booking refund").slice(0, 100),
        Occasion: (opts.occasion || "Refund").slice(0, 100),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ConversationID?: string;
      OriginatorConversationID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!res.ok || (data.ResponseCode && data.ResponseCode !== "0")) {
      return {
        ok: false,
        error:
          data.errorMessage ||
          data.ResponseDescription ||
          "M-Pesa reversal request failed",
      };
    }

    return {
      ok: true,
      conversationId: data.ConversationID,
      originatorConversationId: data.OriginatorConversationID,
    };
  } catch (error) {
    console.error("reverseMpesaTransaction failed", error);
    return { ok: false, error: "Could not reach M-Pesa for reversal" };
  }
}
