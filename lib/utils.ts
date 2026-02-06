export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

/** Parse a YYYY-MM-DD string as local midnight (not UTC). */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function annualizedReturn(
  costBasis: number,
  currentValue: number,
  daysHeld: number
): number {
  if (costBasis <= 0 || daysHeld <= 0) return 0;
  const holdingPeriodReturn = (currentValue - costBasis) / costBasis;
  return Math.pow(1 + holdingPeriodReturn, 365 / daysHeld) - 1;
}
