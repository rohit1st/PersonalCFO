/*
  3. Simulation properties: things that must hold for any sensible Monte Carlo.
*/
'use strict';
const { M, plan, clone, truthy, approx } = require('../lib');
const personas = require('../personas');

function monotone(values, dir) {
  for (let i = 1; i < values.length; i++) if (dir * (values[i] - values[i - 1]) < -1e-9) return false;
  return true;
}
const withSpend = (s, k) => { const c = clone(s); c.spending.forEach(x => { x.amount = x.amount * k; }); return c; };

module.exports = [
  {
    name: 'Same inputs give the same answer every time',
    why: 'The random numbers use a fixed seed so scenario comparisons are fair.',
    run() {
      const a = M.project(personas.example()), b = M.project(personas.example());
      return truthy(a.success === b.success && a.p50.every((v, t) => v === b.p50[t]), 'two runs differ');
    }
  },
  {
    name: 'Worst ≤ mid ≤ best in every year, for every persona',
    why: 'Percentiles must be ordered.',
    run() {
      return Object.entries(personas).map(([k, f]) => {
        const r = M.project(f());
        const ok = r.p10.every((v, t) => v <= r.p50[t] + 1e-6 && r.p50[t] <= r.p90[t] + 1e-6);
        return truthy(ok, `${k}: percentiles out of order`);
      });
    }
  },
  {
    name: 'No market ups and downs: best, mid and worst are the same line',
    why: 'Volatility 0 means every path is identical.',
    run() {
      const s = personas.example(); s.assumptions.volatility = 0;
      const r = M.project(s, 50);
      return truthy(r.p10.every((v, t) => Math.abs(v - r.p90[t]) < 1e-6), 'band should collapse');
    }
  },
  {
    name: 'More market ups and downs widens the range',
    why: 'Gap between best and worst at the end of the plan should grow with volatility.',
    run() {
      const gap = vol => { const s = personas.example(); s.assumptions.volatility = vol; const r = M.project(s); return r.p90[r.H] - r.p10[r.H]; };
      const g = [6, 12, 18].map(gap);
      const d = `end-of-plan gaps ${g.map(x => '$' + (x / 1e6).toFixed(1) + 'M').join(' < ')}`; return truthy(monotone(g, 1), d, d);
    }
  },
  {
    name: 'Spending more never raises the chance of success',
    why: 'Checked for each persona at 80%, 100%, 120%, 140% of spending.',
    run() {
      return Object.entries(personas).map(([k, f]) => {
        const v = [0.8, 1, 1.2, 1.4].map(x => M.project(withSpend(f(), x)).success);
        return truthy(monotone(v, -1), `${k}: ${v.join(' → ')}`);
      });
    }
  },
  {
    name: 'Retiring later never lowers the chance of success',
    why: 'Checked for each working persona at −2, 0, +2, +4 years.',
    run() {
      return Object.entries(personas).filter(([k]) => k !== 'already_retired_single').map(([k, f]) => {
        const v = [-2, 0, 2, 4].map(d => M.project(M.shiftRetirement(f(), d)).success);
        return truthy(monotone(v, 1), `${k}: ${v.join(' → ')}`);
      });
    }
  },
  {
    name: 'Retiring later never lowers net worth at the end of the plan, even when salaries have an end age',
    why: 'More working years can only add pay. Worst, mid and best at plan end (today\'s dollars), −4 to +4 years (moved the way the Retire at slider moves them), for each working persona as is, with every salary ending at retirement, and with every salary "until" 6 years after retirement (it must not keep paying once retired).',
    run() {
      const out = [];
      for (const [k, f] of Object.entries(personas)) {
        if (k === 'already_retired_single') continue;
        for (const [variant, extra] of [['as is', null], ['salaries end at retirement', 0], ['salaries until 6 years after retirement', 6]]) {
          const ends = [];
          for (const d of [-4, -2, 0, 2, 4]) {
            const s = f(), p1 = s.people.p1, p2 = s.people.p2;
            if (extra !== null) s.income.forEach(i => { if (i.type === 'salary' && !(i.endAge < (i.owner === 'p2' ? p2 : p1).retireAge)) i.endAge = (i.owner === 'p2' ? p2 : p1).retireAge + extra; });
            const r = M.project(M.shiftRetirement(s, d), 400), real = Math.pow(1 + r.infl, r.H);
            ends.push([r.p10[r.H] / real, r.p50[r.H] / real, r.p90[r.H] / real]);
          }
          ['worst', 'mid', 'best'].forEach((name, j) => {
            const v = ends.map(e => e[j]);
            out.push(truthy(monotone(v.map(x => Math.round(x)), 1), `${k} (${variant}) ${name} at end: ${v.map(x => '$' + (x / 1e6).toFixed(2) + 'M').join(' → ')}`));
          });
        }
      }
      return out.every(x => x.pass) ? truthy(true, '', `${out.length} checks`) : out.filter(x => !x.pass);
    }
  },
  {
    name: 'Work-optional age moves salaries the same way the Retire at slider does',
    why: 'At the work-optional age, the plan (shifted like the slider) lasts in enough markets; one year sooner it does not. Checked on the Coast FIRE couple, whose last salaries have end ages.',
    run() {
      const s = personas.coast_fire_couple(), w = M.workOptional(s), r1 = s.people.p1.retireAge;
      if (w === null) return truthy(false, 'no work-optional age found');
      const at = M.project(M.shiftRetirement(s, w - r1), 400).success, before = M.project(M.shiftRetirement(s, w - 1 - r1), 400).success;
      return [truthy(at >= M.WO_TARGET, `at ${w}: ${at}`, `at ${w}: ${at}`), truthy(before < M.WO_TARGET, `at ${w - 1}: ${before}`, `at ${w - 1}: ${before}`)];
    }
  },
  {
    name: 'Higher returns never lower the chance of success',
    why: 'Both return assumptions moved together by −2, 0, +2 points.',
    run() {
      return Object.entries(personas).map(([k, f]) => {
        const v = [-2, 0, 2].map(d => { const s = f(); s.assumptions.retReturn += d; s.assumptions.nonReturn += d; return M.project(s).success; });
        return truthy(monotone(v, 1), `${k}: ${v.join(' → ')}`);
      });
    }
  },
  {
    name: 'Work-optional age never gets earlier when spending goes up',
    why: 'Spending 90% vs 110% of the example.',
    run() {
      const lo = M.workOptional(withSpend(personas.example(), 0.9)), hi = M.workOptional(withSpend(personas.example(), 1.1));
      const d = `90% spending: ${lo}, 110%: ${hi}`; return truthy((lo ?? 999) <= (hi ?? 999), d, d);
    }
  },
  {
    name: 'Worst-case savings run out no later than the mid case',
    why: 'Depletion year ordering.',
    run() {
      return Object.entries(personas).map(([k, f]) => { const r = M.project(f()); return truthy(r.deplWorst <= r.deplMid, `${k}: worst ${r.deplWorst}, mid ${r.deplMid}`); });
    }
  },
  {
    name: 'Speed: a full projection stays fast',
    why: 'The page recalculates as people type (1,000 paths plus the work-optional search).',
    severity: 'soft',
    run() {
      const t0 = Date.now(); for (let i = 0; i < 5; i++) M.project(personas.example()); const one = (Date.now() - t0) / 5;
      const t1 = Date.now(); M.workOptional(personas.example()); const wo = Date.now() - t1;
      const a = `project(): ${one.toFixed(1)} ms (budget 80)`, b = `workOptional(): ${wo} ms (budget 400)`; return [truthy(one < 80, a, a), truthy(wo < 400, b, b)];
    }
  }
];
