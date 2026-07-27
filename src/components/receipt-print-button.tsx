"use client";

export function ReceiptPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-lake px-3 py-2 text-sm font-semibold text-sand"
    >
      Print / save PDF
    </button>
  );
}
