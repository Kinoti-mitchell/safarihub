/**
 * Card helpers for the booking checkout form.
 * Full PAN is validated in-memory only — never persisted. We store brand + last4
 * on the Payment.providerRef for receipts.
 */

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export type CardInput = {
  number: string;
  name: string;
  expiry: string; // MM/YY or MM/YYYY
  cvc: string;
};

export type CardChargeResult =
  | {
      ok: true;
      brand: CardBrand;
      last4: string;
      providerRef: string;
    }
  | { ok: false; error: string };

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function detectBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6(?:011|5)/.test(n)) return "discover";
  return "unknown";
}

export function formatCardNumber(value: string): string {
  const n = digitsOnly(value).slice(0, 19);
  const brand = detectBrand(n);
  if (brand === "amex") {
    // 4-6-5
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)]
      .filter(Boolean)
      .join(" ");
  }
  return n.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatExpiry(value: string): string {
  const n = digitsOnly(value).slice(0, 4);
  if (n.length <= 2) return n;
  return `${n.slice(0, 2)}/${n.slice(2)}`;
}

/** Luhn check for card numbers. */
export function luhnOk(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 13 || n.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function parseExpiry(expiry: string): { month: number; year: number } | null {
  const m = expiry.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  let year = Number(m[2]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function expiryValid(expiry: string, now = new Date()): boolean {
  const parsed = parseExpiry(expiry);
  if (!parsed) return false;
  const { month, year } = parsed;
  const expEnd = new Date(year, month, 0, 23, 59, 59); // last day of month
  return expEnd >= now;
}

export function validateCardInput(card: CardInput): string | null {
  const name = card.name.trim();
  if (name.length < 2) return "Enter the name on the card";
  const number = digitsOnly(card.number);
  if (!luhnOk(number)) return "Enter a valid card number";
  if (!expiryValid(card.expiry)) return "Card is expired or expiry is invalid";
  const brand = detectBrand(number);
  const cvc = digitsOnly(card.cvc);
  const cvcLen = brand === "amex" ? 4 : 3;
  if (cvc.length !== cvcLen) {
    return brand === "amex" ? "Enter the 4-digit CVV" : "Enter the 3-digit CVV";
  }
  return null;
}

/** Well-known Stripe-style test decline number — used in sandbox. */
const DECLINE_NUMBERS = new Set([
  "4000000000000002",
  "4000000000009995",
  "4000000000009987",
]);

/**
 * Sandbox card charge: validates details, never stores the full PAN, and
 * confirms or declines using well-known test numbers. Manual mode skips this
 * and waits for staff confirmation via POST /api/bookings/[id]/card.
 */
export function chargeCardSandbox(
  card: CardInput,
  opts: { amount: number; reference: string },
): CardChargeResult {
  const err = validateCardInput(card);
  if (err) return { ok: false, error: err };

  const number = digitsOnly(card.number);
  const brand = detectBrand(number);
  const last4 = number.slice(-4);

  if (DECLINE_NUMBERS.has(number)) {
    return {
      ok: false,
      error: "Your card was declined. Try another card or pay with M-Pesa.",
    };
  }

  // Insufficient funds test pattern (Stripe)
  if (number === "4000000000009995") {
    return { ok: false, error: "Insufficient funds on this card" };
  }

  return {
    ok: true,
    brand,
    last4,
    providerRef: `CARD-${brand.toUpperCase()}-${last4}-${opts.reference}`,
  };
}

export function brandLabel(brand: CardBrand): string {
  switch (brand) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "Amex";
    case "discover":
      return "Discover";
    default:
      return "Card";
  }
}
