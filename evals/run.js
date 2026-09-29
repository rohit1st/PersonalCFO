#!/usr/bin/env node
/*
  Net Worth Planner evals
  -----------------------
  node evals/run.js              run everything
  node evals/run.js --update     accept current results as the new golden results
  node evals/run.js --only tax   run evals whose name contains "tax"

  Hard evals must pass (exit code 1 otherwise). Soft evals are plausibility
  checks: they are reported as warnings and don't fail the run.
  A markdown report is written to evals/reports/latest.md.
*/
'use strict';
const { fs, path, fmt } = require('./lib');

const args = process.argv.slice(2);
const ctx = { update: args.includes('--update') };
const only = args.includes('--only') ? (args[args.indexOf('--only') + 1] || '').toLowerCase() : '';

const dir = path.join(__dirname, 'suites');
const suites = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const color = process.stdout.isTTY ? { g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m` } : { g: s => s, r: s => s, y: s => s, d: s => s };

let hardFail = 0, softFail = 0, passed = 0;
const md = [`# Eval report`, ``, `Run: ${new Date().toISOString()}`, ``];
const t0 = Date.now();

(async () => {
for (const file of suites) {
  const evals = require(path.join(dir, file));
  const title = file.replace(/\.js$/, '').replace(/^\d+-/, '');
  console.log(`\n${title.toUpperCase()}`);
  md.push(`## ${title}`, '', '| Result | Eval | Details |', '| --- | --- | --- |');
  for (const e of evals) {
    if (only && !e.name.toLowerCase().includes(only)) continue;
    let results;
    try { results = [].concat(await e.run(ctx)); }   // evals may be async
    catch (err) { results = [{ pass: false, detail: `crashed: ${err.message}` }]; }
    const ok = results.every(r => r && r.pass);
    const soft = e.severity === 'soft';
    const details = results.filter(r => r && r.detail && (!r.pass || ok)).filter(r => ok || !r.pass).map(r => r.detail).join('; ');
    if (ok) { passed++; console.log(`  ${color.g('✓')} ${e.name} ${color.d(details)}`); }
    else if (soft) { softFail++; console.log(`  ${color.y('!')} ${e.name}\n      ${color.y(details)}\n      ${color.d(e.why)}`); }
    else { hardFail++; console.log(`  ${color.r('✗')} ${e.name}\n      ${color.r(details)}\n      ${color.d(e.why)}`); }
    md.push(`| ${ok ? '✅ pass' : soft ? '⚠️ warn' : '❌ fail'} | ${e.name} | ${(ok ? details : details + ' — ' + e.why).replace(/\|/g, '\\|')} |`);
  }
  md.push('');
}

const summary = `${passed} passed, ${hardFail} failed, ${softFail} warnings (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
console.log(`\n${hardFail ? color.r(summary) : softFail ? color.y(summary) : color.g(summary)}\n`);
md.splice(3, 0, `**${summary}**`, '');
fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'reports', 'latest.md'), md.join('\n') + '\n');
process.exit(hardFail ? 1 : 0);
})();
