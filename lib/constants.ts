export const ACCOUNT_TYPES = [
  "Traditional 401k",
  "Roth 401k",
  "Traditional IRA",
  "Roth IRA",
  "Investment",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TAX_DEFERRED_DEFAULTS: Record<AccountType, boolean> = {
  "Traditional 401k": true,
  "Roth 401k": false,
  "Traditional IRA": true,
  "Roth IRA": false,
  Investment: false,
};

export const INSTITUTIONS = [
  "Fidelity",
  "Charles Schwab",
  "Vanguard",
  "TD Ameritrade",
  "E*TRADE",
  "Merrill Lynch",
  "Morgan Stanley",
  "JP Morgan",
  "Goldman Sachs",
  "UBS",
  "Wells Fargo Advisors",
  "Interactive Brokers",
  "Robinhood",
  "Ally Invest",
  "Ameriprise",
  "Edward Jones",
  "Raymond James",
  "LPL Financial",
  "Betterment",
  "Wealthfront",
  "SoFi",
  "T. Rowe Price",
  "TIAA",
  "Principal Financial",
  "Northwestern Mutual",
] as const;

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "HKD",
  "SGD",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "KRW",
  "INR",
  "BRL",
  "MXN",
  "ZAR",
  "TWD",
] as const;

export type Currency = (typeof CURRENCIES)[number];
