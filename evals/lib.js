/*
  Shared helpers for the Net Worth Planner evals.
  Everything runs in plain Node (v18+), no packages to install.
*/
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const YEAR = 2026;               // fixed so results don't drift with the calendar

// Load config.js the same way the browser does (it assigns window.PLANNER_CONFIG)
function loadConfig() {
  global.window = global.window || {};
  const file = path.join(ROOT, 'config.js');
  delete require.cache[require.resolve(file)];
  require(file);
  return global.window.PLANNER_CONFIG;
}
const CONFIG = loadConfig();
const NWPModel = require(path.join(ROOT, 'model.js'));
const M = NWPModel.create(CONFIG, { year: YEAR });

const clone = o => JSON.parse(JSON.stringify(o));

// Build a plan from a blank one plus overrides. Arrays replace, objects merge.
function plan(over = {}) {
  const s = M.BLANK();
  const merge = (a, b) => {
    for (const k of Object.keys(b)) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  };
  return merge(s, clone(over));
}
// A deterministic plan: no market ups and downs, so every simulated path is identical
function flat(over = {}) {
  const s = plan(over);
  s.assumptions.volatility = 0;
  return s;
}
// Shorthands for common rows
const retired = (age = 65, planTo = 95) => ({ p1: { name: 'A', age, retireAge: Math.min(age, 60), planToAge: planTo } });
const asset = (kind, balance, extra = {}) => ({ label: kind, kind, owner: 'p1', taxType: 'pretax', balance, contribution: 0, employerContribution: 0, ...extra });
const spendAlways = amount => ({ label: 'Living', category: 'other', when: 'always', amount, fromAge: null, toAge: null });

// Assertions return a result object instead of throwing, so one run reports everything
function approx(actual, expected, { rel = 1e-6, abs = 0.5 } = {}) {
  const tol = Math.max(abs, Math.abs(expected) * rel);
  return { pass: Math.abs(actual - expected) <= tol, detail: `got ${fmt(actual)}, expected ${fmt(expected)} (±${fmt(tol)})` };
}
function between(actual, lo, hi) {
  return { pass: actual >= lo && actual <= hi, detail: `got ${fmt(actual)}, expected between ${fmt(lo)} and ${fmt(hi)}` };
}
// detail is shown when the check fails; passDetail (optional) is shown when it passes
function truthy(cond, detail, passDetail = '') { return { pass: !!cond, detail: cond ? passDetail : detail }; }
function fmt(v) {
  if (typeof v !== 'number') return String(v);
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-US');
  return +v.toFixed(4) + '';
}

module.exports = { ROOT, YEAR, CONFIG, M, NWPModel, clone, plan, flat, retired, asset, spendAlways, approx, between, truthy, fmt, fs, path };
