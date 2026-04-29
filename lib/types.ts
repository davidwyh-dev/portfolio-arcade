export interface Account {
  _id: string;
  name: string;
  accountType: string;
  taxDeferred: boolean;
  institution: string;
}

export interface Investment {
  _id: string;
  accountId: string;
  ticker: string;
  dateAcquired: string;
  dateSold?: string;
  units: number;
  unitPrice?: number;
  costBasis: number;
  currency: string;
  currentPriceUsd?: number;
  currentValueUsd?: number;
  costBasisUsd?: number;
  soldUnitPrice?: number;
  soldValueUsd?: number;
  lastPriceUpdate?: string;
}

export interface InvestmentWithAccount extends Investment {
  accountName: string;
}

export type Benchmark = "VOO" | "QQQ" | "DIA";

export const BENCHMARK_TICKERS: readonly Benchmark[] = ["VOO", "QQQ", "DIA"] as const;

export interface HistoricalPricePoint {
  date: string;
  adjClose: number;
}

export interface BenchmarkSummary {
  totalValue: number;
  timeWeightedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
}

export interface SummaryResult {
  totalValue: number;
  totalCost: number;
  realizedGainLoss: number;
  timeWeightedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  holdings: number;
  valuationDate: string;
  benchmarks: Record<Benchmark, BenchmarkSummary>;
}

export interface HistoricalValuePoint {
  date: string;
  totalValue: number;
  totalCost: number;
  gainLoss: number;
  timeWeightedReturn: number;
  benchmarkTimeWeightedReturn: number;
}
