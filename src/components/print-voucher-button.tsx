"use client";

export function PrintVoucherButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand transition hover:bg-lake-bright"
    >
      Print voucher
    </button>
  );
}
