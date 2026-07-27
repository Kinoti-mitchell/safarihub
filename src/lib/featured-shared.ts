/** Shared Feature / carousel duration helpers (safe for client + server). */

export const FEATURE_PERIODS = [
  "DAYS_3",
  "WEEKLY",
  "DAYS_14",
  "MONTHLY",
  "QUARTERLY",
] as const;

export type FeaturePeriod = (typeof FEATURE_PERIODS)[number];

export function isFeaturePeriod(value: string): value is FeaturePeriod {
  return (FEATURE_PERIODS as readonly string[]).includes(value);
}

export function featurePeriodLabel(period: FeaturePeriod): string {
  switch (period) {
    case "DAYS_3":
      return "3 days";
    case "WEEKLY":
      return "1 week";
    case "DAYS_14":
      return "2 weeks";
    case "MONTHLY":
      return "1 month";
    case "QUARTERLY":
      return "3 months";
  }
}

export function featureDurationMs(period: FeaturePeriod): number {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case "DAYS_3":
      return 3 * day;
    case "WEEKLY":
      return 7 * day;
    case "DAYS_14":
      return 14 * day;
    case "MONTHLY":
      return 30 * day;
    case "QUARTERLY":
      return 90 * day;
  }
}

export function computeFeatureWindow(
  period: FeaturePeriod,
  from: Date = new Date(),
): { featuredAt: Date; featuredEndsAt: Date } {
  return {
    featuredAt: from,
    featuredEndsAt: new Date(from.getTime() + featureDurationMs(period)),
  };
}
