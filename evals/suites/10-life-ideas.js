/*
  10. Life ideas: future-dated loans and homes (the building blocks), and the
  scenario ideas built on them (another kid, a new home, a move, a career break,
  downsizing, helping family, a windfall, a big purchase).
*/
'use strict';
const { M, YEAR, flat, asset, spendAlways, approx, truthy } = require('../lib');
const personas = require('../personas');

const base = (extra = {}) => flat({
  people: { p1: { name: 'A', age: 40, retireAge: 80, planToAge: 90 } },
  assets: [asset('nonretirement', 1e6)],
  assumptions: { nonReturn: 0, otherGrowth: 3, inflation: 2, retReturn: 0 },
  ...extra
});
const pmt = (B, r, months) => B * (r / 12) / (1 - Math.pow(1 + r / 12, -months));

// A household for the whole-scenario check: single, 40, retiring at 55; savings earn 4%, home grows 3%, 2% inflation,
// salary $120k growing 2% with a flat 25% tax, $50k spending, a $200k mortgage at 5% paying $1,500 a month.
const household = () => flat({
  people: { p1: { name: 'A', age: 40, retireAge: 55, planToAge: 80 } },
  assets: [asset('nonretirement', 300000), asset('other', 400000, { label: 'Home' })],
  liabilities: [{ label: 'Mortgage', balance: 200000, rate: 5, monthlyPayment: 1500, endYear: null }],
  income: [{ label: 'Salary', type: 'salary', owner: 'p1', amount: 120000, startAge: null, endAge: null }],
  spending: [spendAlways(50000)],
  assumptions: { nonReturn: 4, otherGrowth: 3, inflation: 2, earningsGrowth: 2, eduInflation: 4, payTaxRate: 25, retReturn: 0 }
});
const STACK = [
  ['break', { who: 'p1', inYears: 2, years: 1 }],
  ['kid', { inYears: 1, childcare: 15000, childcareUntil: 5, extra: 8000, extraUntil: 18, college: true, collegeCost: 30000 }],
  ['home', { inYears: 5, price: 600000, downPct: 20, costsPct: 5, rate: 6, years: 30, sellCurrent: true, upkeepPct: 1.5 }],
  ['family', { inYears: 3, years: 4, perYear: 6000 }],
  ['purchase', { inYears: 6, amount: 20000, label: 'Car' }],
  ['move', { inYears: 8, livingPct: 10, movingCost: 10000, stateTax: 5 }],
  ['windfall', { inYears: 10, amount: 50000 }]
];
// The rules for that stack, written out by hand from the ideas' parameters (not from the plan the ideas produce)
function stackReference() {
  const H = 40, g = t => Math.pow(1.02, t), rows = [];
  let N = 300000, O = 400000, old = 200000, nw = 0, pending = 480000 * g(5), newBal = 0;
  const newPay = (() => { const i = 0.06 / 12, m = 360; return pending * i / (1 - Math.pow(1 + i, -m)); })();
  rows.push({ nw: N + O - old, liq: N, debt: old });
  for (let t = 1; t <= H; t++) {
    const age = 40 + t, f = g(t);
    N *= 1.04; O *= 1.03;
    if (t === 5) { const sale = 400000 * Math.pow(1.03, 5); O += 600000 * g(5) - sale; N += sale; }
    const working = age < 55 && (age <= 41 || age >= 43);                     // career break at 42
    const wage = working ? 120000 * Math.pow(1.02, t) : 0, tax = 0.25 * wage;
    let spend = 50000 * f;
    if (age >= 41 && age <= 45) spend += 15000 * f;                             // childcare to age 5
    if (age >= 41 && age <= 58) spend += 8000 * f;                              // everyday costs to 18
    if (age >= 43 && age <= 46) spend += 6000 * f;                              // helping family, 4 years
    if (age >= 45) spend += 3000 * f;                                           // upkeep: 1.5% × ($600k − $400k)
    if (age >= 48) spend += 5000 * f;                                           // move: +10% of $50k
    let special = 0;
    if (t >= 19 && t <= 22) special += 30000 * Math.pow(1.04, t);               // college, kid born in year 1
    if (t === 5) special += 150000 * f;                                         // 20% down + 5% costs on $600k
    if (t === 6) special += 20000 * f;                                          // car
    if (t === 8) special += 10000 * f;                                          // moving costs
    if (t === 10) special -= 50000 * f;                                         // windfall, untaxed
    let paid = 0;
    if (old > 0.5) { for (let m = 0; m < 12 && old > 0.005; m++) { const due = old * (1 + 0.05 / 12), p = Math.min(1500, due); old = due - p; paid += p; }
      if (t >= 5 && old > 0.5) { paid += old; old = 0; } }                        // paid off when the home is sold
    if (newBal > 0.5) for (let m = 0; m < 12 && newBal > 0.005; m++) { const due = newBal * (1 + 0.06 / 12), p = Math.min(newPay, due); newBal = due - p; paid += p; }
    if (t === 5) newBal = pending;                                              // new mortgage starts at the end of year 5
    if (old <= 0.5) old = 0; if (newBal <= 0.5) newBal = 0;
    const net = wage - tax - spend - paid - special;
    if (net >= 0) N += net; else N -= Math.min(Math.max(N, 0), -net);
    rows.push({ nw: N + O - old - newBal, liq: N, debt: old + newBal });
  }
  return rows;
}

