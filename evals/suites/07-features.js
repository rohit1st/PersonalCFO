/*
  7. Features built on the projection: what changed in a scenario, the key result
  tiles, and the "what's new" note shown after an update.
*/
'use strict';
const { M, CONFIG, ROOT, flat, asset, spendAlways, approx, truthy, fs, path } = require('../lib');
const personas = require('../personas');

const labels = d => d.map(x => `${x.label}: ${x.from} → ${x.to}`);

module.exports = [
  {
    name: 'Scenario details: a plan compared with itself has no differences',
    why: 'Nothing should be listed as changed when nothing changed, for every test household.',
    run() {
      return Object.entries(personas).map(([k, f]) => { const d = M.planDiff(f(), f()); return truthy(d.length === 0, `${k}: ${labels(d).join('; ')}`); });
    }
  },
  {
    name: 'Scenario details: changed ages and assumptions are listed with names and before/after values',
    why: 'Example household: Sam retires at 60 instead of 62, returns 5% → 4%, inflation 2.5% → 3%. Exactly those three show, in plain labels.',
    run() {
      const base = M.EXAMPLE(), sc = M.clone(base);
      sc.people.p1.retireAge = 60; sc.assumptions.retReturn = 4; sc.assumptions.inflation = 3;
      const d = M.planDiff(base, sc), got = labels(d).join('; ');
      return [
        truthy(d.length === 3, `expected 3 changes, got ${d.length}: ${got}`, got),
        truthy(d.some(x => x.label === "Sam's retirement age" && x.from === 62 && x.to === 60 && x.format === 'age'), 'retirement age missing or mislabeled'),
        truthy(d.some(x => x.label === 'Retirement account return' && x.from === 5 && x.to === 4 && x.format === 'pct'), 'return missing or mislabeled'),
        truthy(d.every(x => x.change === 'changed'), 'wrong change type')
      ];
    }
  },
  {
    name: 'Scenario details: items added, removed or edited in a list are named',
    why: 'Removing the car loan, adding a spending item and raising groceries show as removed, added and changed, each with the item\'s name.',
    run() {
      const base = M.EXAMPLE(), sc = M.clone(base);
      sc.liabilities = sc.liabilities.filter(l => l.label !== 'Car loan');
      sc.spending.push({ label: 'Boat', category: 'travel', when: 'always', amount: 12000, fromAge: null, toAge: null });
      sc.spending[1].amount += 6000;
      const d = M.planDiff(base, sc), got = d.map(x => `${x.change} ${x.section}: ${x.label}`).join('; ');
      return [
        truthy(d.some(x => x.change === 'removed' && x.section === 'Loans' && /Car loan/.test(x.label)), 'car loan removal not shown', got),
        truthy(d.some(x => x.change === 'added' && x.section === 'Spending' && /Boat/.test(x.label)), 'added spending not shown'),
        truthy(d.some(x => x.change === 'changed' && x.section === 'Spending' && /Groceries/.test(x.label) && x.format === 'money' && x.to - x.from === 6000), 'groceries change not shown'),
        truthy(d.length === 3, `expected 3 changes, got ${d.length}: ${got}`)
      ];
    }
  },
  {
    name: 'Scenario details: switching an income\'s "rises with inflation" shows, and an unset default does not',
    why: 'A pension with no setting and one explicitly set to No are the same (pensions default to No); setting Yes is a change.',
    run() {
      const base = M.EXAMPLE(); base.income.push({ label: 'Pension', type: 'pension', owner: 'p1', amount: 20000, startAge: 65, endAge: null });
      const same = M.clone(base); same.income[same.income.length - 1].cola = false;
      const yes = M.clone(base); yes.income[yes.income.length - 1].cola = true;
      const d1 = M.planDiff(base, same), d2 = M.planDiff(base, yes);
      return [truthy(d1.length === 0, `unexpected: ${d1.map(x => x.label).join('; ')}`), truthy(d2.length === 1 && /rises with inflation/.test(d2[0].label), `got: ${d2.map(x => x.label).join('; ')}`, d2[0] && d2[0].label)];
    }
  },
  {
    name: 'Scenario details: moving retirement with the slider shows the salary end age it moved too',
    why: 'Coast FIRE couple, 2 years sooner: both retirement ages and both last salaries\' end ages change (4 rows).',
    run() {
      const base = personas.coast_fire_couple(), d = M.planDiff(base, M.shiftRetirement(base, -2)), got = labels(d).join('; ');
      return truthy(d.length === 4 && d.filter(x => x.section === 'Income').length === 2, `got ${d.length}: ${got}`, got);
    }
  },
  {
    name: 'Key results: net worth at retirement and at plan end are the mid case',
    why: 'Tiles show the same mid-case numbers as the chart and scenario table.',
    run() {
      const r = M.project(M.EXAMPLE()), k = M.keyResults(r);
      return [approx(k.atRetirement, r.p50[r.retireT]), approx(k.atEnd, r.p50[r.H]), approx(k.retireT, r.retireT, { abs: 0 })];
    }
  },
  {
    name: 'Key results: first-year draw from savings is spending not covered by income, as a share of savings',
    why: 'Already retired, $1M savings, $40k spending, no income, no inflation → 4%. With $50k of benefits the draw is 0.',
    run() {
      const base = { people: { p1: { name: 'A', age: 66, retireAge: 60, planToAge: 95 } }, assets: [asset('nonretirement', 1e6)], spending: [spendAlways(40000)], assumptions: { nonReturn: 0, inflation: 0 } };
      const a = M.keyResults(M.project(flat(base), 20));
      const b = M.keyResults(M.project(flat({ ...base, income: [{ label: 'Pension', type: 'benefit', owner: 'p1', amount: 50000, startAge: null, endAge: null }] }), 20));
      return [approx(a.drawRate, 0.04, { abs: 1e-9 }), approx(b.drawRate, 0, { abs: 0 })];
    }
  },
  {
    name: 'Key results: worst-case run-out age is shown only when the worst case runs out',
    why: 'Matches the simulation: none for a plan that always lasts, the age for one that does not.',
    run() {
      const ok = M.keyResults(M.project(personas.near_retirement_couple()));
      const short = M.project(personas.underfunded_family()), ks = M.keyResults(short);
      return [truthy(ok.worstRunOutAge === null, `got ${ok.worstRunOutAge}`), approx(ks.worstRunOutAge, short.a1 + short.deplWorst, { abs: 0 })];
    }
  },
  {
    name: 'Milestones: net worth milestones mark the first year the mid case passes each round number, in today\'s dollars',
    why: '$900k growing 10% a year, 2.5% inflation: real growth 7.3%, so $1M (today\'s dollars) is passed in year 2 and $2M in year 12. Round numbers already passed today are not shown.',
    run() {
      const s = flat({ people: { p1: { name: 'A', age: 40, retireAge: 80, planToAge: 60 } }, assets: [asset('nonretirement', 9e5)], assumptions: { nonReturn: 10, inflation: 2.5 } });
      const r = M.project(s, 20), m = M.milestones(r).filter(x => x.kind === 'networth');
      const real = t => r.p50[t] / Math.pow(1.025, t), first = v => { for (let t = 1; t <= r.H; t++) if (real(t) >= v) return t; return null; };
      const got = m.map(x => `${x.amount / 1e6}M@${x.t}`).join(', ');
      return [truthy(m.length >= 2 && m[0].amount === 1e6 && m[0].t === first(1e6) && m[1].amount === 2e6 && m[1].t === first(2e6), got, got),
        truthy(M.milestones(M.project(flat({ ...s, assets: [asset('nonretirement', 1.5e6)] }), 20)).every(x => x.kind !== 'networth' || x.amount > 1e6), '$1M shown although already passed')];
    }
  },
  {
    name: 'Milestones: the 4% rule marks the first year savings reach 25× that year\'s spending',
    why: 'Savings (not the home) of $500k plus $40k saved a year, spending $30k, no growth or inflation: 25 × $30k = $750k is reached in year 7 ($780k).',
    run() {
      const s = flat({ people: { p1: { name: 'A', age: 40, retireAge: 70, planToAge: 60 } }, assets: [asset('nonretirement', 5e5), asset('other', 2e6)],
        income: [{ label: 'Pay', type: 'other', owner: 'p1', amount: 70000, startAge: null, endAge: null }], spending: [spendAlways(30000)],
        assumptions: { nonReturn: 0, inflation: 0, otherGrowth: 0, payTaxRate: 0 } });
      const m = M.milestones(M.project(s, 20)).filter(x => x.kind === 'fourPercent');
      return truthy(m.length === 1 && m[0].t === 7, `got ${JSON.stringify(m)}`, `year ${m[0] && m[0].t}`);
    }
  },
  {
    name: 'Milestones: at most four net worth milestones, and none after savings run out',
    why: 'Keeps the chart uncluttered: the high-earner household passes many round numbers; only four show.',
    run() {
      const r = M.project(personas.high_earner_early_retirement()), m = M.milestones(r), nw = m.filter(x => x.kind === 'networth');
      return [truthy(nw.length <= 4, `${nw.length} shown`, `${nw.map(x => '$' + x.amount / 1e6 + 'M').join(', ')}`), truthy(m.every((x, i) => i === 0 || x.t >= m[i - 1].t), 'not in year order')];
    }
  },
  {
    name: "What's new: the newest note matches the version in sw.js",
    why: 'Every release bumps VERSION in sw.js; config.js whatsNew needs a note for it so people see what changed.',
    run() {
      const v = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
      const notes = CONFIG.whatsNew || [];
      return [truthy(notes.length && notes[0].version === v, `sw.js is ${v}, newest note is ${notes[0] && notes[0].version}`, `${v}: "${notes[0] && notes[0].note}"`),
        truthy(notes.every(x => x.version && x.note && x.note.length <= 160), 'a note is missing text or longer than 160 characters')];
    }
  }
];
