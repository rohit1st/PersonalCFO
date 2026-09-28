#!/usr/bin/env node
/*
  Copy the settings in config.js into model.js's built-in fallback copy.
  Run after editing config.js:   node evals/sync-builtin.js
*/
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const cfg = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const start = cfg.indexOf('window.PLANNER_CONFIG = ');
if (start < 0) { console.error('config.js: could not find "window.PLANNER_CONFIG = "'); process.exit(1); }
const obj = cfg.slice(start + 'window.PLANNER_CONFIG = '.length).trim().replace(/;\s*$/, '');
const modelFile = path.join(root, 'model.js');
let model = fs.readFileSync(modelFile, 'utf8');
const a = model.indexOf('const BUILTIN_CONFIG = '), b = model.indexOf('function mergeConfig');
if (a < 0 || b < 0) { console.error('model.js: markers not found'); process.exit(1); }
const indented = obj.split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n');
model = model.slice(0, a) + 'const BUILTIN_CONFIG = ' + indented + ';\n  ' + model.slice(b);
fs.writeFileSync(modelFile, model);
console.log('Copied config.js into model.js (BUILTIN_CONFIG).');
