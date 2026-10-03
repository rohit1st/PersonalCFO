/*
  2. Timing rules: who earns, spends and saves in which year.
*/
'use strict';
const { M, flat, asset, spendAlways, approx, truthy } = require('../lib');
const personas = require('../personas');

const worker = (extra = {}) => flat({
  people: { p1: { name: 'A', age: 60, retireAge: 65, planToAge: 90 } },
  assets: [asset('nonretirement', 1e6)],
  income: [{ label: 'Salary', type: 'salary', owner: 'p1', amount: 100000, startAge: null, endAge: null }],
  assumptions: { nonReturn: 0, earningsGrowth: 3.5, inflation: 2.5 },
  ...extra
});

module.exports = [
  {
    name: 'Salary grows with salary growth and stops at retirement age',
    why: 'Age 60, retires at 65: pay in years 1 to 4, none from year 5.',
    run() {
      const r = M.project(worker(), 20);
      return [approx(r.inc[1], 100000 * 1.035, { rel: 1e-9 }), approx(r.inc[4], 100000 * Math.pow(1.035, 4), { rel: 1e-9 }), approx(r.inc[5], 0, { abs: 0 })];
    }
  },
  {
    name: 'A salary stops at retirement even if its end age is later; an earlier end age ends it sooner',
    why: 'Age 60, retires at 65. Salary "until 70": paid in years 1 to 4, none from year 5. Salary "until 62": paid in years 1 and 2 only.',
    run() {
      const late = worker(); late.income[0].endAge = 70;
      const early = worker(); early.income[0].endAge = 62;
      const a = M.project(late, 20), b = M.project(early, 20);
      return [approx(a.inc[4], 100000 * Math.pow(1.035, 4)), approx(a.inc[5], 0, { abs: 0 }), approx(a.inc[8], 0, { abs: 0 }),
        approx(b.inc[2], 100000 * Math.pow(1.035, 2)), approx(b.inc[3], 0, { abs: 0 })];
    }
  },
  {
    name: "Moving retirement moves the end of each person's last salary with it, and nothing else",
    why: 'Coast FIRE couple: tech job until 45, coast job 46 to 58, retire at 58; partner paid until 56, retires at 56. Three years sooner: coast job ends at 55, partner\'s pay at 53, tech job still ends at 45. Salaries with no end age are left alone.',
    run() {
      const s = personas.coast_fire_couple(), sooner = M.shiftRetirement(s, -3), later = M.shiftRetirement(s, 2);
      const ends = x => x.income.filter(i => i.type === 'salary').map(i => i.endAge).join(', ');
      const ex = M.shiftRetirement(M.EXAMPLE(), -2);
      return [
        truthy(sooner.people.p1.retireAge === 55 && sooner.people.p2.retireAge === 53, `retire ages ${sooner.people.p1.retireAge}/${sooner.people.p2.retireAge}`),
        truthy(ends(sooner) === '45, 55, 53', `salary end ages ${ends(sooner)}, expected 45, 55, 53`, 'sooner: 45, 55, 53'),
        truthy(ends(later) === '45, 60, 58', `salary end ages ${ends(later)}, expected 45, 60, 58`, 'later: 45, 60, 58'),
        truthy(ex.income.filter(i => i.type === 'salary').every(i => i.endAge === null), 'a salary without an end age was given one'),
        truthy(ends(s) === '45, 58, 56', 'the original plan was changed')
      ];
    }
  },
  {
    name: "Income that doesn't rise with inflation stays at the same dollar amount",
    why: 'Retired, 2.5% inflation. A $30k pension without cost-of-living raises pays $30,000 every year; $20k Social Security rises to $20k × 1.025^10 by year 10; a pension marked "rises with inflation" rises too.',
    run() {
      const s = flat({ people: { p1: { name: 'A', age: 70, retireAge: 60, planToAge: 95 } }, assets: [asset('nonretirement', 1e6)],
        income: [{ label: 'Pension', type: 'pension', owner: 'p1', amount: 30000, startAge: null, endAge: null },
                 { label: 'SS', type: 'benefit', owner: 'p1', amount: 20000, startAge: null, endAge: null }],
        assumptions: { inflation: 2.5, nonReturn: 0 } });
      const r = M.project(s, 20);
      const c = M.clone(s); c.income[0].cola = true;
      const r2 = M.project(c, 20);
      return [approx(r.inc[10], 30000 + 20000 * Math.pow(1.025, 10)), approx(r2.inc[10], 50000 * Math.pow(1.025, 10)),
        truthy(M.incomeGrows({ type: 'benefit' }) && !M.incomeGrows({ type: 'pension' }) && M.incomeGrows({ type: 'pension', cola: true }) && !M.incomeGrows({ type: 'benefit', cola: false }), 'defaults wrong: Social Security should rise, pensions not, unless set')];
    }
  },
  {
    name: 'Social Security starts at its age and keeps up with inflation',
    why: '$30k at 67 in today\'s dollars → first paid at t = 7, worth $30k × 1.025^7.',
    run() {
      const s = worker({ income: [{ label: 'SS', type: 'benefit', owner: 'p1', amount: 30000, startAge: 67, endAge: null }] });
      const r = M.project(s, 20);
      return [approx(r.inc[6], 0, { abs: 0 }), approx(r.inc[7], 30000 * Math.pow(1.025, 7), { rel: 1e-9 })];
    }
  },
  {
    name: 'Retirement contributions stop when the owner retires; employer money is not taken from pay',
    why: 'You add $20k, employer adds $5k, rising with inflation, only while working.',
    run() {
      const s = worker({ assets: [asset('nonretirement', 1e6), asset('retirement', 0, { contribution: 20000, employerContribution: 5000 })] });
      const r = M.project(s, 20);
      return [approx(r.contrib[1], 25000 * 1.025, { rel: 1e-9 }), approx(r.contrib[5], 0, { abs: 0 }), approx(r.youC[1], 20000 * 1.025, { rel: 1e-9 })];
    }
  },
  {
    name: 'Roth contributions do not lower the tax estimate; pre-tax ones do',
    why: 'Same $20k contribution, different tax treatment.',
    run() {
      const pre = M.project(worker({ assets: [asset('retirement', 0, { contribution: 20000 })] }), 20);
      const roth = M.project(worker({ assets: [asset('retirement', 0, { contribution: 20000, taxType: 'roth' })] }), 20);
      return [truthy(roth.taxes[1] > pre.taxes[1], `Roth taxes ${Math.round(roth.taxes[1])} should exceed pre-tax ${Math.round(pre.taxes[1])}`),
        truthy(roth.rothC[1] > 0 && pre.rothC[1] === 0, 'Roth money should go to the Roth balance')];
    }
  },
  {
    name: 'Spending windows: before retirement, in retirement, between ages',
    why: 'Each item should only apply in its window.',
    run() {
      const s = worker({ spending: [
        { label: 'pre', category: 'other', when: 'pre', amount: 10000 },
        { label: 'ret', category: 'other', when: 'ret', amount: 20000 },
        { label: 'ages', category: 'other', when: 'ages', amount: 5000, fromAge: 62, toAge: 63 }
      ] });
      const r = M.project(s, 20), f = t => Math.pow(1.025, t);
      return [approx(r.spend[1], 10000 * f(1), { rel: 1e-9 }), approx(r.spend[2], 15000 * f(2), { rel: 1e-9 }), approx(r.spend[4], 10000 * f(4), { rel: 1e-9 }), approx(r.spend[5], 20000 * f(5), { rel: 1e-9 })];
    }
  },
  {
    name: 'College: four years starting at 18, rising with college inflation',
    why: 'A 16-year-old: college in years 2 to 5.',
    run() {
      const s = worker({ dependents: [{ name: 'K', age: 16, college: true, collegeCost: 30000, collegeStartAge: 18, collegeYears: 4 }], assumptions: { eduInflation: 4.5 } });
      const r = M.project(s, 20);
      return [approx(r.special[1], 0, { abs: 0 }), approx(r.special[2], 30000 * Math.pow(1.045, 2), { rel: 1e-9 }), approx(r.special[5], 30000 * Math.pow(1.045, 5), { rel: 1e-9 }), approx(r.special[6], 0, { abs: 0 })];
    }
  },
  {
    name: 'Repeating purchase: every 8 years until the end year',
    why: 'A car in years 3, 11 and 19, not 27.',
    run() {
      const s = worker({ people: { p1: { name: 'A', age: 40, retireAge: 65, planToAge: 90 } }, purchases: [{ label: 'Car', year: M.Y0 + 3, amount: 40000, repeatEvery: 8, until: M.Y0 + 24 }] });
      const r = M.project(s, 20), hits = [];
      for (let t = 1; t <= r.H; t++) if (r.special[t] > 0) hits.push(t);
      return { pass: hits.join(',') === '3,11,19', detail: `purchase years ${hits.join(',') || 'none'}, expected 3,11,19` };
    }
  },
  {
    name: 'Withdrawal order: non-retirement, then pre-tax (taxed), then Roth (tax-free)',
    why: '$150k savings, $100k pre-tax, $100k Roth, $100k a year spending, 20% withdrawal tax, no growth or inflation.',
    run() {
      const s = flat({
        people: { p1: { name: 'A', age: 70, retireAge: 60, planToAge: 80 } },
        assets: [asset('nonretirement', 150000), asset('retirement', 100000), asset('retirement', 100000, { taxType: 'roth' })],
        spending: [spendAlways(100000)],
        assumptions: { retReturn: 0, nonReturn: 0, inflation: 0, withdrawalTax: 20 }
      });
      const r = M.project(s, 20);
      return [approx(r.liq50[1], 250000, { abs: 0.5 }), approx(r.liq50[2], 137500, { abs: 0.5 }), approx(r.liq50[3], 30000, { abs: 0.5 }), approx(r.deplMid, 4, { abs: 0 })];
    }
  },
  {
    name: 'Older plans entered as take-home pay are not taxed again',
    why: "incomeBasis 'net' keeps the old behaviour until the person switches.",
    run() {
      const s = worker(); s.incomeBasis = 'net';
      const r = M.project(s, 20);
      return approx(r.taxes[1], 0, { abs: 0 });
    }
  },
  {
    name: 'Required withdrawals (RMDs) start at 73 for people born before 1960',
    why: 'Age 71 in 2026 (born 1955): nothing at 72, then balance ÷ 26.5 at 73 (IRS Uniform Lifetime Table), taxed at the 20% withdrawal rate.',
    run() {
      const r = M.project(rmdPlan(71, [asset('retirement', 1e6)]), 20);
      return [approx(r.rmd[1], 0, { abs: 0 }), approx(r.rmd[2], 1e6 / 26.5), approx(r.p50[2], 1e6 - 0.2 * 1e6 / 26.5), approx(r.rmd[3], (1e6 - 1e6 / 26.5) / 25.5)];
    }
  },
  {
    name: 'Required withdrawals start at 75 for people born in 1960 or later',
    why: 'Age 66 in 2026 (born 1960): none at 73 or 74, then balance ÷ 24.6 at 75 (SECURE 2.0).',
    run() {
      const r = M.project(rmdPlan(66, [asset('retirement', 1e6)]), 20);
      return [approx(r.rmd[7], 0, { abs: 0 }), approx(r.rmd[8], 0, { abs: 0 }), approx(r.rmd[9], 1e6 / 24.6)];
    }
  },
  {
    name: 'Roth accounts have no required withdrawals',
    why: 'Roth IRAs and (since 2024) Roth 401(k)s have no RMDs for the owner.',
    run() {
      const r = M.project(rmdPlan(80, [asset('retirement', 1e6, { taxType: 'roth' })]), 20);
      return [approx(r.rmd[1], 0, { abs: 0 }), approx(r.p50[1], 1e6)];
    }
  },
  {
    name: 'Required withdrawals pay for spending first; what is left over goes to non-retirement savings',
    why: 'Age 75: $1M pre-tax ÷ 23.7 at 76 = $42,194, $33,755 after 20% tax, covers $20k spending, $13,755 saved. Savings are not touched.',
    run() {
      const s = rmdPlan(75, [asset('retirement', 1e6), asset('nonretirement', 100000)]);
      s.spending = [spendAlways(20000)];
      const r = M.project(s, 20), rmd = 1e6 / 23.7;
      return [approx(r.rmd[1], rmd), approx(r.liq50[1], 1e6 - rmd + 100000 + rmd * 0.8 - 20000)];
    }
  },
  {
    name: "Each partner's required withdrawals use their own age; joint pre-tax accounts are split evenly",
    why: 'Partner 1 is 72 (born 1954), Partner 2 is 60 (born 1966). At t=1 only Partner 1 (73, ÷ 26.5) withdraws: own $500k plus half of a $200k joint account.',
    run() {
      const s = rmdPlan(72, [asset('retirement', 500000), asset('retirement', 500000, { owner: 'p2' }), asset('retirement', 200000, { owner: 'joint' })]);
      s.people.p2 = { enabled: true, name: 'B', age: 60, retireAge: 60, planToAge: 90 };
      const r = M.project(s, 20);
      return [approx(r.rmd[1], 600000 / 26.5), truthy(r.events[1].some(e => /A's required withdrawals start/.test(e)), 'no "A\'s required withdrawals start" event in year 1', 'event shown')];
    }
  },
  {
    name: "After a partner's plan ends, the other partner takes required withdrawals on their accounts at their own age",
    why: 'Partner 1 is 80 with plan until 81; Partner 2 is 74. At t=2 Partner 1 is past their plan, so their $1M is withdrawn at Partner 2\'s age 76 (÷ 23.7).',
    run() {
      const s = rmdPlan(80, [asset('retirement', 1e6)]);
      s.people.p1.planToAge = 81;
      s.people.p2 = { enabled: true, name: 'B', age: 74, retireAge: 60, planToAge: 95 };
      const r = M.project(s, 20), after1 = 1e6 - 1e6 / 19.4;   // t=1: Partner 1 is 81
      return [approx(r.rmd[1], 1e6 / 19.4), approx(r.rmd[2], after1 / 23.7)];
    }
  }
];

// Retired person with no growth, inflation or spending, and a 20% withdrawal tax
function rmdPlan(age, assets) {
  return flat({
    people: { p1: { name: 'A', age, retireAge: 60, planToAge: 95 } },
    assets,
    assumptions: { retReturn: 0, nonReturn: 0, inflation: 0, withdrawalTax: 20 }
  });
}
