/** Build a minimal iCalendar (.ics) attachment for a stay / package. */
export function buildBookingIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  url?: string;
}): string {
  const stamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(parseDay(opts.startISO));
  const dtEnd = formatIcsDate(parseDay(opts.endISO, true));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Safari Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(opts.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
  ];
  if (opts.description) {
    lines.push(`DESCRIPTION:${escapeIcs(opts.description)}`);
  }
  if (opts.location) {
    lines.push(`LOCATION:${escapeIcs(opts.location)}`);
  }
  if (opts.url) {
    lines.push(`URL:${escapeIcs(opts.url)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function parseDay(value: string, endExclusive = false): Date {
  const day = value.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (endExclusive) dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}

function formatIcsDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
