/*
  6. Whole-projection check: an independent, plain year-by-year calculation of a
  detailed household (no market ups and downs, flat tax rates on pay and withdrawals) must match
  model.js in every year of the plan. It re-states the rules from CLAUDE.md in the
  simplest possible code, so a change anywhere in project() that breaks one of
  them shows up here even if no targeted eval covers it.
*/
'use strict';
const { M, YEAR, flat, approx, truthy } = require('../lib');

// IRS Uniform Lifetime Table (2022 onward), typed in separately from config.js
const ULT = { 72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9 };

const household = () => flat({
  people: {
    p1: { name: 'Kim', age: 60, retireAge: 64, planToAge: 90 },
    p2: { enabled: true, name: 'Ash', age: 58, retireAge: 63, planToAge: 92 }
  },
  dependents: [{ name: 'Kid', age: 15, college: true, collegeCost: 30000, collegeStartAge: 18, collegeYears: 4 }],
  assets: [
    { label: "Kim's 401(k)", kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 800000, contribution: 20000, employerContribution: 5000 },
    { label: "Ash's 403(b)", kind: 'retirement', owner: 'p2', taxType: 'pretax', balance: 300000, contribution: 10000, employerContribution: 0 },
    { label: 'Roth IRAs', kind: 'retirement', owner: 'joint', taxType: 'roth', balance: 100000, contribution: 6000, employerContribution: 0 },
    { label: 'Brokerage', kind: 'nonretirement', owner: 'joint', balance: 150000, contribution: 0, employerContribution: 0 },
    { label: 'Home', kind: 'other', owner: 'joint', balance: 500000, contribution: 0, employerContribution: 0 }
  ],
  liabilities: [{ label: 'Mortgage', balance: 100000, rate: 5, monthlyPayment: 1500, endYear: null }],
  income: [
    { label: "Kim's salary", type: 'salary', owner: 'p1', amount: 150000, startAge: null, endAge: null },
    { label: "Ash's salary", type: 'salary', owner: 'p2', amount: 90000, startAge: null, endAge: null },
    { label: "Kim's Social Security", type: 'benefit', owner: 'p1', amount: 30000, startAge: 67, endAge: null },
    { label: "Ash's Social Security", type: 'benefit', owner: 'p2', amount: 20000, startAge: 67, endAge: null }
  ],
  spending: [
    { label: 'Living', category: 'other', when: 'always', amount: 60000, fromAge: null, toAge: null },
    { label: 'Work years', category: 'other', when: 'pre', amount: 20000, fromAge: null, toAge: null },
    { label: 'Retirement', category: 'health', when: 'ret', amount: 15000, fromAge: null, toAge: null },
    { label: 'Travel', category: 'travel', when: 'ages', amount: 10000, fromAge: 64, toAge: 70 }
  ],
  purchases: [{ label: 'Car', year: YEAR + 3, amount: 30000, repeatEvery: 10, until: YEAR + 25 }],
  assumptions: { retReturn: 5, nonReturn: 6, otherGrowth: 3, inflation: 2.5, earningsGrowth: 3, eduInflation: 4, withdrawalTaxRate: 20, payTaxRate: 25 }
});

// Pre-tax contributions taken from pay (the Roth one isn't)
const youC0 = (w1, w2, f) => (w1 ? 20000 * f : 0) + (w2 ? 10000 * f : 0);

