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

/**
 * Compute a time-weighted return by geometrically linking an array of
 * holding-period returns (HPRs).
 *
 *   TWR = (1 + HPR_1) * (1 + HPR_2) * ... * (1 + HPR_n) - 1
 *
 * Returns 0 when the array is empty.
 */
export function timeWeightedReturn(hprs: number[]): number {
  if (hprs.length === 0) return 0;
  const product = hprs.reduce((acc, hpr) => acc * (1 + hpr), 1);
  return product - 1;
}

/**
 * Annualize a cumulative return over a given number of days.
 *
 *   Annualized = (1 + cumulative)^(365 / days) - 1
 */
export function annualizeReturn(
  cumulativeReturn: number,
  totalDays: number,
): number {
  if (totalDays <= 0) return 0;
  return Math.pow(1 + cumulativeReturn, 365 / totalDays) - 1;
}
