# Ledgerline

A portfolio analytics dashboard in a single HTML file. No build step, no dependencies, no network calls.

**[Live demo](https://savvassoteriou223.github.io/Personal-Projects/ledgerline/)** · open `index.html` locally and it just works.

---

## Read this first: the data is synthetic

This is a **front-end and analytics project, not a live portfolio tracker.** There is no backend, no database and no
market data provider. Every price, quantity, cost basis and cash flow is invented, generated from a seeded
pseudo-random model in the browser at page load.

What is real is everything computed on top of that data:

| Real (computed in `index.html`) | Synthetic (invented inputs) |
|---|---|
| Time-weighted return, annualised, volatility, Sharpe | Prices, quantities, cost bases |
| Money-weighted IRR (bisection solver) | The 3-year daily return series (seeded PRNG) |
| Drawdown from a running high-water mark | The quarterly cash-flow ledger |
| Beta, up/down capture ratios | Fundamentals feeding the factor model |
| Correlation matrix (Pearson, from monthly returns) | Per-class volatility and factor loadings |
| Factor percentile ranks, blends, 9-criteria quality score | — |
| Concentration: weights, Herfindahl, effective N | — |
| FX translation and asset-vs-FX P&L attribution | FX rates and daily currency moves |
| Scenario shocks applied through position beta | The scenario definitions |

Point the same code at a real price feed and the analytics layer works unchanged. That separation is the point of the
project.

The **Pipeline** tab documents the architecture I would build behind this, and labels itself as such. It is a design,
not a running system.

---

## Why I built it

I wanted to write the parts of a portfolio tool that are easy to get quietly wrong, where the output still looks
plausible when the logic is broken:

- **Time-weighted vs money-weighted return.** TWRR strips out the timing of contributions and is the only figure
  comparable to an index; IRR answers "how did I do" and is dragged around by when cash arrived. The dashboard shows
  both, over the same window, and states the gap between them.
- **Not annualising a short window.** Compounding a three-week return up to a yearly rate turns a quiet month into a
  "−15% annualised" headline. Below a year, the annualised return and Sharpe render as `—`.
- **Asset move vs currency move.** In a book priced in four currencies, the base-currency value moves even when every
  share price is flat. Each position's day P&L splits into an asset leg and an FX leg that sum to the total.
- **Blending ranks, not raw values.** A factor composite that averages a P/E with a gross margin is meaningless. Every
  metric is converted to a percentile rank within the universe first, then blended.
- **Drift is not automatically a reason to trade.** Rebalancing on every deviation realises gains and pays spread, so
  the policy is a tolerance band. The Rebalance tab also prices the alternative: the contribution that reaches the same
  weights with no sales, and it says plainly when that number is too large to be realistic.
- **A finding is only useful if it is actionable.** The Decisions board deliberately does not raise a position that
  has fallen from its high but is still profitable: it is not a harvest candidate, and a board full of items reading
  "no action" teaches people to stop reading it.
- **One source of truth.** Each holding has a single generated price history; its sparkline, its 12-1 momentum and its
  realised volatility are all derived from that one array, so they cannot disagree. The same applies at the portfolio
  level: the equity curve, the monthly heatmap and the drawdown chart are three views of one series.

## What's in it

Nine tabs:

- **Overview** — portfolio value, six stat tiles, growth-of-100 against a 60/40 benchmark, allocation, currency
  exposure, movers
- **Decisions** — a rule engine over the current book: policy drift, position and currency concentration, factor rank
  on something already owned, and loss-harvest candidates. Items are raised only when a threshold breaches, and the
  table of every rule that ran is shown alongside, so a quiet board is visibly quiet rather than possibly broken
- **Holdings** — 20 positions across stocks, ETFs, crypto and cash; every column sortable; asset/FX day attribution;
  30-day sparklines; totals that tie out
- **Performance** — TWRR against IRR, the quarterly flow ledger, a monthly return heatmap, drawdown, benchmark
  comparison with capture ratios
- **Risk** — concentration and Herfindahl, a measured correlation matrix, variance contribution by position, five
  scenarios
- **Factors** — five-factor percentile model, value-vs-quality scatter, ranked table with tercile signals
- **Watchlist** — candidates not held, scored inside the same universe as the holdings so a composite is directly
  comparable, plus a pre-set entry price. A name has to clear both the quality screen and the price test to reach the
  buy zone
- **Rebalance** — drift from policy targets against a tolerance band, the trade list to correct it, and the
  contribution that would fix the weights without selling anything
- **Pipeline** — target architecture, job cadence, data-quality gates

Interactions: date-range filter that genuinely re-slices and recomputes every statistic, base-currency switch
(USD/EUR/GBP) that re-translates all values, asset-class filter, crosshair tooltips on time series, hover tooltips on
every mark, sortable tables, persisted light/dark theme, and table-view toggles on the charts.

## Charts

Hand-rolled SVG, no charting library. Deliberate choices worth naming:

- **One y-axis, always.** The portfolio and benchmark are indexed to 100 at the range start so a single scale carries
  both. Dual-axis charts invent correlations that aren't in the data.
- **The return heatmap uses a blue↔red diverging scale, not red/green,** with a neutral midpoint at zero, so it stays
  readable for colour-blind users. The categorical palette was checked against protanopia/deuteranopia/tritanopia
  simulation rather than by eye.
- **Every chart has a table view.** Colour is never the only way to read a value.
- Thin marks, hairline solid gridlines, 2px gaps separating stacked segments instead of borders, and direct labels only
  on endpoints and extremes.

## Running it

```bash
git clone https://github.com/savvassoteriou223/Personal-Projects.git
cd Personal-Projects/ledgerline
open index.html          # or double-click it; any modern browser
```

No `npm install`, no bundler, no server. The whole thing is one file.

## Stack

Vanilla JavaScript, hand-written SVG, CSS custom properties for theming. Zero runtime dependencies by choice: the
analytics are the substance, and I wanted them legible rather than buried behind a framework.

## Structure

Everything lives in `index.html`:

- Tokens and layout in the `<style>` block; light and dark are separate validated sets, not an inverted filter
- `mulberry32` / `gauss` — the seeded generator, so every load is identical
- `stats`, `ddSeries`, `monthlyReturns`, `capture`, `pearson`, `irr` — the analytics
- `buildFactors` — percentile ranking and blending
- `lineChart`, `stackBar`, `hBars`, `colChart`, `heatmap`, `scatter`, `sparkline` — the chart primitives
- `renderOverview` … `renderPipeline` — one renderer per tab

## Licence

MIT. See [LICENSE](LICENSE).