// The rules, written out plainly
function reference(s) {
  const A = s.assumptions, p1 = s.people.p1, p2 = s.people.p2;
  const H = Math.max(p1.planToAge - p1.age, p2.planToAge - p2.age);
  const infl = A.inflation / 100, eg = A.earningsGrowth / 100, edu = A.eduInflation / 100, wt = A.withdrawalTaxRate / 100, pt = A.payTaxRate / 100;
  const rmdAge = age => (YEAR - age >= 1960 ? 75 : 73);
  const rows = [];
  let R1 = 800000, R2 = 300000, Q = 100000, N = 150000, O = 500000, loan = 100000;
  rows.push({ nw: R1 + R2 + Q + N + O - loan, tax: 0, rmd: 0 });
  for (let t = 1; t <= H; t++) {
    const f = Math.pow(1 + infl, t), A1 = p1.age + t, A2 = p2.age + t;
    const w1 = A1 < p1.retireAge, w2 = A2 < p2.retireAge, allRetired = !w1 && !w2;
    // Required withdrawals: last year-end balance ÷ table divisor, from the owner's RMD age
    // (once Kim's plan has ended, Ash inherits Kim's account and withdraws at Ash's age)
    const kimAge = A1 <= p1.planToAge ? A1 : A2, kimStart = A1 <= p1.planToAge ? rmdAge(p1.age) : rmdAge(p2.age);
    const rmd1 = kimAge >= kimStart ? R1 / ULT[kimAge] : 0, rmd2 = A2 >= rmdAge(p2.age) ? R2 / ULT[A2] : 0;
    // Growth first
    R1 *= 1.05; R2 *= 1.05; Q *= 1.05; N *= 1.06; O *= 1.03;
    R1 -= rmd1; R2 -= rmd2;
    // Pay and benefits (benefits stop after the owner's plan-until age)
    const wages = (w1 ? 150000 * Math.pow(1 + eg, t) : 0) + (w2 ? 90000 * Math.pow(1 + eg, t) : 0);
    const ben = (A1 >= 67 && A1 <= p1.planToAge ? 30000 * f : 0) + (A2 >= 67 && A2 <= p2.planToAge ? 20000 * f : 0);
    // Flat rate on pay plus the taxable part of Social Security (IRS formula; the $32k/$44k thresholds aren't raised for inflation)
    const pi = (wages - youC0(w1, w2, f)) / f + ben / f / 2, b1 = 32000 / f, b2 = 44000 / f, ssR = ben / f;
    const tss = pi <= b1 ? 0 : pi <= b2 ? Math.min(0.5 * ssR, 0.5 * (pi - b1)) : Math.min(0.85 * ssR, 0.85 * (pi - b2) + Math.min(0.5 * ssR, 0.5 * (b2 - b1)));
    const tax = pt * (wages + tss * f);
    // Contributions while the owner works (joint Roth: while either works)
    let youC = 0;
    if (w1) { R1 += 25000 * f; youC += 20000 * f; }
    if (w2) { R2 += 10000 * f; youC += 10000 * f; }
    if (w1 || w2) { Q += 6000 * f; youC += 6000 * f; }
    const spend = 60000 * f + (!allRetired ? 20000 * f : 0) + (allRetired ? 15000 * f : 0) + (A1 >= 64 && A1 <= 70 ? 10000 * f : 0);
    let paid = 0;
    for (let m = 0; m < 12 && loan > 0.005; m++) { const due = loan * (1 + 0.05 / 12), pay = Math.min(1500, due); loan = due - pay; paid += pay; }
    const kidAge = 15 + t, college = kidAge >= 18 && kidAge < 22 ? 30000 * Math.pow(1 + edu, t) : 0;
    const car = t === 3 || t === 13 || t === 23 ? 30000 * f : 0;
    const cash = wages + ben - tax - youC - spend - paid - college - car + (rmd1 + rmd2) * (1 - wt);
    if (cash >= 0) N += cash;
    else {
      let need = -cash;
      const fromN = Math.min(N, need); N -= fromN; need -= fromN;
      if (need > 0) {
        const gross = need / (1 - wt), R = R1 + R2;
        if (R >= gross) { R1 -= gross * R1 / R; R2 -= gross * R2 / R; need = 0; }
        else { need -= R * (1 - wt); R1 = R2 = 0; }
        if (need > 0) Q = Math.max(0, Q - need);
      }
    }
    if (loan <= 0.5) loan = 0;
    rows.push({ nw: R1 + R2 + Q + N + O - loan, tax, rmd: rmd1 + rmd2 });
  }
  return rows;
}

module.exports = [
  {
    name: 'Whole projection matches an independent year-by-year calculation',
    why: 'Detailed couple: pay, taxes, pre-tax and Roth saving, spending windows, mortgage, college, repeating purchase, retirement, Social Security, shortfall withdrawals and RMDs. Every year must match to the dollar.',
    run() {
      const s = household(), r = M.project(s, 10), ref = reference(s), out = [];
      out.push(approx(r.H, ref.length - 1, { abs: 0 }));
      for (let t = 0; t < ref.length; t++) {
        for (const [k, got] of [['nw', r.p50[t]], ['tax', r.taxes[t]], ['rmd', r.rmd ? r.rmd[t] : NaN]]) {
          const a = approx(got, ref[t][k], { abs: 1, rel: 1e-9 });
          if (!a.pass) out.push({ pass: false, detail: `year ${t} ${k}: ${a.detail}` });
        }
      }
      return out.length > 1 ? out : truthy(true, '', `${ref.length} years × net worth, taxes, RMDs match`);
    }
  },
  {
    name: 'The detailed household actually exercises every rule it is meant to check',
    why: 'Guards the check above: if the household stopped drawing from retirement accounts or reaching RMD age, the comparison would prove less.',
    run() {
      const s = household(), r = M.project(s, 10);
      const drew = r.p50.some((v, t) => t > 0 && r.liq50[t] < r.liq50[t - 1]);
      return [
        truthy(r.rmd && r.rmd.some(v => v > 0), 'no required withdrawals in the plan', 'RMDs happen'),
        truthy(drew, 'savings never go down, so shortfall withdrawals are not tested', 'shortfalls happen'),
        truthy(r.debtBal[r.H] === 0, 'mortgage never paid off', 'mortgage paid off')
      ];
    }
  }
];
