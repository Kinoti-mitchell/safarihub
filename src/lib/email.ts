import dns from "node:dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { getPlatformSettings, type SettingValue } from "@/lib/settings";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

function str(settings: Record<string, SettingValue>, key: string): string {
  const v = settings[key];
  return v == null ? "" : String(v);
}

function bool(settings: Record<string, SettingValue>, key: string, fallback = false): boolean {
  const v = settings[key];
  if (typeof v === "boolean") return v;
  if (v == null || v === "") return fallback;
  return String(v) === "true" || v === 1;
}

function num(settings: Record<string, SettingValue>, key: string, fallback: number): number {
  const v = settings[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

function lookupIpv4(
  hostname: string,
  _options: unknown,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
) {
  dns.lookup(hostname, { family: 4, all: false }, callback);
}

function getGmailEnvConfig(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (user && pass) return { user, pass };
  return null;
}

type SmtpCreds = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

/**
 * Resolve SMTP credentials from Admin settings, then Gmail env vars (same as Trace).
 */
function resolveSmtp(
  settings: Record<string, SettingValue>,
  fromEmail: string,
  fromName: string,
): SmtpCreds | null {
  const host = str(settings, "email.host").trim();
  const user = str(settings, "email.username").trim();
  const pass = str(settings, "email.password").trim();

  if (host && user && pass) {
    const port = num(settings, "email.port", 587);
    return {
      host,
      port,
      secure: bool(settings, "email.secure", port === 465),
      user,
      pass,
      fromEmail: fromEmail || user,
      fromName,
    };
  }

  const gmail = getGmailEnvConfig();
  if (gmail) {
    // Gmail only allows sending as the authenticated account (or aliases).
    const placeholder = !fromEmail || /no-reply@safarihub/i.test(fromEmail);
    return {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: gmail.user,
      pass: gmail.pass,
      fromEmail: placeholder ? gmail.user : fromEmail,
      fromName,
    };
  }

  return null;
}

async function sendViaSmtp(creds: SmtpCreds, msg: EmailMessage, recipients: string[]): Promise<boolean> {
  const isGmail = /gmail\.com$/i.test(creds.host);
  const attempts = isGmail
    ? [
        { port: 587, secure: false, label: "587/STARTTLS" },
        { port: 465, secure: true, label: "465/SSL" },
      ]
    : [{ port: creds.port, secure: creds.secure, label: `${creds.port}` }];

  const from = `${creds.fromName} <${creds.fromEmail}>`;
  const html = msg.html ?? `<pre>${escapeHtml(msg.text)}</pre>`;
  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const transporter = nodemailer.createTransport({
        host: creds.host,
        port: attempt.port,
        secure: attempt.secure,
        auth: { user: creds.user, pass: creds.pass },
        tls: isGmail ? { servername: "smtp.gmail.com" } : undefined,
        lookup: lookupIpv4 as never,
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 20_000,
      } as SMTPTransport.Options);

      await transporter.sendMail({
        from,
        to: recipients.join(", "),
        subject: msg.subject,
        text: msg.text,
        html,
      });
      console.info(
        `[email:smtp ok ${attempt.label}] → ${recipients.join(", ")} · ${msg.subject}`,
      );
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[email:smtp ${attempt.label} failed]`, lastError.message);
    }
  }

  return logFallback(msg, `smtp: ${lastError?.message || "unknown error"}`);
}

/**
 * Send an email using the provider configured in Admin → Settings → Email.
 * SMTP uses nodemailer (Admin SMTP fields, or GMAIL_USER + GMAIL_APP_PASSWORD like Trace).
 * Never throws — a failed notification must not break the underlying action.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  try {
    const settings = await getPlatformSettings();
    const provider = str(settings, "email.provider") || "smtp";
    const fromEmail =
      str(settings, "email.fromEmail") ||
      str(settings, "notifications.fromEmail") ||
      process.env.GMAIL_USER?.trim() ||
      "no-reply@safarihub.co.ke";
    const fromName = str(settings, "email.fromName") || "Safari Hub";
    const to = Array.isArray(msg.to) ? msg.to : [msg.to];
    const recipients = to.map((t) => t.trim()).filter(Boolean);
    if (recipients.length === 0) return false;

    const html = msg.html ?? `<pre>${escapeHtml(msg.text)}</pre>`;

    if (provider === "disabled") {
      return logFallback(msg, 'provider="disabled"');
    }

    if (provider === "resend") {
      const apiKey = str(settings, "email.apiKey") || process.env.RESEND_API_KEY?.trim() || "";
      if (!apiKey) return logFallback(msg, "resend: no api key");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: recipients,
          subject: msg.subject,
          text: msg.text,
          html,
        }),
      });
      return res.ok || logFallback(msg, `resend ${res.status}`);
    }

    if (provider === "sendgrid") {
      const apiKey = str(settings, "email.apiKey");
      if (!apiKey) return logFallback(msg, "sendgrid: no api key");
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map((email) => ({ email })) }],
          from: { email: fromEmail, name: fromName },
          subject: msg.subject,
          content: [
            { type: "text/plain", value: msg.text },
            { type: "text/html", value: html },
          ],
        }),
      });
      return res.ok || logFallback(msg, `sendgrid ${res.status}`);
    }

    // SMTP (default) — Admin fields, else GMAIL_* env like Trace
    const smtp = resolveSmtp(settings, fromEmail, fromName);
    if (!smtp) {
      return logFallback(
        msg,
        'smtp: set Admin → Email SMTP fields, or GMAIL_USER + GMAIL_APP_PASSWORD in .env',
      );
    }
    return sendViaSmtp(smtp, msg, recipients);
  } catch (error) {
    console.error("sendEmail failed", error);
    return false;
  }
}

function logFallback(msg: EmailMessage, reason: string): boolean {
  console.info(
    `[email:noop ${reason}] → ${Array.isArray(msg.to) ? msg.to.join(", ") : msg.to} · ${msg.subject}`,
  );
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return path ? `${base}${path.startsWith("/") ? "" : "/"}${path}` : base;
}
