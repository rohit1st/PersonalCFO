/*
  4. Plausibility: compare against well-known rules of thumb.
  These are corridors, not exact answers (severity: soft). A failure means
  "look at this", not necessarily "this is wrong".
*/
'use strict';
const { M, plan, asset, spendAlways, between } = require('../lib');

// A retiree at 65 planning to 95 (30 years) withdrawing a share of $1M each year, rising with inflation.
// Assumes a balanced portfolio: 6% typical return, 12% ups and downs, 2.5% inflation, taxes ignored.
function withdrawal(rate, over = {}) {
  const s = plan({
    people: { p1: { name: 'R', age: 65, retireAge: 60, planToAge: 95 } },
    assets: [asset('nonretirement', 1e6)],
    spending: [spendAlways(1e6 * rate)],
    assumptions: { nonReturn: 6, volatility: 12, inflation: 2.5, ...over }
  });
  return M.project(s).success;
}

module.exports = [
  {
    name: '4% rule: $40k a year from $1M for 30 years succeeds most of the time',
    why: 'Historical studies (e.g. the Trinity study) put a 30-year 4% withdrawal from a balanced portfolio at roughly 85 to 95% success.',
    severity: 'soft',
    run() { return between(withdrawal(0.04), 0.75, 0.99); }
  },
  {
    name: '3% withdrawal is very safe',
    why: 'Almost always lasts 30 years.',
    severity: 'soft',
    run() { return between(withdrawal(0.03), 0.93, 1); }
  },
  {
    name: '6% withdrawal often fails',
    why: 'Commonly cited as roughly a coin flip or worse over 30 years.',
    severity: 'soft',
    run() { return between(withdrawal(0.06), 0.15, 0.65); }
  },
  {
    name: 'Stock-heavy volatility (18%) lowers 4% success versus balanced (12%)',
    why: 'Same typical return, bigger swings, more sequence risk.',
    severity: 'soft',
    run() { const a = withdrawal(0.04), b = withdrawal(0.04, { volatility: 18 }); return { pass: b < a, detail: `12%: ${a}, 18%: ${b}` }; }
  },
  {
    name: 'Effective tax rate on $150k single pay is in a normal range',
    why: 'Federal + payroll + 5% state on $150k single is usually around 25 to 32%.',
    severity: 'soft',
    run() { const t = M.estimateTaxes({ wages: [150000], other: 0, benefits: 0, pretax: 0, filing: 'single', stateRate: 0.05 }); return between(t / 150000, 0.25, 0.32); }
  }
];
