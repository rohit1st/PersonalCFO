# Evals

Automated checks for the projection model (`model.js`). Run them before and after every change to the math, the assumptions or `config.js`.

```bash
node evals/run.js              # run everything (about 2 seconds, no installs needed; Node 18+)
node evals/run.js --only tax   # run evals whose name contains "tax"
node evals/run.js --update     # accept intended changes to the golden results
node evals/sensitivity.js      # outcome ranges as each assumption moves (example household)
node evals/sensitivity.js near_retirement_couple
node evals/sync-builtin.js     # after editing config.js: copy it into model.js's fallback
```

The same commands are available as `npm test`, `npm run sensitivity`, and so on.

A report is written to `evals/reports/latest.md` (and `sensitivity-*.md/.csv`).

## What's checked

| Suite | What it proves | Severity |
| --- | --- | --- |
| `01-math` | Compounding, inflation, today's-dollar conversion, loan amortization and payoff, withdrawal tax gross-up, tax estimates against hand calculations | Hard |
| `02-cashflow` | Timing rules: salaries stop at retirement, benefits start at their age, contributions stop, pre-tax vs Roth, spending windows, college years, repeating purchases, withdrawal order, required withdrawals (RMDs) | Hard |
| `03-simulation` | Monte Carlo sanity: same answer every run, worst ≤ mid ≤ best, more volatility widens the range, more spending / earlier retirement / lower returns never improve the odds, speed budget | Hard (speed is soft) |
| `04-benchmarks` | Plausibility against rules of thumb (4% / 3% / 6% withdrawal success, effective tax rate) | Soft |
| `05-golden` | Key outcomes for each test household, saved in `golden/golden.json`, so any change in results is visible | Hard |
| `06-reconcile` | An independent, plain year-by-year recalculation of a detailed couple (pay, taxes, saving, spending windows, mortgage, college, purchases, retirement, Social Security, shortfalls, RMDs) must match `project()` to the dollar in every year | Hard |
| `07-features` | Scenario details list exactly what changed (names, before → after, added/removed items); key result tiles match the projection; the newest "what's new" note matches `VERSION` in `sw.js` | Hard |
| `08-offline` | Runs the real `sw.js` against a stand-in browser: new versions download fresh files, a version never mixes with newer files, works offline, old caches are deleted; and the page applies waiting updates | Hard |
| `09-themes` | Every color theme in config.js has all its colors, passes WCAG AA contrast for text and buttons, keeps backgrounds light, and uses no purple | Hard |
| `10-life-ideas` | Future loans, homes bought or sold later, and each life idea (kid, new home, career break, windfall, stacking): right items, right years, original plan untouched, every idea works on every test household | Hard |

**Hard** evals must pass; the run exits with an error otherwise. **Soft** evals print warnings: they flag results worth a second look, not necessarily bugs.

## Test households (`personas.js`)

`example` (from config.js), `single_renter_early_career`, `underfunded_family`, `near_retirement_couple`, `already_retired_single`, `coast_fire_couple`, `high_earner_early_retirement`. Add more by copying one; then run `--update` once to save its golden results.

## Adding an eval

Add an object to the right file in `suites/`:

```js
{
  name: 'Plain-English statement of what should be true',
  why: 'Where the expected value comes from',
  severity: 'hard',            // or 'soft'
  run() {
    const s = flat({ ... });   // flat() = no market ups and downs, so results are exact
    const r = M.project(s);
    return approx(r.p50[10], expected, { rel: 1e-9 });   // or between(), truthy(); or an array of these
  }
}
```

Helpers in `lib.js`: `plan()`, `flat()`, `asset()`, `spendAlways()`, `retired()`, `approx()`, `between()`, `truthy()`. The year is fixed at 2026 so results don't drift with the calendar.

## When the golden results change

1. Run `node evals/run.js` and read which personas moved and by how much.
2. If the change is what you intended (new assumption, better tax table, model fix), run `node evals/run.js --update` and commit `golden/golden.json` with a note in `CHANGELOG.md`.
3. If it isn't, you've found a bug.

## Known findings

- With the default assumptions (6% typical return on non-retirement money, 12% ups and downs, 2.5% inflation), a classic 4% withdrawal from $1M over 30 years lasts in about 77% of simulated markets. Historical studies report roughly 90 to 95%. The gap comes from conservative defaults (about 3.4% typical real return) and from the model treating each year's return independently. The benchmark corridor is set to 75–99%, so it passes, but only just. If you raise default returns in config.js, expect this number to rise.
