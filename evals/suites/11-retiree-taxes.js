/*
  11. Taxes in retirement. Social Security is taxed on the IRS provisional-income
  formula (0% to 85% counted, thresholds fixed in law, never raised for inflation),
  people 65 and over get the extra standard deduction (and the 2025–2028 senior
  deduction, phased out at higher incomes), and money taken out of pre-tax accounts
  (RMDs and shortfall withdrawals) is added to the year's other income and taxed
  through the brackets, not at a flat rate. A flat "Tax on retirement withdrawals"
  stays available as an override.

  Hand calculations use the 2026 tables: standard deduction $16,100 / $32,200,
  extra for 65+ $2,050 single / $1,650 per person married, senior deduction $6,000
  per person through 2028 (minus 6% of income over $75k / $150k), Social Security
  thresholds $25k/$34k single, $32k/$44k married.
*/
'use strict';
const { M, YEAR, CONFIG, NWPModel, flat, asset, approx, truthy } = require('../lib');

const TAX = (o) => M.estimateTaxes({ wages: [0], other: 0, benefits: 0, pensions: 0, pretax: 0, stateRate: 0, ...o });

// An independent version of the rules, typed in separately from config.js and model.js
const BR = {
  single: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
  joint: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]]
};
function refBrackets(x, filing) { let t = 0, lo = 0; for (const [hi, r] of BR[filing]) { if (x > lo) t += (Math.min(x, hi) - lo) * r; lo = hi; } return t; }
// Federal + state income tax in today's dollars; price = how much prices have risen since today (for amounts fixed in law)
function refTax({ ord, ss, filing, over65, year, price, state }) {
  const j = filing === 'joint', b1 = (j ? 32000 : 25000) / price, b2 = (j ? 44000 : 34000) / price;
  const pi = ord + ss / 2;
  let tss = 0;
  if (pi > b2) tss = Math.min(0.85 * ss, 0.85 * (pi - b2) + Math.min(0.5 * ss, 0.5 * (b2 - b1)));
  else if (pi > b1) tss = Math.min(0.5 * ss, 0.5 * (pi - b1));
  const agi = ord + tss;
  let ded = (j ? 32200 : 16100) + over65 * (j ? 1650 : 2050);
  if (year <= 2028) ded += over65 * Math.max(0, 6000 / price - 0.06 * Math.max(0, agi - (j ? 150000 : 75000) / price));
  return refBrackets(Math.max(0, agi - ded), filing) + state * ord;
}

// A retired couple drawing down: Kim 66 (Social Security from 67), Ash 63 (pension from 65, turns 65 in two years)
const couple = () => flat({
  people: {
    p1: { name: 'Kim', age: 66, retireAge: 60, planToAge: 95 },
    p2: { enabled: true, name: 'Ash', age: 63, retireAge: 60, planToAge: 92 }
  },
  assets: [
    { label: "Kim's IRA", kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 1200000, contribution: 0, employerContribution: 0 },
    { label: "Ash's 401(k)", kind: 'retirement', owner: 'p2', taxType: 'pretax', balance: 400000, contribution: 0, employerContribution: 0 },
    { label: 'Roth IRAs', kind: 'retirement', owner: 'joint', taxType: 'roth', balance: 200000, contribution: 0, employerContribution: 0 },
    { label: 'Brokerage', kind: 'nonretirement', owner: 'joint', balance: 100000, contribution: 0, employerContribution: 0 }
  ],
  income: [
    { label: "Kim's Social Security", type: 'benefit', owner: 'p1', amount: 30000, startAge: 67, endAge: null },
    { label: "Ash's pension", type: 'pension', owner: 'p2', amount: 20000, startAge: 65, endAge: null, cola: false }
  ],
  spending: [{ label: 'Living', category: 'other', when: 'always', amount: 90000, fromAge: null, toAge: null }],
  assumptions: { retReturn: 4, nonReturn: 4, inflation: 2.5, stateTax: 4, payTaxRate: null, withdrawalTaxRate: null }
});

// The couple's whole plan, year by year, written out plainly
function reference() {
  const ULT = { 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9 };
  let R1 = 1200000, R2 = 400000, Q = 200000, N = 100000;
  const rows = [{ nw: R1 + R2 + Q + N, pay: 0, wtax: 0 }];
  for (let t = 1; t <= 29; t++) {
    const f = Math.pow(1.025, t), A1 = 66 + t, A2 = 63 + t, year = YEAR + t;
    const over65 = (A1 >= 65 ? 1 : 0) + (A2 >= 65 ? 1 : 0);
    const m1 = A1 >= 75 ? R1 / ULT[A1] : 0, m2 = A2 >= 75 ? R2 / ULT[A2] : 0;   // both born 1960 or later: RMDs from 75
    R1 *= 1.04; R2 *= 1.04; Q *= 1.04; N *= 1.04;
    R1 -= m1; R2 -= m2;
    const ss = A1 >= 67 ? 30000 * f : 0, pen = A2 >= 65 ? 20000 : 0;
    const T = w => refTax({ ord: pen / f + w / f, ss: ss / f, filing: 'joint', over65, year, price: f, state: 0.04 }) * f;
    const pay = T(0), extra = w => T(w) - pay, rmd = m1 + m2;
    let wtax = extra(rmd);
    const cash = ss + pen - pay - 90000 * f + rmd - wtax;
    if (cash >= 0) N += cash;
    else {
      let need = -cash;
      const fromN = Math.min(N, need); N -= fromN; need -= fromN;
      if (need > 0) {
        const R = R1 + R2, netOf = x => x - (extra(rmd + x) - extra(rmd));
        if (netOf(R) >= need) {
          let lo = 0, hi = R;
          for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (netOf(mid) < need) lo = mid; else hi = mid; }
          const x = (lo + hi) / 2;
          R1 -= x * R1 / R; R2 -= x * R2 / R; wtax = extra(rmd + x); need = 0;
        } else { need -= netOf(R); wtax = extra(rmd + R); R1 = R2 = 0; }
        if (need > 0) Q = Math.max(0, Q - need);
      }
    }
    rows.push({ nw: R1 + R2 + Q + N, pay, wtax });
  }
  return rows;
}

