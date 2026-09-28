#!/usr/bin/env node
/*
  Sensitivity report: how outcomes move as each assumption changes.
  node evals/sensitivity.js                 example household
  node evals/sensitivity.js near_retirement_couple
  Writes evals/reports/sensitivity-<persona>.md and .csv
*/
'use strict';
const { M, clone, fs, path } = require('./lib');
const personas = require('./personas');

const key = process.argv[2] || 'example';
if (!personas[key]) { console.error(`Unknown persona "${key}". Choose one of: ${Object.keys(personas).join(', ')}`); process.exit(1); }
const base = personas[key]();

function outcome(s) {
  const r = M.project(s), rt = r.retireT === null ? r.H : r.retireT, real = (v, t) => v / Math.pow(1 + r.infl, t);
  return { success: r.success, wo: M.workOptional(s), midRet: real(r.p50[rt], rt), worstEnd: real(r.p10[r.H], r.H), midEnd: real(r.p50[r.H], r.H), bestEnd: real(r.p90[r.H], r.H) };
}
const edit = (fn) => { const s = clone(base); fn(s); return s; };
const shiftRet = d => s => { s.people.p1.retireAge += d; if (s.people.p2.enabled) s.people.p2.retireAge += d; };
const A = base.assumptions;

// One assumption at a time
const levers = [
  ['Retirement account return', [-2, -1, 0, 1, 2].map(d => [`${(A.retReturn + d).toFixed(1)}%`, s => { s.assumptions.retReturn += d; }])],
  ['Non-retirement return', [-2, -1, 0, 1, 2].map(d => [`${(A.nonReturn + d).toFixed(1)}%`, s => { s.assumptions.nonReturn += d; }])],
  ['Both returns together', [-2, -1, 0, 1, 2].map(d => [`${d >= 0 ? '+' : ''}${d} pts`, s => { s.assumptions.retReturn += d; s.assumptions.nonReturn += d; }])],
  ['Market ups and downs', [6, 9, 12, 15, 18].map(v => [`${v}%`, s => { s.assumptions.volatility = v; }])],
  ['Inflation', [1.5, 2, 2.5, 3, 4].map(v => [`${v}%`, s => { s.assumptions.inflation = v; }])],
  ['Salary growth', [1.5, 2.5, 3.5, 4.5].map(v => [`${v}%`, s => { s.assumptions.earningsGrowth = v; }])],
  ['Spending', [0.8, 0.9, 1, 1.1, 1.2].map(k => [`${Math.round(k * 100)}%`, s => { s.spending.forEach(x => { x.amount *= k; }); }])],
  ['Retirement age', [-3, -1, 0, 1, 3].map(d => [`${d >= 0 ? '+' : ''}${d} yrs`, shiftRet(d)])],
  ['State income tax', [0, 5, 9.3].map(v => [`${v}%`, s => { s.assumptions.stateTax = v; }])]
];

const money = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(2) + 'M' : Math.round(Math.abs(v) / 1e3) + 'k');
const b0 = outcome(base);
const md = [`# Sensitivity: ${key}`, '', `Base case: lasts in **${Math.round(b0.success * 100)}%** of markets, work-optional at **${b0.wo ?? '80+'}**, mid-case net worth at retirement **${money(b0.midRet)}** (today's dollars).`, ''];
const csv = [['lever', 'setting', 'success_pct', 'work_optional_age', 'mid_at_retirement', 'worst_at_end', 'mid_at_end', 'best_at_end']];
console.log(`\nSensitivity for "${key}" (today's dollars)\n`);
for (const [name, steps] of levers) {
  md.push(`## ${name}`, '', '| Setting | Lasts in | Work-optional | Mid at retirement | End of plan: worst / mid / best |', '| --- | --- | --- | --- | --- |');
  console.log(name);
  for (const [label, fn] of steps) {
    const o = outcome(edit(fn));
    const row = `| ${label} | ${Math.round(o.success * 100)}% | ${o.wo ?? '80+'} | ${money(o.midRet)} | ${money(o.worstEnd)} / ${money(o.midEnd)} / ${money(o.bestEnd)} |`;
    md.push(row);
    csv.push([name, label, (o.success * 100).toFixed(1), o.wo ?? '', Math.round(o.midRet), Math.round(o.worstEnd), Math.round(o.midEnd), Math.round(o.bestEnd)]);
    console.log(`  ${label.padEnd(9)} lasts ${String(Math.round(o.success * 100)).padStart(3)}%  work-optional ${String(o.wo ?? '80+').padStart(3)}  mid at retirement ${money(o.midRet).padStart(8)}`);
  }
  md.push('');
}
// Two assumptions at once: returns × volatility → chance of success
const rets = [-2, -1, 0, 1, 2], vols = [6, 9, 12, 15, 18];
md.push('## Returns × market ups and downs (chance savings last)', '', `| Returns | ${vols.map(v => v + '%').join(' | ')} |`, `| --- | ${vols.map(() => '---').join(' | ')} |`);
for (const d of rets) {
  const cells = vols.map(v => Math.round(M.project(edit(s => { s.assumptions.retReturn += d; s.assumptions.nonReturn += d; s.assumptions.volatility = v; })).success * 100) + '%');
  md.push(`| ${d >= 0 ? '+' : ''}${d} pts | ${cells.join(' | ')} |`);
}
const dir = path.join(__dirname, 'reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `sensitivity-${key}.md`), md.join('\n') + '\n');
fs.writeFileSync(path.join(dir, `sensitivity-${key}.csv`), csv.map(r => r.join(',')).join('\n') + '\n');
console.log(`\nWrote evals/reports/sensitivity-${key}.md and .csv\n`);
