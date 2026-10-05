/*
  1. Core math: results checked against formulas worked out by hand.
  These must always pass (severity: hard).
*/
'use strict';
const { M, NWPModel, CONFIG, YEAR, flat, plan, retired, asset, spendAlways, approx, truthy } = require('../lib');

const ESTIMATE = (o) => M.estimateTaxes({ other: 0, benefits: 0, pretax: 0, stateRate: 0.05, ...o });

module.exports = [
  {
    name: 'Compounding: $100k at 6.5% for 10 years, no ups and downs',
    why: 'The mid case should compound at exactly the entered return when there is no volatility. (Roth, so no required withdrawals at 75.)',
    run() {
      const s = flat({ people: retired(65, 75), assets: [asset('retirement', 100000, { taxType: 'roth' })], assumptions: { retReturn: 6.5 } });
      return approx(M.project(s, 50).p50[10], 100000 * Math.pow(1.065, 10), { rel: 1e-9 });
    }
  },
  {
    name: 'Compounding with ups and downs: median path grows at the entered return',
    why: 'Returns are lognormal with the entered rate as the median, so the median of many paths ≈ (1 + r)^t.',
    run() {
      const s = plan({ people: retired(65, 75), assets: [asset('retirement', 100000, { taxType: 'roth' })], assumptions: { retReturn: 6.5, volatility: 12 } });
      return approx(M.project(s, 4000).p50[10], 100000 * Math.pow(1.065, 10), { rel: 0.03 });
    }
  },
  {
    name: 'Inflation: spending rises every year and is taken at year end',
    why: '$1M, no growth, $50k spending in today\'s dollars at 2.5% inflation for 5 years.',
    run() {
      const s = flat({ people: retired(70, 80), assets: [asset('nonretirement', 1e6)], spending: [spendAlways(50000)], assumptions: { nonReturn: 0, inflation: 2.5 } });
      let expected = 1e6; for (let t = 1; t <= 5; t++) expected -= 50000 * Math.pow(1.025, t);
      return approx(M.project(s, 50).p50[5], expected, { rel: 1e-9 });
    }
  },
  {
    name: "Today's dollars: nominal value divided by (1 + inflation)^t",
    why: 'With growth equal to inflation, real value should stay flat.',
    run() {
      const s = flat({ people: retired(65, 75), assets: [asset('nonretirement', 250000)], assumptions: { nonReturn: 3, inflation: 3 } });
      const r = M.project(s, 50);
      return approx(r.p50[10] / Math.pow(1 + r.infl, 10), 250000, { rel: 1e-9 });
    }
  },
  {
    name: 'Mortgage: balance after one year matches the amortization formula',
    why: '$780k at 3% with $3,300 a month.',
    run() {
      const s = flat({ people: retired(50, 90), assets: [asset('nonretirement', 5e6)], liabilities: [{ label: 'Mortgage', balance: 780000, rate: 3, monthlyPayment: 3300, endYear: null }], assumptions: { nonReturn: 0 } });
      const i = 0.03 / 12, expected = 780000 * Math.pow(1 + i, 12) - 3300 * (Math.pow(1 + i, 12) - 1) / i;
      return approx(M.project(s, 20).debtBal[1], expected, { rel: 1e-9 });
    }
  },
  {
    name: 'Mortgage: payoff year matches the formula',
    why: 'Months to pay off = −ln(1 − rB/P) / ln(1 + r).',
    run() {
      const s = flat({ people: retired(50, 90), assets: [asset('nonretirement', 5e6)], liabilities: [{ label: 'Mortgage', balance: 780000, rate: 3, monthlyPayment: 3300, endYear: null }], assumptions: { nonReturn: 0 } });
      const i = 0.03 / 12, months = -Math.log(1 - i * 780000 / 3300) / Math.log(1 + i);
      const r = M.project(s, 20), t = r.events.findIndex(e => e.some(x => x.includes('paid off')));
      return approx(t, Math.ceil(months / 12), { abs: 0 });
    }
  },
  {
    name: 'Loan with only a paid-off year: calculated payment clears it exactly that year',
    why: 'Payment = B·r / (1 − (1 + r)^−n).',
    run() {
      const endYear = M.Y0 + 25;
      const s = flat({ people: retired(50, 90), assets: [asset('nonretirement', 5e6)], liabilities: [{ label: 'Mortgage', balance: 780000, rate: 3, monthlyPayment: null, endYear }] });
      const i = 0.0025, pay = 780000 * i / (1 - Math.pow(1 + i, -300));
      const r = M.project(s, 20);
      return [approx(r.debtPay[1] / 12, pay, { rel: 1e-9 }), approx(r.debtBal[25], 0, { abs: 1 }), approx(r.debtBal[24] > 0 ? 1 : 0, 1, { abs: 0 })];
    }
  },
  {
    name: 'Loan with payment and paid-off year: leftover balance paid as a lump sum',
    why: '$18k at 5%, $300 a month, must be paid off in 3 years.',
    run() {
      const s = flat({ people: retired(50, 90), assets: [asset('nonretirement', 5e6)], liabilities: [{ label: 'Car', balance: 18000, rate: 5, monthlyPayment: 300, endYear: M.Y0 + 3 }] });
      const r = M.project(s, 20);
      let b = 18000, paid = 0; const i = 0.05 / 12;
      for (let m = 0; m < 36; m++) { const due = b * (1 + i); const p = Math.min(300, due); b = due - p; paid += p; }
      const total = r.debtPay[1] + r.debtPay[2] + r.debtPay[3];
      return [approx(total, paid + b, { rel: 1e-9 }), approx(r.debtBal[3], 0, { abs: 0.5 })];
    }
  },
  {
    name: 'Withdrawal tax: needing $51,250 at a 20% tax takes $64,062.50 from a pre-tax account',
    why: 'Gross-up = need / (1 − tax).',
    run() {
      const s = flat({ people: retired(70, 80), assets: [asset('retirement', 1e6)], spending: [spendAlways(50000)], assumptions: { retReturn: 0, inflation: 2.5, withdrawalTaxRate: 20 } });
      return approx(1e6 - M.project(s, 20).p50[1], 50000 * 1.025 / 0.8, { rel: 1e-9 });
    }
  },
  {
    name: 'Taxes: single, $100k pay, $10k pre-tax, 5% state',
    why: 'Hand calculation with 2026 tables: federal $10,970 + FICA $7,650 + state $4,500 = $23,120.',
    run() { return approx(ESTIMATE({ wages: [100000], pretax: 10000, filing: 'single' }), 23120, { abs: 0.01 }); }
  },
  {
    name: 'Taxes: married, $200k + $200k pay, $46k pre-tax, 5% state',
    why: 'Federal $62,428 + FICA $30,028 (incl. additional Medicare) + state $17,700 = $110,156.',
    run() { return approx(ESTIMATE({ wages: [200000, 200000], pretax: 46000, filing: 'joint' }), 110156, { abs: 0.01 }); }
  },
  {
    name: 'Taxes: Social Security tax stops at the wage base',
    why: 'Single, $300k pay, no state tax: FICA should be $184,500 × 6.2% + $300k × 1.45% + $100k × 0.9% = $16,689.',
    run() {
      const total = M.estimateTaxes({ wages: [300000], other: 0, benefits: 0, pretax: 0, filing: 'single', stateRate: 0 });
      return approx(total - 68134.25, 16689, { abs: 0.01 });
    }
  },
  {
    name: 'Taxes: Social Security alone below the IRS threshold is untaxed, with no payroll tax and (by default) no state tax',
    why: 'Married, $60k Social Security only: provisional income is half ($30k), under the $32k threshold, so none is taxable; most states don\'t tax it either, so $0.',
    run() { return approx(M.estimateTaxes({ wages: [0], other: 0, benefits: 60000, pretax: 0, filing: 'joint', stateRate: 0.05 }), 0, { abs: 0.01 }); }
  },
  {
    name: 'Taxes: pensions and annuities are fully taxable, federal and state, with no payroll tax',
    why: 'Single, $40k pension, 5% state: federal on $40k − $16,100 = $23,900 → $1,240 + 12% × $11,500 = $2,620; state $2,000; total $4,620.',
    run() { return approx(M.estimateTaxes({ wages: [0], other: 0, benefits: 0, pensions: 40000, pretax: 0, filing: 'single', stateRate: 0.05 }), 4620, { abs: 0.01 }); }
  },
  {
    name: 'After inflation: 6% before inflation with 3% inflation leaves about 2.91%',
    why: 'Real rate = (1 + nominal) ÷ (1 + inflation) − 1, and nominal = (1 + real) × (1 + inflation) − 1 turns it back.',
    run() {
      return [approx(M.realRate(6, 3), (1.06 / 1.03 - 1) * 100, { rel: 1e-12, abs: 1e-12 }), approx(M.nominalRate(M.realRate(6, 3), 3), 6, { rel: 1e-12, abs: 1e-12 })];
    }
  },
  {
    name: 'Investment mix presets set before-inflation returns from their after-inflation rate and the plan\'s inflation',
    why: 'Balanced (3.5% after inflation, 11% ups and downs) at 2.5% inflation: (1.035 × 1.025 − 1) = 6.09%, shown as 6.1% for both kinds of account. Unknown or "custom" mixes change nothing.',
    run() {
      const b = M.mixAssumptions('balanced', 2.5), none = M.mixAssumptions('custom', 2.5);
      return [approx(b.retReturn, 6.1, { abs: 1e-9 }), approx(b.nonReturn, 6.1, { abs: 1e-9 }), approx(b.volatility, 11, { abs: 0 }),
        approx(M.mixAssumptions('balanced', 4).retReturn, 7.6, { abs: 1e-9 }), truthy(none === null && M.mixAssumptions('nope', 2.5) === null, 'a non-preset mix returned values')];
    }
  },
  {
    name: 'Investment mix presets are sensible: more expected growth comes with bigger ups and downs',
    why: 'Each preset (config.js) is between 0% and 7% after inflation and 0–30% ups and downs, and the ranking of growth matches the ranking of ups and downs.',
    run() {
      const mixes = M.MIXES.slice().sort((a, b) => a.returnAfterInflation - b.returnAfterInflation);
      return [truthy(mixes.length >= 2, 'fewer than two presets'),
        ...mixes.map(m => truthy(m.returnAfterInflation >= 0 && m.returnAfterInflation <= 7 && m.marketUpsAndDowns >= 0 && m.marketUpsAndDowns <= 30, `${m.id}: ${m.returnAfterInflation}% / ${m.marketUpsAndDowns}%`)),
        truthy(mixes.every((m, i) => i === 0 || m.marketUpsAndDowns > mixes[i - 1].marketUpsAndDowns), 'ups and downs are not in the same order as returns', mixes.map(m => m.id).join(' < '))];
    }
  },
  {
    name: 'Built-in settings match config.js',
    why: 'model.js carries a copy of config.js as a fallback if config.js fails to load. Run: node evals/sync-builtin.js',
    severity: 'soft',
    run() {
      const { CONFIG } = require('../lib');
      return truthy(JSON.stringify(M.BUILTIN_CONFIG) === JSON.stringify(CONFIG), 'config.js has changed; run node evals/sync-builtin.js to copy it into model.js', 'in sync');
    }
  }
];
