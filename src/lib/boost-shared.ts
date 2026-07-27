export const BOOST_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type BoostPeriod = (typeof BOOST_PERIODS)[number];

export type BoostRequestStatus =
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export function isBoostPeriod(value: string): value is BoostPeriod {
  return (BOOST_PERIODS as readonly string[]).includes(value);
}

export function boostPeriodLabel(period: string): string {
  switch (period) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    default:
      return period;
  }
}

export function boostDurationMs(period: BoostPeriod): number {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case "DAILY":
      return day;
    case "WEEKLY":
      return 7 * day;
    case "MONTHLY":
      return 30 * day;
    case "YEARLY":
      return 365 * day;
  }
}

export function computeBoostWindow(
  period: BoostPeriod,
  from: Date = new Date(),
): { startsAt: Date; endsAt: Date } {
  const startsAt = from;
  const endsAt = new Date(startsAt.getTime() + boostDurationMs(period));
  return { startsAt, endsAt };
}