module.exports = [
  {
    name: 'Social Security: the taxable share follows the IRS formula (0%, up to 50%, up to 85%)',
    why: 'Married, $40k benefits: other income $10k → $0; $20k → $4,000; $30k → $11,100; $100k → $34,000 (85%). Single, $30k benefits + $20k other → $5,350.',
    run() {
      const T = M.taxableBenefits;
      return [approx(T(40000, 10000, 'joint'), 0, { abs: 0.01 }), approx(T(40000, 20000, 'joint'), 4000, { abs: 0.01 }), approx(T(40000, 30000, 'joint'), 11100, { abs: 0.01 }),
        approx(T(40000, 100000, 'joint'), 34000, { abs: 0.01 }), approx(T(30000, 20000, 'single'), 5350, { abs: 0.01 })];
    }
  },
  {
    name: 'Social Security: the $32k / $44k thresholds are fixed in law, so more of it is taxed as prices rise',
    why: 'Same married couple ($40k benefits + $30k other, in today\'s dollars) once prices have doubled: the thresholds are worth $16k / $22k, so $26,800 is taxable instead of $11,100.',
    run() { return approx(M.taxableBenefits(40000, 30000, 'joint', 2), 26800, { abs: 0.01 }); }
  },
  {
    name: 'Taxes at 65+: the extra standard deduction applies per person',
    why: 'Single, $40k pension, 2029: under 65 → $2,620; at 65 the deduction grows by $2,050 → $40,000 − $18,150 = $21,850 taxable → $2,374.',
    run() { return [approx(TAX({ pensions: 40000, filing: 'single', year: 2029 }), 2620, { abs: 0.01 }), approx(TAX({ pensions: 40000, filing: 'single', over65: 1, year: 2029 }), 2374, { abs: 0.01 })]; }
  },
  {
    name: 'Taxes at 65+: the $6,000 senior deduction applies through 2028 only',
    why: 'Married, both 65+, $40k Social Security + $60k pension: $34,000 of benefits taxable, AGI $94,000. 2029: $58,500 taxable → $6,524. 2026: another $12,000 off → $5,084.',
    run() {
      const o = { benefits: 40000, pensions: 60000, filing: 'joint', over65: 2 };
      return [approx(TAX({ ...o, year: 2029 }), 6524, { abs: 0.01 }), approx(TAX({ ...o, year: 2026 }), 5084, { abs: 0.01 })];
    }
  },
  {
    name: 'Taxes at 65+: the senior deduction shrinks by 6% of income over $75k single, and is gone by $175k',
    why: 'Single 65+, $125k pension, 2026: $6,000 − 6% × $50,000 = $3,000 → $103,850 taxable → $17,559. At $200k it\'s zero, so 2026 matches 2029.',
    run() {
      const o = { filing: 'single', over65: 1 };
      return [approx(TAX({ ...o, pensions: 125000, year: 2026 }), 17559, { abs: 0.01 }),
        approx(TAX({ ...o, pensions: 200000, year: 2026 }), TAX({ ...o, pensions: 200000, year: 2029 }), { abs: 0.01 })];
    }
  },
  {
    name: 'Taxes: state tax skips Social Security by default; owners can switch it on in config.js',
    why: 'Single, $40k pension + $30k Social Security, 5% state: $22,350 of benefits is federally taxable. Default state tax $2,000; with taxes.stateTaxesSocialSecurity: true, 5% of $62,350 = $3,117.50.',
    run() {
      const o = { pensions: 40000, benefits: 30000, filing: 'single', stateRate: 0.05, year: 2029 }, fed = TAX({ ...o, stateRate: 0 });
      const M2 = NWPModel.create({ ...CONFIG, taxes: { ...CONFIG.taxes, stateTaxesSocialSecurity: true } }, { year: YEAR });
      return [approx(TAX(o) - fed, 2000, { abs: 0.01 }), approx(M2.estimateTaxes({ wages: [0], other: 0, pretax: 0, ...o }) - fed, 3117.5, { abs: 0.01 })];
    }
  },
  {
    name: 'Withdrawals: pre-tax withdrawals are taxed with the year\'s other income, through the brackets',
    why: 'Adding $60k of withdrawals to a married couple\'s $50k Social Security makes $41k of benefits taxable too, so the extra tax is more than a flat 10% and far less than 22%.',
    run() {
      const o = { benefits: 50000, filing: 'joint', over65: 2, year: 2029 };
      const extra = TAX({ ...o, withdrawals: 60000 }) - TAX(o);
      const ref = refTax({ ord: 60000, ss: 50000, filing: 'joint', over65: 2, year: 2029, price: 1, state: 0 }) - refTax({ ord: 0, ss: 50000, filing: 'joint', over65: 2, year: 2029, price: 1, state: 0 });
      return [approx(extra, ref, { abs: 0.01 }), truthy(extra > 6000 && extra < 13200, `extra tax ${Math.round(extra)}`, `extra tax $${Math.round(extra).toLocaleString()} on $60k`)];
    }
  },
  {
    name: 'Retired couple drawing down: matches an independent year-by-year calculation with estimated taxes',
    why: 'Social Security from 67, a pension without raises, Ash turning 65, the senior deduction ending after 2028, thresholds not rising with inflation, non-retirement spent first, pre-tax withdrawals solved so their tax is covered, RMDs from 75 and a 4% state tax. Every year must match to the dollar.',
    run() {
      const r = M.project(couple(), 10), ref = reference(), out = [];
      for (let t = 0; t < ref.length; t++) {
        for (const [k, got] of [['nw', r.p50[t]], ['pay', r.taxes[t]], ['wtax', r.wtax ? r.wtax[t] : NaN]]) {
          const a = approx(got, ref[t][k], { abs: 1, rel: 1e-9 });
          if (!a.pass) out.push({ pass: false, detail: `year ${t} ${k}: ${a.detail}` });
        }
      }
      return out.length ? out : truthy(true, '', `${ref.length} years × net worth, taxes on income, taxes on withdrawals match`);
    }
  },
  {
    name: 'The drawdown couple actually exercises the rules it is meant to check',
    why: 'Guards the check above: it needs tax on income, tax on shortfall withdrawals before RMD age, and RMDs.',
    run() {
      const r = M.project(couple(), 10);
      return [truthy(r.taxes.some(v => v > 0), 'never any tax on income', 'tax on income'), truthy(r.wtax && r.wtax[3] > 0, 'no tax on withdrawals in year 3', 'tax on early withdrawals'),
        truthy(r.rmd.some(v => v > 0), 'no RMDs', 'RMDs happen')];
    }
  },
  {
    name: 'Withdrawals: Roth and non-retirement savings aren\'t taxed on the way out',
    why: 'A retiree spending only from a brokerage account and a Roth pays no withdrawal tax.',
    run() {
      const r = M.project(flat({ people: { p1: { name: 'A', age: 70, retireAge: 60, planToAge: 85 } }, assets: [asset('nonretirement', 100000), asset('retirement', 500000, { taxType: 'roth' })],
        spending: [{ label: 'Living', category: 'other', when: 'always', amount: 60000 }], assumptions: { retReturn: 0, nonReturn: 0, inflation: 0, withdrawalTaxRate: null } }), 5);
      return [approx(Math.max(...r.wtax), 0, { abs: 0 }), approx(r.liq50[3], 600000 - 180000, { abs: 0.5 })];
    }
  },
  {
    name: 'Withdrawals: a flat "Tax on retirement withdrawals" still overrides the estimate',
    why: 'With 20% set, $50k of spending from a pre-tax account takes $62,500 and the withdrawal tax is $12,500.',
    run() {
      const r = M.project(flat({ people: { p1: { name: 'A', age: 70, retireAge: 60, planToAge: 85 } }, assets: [asset('retirement', 1e6)],
        spending: [{ label: 'Living', category: 'other', when: 'always', amount: 50000 }], assumptions: { retReturn: 0, inflation: 0, withdrawalTaxRate: 20 } }), 5);
      return [approx(r.p50[1], 1e6 - 62500, { abs: 0.01 }), approx(r.wtax[1], 12500, { abs: 0.01 })];
    }
  },
  {
    name: 'Withdrawals: plans saved with the old flat withdrawal rate switch to the estimate',
    why: 'Older plans store withdrawalTax (18% by default); it\'s ignored, so they get the estimate unless someone sets the new override.',
    run() {
      const base = { people: { p1: { name: 'A', age: 70, retireAge: 60, planToAge: 85 } }, assets: [asset('retirement', 1e6)], spending: [{ label: 'Living', category: 'other', when: 'always', amount: 50000 }] };
      const a = M.project(flat({ ...base, assumptions: { retReturn: 0, inflation: 0, withdrawalTax: 18 } }), 5), b = M.project(flat({ ...base, assumptions: { retReturn: 0, inflation: 0 } }), 5);
      return [approx(a.wtax[1], b.wtax[1], { abs: 0.01 }), truthy(Math.abs(a.wtax[1] - 0.18 * 50000 / 0.82) > 100, 'still using 18%', 'estimated, not 18%')];
    }
  }
];
