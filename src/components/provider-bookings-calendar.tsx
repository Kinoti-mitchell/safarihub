"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProviderBookingRow } from "@/app/provider/bookings/bookings-client";

function dayKey(value: string): string {
  return value.slice(0, 10);
}

function formatMonthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function statusTone(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-lake/15 text-lake";
    case "PENDING":
    case "RESERVED":
      return "bg-sun/30 text-ink";
    case "CANCELLED":
    case "NO_SHOW":
      return "bg-red-50 text-red-700";
    case "COMPLETED":
      return "bg-sand-deep/50 text-ink-muted";
    default:
      return "bg-sand text-ink";
  }
}

export function ProviderBookingsCalendar({
  bookings,
}: {
  bookings: ProviderBookingRow[];
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, ProviderBookingRow[]>();
    for (const b of bookings) {
      if (["CANCELLED"].includes(b.status)) continue;
      const start = dayKey(b.checkIn);
      const end = dayKey(b.checkOut);
      const startDate = new Date(`${start}T12:00:00`);
      const endDate = new Date(`${end}T12:00:00`);
      // Day-use / same-day tours: pin on check-in only
      if (
        b.stayType === "DAYUSE" ||
        Number.isNaN(endDate.getTime()) ||
        endDate.getTime() <= startDate.getTime()
      ) {
        const list = map.get(start) || [];
        list.push(b);
        map.set(start, list);
        continue;
      }
      for (
        let d = new Date(startDate);
        d < endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const list = map.get(key) || [];
        list.push(b);
        map.set(key, list);
      }
    }
    return map;
  }, [bookings]);

  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ key: `pad-${i}`, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key, day: d });
  }

  const selectedDefault = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [selected, setSelected] = useState(selectedDefault);
  const selectedBookings = byDay.get(selected) || [];

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-line bg-white/70 p-4 lg:col-span-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              setCursor((c) => {
                const m = c.month - 1;
                return m < 0
                  ? { year: c.year - 1, month: 11 }
                  : { year: c.year, month: m };
              })
            }
            className="rounded-md border border-line px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <p className="font-display text-lg font-semibold text-lake">
            {formatMonthTitle(cursor.year, cursor.month)}
          </p>
          <button
            type="button"
            onClick={() =>
              setCursor((c) => {
                const m = c.month + 1;
                return m > 11
                  ? { year: c.year + 1, month: 0 }
                  : { year: c.year, month: m };
              })
            }
            className="rounded-md border border-line px-3 py-1.5 text-sm"
          >
            →
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            if (cell.day == null) {
              return <div key={cell.key} className="min-h-16" />;
            }
            const count = byDay.get(cell.key)?.length || 0;
            const isSelected = cell.key === selected;
            const isToday = cell.key === selectedDefault;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelected(cell.key)}
                className={`min-h-16 rounded-lg border p-1.5 text-left transition ${
                  isSelected
                    ? "border-lake bg-lake/10"
                    : "border-line/70 bg-white hover:border-lake-bright"
                } ${isToday && !isSelected ? "ring-1 ring-sun/60" : ""}`}
              >
                <span className="text-xs font-semibold text-ink">{cell.day}</span>
                {count > 0 && (
                  <span className="mt-1 block truncate rounded bg-lake/15 px-1 py-0.5 text-[0.65rem] font-medium text-lake">
                    {count} booking{count === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white/70 p-4 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {new Date(`${selected}T12:00:00`).toLocaleDateString("en-KE", {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        <ul className="mt-3 space-y-2">
          {selectedBookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/provider/bookings/${b.id}`}
                className="block rounded-lg border border-line px-3 py-2 transition hover:border-lake-bright hover:bg-sand/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {b.listing?.title || b.reference}
                  </p>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${statusTone(b.status)}`}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {b.guestName || b.traveler?.name || "Guest"} · {b.reference}
                  {b.roomsBooked
                    ? ` · ${b.roomsBooked} seat${b.roomsBooked === 1 ? "" : "s"}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
          {!selectedBookings.length && (
            <li className="py-8 text-center text-sm text-ink-muted">
              No bookings on this day.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