module.exports = [
  {
    name: 'Seven stacked ideas produce exactly the projection an independent year-by-year calculation gives',
    why: 'Career break, another kid, a new home (selling the old one), helping family, a car, a move and a windfall on one household: net worth, savings and loans must match the hand calculation to the dollar in every one of 40 years.',
    run() {
      const s = STACK.reduce((p, [id, prm]) => M.applyIdea(p, id, prm), household()), r = M.project(s, 10), ref = stackReference(), bad = [];
      for (let t = 0; t < ref.length; t++) for (const [k, got] of [['nw', r.p50[t]], ['liq', r.liq50[t]], ['debt', r.debtBal[t]]]) {
        const a = approx(got, ref[t][k], { abs: 1, rel: 1e-9 }); if (!a.pass) bad.push({ pass: false, detail: `year ${t} ${k}: ${a.detail}` });
      }
      return bad.length ? bad.slice(0, 6) : truthy(true, '', `${ref.length} years × net worth, savings, loans match`);
    }
  },
  {
    name: 'Downsize: the home sells at the chosen age, the smaller home and its costs come out of the proceeds',
    why: 'Age 60, $500k home (3% growth), downsize at 70 to a $300k home with 6% costs, 2% inflation: savings rise by $500k × 1.03¹⁰ − $300k × 1.06 × 1.02¹⁰ and the smaller home is worth $300k × 1.02¹⁰.',
    run() {
      const p = flat({ people: { p1: { name: 'A', age: 60, retireAge: 60, planToAge: 90 } }, assets: [asset('nonretirement', 0), asset('other', 500000, { label: 'Home' })],
        assumptions: { nonReturn: 0, otherGrowth: 3, inflation: 2 } });
      const r = M.project(M.applyIdea(p, 'downsize', { atAge: 70, price: 300000, costsPct: 6 }), 20);
      return [approx(r.liq50[10], 500000 * Math.pow(1.03, 10) - 300000 * 1.06 * Math.pow(1.02, 10)), approx(r.p50[10] - r.liq50[10], 300000 * Math.pow(1.02, 10))];
    }
  },
  {
    name: 'Stacked homes: downsizing after buying a new home sells the new home, not one already sold',
    why: 'Buy a new home in 3 years, then downsize at 70: the downsize must sell "New home" in that year.',
    run() {
      const p = M.EXAMPLE(), s1 = M.applyIdea(p, 'home', { ...M.ideaDefaults(p, 'home').params, inYears: 3 });
      const s2 = M.applyIdea(s1, 'downsize', { atAge: 70, price: 500000, costsPct: 6 }), y = YEAR + (70 - p.people.p1.age);
      const nh = s2.assets.find(a => a.label === 'New home');
      return truthy(nh && nh.sellYear === y && s2.assets.some(a => a.label === 'Smaller home' && a.fromYear === y), `New home sellYear ${nh && nh.sellYear}, expected ${y}`, `New home sold in ${y}`);
    }
  },
  {
    name: 'A loan can start in a future year: today\'s-dollar balance, payments from the next year, paid off by its end year',
    why: '$300k (today\'s dollars) at 6% from 2029 to 2059, 2% inflation: balance appears in 2029 as $300k × 1.02³, nothing before, standard 30-year payments after, gone by 2059.',
    run() {
      const s = base({ liabilities: [{ label: 'New mortgage', balance: 300000, rate: 6, monthlyPayment: null, startYear: YEAR + 3, endYear: YEAR + 33 }] });
      const r = M.project(s, 20), B = 300000 * Math.pow(1.02, 3), p = pmt(B, 0.06, 360);
      return [approx(r.debtBal[2], 0, { abs: 0 }), approx(r.debtBal[3], B), approx(r.debtPay[3], 0, { abs: 0 }), approx(r.debtPay[4], 12 * p, { abs: 1 }), approx(r.debtBal[33], 0, { abs: 1 }),
        truthy(r.events[3].some(e => /New mortgage begins/.test(e)), 'no "begins" event')];
    }
  },
  {
    name: 'A home can be bought in a future year: its today\'s-dollar price appears that year, then grows like other homes',
    why: '$500k home from 2028, 2% inflation, 3% home growth: absent in 2027, $500k × 1.02² in 2028, then × 1.03 a year.',
    run() {
      const s = base({ assets: [asset('nonretirement', 1e6), asset('other', 500000, { label: 'New home', fromYear: YEAR + 2 })] });
      const r = M.project(s, 20), v2 = 500000 * Math.pow(1.02, 2);
      return [approx(r.p50[1], 1e6), approx(r.p50[2], 1e6 + v2), approx(r.p50[5], 1e6 + v2 * Math.pow(1.03, 3))];
    }
  },
  {
    name: 'Selling a home moves its value into savings that year; net worth only changes by growth',
    why: '$1M home sold in 2030 at 3% growth: savings (not counting the home) jump by $1M × 1.03⁴ in 2030 and the home leaves net worth.',
    run() {
      const s = base({ assets: [asset('nonretirement', 0), asset('other', 1e6, { label: 'Home', sellYear: YEAR + 4 })] });
      const r = M.project(s, 20), sale = 1e6 * Math.pow(1.03, 4);
      return [approx(r.liq50[3], 0, { abs: 1 }), approx(r.liq50[4], sale), approx(r.p50[4], sale), approx(r.p50[5], sale),
        truthy(r.events[4].some(e => /Home sold/.test(e)), 'no "sold" event')];
    }
  },
  {
    name: 'Life ideas: every idea has suggested values and applies to every test household without breaking the projection',
    why: 'Defaults come from the plan and config.js; the result must still project (finite numbers every year).',
    run() {
      const out = [];
      for (const idea of M.IDEAS) for (const [k, f] of Object.entries(personas)) {
        const p = f(), d = M.ideaDefaults(p, idea.id), s = M.applyIdea(p, idea.id, d.params), r = M.project(s, 50);
        const ok = d.params && Array.from(r.p50).every(Number.isFinite) && JSON.stringify(p) === JSON.stringify(f());
        if (!ok) out.push(truthy(false, `${idea.id} on ${k} failed (or changed the original plan)`));
      }
      return out.length ? out : truthy(true, '', `${M.IDEAS.length} ideas × ${Object.keys(personas).length} households`);
    }
  },
  {
    name: 'Another kid: a child born in N years, with childcare and everyday costs for the right ages, and college',
    why: 'Born in 2 years: dependent age −2 (college at 18 → 16 years out); childcare from Partner 1\'s age +2 for 5 years; everyday costs to 18.',
    run() {
      const p = base(), s = M.applyIdea(p, 'kid', { inYears: 2, childcare: 18000, childcareUntil: 5, extra: 10000, extraUntil: 18, college: true, collegeCost: 30000 });
      const kid = s.dependents[s.dependents.length - 1], care = s.spending.find(x => /childcare/i.test(x.label)), extra = s.spending.find(x => /everyday/i.test(x.label));
      const r = M.project(s, 20);
      return [truthy(kid && kid.age === -2 && kid.college, 'dependent missing or wrong age'), truthy(care && care.fromAge === 42 && care.toAge === 46 && care.amount === 18000, `childcare ${JSON.stringify(care)}`),
        truthy(extra && extra.fromAge === 42 && extra.toAge === 59, `everyday ${JSON.stringify(extra)}`), truthy(r.events[20].some(e => /starts college/.test(e)), 'college does not start 20 years out')];
    }
  },
  {
    name: 'New home: down payment and costs, the new home and its mortgage start that year, and the current home is sold',
    why: 'Example household, $1.2M home in 3 years, 20% down, 5% costs, 6.5% for 30 years: purchase $300k (today\'s dollars), new home and $960k mortgage from year 3, current home sold and its mortgage paid off that year.',
    run() {
      const p = M.EXAMPLE(), y = YEAR + 3;
      const s = M.applyIdea(p, 'home', { inYears: 3, price: 1200000, downPct: 20, costsPct: 5, rate: 6.5, years: 30, sellCurrent: true, upkeepPct: 1.5 });
      const buy = s.purchases.find(x => x.year === y && /new home/i.test(x.label)), home = s.assets.find(a => a.fromYear === y), loan = s.liabilities.find(l => l.startYear === y);
      const old = s.assets.find(a => a.sellYear === y), oldLoan = s.liabilities.find(l => /mortgage/i.test(l.label) && !l.startYear);
      const r = M.project(s, 50);
      return [truthy(buy && Math.abs(buy.amount - 300000) < 1, `purchase ${buy && buy.amount}`), truthy(home && home.balance === 1200000 && home.kind === 'other', 'new home missing'),
        truthy(loan && loan.balance === 960000 && loan.endYear === y + 30, `mortgage ${JSON.stringify(loan)}`), truthy(old && /home/i.test(old.label), 'current home not sold'),
        truthy(oldLoan && oldLoan.endYear === y && oldLoan.monthlyPayment > 0, 'old mortgage not paid off at the sale'), truthy(r.events[3].some(e => /sold/.test(e)), 'no sale event')];
    }
  },
  {
    name: 'Career break: pay stops for the break and resumes after, and moving retirement still moves the later salary',
    why: 'Salary for A (40): a 2-year break starting in 1 year → paid at 40, not at 41–42, paid again from 43 to retirement.',
    run() {
      const p = base({ income: [{ label: 'Pay', type: 'salary', owner: 'p1', amount: 100000, startAge: null, endAge: null }] });
      p.people.p1.retireAge = 60;
      const s = M.applyIdea(p, 'break', { who: 'p1', inYears: 1, years: 2 }), r = M.project(s, 20);
      return [truthy(r.inc[1] === 0 && r.inc[2] === 0 && r.inc[3] > 0, `pay by year: ${[0, 1, 2, 3].map(t => Math.round(r.inc[t])).join(', ')}`, 'paused years 1–2, back in year 3'),
        truthy(s.income.length === 2, 'salary not split in two')];
    }
  },
  {
    name: 'Windfall: arrives untaxed in its year; ideas stack into one scenario',
    why: '$100k inheritance in 5 years (today\'s dollars, 2% inflation) adds $100k × 1.02⁵ to savings with no tax; stacking it with a $40k big purchase in year 2 keeps both.',
    run() {
      const p = base(), s = M.applyIdea(p, 'windfall', { inYears: 5, amount: 100000 });
      const r0 = M.project(p, 20), r = M.project(s, 20);
      const both = M.applyIdea(s, 'purchase', { inYears: 2, amount: 40000, label: 'Boat' });
      return [approx(r.liq50[5] - r0.liq50[5], 100000 * Math.pow(1.02, 5)), approx(r.taxes[5], 0, { abs: 0 }),
        truthy(both.purchases.length === 2 && both.purchases.some(x => /Boat/.test(x.label)), 'stacking lost an idea')];
    }
  },
  {
    name: 'Scenario summaries: each idea reads as a plain action with amount, age and year',
    why: 'Saved scenarios say what they do, e.g. "Give family $100k at age 50 (2036)", so nobody has to decode the changes list.',
    run() {
      const single = base(), couple = flat({ people: { p1: { name: 'Sam', age: 30, retireAge: 62, planToAge: 95 }, p2: { enabled: true, name: 'Jo', age: 31, retireAge: 62, planToAge: 95 } },
        assets: [asset('other', 500000, { label: 'Home', owner: 'joint' })], income: [{ label: "Jo's salary", type: 'salary', owner: 'p2', amount: 90000 }] });
      const S = M.ideaSummary;
      return [
        truthy(S(single, 'family', { inYears: 10, years: 1, perYear: 100000 }) === `Give family $100k at age 50 (${YEAR + 10})`, S(single, 'family', { inYears: 10, years: 1, perYear: 100000 }), 'one-off gift'),
        truthy(S(couple, 'family', { inYears: 1, years: 5, perYear: 12000 }) === `Give family $12k a year for 5 years, starting when Sam is 31 (${YEAR + 1}): $60k in all`, S(couple, 'family', { inYears: 1, years: 5, perYear: 12000 }), 'yearly help'),
        truthy(S(single, 'windfall', { inYears: 5, amount: 100000 }) === `Receive $100k at age 45 (${YEAR + 5}), not taxed`, S(single, 'windfall', { inYears: 5, amount: 100000 }), 'windfall'),
        truthy(S(single, 'purchase', { inYears: 2, amount: 42500, label: 'New car', repeatEvery: 8 }) === `Spend $42.5k on New car at age 42 (${YEAR + 2}), then every 8 years`, S(single, 'purchase', { inYears: 2, amount: 42500, label: 'New car', repeatEvery: 8 }), 'purchase'),
        truthy(/^Jo takes a 2-year career break at 32 \(\d{4}\), then pay picks up again$/.test(S(couple, 'break', { who: 'p2', inYears: 1, years: 2 })), S(couple, 'break', { who: 'p2', inYears: 1, years: 2 }), 'break uses the right person'),
        truthy(/selling your current home/.test(S(couple, 'home', { inYears: 3, price: 750000, downPct: 20, costsPct: 5, rate: 6.5, years: 30, sellCurrent: true })), S(couple, 'home', { inYears: 3, price: 750000, downPct: 20, costsPct: 5, rate: 6.5, years: 30, sellCurrent: true }), 'home sale mentioned'),
        truthy(!/selling/.test(S(single, 'home', { inYears: 3, price: 750000, downPct: 20, costsPct: 5, rate: 6.5, years: 30, sellCurrent: true })), 'mentions selling a home the plan doesn\'t have', 'no home, no sale'),
        truthy(/^Sell the home when Sam is 70 \(\d{4}\) and buy a \$300k one/.test(S(couple, 'downsize', { atAge: 70, price: 300000, costsPct: 6 })), S(couple, 'downsize', { atAge: 70, price: 300000, costsPct: 6 }), 'downsize')
      ];
    }
  },
  {
    name: 'Scenario summaries and names work for every idea on every test household',
    why: 'No blanks, NaN or "undefined", and the short name carries an age so two versions of an idea are easy to tell apart.',
    run() {
      const out = [];
      for (const idea of M.IDEAS) for (const [k, f] of Object.entries(personas)) {
        const p = f(), d = M.ideaDefaults(p, idea.id), s = M.ideaSummary(p, idea.id, d.params), l = M.ideaLabel(idea.id, d.params, p);
        if (!s || /NaN|undefined|null/.test(s + l)) out.push({ pass: false, detail: `${idea.id} on ${k}: "${s}" / "${l}"` });
        if (!/\d/.test(l)) out.push({ pass: false, detail: `${idea.id} label has no age: "${l}"` });
      }
      return out.length ? out : truthy(true, '', `${M.IDEAS.length} ideas × ${Object.keys(personas).length} households`);
    }
  }
];
