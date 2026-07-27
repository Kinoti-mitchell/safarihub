import { createHash, randomInt } from "crypto";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { sendSms, normalizePhone } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { normalizeEmail, phoneVariants } from "@/lib/identity";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export type OtpChannel = "phone" | "email";

export async function createAndSendOtp(opts: {
  channel: OtpChannel;
  destination: string;
  /** signup = any number; login = must already have an account */
  purpose?: "signup" | "login";
}): Promise<{ ok: true; otpId: string; devCode?: string } | { ok: false; error: string }> {
  let destination: string;
  if (opts.channel === "phone") {
    const phone = normalizePhone(opts.destination);
    if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number" };
    destination = phone;
  } else {
    destination = normalizeEmail(opts.destination);
    if (!destination.includes("@")) {
      return { ok: false, error: "Enter a valid email address" };
    }
  }

  if (opts.purpose === "login") {
    if (opts.channel !== "phone") {
      return { ok: false, error: "Phone OTP login only" };
    }
    const variants = phoneVariants(destination);
    const { data: existing } = await db
      .from("User")
      .select("id")
      .in("phone", variants)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      return {
        ok: false,
        error: "No account found for this phone number",
      };
    }
  }

  // Invalidate prior unused codes for this destination
  await db
    .from("VerificationOtp")
    .delete()
    .eq("destination", destination)
    .eq("verified", false);

  const code = generateCode();
  const otpId = createId("otp");
  const now = Date.now();
  const { error } = await db.from("VerificationOtp").insert({
    id: otpId,
    channel: opts.channel,
    destination,
    codeHash: hashOtp(code),
    attempts: 0,
    verified: false,
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
  });
  if (error) {
    // Table may not exist yet
    if (/VerificationOtp|does not exist|schema cache/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Database needs db/2026-provider-verification-extras.sql applied for OTP.",
      };
    }
    return { ok: false, error: error.message };
  }

  const message =
    opts.purpose === "login"
      ? `Your Safari Hub login code is ${code}. It expires in 10 minutes.`
      : `Your Safari Hub verification code is ${code}. It expires in 10 minutes.`;
  let delivered = false;
  if (opts.channel === "phone") {
    delivered = await sendSms(destination, message);
  } else {
    delivered = await sendEmail({
      to: destination,
      subject: "Safari Hub verification code",
      text: message,
      html: `<p>Your Safari Hub verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  }

  const isDev = process.env.NODE_ENV !== "production";
  if (!delivered && !isDev) {
    return {
      ok: false,
      error:
        opts.channel === "phone"
          ? "Could not send SMS — check SMS settings in admin"
          : "Could not send email — check email settings in admin",
    };
  }

  return {
    ok: true,
    otpId,
    ...(isDev || !delivered ? { devCode: code } : {}),
  };
}

export async function verifyOtp(opts: {
  otpId: string;
  code: string;
  destination?: string;
}): Promise<
  | { ok: true; channel: OtpChannel; destination: string }
  | { ok: false; error: string }
> {
  // Allow spaces / dashes in pasted codes
  const code = opts.code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code" };
  }

  const { data: row, error } = await db
    .from("VerificationOtp")
    .select("*")
    .eq("id", opts.otpId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, error: "Code expired or not found — request a new one" };
  }

  if (row.verified) {
    return {
      ok: true,
      channel: row.channel as OtpChannel,
      destination: row.destination as string,
    };
  }

  if (new Date(row.expiresAt as string).getTime() < Date.now()) {
    return { ok: false, error: "Code expired — request a new one" };
  }

  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts — request a new code" };
  }

  if (opts.destination) {
    const expected =
      row.channel === "phone"
        ? normalizePhone(opts.destination)
        : normalizeEmail(opts.destination);
    if (!expected || expected !== row.destination) {
      return {
        ok: false,
        error:
          row.channel === "phone"
            ? "Phone number does not match the code we sent — check the number on Account"
            : "Email does not match the code we sent — check the address on Account",
      };
    }
  }

  await db
    .from("VerificationOtp")
    .update({ attempts: (row.attempts as number) + 1 })
    .eq("id", opts.otpId);

  if (hashOtp(code) !== row.codeHash) {
    return { ok: false, error: "Incorrect code" };
  }

  await db
    .from("VerificationOtp")
    .update({ verified: true })
    .eq("id", opts.otpId);

  return {
    ok: true,
    channel: row.channel as OtpChannel,
    destination: row.destination as string,
  };
}

/** Confirm a previously verified OTP still matches the destination. */
export async function assertVerifiedOtp(opts: {
  otpId: string | null | undefined;
  channel: OtpChannel;
  destination: string;
}): Promise<string | null> {
  if (!opts.otpId) {
    return opts.channel === "phone"
      ? "Verify your phone with the OTP code first"
      : "Verify your email with the OTP code first";
  }
  const dest =
    opts.channel === "phone"
      ? normalizePhone(opts.destination)
      : normalizeEmail(opts.destination);
  if (!dest) return "Invalid destination for OTP check";

  const { data: row } = await db
    .from("VerificationOtp")
    .select("id, channel, destination, verified, expiresAt")
    .eq("id", opts.otpId)
    .maybeSingle();
  if (!row?.verified) return "OTP not verified — complete verification first";
  if (row.channel !== opts.channel) return "OTP channel mismatch";
  if (row.destination !== dest) return "OTP does not match this contact";
  // Allow verified OTPs for up to 2 hours after issue for finishing signup
  const exp = new Date(row.expiresAt as string).getTime() + 2 * 60 * 60 * 1000;
  if (exp < Date.now()) return "Verification expired — request a new code";
  return null;
}
