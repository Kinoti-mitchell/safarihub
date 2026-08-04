"use client";

import { useState } from "react";

/** WhatsApp / copy / native share for confirmation vouchers. */
export function BookingShareActions({
  reference,
  title,
  whenLabel,
  pageUrl,
  guestPhone,
}: {
  reference: string;
  title: string;
  whenLabel: string;
  pageUrl: string;
  guestPhone?: string | null;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const text = [
    `Safari Hub booking ${reference}`,
    title,
    whenLabel,
    pageUrl,
  ].join("\n");

  const waHref = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const smsHref = guestPhone
    ? `sms:${guestPhone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(text)}`
    : `sms:?body=${encodeURIComponent(text)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setMsg("Link copied");
    } catch {
      setMsg("Could not copy — select the URL from the address bar");
    }
  }

  async function nativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Booking ${reference}`, text, url: pageUrl });
        return;
      }
      await copyLink();
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 print:hidden">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
      >
        Share on WhatsApp
      </a>
      <a
        href={smsHref}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
      >
        SMS voucher
      </a>
      <button
        type="button"
        onClick={() => void nativeShare()}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
      >
        Share…
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
      >
        Copy link
      </button>
      {msg && <p className="w-full text-xs text-lake-bright">{msg}</p>}
    </div>
  );
}
