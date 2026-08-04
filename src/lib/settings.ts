import { db } from "@/lib/supabase";

export type SettingValue = string | number | boolean;

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "image"
  | "secret";

export type SettingField = {
  key: string;
  label: string;
  help?: string;
  type: FieldType;
  default: SettingValue;
  options?: { value: string; label: string }[];
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
};

export type SettingsGroup = {
  id: string;
  label: string;
  description?: string;
  fields: SettingField[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "general",
    label: "General",
    description: "Basic platform identity and contact details.",
    fields: [
      { key: "general.platformName", label: "Platform name", type: "text", default: "Safari Hub" },
      {
        key: "general.marketName",
        label: "Market / country",
        type: "text",
        default: "",
        help: "Shown in the header, homepage, and browse copy when set (e.g. Featured across …).",
      },
      { key: "general.supportEmail", label: "Support email", type: "text", default: "" },
      { key: "general.supportPhone", label: "Support phone", type: "text", default: "" },
      {
        key: "general.currency",
        label: "Currency",
        type: "select",
        default: "KES",
        options: [
          { value: "KES", label: "Kenyan Shilling (KES)" },
          { value: "USD", label: "US Dollar (USD)" },
          { value: "EUR", label: "Euro (EUR)" },
        ],
      },
      { key: "general.timezone", label: "Timezone", type: "text", default: "Africa/Nairobi" },
      {
        key: "general.maintenanceMode",
        label: "Maintenance mode",
        help: "When on, the public site shows a maintenance notice (admins still have access).",
        type: "boolean",
        default: false,
      },
    ],
  },
  {
    id: "fees",
    label: "Fees & commission",
    description: "Defaults applied to provider earnings and pricing.",
    fields: [
      { key: "fees.defaultCommission", label: "Default commission", type: "number", default: 10, suffix: "%", min: 0, max: 50, help: "Applied to new providers on sign-up and pre-filled at approval." },
      { key: "fees.serviceFee", label: "Service fee", type: "number", default: 0, suffix: "%", min: 0, max: 50 },
      { key: "fees.vatRate", label: "VAT / tax rate", type: "number", default: 16, suffix: "%", min: 0, max: 50, help: "Added on top of the stay subtotal on every booking receipt (Kenya standard is 16%)." },
    ],
  },
  {
    id: "listingPublish",
    label: "Listing publish fee",
    description:
      "Providers pay once per listing to go live. Admins only approve businesses — not each listing’s content. Set fee to 0 for free publish.",
    fields: [
      {
        key: "listing.publishFeeKes",
        label: "Publish fee",
        type: "number",
        default: 500,
        prefix: "KES",
        min: 0,
        help: "0 = listing goes live immediately when complete. Above 0 = provider pays via M-Pesa, then admin confirms payment to publish.",
      },
      {
        key: "listing.publishPaymentInstructions",
        label: "Payment instructions",
        type: "textarea",
        default:
          "Pay the listing publish fee via M-Pesa to the Safari Hub paybill/till, then paste your M-Pesa confirmation code. Your listing goes live after payment is verified.",
        help: "Shown to providers on the listing publish step.",
      },
    ],
  },
  {
    id: "boost",
    label: "Listing boosts",
    description:
      "Paid catalog promotion. Rates per period are managed under Admin → Boosts. Providers can only request a boost after a listing is live.",
    fields: [
      {
        key: "boost.enabled",
        label: "Enable paid boosts",
        type: "boolean",
        default: true,
        help: "When off, providers cannot submit new boost requests.",
      },
      {
        key: "boost.paymentInstructions",
        label: "Payment instructions",
        type: "textarea",
        default:
          "Pay the boost fee via M-Pesa to the Safari Hub paybill/till, then paste your M-Pesa confirmation code when you request a boost. An admin will activate your boost after verifying payment.",
        help: "Shown to providers on the boost request form.",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Control which payment methods and amounts are accepted.",
    fields: [
      { key: "payments.mpesaEnabled", label: "Accept M-Pesa", type: "boolean", default: true },
      { key: "payments.cardEnabled", label: "Accept card", type: "boolean", default: true },
      {
        key: "payments.cardMode",
        label: "Card processing",
        type: "select",
        default: "sandbox",
        options: [
          { value: "sandbox", label: "Sandbox (test cards, instant confirm)" },
          { value: "manual", label: "Manual (provider/admin confirms payment)" },
        ],
        help: "Sandbox validates Luhn + test cards and confirms instantly (no PAN stored). Manual queues the booking until staff confirms via Record card paid.",
      },
      { key: "payments.cashEnabled", label: "Accept cash on arrival", type: "boolean", default: true },
      { key: "payments.mpesaPaybill", label: "M-Pesa paybill / till", type: "text", default: "" },
      { key: "payments.minBookingAmount", label: "Minimum booking amount", type: "number", default: 0, prefix: "KES", min: 0, help: "0 = no minimum." },
      { key: "payments.maxBookingAmount", label: "Maximum booking amount", type: "number", default: 0, prefix: "KES", min: 0, help: "0 = no maximum." },
    ],
  },
  {
    id: "daraja",
    label: "M-Pesa (Daraja)",
    description:
      "Safaricom Daraja API credentials for STK Push (collections) and B2C (payouts).",
    fields: [
      {
        key: "daraja.environment",
        label: "Environment",
        type: "select",
        default: "sandbox",
        options: [
          { value: "sandbox", label: "Sandbox" },
          { value: "production", label: "Production" },
        ],
      },
      { key: "daraja.consumerKey", label: "Consumer key", type: "secret", default: "" },
      { key: "daraja.consumerSecret", label: "Consumer secret", type: "secret", default: "" },
      { key: "daraja.shortcode", label: "Business shortcode / paybill", type: "text", default: "" },
      {
        key: "daraja.transactionType",
        label: "Transaction type",
        type: "select",
        default: "CustomerPayBillOnline",
        options: [
          { value: "CustomerPayBillOnline", label: "Pay Bill" },
          { value: "CustomerBuyGoodsOnline", label: "Buy Goods (Till)" },
        ],
      },
      { key: "daraja.passkey", label: "Lipa na M-Pesa passkey", type: "secret", default: "" },
      { key: "daraja.callbackUrl", label: "STK callback URL", type: "text", default: "", help: "Public URL Safaricom posts payment results to." },
      { key: "daraja.initiatorName", label: "B2C initiator name", type: "text", default: "", help: "Used for provider payouts (B2C)." },
      { key: "daraja.securityCredential", label: "B2C security credential", type: "secret", default: "" },
      { key: "daraja.resultUrl", label: "B2C result URL", type: "text", default: "", help: "Defaults to /api/mpesa/b2c-result on your app URL." },
      { key: "daraja.timeoutUrl", label: "B2C timeout URL", type: "text", default: "", help: "Defaults to /api/mpesa/b2c-timeout." },
      {
        key: "daraja.b2cCommandId",
        label: "B2C command",
        type: "select",
        default: "BusinessPayment",
        options: [
          { value: "BusinessPayment", label: "BusinessPayment" },
          { value: "SalaryPayment", label: "SalaryPayment" },
          { value: "PromotionPayment", label: "PromotionPayment" },
        ],
      },
    ],
  },
  {
    id: "booking",
    label: "Booking rules",
    description: "Defaults that govern reservations.",
    fields: [
      { key: "booking.checkInTime", label: "Default check-in time", type: "text", default: "14:00" },
      { key: "booking.checkOutTime", label: "Default check-out time", type: "text", default: "10:00" },
      { key: "booking.cancellationWindowHours", label: "Free cancellation window", type: "number", default: 48, suffix: "hours", min: 0 },
      { key: "booking.minLeadTimeHours", label: "Minimum booking lead time", type: "number", default: 0, suffix: "hours", min: 0 },
      {
        key: "booking.autoConfirm",
        label: "Auto-confirm paid bookings",
        type: "boolean",
        default: true,
        help: "When on, successful payment marks the booking confirmed. When off, payment is recorded but the host must confirm before the stay is confirmed.",
      },
      {
        key: "payout.settlementCadenceDays",
        label: "Provider payout settlement cadence",
        type: "number",
        default: 7,
        suffix: "days",
        min: 1,
        help: "Shown to providers as the expected next settlement window for pending payouts.",
      },
    ],
  },
  {
    id: "flags",
    label: "Feature flags",
    description: "Turn platform modules on or off.",
    fields: [
      { key: "flags.eventsEnabled", label: "Events module", type: "boolean", default: true },
      { key: "flags.packagesEnabled", label: "Travel packages", type: "boolean", default: true },
      { key: "flags.reviewsEnabled", label: "Reviews", type: "boolean", default: true },
      { key: "flags.inquiriesEnabled", label: "Inquiries / leads", type: "boolean", default: true },
      { key: "flags.loyaltyEnabled", label: "Loyalty points", type: "boolean", default: true },
      { key: "flags.requireListingApproval", label: "Legacy: admin review each listing", type: "boolean", default: false, help: "Keep OFF. Business approval + publish fee is the normal path. When ON, listings wait for content review instead of pay-to-publish." },
      { key: "flags.autoApproveProviders", label: "Hard-gate auto-approve providers", type: "boolean", default: false, help: "When on, new providers are approved only if every hard check passes (OTP, docs, KRA, permit expiry, M-Pesa, map, no duplicates). Otherwise they stay in the admin queue." },
      { key: "flags.suppliersEnabled", label: "Supplier marketplace", type: "boolean", default: true },
      { key: "flags.staffingEnabled", label: "Provider staffing invites", type: "boolean", default: true },
      {
        key: "flags.launchFocusStayTours",
        label: "Launch focus: Stay + Explore/tours",
        type: "boolean",
        default: true,
        help: "When on, public nav and browse de-emphasize Eat, Move, and Meet so ops can launch on stays and tours first.",
      },
      {
        key: "flags.catalogEatEnabled",
        label: "Show Eat category",
        type: "boolean",
        default: false,
        help: "Ignored when launch focus is off (all categories show).",
      },
      {
        key: "flags.catalogMoveEnabled",
        label: "Show Move category",
        type: "boolean",
        default: false,
      },
      {
        key: "flags.catalogMeetEnabled",
        label: "Show Meet category",
        type: "boolean",
        default: false,
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance & eTIMS",
    description: "KRA eTIMS queue for paid receipts — turns compliance into operator retention.",
    fields: [
      {
        key: "compliance.etimsEnabled",
        label: "eTIMS module",
        help: "When on, providers see the fiscal queue for paid receipts.",
        type: "boolean",
        default: true,
      },
      {
        key: "compliance.etimsMode",
        label: "eTIMS mode",
        type: "select",
        default: "manual",
        options: [
          { value: "manual", label: "Manual (queue + mark submitted)" },
          { value: "sandbox", label: "Sandbox (auto-assign sandbox KRA ref)" },
          { value: "live", label: "Live (POST to eTIMS API URL)" },
        ],
        help: "Sandbox auto-submits on queue. Live posts to the API URL with the API key. Cron also drains the queue.",
      },
      {
        key: "compliance.etimsApiUrl",
        label: "eTIMS API URL",
        type: "text",
        default: "",
        help: "HTTPS endpoint that accepts JSON receipt payloads (live mode). Leave blank for manual/sandbox.",
      },
      { key: "compliance.etimsApiKey", label: "eTIMS API key", type: "secret", default: "" },
      {
        key: "compliance.etimsAutoQueueOnPaid",
        label: "Auto-queue eTIMS on paid booking",
        type: "boolean",
        default: true,
        help: "When on, paid bookings for eTIMS-enabled providers enter the fiscal queue automatically.",
      },
      {
        key: "compliance.etimsMaxRetries",
        label: "eTIMS max retries",
        type: "number",
        default: 8,
        min: 1,
        max: 30,
        help: "Live mode: failed/retryable submissions fail permanently after this many attempts.",
      },
      {
        key: "compliance.etimsSellerTin",
        label: "Platform / seller TIN (optional)",
        type: "text",
        default: "",
        help: "Included in live eTIMS JSON envelope when set.",
      },
      {
        key: "compliance.etimsBranch",
        label: "eTIMS branch code",
        type: "text",
        default: "00",
      },
    ],
  },
  {
    id: "loyalty",
    label: "Loyalty",
    description: "How travellers earn and redeem points.",
    fields: [
      { key: "loyalty.kesPerPoint", label: "Spend to earn 1 point", type: "number", default: 100, prefix: "KES", min: 1, help: "e.g. 100 = 1 point per KES 100 paid." },
      { key: "loyalty.pointValue", label: "Value of 1 point", type: "number", default: 1, prefix: "KES", min: 0 },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email settings (requires an email provider to send).",
    fields: [
      { key: "notifications.fromEmail", label: "From address", type: "text", default: "no-reply@safarihub.co.ke" },
      { key: "notifications.adminRecipients", label: "Admin alert recipients", type: "text", default: "", help: "Comma-separated email addresses." },
      { key: "notifications.emailOnBooking", label: "Email on new booking", type: "boolean", default: true },
      { key: "notifications.emailOnPayout", label: "Email on payout", type: "boolean", default: true },
      { key: "notifications.emailOnInquiry", label: "Email on new inquiry", type: "boolean", default: true },
    ],
  },
  {
    id: "legal",
    label: "Legal & content",
    description: "Editable copy for your public policy pages.",
    fields: [
      { key: "legal.terms", label: "Terms of service", type: "textarea", default: "By using Safari Hub you agree to book in good faith, pay as agreed, and follow house rules set by each provider." },
      { key: "legal.privacy", label: "Privacy policy", type: "textarea", default: "We collect account details, booking data, and payment references needed to run the marketplace. We do not store full card numbers." },
      { key: "legal.about", label: "About", type: "textarea", default: "Safari Hub is Kenya's digital hospitality ecosystem — an operating system connecting hotels, restaurants, tours, transport and venues with travellers, suppliers, payments (M-Pesa) and compliance." },
      {
        key: "legal.cancellation",
        label: "Cancellation & refunds",
        type: "textarea",
        default:
          "Tourists may cancel free of charge before check-in / event start. Paid M-Pesa or card bookings are marked refunded in Safari Hub; actual money return follows your M-Pesa / card processor timeline. Cash-on-arrival reservations can be cancelled anytime before the visit. Providers may cancel with a reason — guests are notified.",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    description: "Account and access controls.",
    fields: [
      { key: "security.minPasswordLength", label: "Minimum password length", type: "number", default: 6, min: 6, max: 64 },
      { key: "security.sessionMinutes", label: "Session length", type: "number", default: 60, suffix: "minutes", min: 5, max: 1440, help: "Users are signed out after this long. Max 1440 (24 hours)." },
      { key: "security.allowSelfSignup", label: "Allow public sign-up", type: "boolean", default: true },
      {
        key: "security.bindSessionToTab",
        label: "Bind session to browser tab",
        type: "boolean",
        default: true,
        help: "When on, copying a dashboard link into a new tab does not stay signed in — that tab opens the landing page and asks for a fresh login. Other open tabs keep working.",
      },
    ],
  },
  {
    id: "sms",
    label: "SMS",
    description: "Text-message delivery for booking alerts and OTPs.",
    fields: [
      { key: "sms.enabled", label: "Enable SMS", type: "boolean", default: false },
      {
        key: "sms.provider",
        label: "Provider",
        type: "select",
        default: "africastalking",
        options: [
          { value: "africastalking", label: "Africa's Talking" },
          { value: "twilio", label: "Twilio" },
          { value: "custom", label: "Custom HTTP" },
        ],
      },
      { key: "sms.senderId", label: "Sender ID / header", type: "text", default: "", help: "Approved alphanumeric sender name shown on the SMS, e.g. SAFARIHUB." },
      { key: "sms.username", label: "Username / account SID", type: "text", default: "" },
      { key: "sms.apiKey", label: "API key / auth token", type: "secret", default: "" },
      { key: "sms.endpoint", label: "Custom endpoint URL", type: "text", default: "", help: "Only used for the Custom HTTP provider." },
    ],
  },
  {
    id: "email",
    label: "Email delivery",
    description: "How outgoing email is sent. Toggles for which events send are under Notifications.",
    fields: [
      {
        key: "email.provider",
        label: "Provider",
        type: "select",
        default: "smtp",
        options: [
          { value: "smtp", label: "SMTP" },
          { value: "resend", label: "Resend" },
          { value: "sendgrid", label: "SendGrid" },
          { value: "disabled", label: "Disabled" },
        ],
      },
      { key: "email.fromName", label: "From name", type: "text", default: "Safari Hub" },
      {
        key: "email.fromEmail",
        label: "From email",
        type: "text",
        default: "no-reply@safarihub.co.ke",
        help: "For Gmail SMTP, use the same address as GMAIL_USER / SMTP username.",
      },
      {
        key: "email.host",
        label: "SMTP host",
        type: "text",
        default: "",
        help: "e.g. smtp.gmail.com. Leave blank to use GMAIL_USER + GMAIL_APP_PASSWORD from .env (same as Trace).",
      },
      { key: "email.port", label: "SMTP port", type: "number", default: 587, min: 1, max: 65535 },
      { key: "email.secure", label: "Use TLS/SSL", type: "boolean", default: false },
      { key: "email.username", label: "SMTP username", type: "text", default: "" },
      {
        key: "email.password",
        label: "SMTP password",
        type: "secret",
        default: "",
        help: "Gmail: use an App Password (Google Account → Security), not your normal password.",
      },
      { key: "email.apiKey", label: "API key", type: "secret", default: "", help: "For Resend / SendGrid." },
    ],
  },
  {
    id: "integrations",
    label: "Integrations & keys",
    description: "Third-party API keys used across the platform.",
    fields: [
      { key: "integrations.googleMapsApiKey", label: "Google Maps API key", type: "secret", default: "", help: "Powers maps and location pickers on listings." },
      { key: "integrations.recaptchaSiteKey", label: "reCAPTCHA site key", type: "text", default: "" },
      { key: "integrations.recaptchaSecret", label: "reCAPTCHA secret", type: "secret", default: "" },
    ],
  },
  {
    id: "branding",
    label: "Branding",
    description: "Appearance of the marketplace.",
    fields: [
      { key: "branding.logoUrl", label: "Logo", type: "image", default: "", help: "Shown in the header and dashboards. PNG/SVG with transparent background works best." },
      { key: "branding.logoText", label: "Logo initials", type: "text", default: "SH", help: "Fallback shown when no logo image is uploaded." },
      { key: "branding.accentColor", label: "Accent color", type: "text", default: "#d4a017" },
      {
        key: "branding.heroHeadline",
        label: "Homepage headline",
        type: "text",
        default: "",
        help: "Leave blank to use the platform name.",
      },
      {
        key: "branding.heroSubheadline",
        label: "Homepage subheadline",
        type: "textarea",
        default: "",
        help: "Leave blank for a short line built from the platform and market names.",
      },
    ],
  },
];

const FIELD_INDEX: Map<string, SettingField> = new Map(
  SETTINGS_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f]),
);

export const DEFAULT_SETTINGS: Record<string, SettingValue> = Object.fromEntries(
  Array.from(FIELD_INDEX.values()).map((f) => [f.key, f.default]),
);

export function isSecretField(key: string): boolean {
  return FIELD_INDEX.get(key)?.type === "secret";
}

/** Coerce an arbitrary incoming value to the type declared for its field. */
export function coerceSetting(key: string, value: unknown): SettingValue | undefined {
  const field = FIELD_INDEX.get(key);
  if (!field) return undefined;
  switch (field.type) {
    case "boolean":
      return Boolean(value);
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n : (field.default as number);
    }
    default:
      return value == null ? "" : String(value);
  }
}

// Settings change rarely but are read on nearly every request (site header,
// booking/registration flows). Cache them in-process to avoid opening a DB
// connection per request, which was exhausting the connection pool.
const CACHE_TTL_MS = 30_000;
let cache: { value: Record<string, SettingValue>; expires: number } | null = null;

export function invalidateSettingsCache(): void {
  cache = null;
}

/** Full settings map with DB overrides merged over defaults. */
export async function getPlatformSettings(): Promise<Record<string, SettingValue>> {
  if (cache && cache.expires > Date.now()) return cache.value;

  const merged: Record<string, SettingValue> = { ...DEFAULT_SETTINGS };
  try {
    const { data: rows, error } = await db.from("Setting").select("key, value");
    if (error) throw error;
    for (const row of rows ?? []) {
      if (!FIELD_INDEX.has(row.key as string)) continue;
      const coerced = coerceSetting(row.key as string, row.value);
      if (coerced !== undefined) merged[row.key as string] = coerced;
    }
    cache = { value: merged, expires: Date.now() + CACHE_TTL_MS };
  } catch {
    // DB unavailable — fall back to defaults without caching the failure.
  }
  return merged;
}

export async function savePlatformSettings(
  patch: Record<string, unknown>,
): Promise<string[]> {
  const changed: string[] = [];
  const now = new Date().toISOString();
  const rows = Object.entries(patch)
    .map(([key, raw]) => {
      const value = coerceSetting(key, raw);
      if (value === undefined) return null;
      // Leaving a secret blank means "keep the existing value" — don't wipe it.
      if (isSecretField(key) && value === "") return null;
      changed.push(key);
      return { key, value, updatedAt: now };
    })
    .filter((x): x is { key: string; value: SettingValue; updatedAt: string } => x !== null);

  if (rows.length) {
    const { error } = await db.from("Setting").upsert(rows, { onConflict: "key" });
    if (error) throw error;
  }
  invalidateSettingsCache();
  return changed;
}

export function boolSetting(
  settings: Record<string, SettingValue>,
  key: string,
): boolean {
  return Boolean(settings[key]);
}

export function numberSetting(
  settings: Record<string, SettingValue>,
  key: string,
): number {
  const v = Number(settings[key]);
  return Number.isFinite(v) ? v : 0;
}
