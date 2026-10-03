/*
  9. Color themes (config.js `themes`): every theme stays readable and on-brand.
  The design rules say pastel and light, no purple, and green / coral / amber keep
  their meanings (good / bad / caution), so themes only change the neutrals and
  the main accent.
*/
'use strict';
const { CONFIG, truthy } = require('../lib');

const REQUIRED = ['bg', 'surface', 'well', 'line', 'ink', 'muted', 'accent', 'accentSoft', 'accentDeep', 'accentHover', 'accentSofter', 'accentSoftHover', 'heroA', 'heroB'];
const rgb = h => { const x = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16) / 255); };
const lum = h => rgb(h).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function hsl(h) {
  const [r, g, b] = rgb(h), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hue * 60 + 360) % 360, s, l };
}
const themes = CONFIG.themes || [];

module.exports = [
  {
    name: 'Themes: there is at least one, the first is the default, and each has every color it needs',
    why: 'The page falls back to the first theme; a missing color would leave part of the page unstyled.',
    run() {
      return [truthy(themes.length >= 1, 'no themes in config.js'),
        ...themes.map(t => truthy(t.id && t.name && REQUIRED.every(k => /^#[0-9A-Fa-f]{6}$/.test((t.colors || {})[k] || '')), `${t.id || '?'}: missing or malformed ${REQUIRED.filter(k => !/^#[0-9A-Fa-f]{6}$/.test(((t.colors || {})[k]) || '')).join(', ')}`, t.id)),
        truthy(new Set(themes.map(t => t.id)).size === themes.length, 'two themes share an id')];
    }
  },
  {
    name: 'Themes: text and buttons stay readable (WCAG AA, 4.5:1)',
    why: 'Body text and muted text on cards and wells, accent text on its soft chip, and white text on accent buttons.',
    run() {
      const out = [];
      for (const t of themes) {
        const c = t.colors, pairs = [['ink on bg', c.ink, c.bg], ['ink on surface', c.ink, c.surface], ['muted on surface', c.muted, c.surface], ['muted on well', c.muted, c.well],
          ['accent text on surface', c.accentDeep, c.surface], ['accent text on soft chip', c.accentDeep, c.accentSoft], ['white on accent button', '#FFFFFF', c.accentDeep], ['white on button hover', '#FFFFFF', c.accentHover]];
        const bad = pairs.map(([n, a, b]) => [n, contrast(a, b)]).filter(([, r]) => r < 4.5);
        out.push(truthy(!bad.length, `${t.id}: ${bad.map(([n, r]) => `${n} ${r.toFixed(2)}`).join(', ')}`, `${t.id} ok`));
      }
      return out;
    }
  },
  {
    name: 'Themes: no purple anywhere, and pastel and light',
    why: 'CLAUDE.md non-negotiable: no purple. Backgrounds and cards must be light (the design is pastel and light).',
    run() {
      const out = [];
      for (const t of themes) {
        const purple = Object.entries(t.colors).filter(([, v]) => { const x = hsl(v); return x.s > 0.12 && x.h >= 255 && x.h <= 335; });
        const dark = ['bg', 'surface', 'well'].filter(k => hsl(t.colors[k]).l < 0.9);
        out.push(truthy(!purple.length && !dark.length, `${t.id}: ${purple.length ? 'purple ' + purple.map(([k, v]) => `${k} ${v}`).join(', ') : ''}${dark.length ? ' not light: ' + dark.join(', ') : ''}`, `${t.id} ok`));
      }
      return out;
    }
  }
];
