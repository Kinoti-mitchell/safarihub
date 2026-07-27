"use client";

import {
  brandLabel,
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  type CardBrand,
} from "@/lib/card";

export type CardFormValues = {
  number: string;
  name: string;
  expiry: string;
  cvc: string;
};

export function CardPaymentForm({
  values,
  onChange,
  amount,
}: {
  values: CardFormValues;
  onChange: (next: CardFormValues) => void;
  amount?: number;
}) {
  const brand: CardBrand = detectBrand(values.number);
  const last4 = digitsOnly(values.number).slice(-4);
  const displayNumber =
    formatCardNumber(values.number) || "•••• •••• •••• ••••";
  const displayExpiry = values.expiry || "MM/YY";
  const displayName = values.name.trim().toUpperCase() || "NAME ON CARD";

  return (
    <div className="space-y-3 rounded-xl border border-line bg-gradient-to-br from-lake/5 to-sun/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Pay with card</p>
        <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted">
          <span className={brand === "visa" ? "text-lake" : ""}>Visa</span>
          <span>·</span>
          <span className={brand === "mastercard" ? "text-lake" : ""}>
            Mastercard
          </span>
        </div>
      </div>

      {/* Preview card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a3a5c] via-[#0c3d3a] to-[#0a2a28] p-5 text-sand shadow-md">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 size-32 rounded-full bg-sun/20 blur-2xl"
        />
        <div className="relative flex items-start justify-between">
          <div className="h-8 w-11 rounded-md bg-gradient-to-br from-sun/90 to-sun/40 opacity-90" />
          <span className="text-xs font-semibold tracking-widest text-sand/80">
            {brandLabel(brand)}
          </span>
        </div>
        <p className="relative mt-6 font-mono text-lg tracking-[0.18em]">
          {digitsOnly(values.number).length >= 4
            ? displayNumber
            : "•••• •••• •••• ••••"}
          {digitsOnly(values.number).length > 0 &&
            digitsOnly(values.number).length < 4 &&
            ` ${last4}`}
        </p>
        <div className="relative mt-5 flex items-end justify-between gap-3 text-xs">
          <div>
            <p className="text-[0.6rem] uppercase tracking-wider text-sand/50">
              Cardholder
            </p>
            <p className="mt-0.5 truncate font-medium tracking-wide">
              {displayName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.6rem] uppercase tracking-wider text-sand/50">
              Expires
            </p>
            <p className="mt-0.5 font-mono font-medium">{displayExpiry}</p>
          </div>
        </div>
      </div>

      <label className="block text-sm font-medium text-ink">
        Card number
        <input
          name="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={values.number}
          onChange={(e) =>
            onChange({ ...values, number: formatCardNumber(e.target.value) })
          }
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
          required
        />
      </label>

      <label className="block text-sm font-medium text-ink">
        Name on card
        <input
          name="cardName"
          autoComplete="cc-name"
          placeholder="As shown on card"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-ink">
          Expiry
          <input
            name="cardExpiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={values.expiry}
            onChange={(e) =>
              onChange({ ...values, expiry: formatExpiry(e.target.value) })
            }
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
            required
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          CVV
          <input
            name="cardCvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            value={values.cvc}
            onChange={(e) =>
              onChange({
                ...values,
                cvc: digitsOnly(e.target.value).slice(0, 4),
              })
            }
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
            required
          />
        </label>
      </div>

      {amount != null && amount > 0 && (
        <p className="text-xs text-ink-muted">
          You will be charged{" "}
          <span className="font-semibold text-ink">
            KES {amount.toLocaleString()}
          </span>{" "}
          when you confirm.
        </p>
      )}
      <p className="text-[0.7rem] text-ink-muted">
        Card details are used to complete payment only — the full number is never
        stored. Test Visa: 4242 4242 4242 4242 · any future expiry · any CVV.
      </p>
    </div>
  );
}
