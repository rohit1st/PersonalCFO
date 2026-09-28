/*
  5. Golden results: key outcomes for each persona, saved in golden/golden.json.
  Any model or config change that moves them shows up here, so you can decide
  whether the change is intended. Accept intended changes with:
      node evals/run.js --update
*/
'use strict';
const { M, fs, path, truthy } = require('../lib');
const personas = require('../personas');
const FILE = path.join(__dirname, '..', 'golden', 'golden.json');

function snapshot() {
  const out = {};
  for (const [k, f] of Object.entries(personas)) {
    const s = f(), r = M.project(s), rt = r.retireT === null ? r.H : r.retireT, real = (v, t) => v / Math.pow(1 + r.infl, t);
    out[k] = {
      successPct: Math.round(r.success * 1000) / 10,
      workOptionalAge: M.workOptional(s),
      midAtRetirement: Math.round(real(r.p50[rt], rt)),
      worstAtEnd: Math.round(real(r.p10[r.H], r.H)),
      midAtEnd: Math.round(real(r.p50[r.H], r.H)),
      bestAtEnd: Math.round(real(r.p90[r.H], r.H)),
      taxesThisYear: Math.round(r.taxNow),
      midSavingsRunOutAge: r.deplMid === Infinity ? null : r.a1 + r.deplMid
    };
  }
  return out;
}

function close(a, b, key) {
  if (a === null || b === null || typeof a !== 'number') return a === b;
  if (key === 'successPct') return Math.abs(a - b) <= 0.5;
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);
}

module.exports = [
  {
    name: 'Persona outcomes match the saved golden results',
    why: 'Catches unintended changes. Tolerance: 0.5 points of success, 0.5% on dollar amounts.',
    run(ctx) {
      const now = snapshot();
      if (ctx.update || !fs.existsSync(FILE)) {
        fs.writeFileSync(FILE, JSON.stringify(now, null, 2) + '\n');
        const m = ctx.update ? 'golden results updated' : 'golden results created (first run)'; return truthy(true, m, m);
      }
      const gold = JSON.parse(fs.readFileSync(FILE, 'utf8')), results = [];
      for (const k of new Set([...Object.keys(gold), ...Object.keys(now)])) {
        if (!gold[k] || !now[k]) { results.push(truthy(false, `${k}: persona ${gold[k] ? 'removed' : 'added'} (run with --update)`)); continue; }
        for (const f of Object.keys(now[k])) {
          if (!close(now[k][f], gold[k][f], f)) results.push(truthy(false, `${k}.${f}: was ${gold[k][f]}, now ${now[k][f]}`));
        }
      }
      const m = `${Object.keys(now).length} personas unchanged`; return results.length ? results : truthy(true, m, m);
    }
  }
];
module.exports.snapshot = snapshot;
