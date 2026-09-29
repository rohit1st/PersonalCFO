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
