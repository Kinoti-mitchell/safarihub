"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BookingSupportButton({
  bookingId,
  accessToken,
}: {
  bookingId: string;
  accessToken?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openThread() {
    setBusy(true);
    setError(null);
    try {
      const qs = accessToken ? `?t=${encodeURIComponent(accessToken)}` : "";
      const message = window.prompt(
        "Message to the host / support (optional):",
        "I need help with this booking.",
      );
      if (message == null) {
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/support${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not open support thread");
        return;
      }
      if (body.href) router.push(body.href as string);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void openThread()}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
      >
        {busy ? "Opening…" : "Message host / support"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
