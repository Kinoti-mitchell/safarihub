"use client";

import { useState } from "react";
import { addTripStop } from "@/lib/trip-storage";

export function AddToTripButton({
  listingId,
  title,
  href,
  kind,
  checkIn,
  checkOut,
}: {
  listingId: string;
  title: string;
  href: string;
  kind?: string;
  checkIn?: string;
  checkOut?: string;
}) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addTripStop({ listingId, title, href, kind, checkIn, checkOut });
        setDone(true);
      }}
      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
    >
      {done ? "Added to trip ✓" : "Add to trip"}
    </button>
  );
}
