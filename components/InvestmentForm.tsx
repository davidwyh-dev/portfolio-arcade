"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RetroInput } from "./ui/RetroInput";
import { RetroSelect } from "./ui/RetroSelect";
import { RetroButton } from "./ui/RetroButton";
import { RetroModal } from "./ui/RetroModal";
import { CURRENCIES } from "@/lib/constants";

interface InvestmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  editInvestment?: {
    _id: Id<"investments">;
    accountId: Id<"accounts">;
    ticker: string;
    dateAcquired: string;
    dateSold?: string;
    units: number;
    unitPrice: number;
    currency: string;
  };
}

export function InvestmentForm({
  isOpen,
  onClose,
  editInvestment,
}: InvestmentFormProps) {
  const accounts = useQuery(api.accounts.list);
  const createInvestment = useMutation(api.investments.create);
  const updateInvestment = useMutation(api.investments.update);
  const updatePrice = useMutation(api.investments.updatePrice);
  const searchTicker = useAction(api.marketData.searchTicker);
  const fetchQuote = useAction(api.marketData.fetchQuote);
  const fetchSingleRate = useAction(api.fxRates.fetchSingleRate);

  const [ticker, setTicker] = useState("");
  const [tickerResults, setTickerResults] = useState<
    { symbol: string; description: string }[]
  >([]);
  const [showResults, setShowResults] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [dateAcquired, setDateAcquired] = useState("");
  const [dateSold, setDateSold] = useState("");
  const [units, setUnits] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editInvestment) {
      setTicker(editInvestment.ticker);
      setAccountId(editInvestment.accountId);
      setDateAcquired(editInvestment.dateAcquired);
      setDateSold(editInvestment.dateSold ?? "");
      setUnits(editInvestment.units.toString());
      setUnitPrice(editInvestment.unitPrice.toString());
      setCurrency(editInvestment.currency);
    } else {
      setTicker("");
      setAccountId(accounts?.[0]?._id ?? "");
      setDateAcquired("");
      setDateSold("");
      setUnits("");
      setUnitPrice("");
      setCurrency("USD");
    }
    setError("");
    setTickerResults([]);
    setShowResults(false);
  }, [editInvestment, isOpen, accounts]);

  const handleTickerSearch = useCallback(
    async (query: string) => {
      setTicker(query);
      if (query.length < 1) {
        setTickerResults([]);
        setShowResults(false);
        return;
      }
      try {
        const results = await searchTicker({ query });
        setTickerResults(results);
        setShowResults(true);
      } catch {
        // Silently fail on search errors
      }
    },
    [searchTicker]
  );

  const handleSelectTicker = (symbol: string) => {
    setTicker(symbol);
    setShowResults(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !accountId || !dateAcquired || !units || !unitPrice) {
      setError("Please fill in all required fields");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const parsedUnits = parseFloat(units);
      const parsedUnitPrice = parseFloat(unitPrice);
      const costBasis = parsedUnitPrice * parsedUnits;

      const investmentData = {
        accountId: accountId as Id<"accounts">,
        ticker: ticker.toUpperCase(),
        dateAcquired,
        dateSold: dateSold || undefined,
        units: parsedUnits,
        unitPrice: parsedUnitPrice,
        currency,
      };

      let investmentId: Id<"investments">;
      if (editInvestment) {
        await updateInvestment({ id: editInvestment._id, ...investmentData });
        investmentId = editInvestment._id;
      } else {
        investmentId = await createInvestment(investmentData);
      }

      // Automatically fetch current price & FX rate so Value (USD) is
      // populated immediately instead of requiring a manual refresh.
      try {
        const quote = await fetchQuote({ ticker: investmentData.ticker });
        let priceUsd = quote.price;
        let fxRate = 1;

        if (investmentData.currency !== "USD") {
          try {
            const { rate } = await fetchSingleRate({
              from: investmentData.currency,
              to: "USD",
            });
            fxRate = rate;
            priceUsd = quote.price * rate;
          } catch {
            // If FX lookup fails, fall back to raw price (assumes USD)
          }
        }

        const currentValueUsd = priceUsd * investmentData.units;
        const costBasisUsd = costBasis * fxRate;
        await updatePrice({
          id: investmentId,
          currentPriceUsd: priceUsd,
          currentValueUsd,
          costBasisUsd,
        });
      } catch {
        // Price fetch failed — value will be populated on next manual refresh
      }

      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save investment"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <RetroModal
      isOpen={isOpen}
      onClose={onClose}
      title={editInvestment ? "EDIT INVESTMENT" : "NEW INVESTMENT"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Ticker with autocomplete */}
        <div className="relative">
          <RetroInput
            label="TICKER"
            value={ticker}
            onChange={(e) => void handleTickerSearch(e.target.value)}
            onFocus={() => tickerResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="AAPL"
            required
          />
          {showResults && tickerResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded border border-border-dim bg-surface shadow-lg">
              {tickerResults.map((result) => (
                <button
                  key={result.symbol}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-light"
                  onMouseDown={() => handleSelectTicker(result.symbol)}
                >
                  <span className="font-mono text-sm font-medium text-neon-cyan">
                    {result.symbol}
                  </span>
                  <span className="truncate font-terminal text-sm text-foreground/40">
                    {result.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <RetroSelect
          label="ACCOUNT"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={
            accounts?.map((a) => ({ value: a._id, label: a.name })) ?? []
          }
          placeholder="Select account..."
        />

        <div className="grid grid-cols-2 gap-3">
          <RetroInput
            label="DATE ACQUIRED"
            type="date"
            value={dateAcquired}
            onChange={(e) => setDateAcquired(e.target.value)}
            required
          />
          <RetroInput
            label="DATE SOLD (OPTIONAL)"
            type="date"
            value={dateSold}
            onChange={(e) => setDateSold(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <RetroInput
            label="UNITS"
            type="number"
            step="any"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="100"
            required
          />
          <RetroInput
            label="UNIT PRICE"
            type="number"
            step="any"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="150.00"
            required
          />
        </div>

        {units && unitPrice && (
          <div className="rounded border border-border-dim bg-surface px-3 py-2">
            <span className="font-terminal text-sm text-foreground/40">
              COST BASIS:{" "}
            </span>
            <span className="font-mono text-sm font-medium text-neon-green">
              {(parseFloat(units) * parseFloat(unitPrice)).toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              )}{" "}
              {currency}
            </span>
          </div>
        )}

        <RetroSelect
          label="CURRENCY"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />

        {error && (
          <p className="font-terminal text-sm text-neon-red">{error}</p>
        )}

        <div className="mt-2 flex gap-3">
          <RetroButton type="submit" disabled={loading} className="flex-1">
            {loading ? "SAVING..." : editInvestment ? "UPDATE" : "CREATE"}
          </RetroButton>
          <RetroButton
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            CANCEL
          </RetroButton>
        </div>
      </form>
    </RetroModal>
  );
}
