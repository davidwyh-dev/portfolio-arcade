# Benchmark ETF Comparison Feature

## Overview
Added a benchmark comparison feature that allows users to compare their portfolio performance against major market ETFs one at a time using a dropdown selector.

## Available Benchmarks
- **S&P 500** - VOO (Vanguard S&P 500 ETF) - Default selection
- **NASDAQ-100** - QQQ (Invesco QQQ Trust)
- **Dow Jones** - DIA (SPDR Dow Jones Industrial Average ETF)

## How It Works

### User Interface
1. A **BENCHMARK** dropdown selector is displayed in the Dashboard top bar next to the valuation date
2. Users can select which benchmark they want to compare against (defaults to S&P 500)
3. Each of the four metric cards displays an additional caption showing the corresponding benchmark value

### Calculation Method
For each investment in your portfolio:
1. Takes the cost basis (in USD) at the date of acquisition
2. Calculates how many shares of the selected benchmark ETF could have been purchased with that same amount on that date (using adjusted closing price)
3. Tracks the value of those hypothetical benchmark shares over time
4. Calculates all metrics (total value, time-weighted return, volatility, sharpe ratio) for the benchmark portfolio

This provides a fair comparison showing what each metric would be if you had invested the same amounts in the benchmark ETF at the same times.

### Displayed Metrics
Each card shows both your portfolio's metric and the benchmark's metric:

1. **Portfolio Value Card**
   - Your total portfolio value
   - Unrealized gain/loss
   - Realized gain/loss (if enabled)
   - Benchmark total value (in lighter text)

2. **Time-Weighted Return Card**
   - Your annualized time-weighted return
   - Your cost basis
   - Benchmark annualized time-weighted return (in lighter text)

3. **Volatility Card**
   - Your annualized volatility (standard deviation)
   - Benchmark annualized volatility (in lighter text)

4. **Risk-Adjusted Return Card**
   - Your Sharpe ratio
   - Benchmark Sharpe ratio (in lighter text)

## Technical Implementation

### Backend (`convex/portfolio.ts`)

#### `getSummary` Query
- Updated to calculate comprehensive benchmark metrics
- Added `benchmarks` object containing metrics for VOO, QQQ, and DIA
- Calculates for each benchmark:
  - Total value (what the portfolio would be worth)
  - Time-weighted return (annualized)
  - Annualized volatility (standard deviation)
  - Sharpe ratio (risk-adjusted return)

#### `getHistoricalValues` Query
- Updated to accept optional `benchmarkTicker` parameter
- Fetches historical prices for the selected benchmark ETF
- Calculates benchmark time-weighted return for each date in the portfolio history
- Returns both portfolio and benchmark time-weighted returns in the data array
- Uses the same investment dates and amounts to ensure fair comparison

### Frontend

#### Dashboard (`app/dashboard/page.tsx`)
- Manages shared benchmark selection state
- Passes benchmark selection to both `PortfolioSummary` and `PortfolioChart`
- Ensures synchronized view across all components

#### Summary Cards (`components/PortfolioSummary.tsx`)
- Accepts `selectedBenchmark` and `onBenchmarkChange` props
- Added dropdown selector in the TopBar component
- Automatically fetches benchmark historical data if missing or stale (older than 24 hours)
- Displays selected benchmark metrics as captions in each card (lighter text color)
- Benchmark captions only show when data is available (totalValue > 0)

#### Chart (`components/PortfolioChart.tsx`)
- Accepts `selectedBenchmark` prop
- Queries historical data with the selected benchmark
- Displays benchmark time-weighted return as a magenta dotted line
- Uses right Y-axis (same as portfolio return) for comparison
- Updates dynamically when benchmark selection changes
- Legend shows both portfolio and benchmark returns

## Data Requirements

The feature requires historical price data for VOO, QQQ, and DIA. This data is:
- Automatically fetched when the Dashboard loads for the first time
- Refreshed if cached data is older than 24 hours
- Cached for performance

## Chart Integration

The Portfolio Chart now includes the selected benchmark's time-weighted return:
- **Visual Style**: Magenta dotted line for effective visual contrast
- **Dynamic Updates**: When you change the benchmark selection in the dropdown, the chart automatically updates to show that benchmark's performance
- **Synchronized View**: Both the summary cards and chart use the same benchmark selection
- **Legend**: Chart legend shows both "Time-Weighted Return" (your portfolio) and the benchmark name (e.g., "S&P 500 Benchmark")

## User Experience

- Clean, single-comparison interface (only one benchmark shown at a time)
- Easy switching between benchmarks via dropdown
- Benchmark values displayed in subtle, lighter text in cards to not distract from main metrics
- Benchmark line displayed as magenta dotted line in chart for clear visual distinction
- Benchmark data loads automatically in the background
- Graceful handling when benchmark data is not yet available (captions hidden until data loads)
- Synchronized selection between summary cards and chart
