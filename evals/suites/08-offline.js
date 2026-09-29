/*
  8. Offline and updates: runs the real sw.js against a stand-in for the browser's
  caches and network, to check that a new version downloads fresh files, keeps each
  version's files together, and that old versions are cleaned up.
*/
'use strict';
const vm = require('vm');
const { ROOT, CONFIG, truthy, fs, path } = require('../lib');

const BASE = 'https://planner.test/app/';
const SW_SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// A tiny browser: named caches, a network that serves "version" text per file, and the service worker's events
function browser(serverVersion) {
  const store = new Map(), fetched = [];
  const net = { version: serverVersion, online: true };
  class Request { constructor(u, init = {}) { this.url = new URL(typeof u === 'string' ? u : u.url, BASE).href; this.cache = init.cache || 'default'; this.method = 'GET'; this.mode = init.mode || 'cors'; } }
  const resp = body => ({ ok: true, body, clone() { return resp(body); } });
  const key = r => new URL(typeof r === 'string' ? r : r.url, BASE).href.split('?')[0];
  const cacheObj = name => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return {
      match: async r => m.get(key(r)),
      put: async (r, res) => { m.set(key(r), res); },
      addAll: async reqs => { for (const r of reqs) { const q = typeof r === 'string' ? new Request(r) : r; m.set(key(q), await fetchFn(q)); } }
    };
  };
  const caches = {
    open: async n => cacheObj(n),
    keys: async () => [...store.keys()],
    delete: async n => store.delete(n),
    match: async r => { for (const n of store.keys()) { const x = store.get(n).get(key(r)); if (x) return x; } }
  };
  async function fetchFn(r, init = {}) {
    const q = typeof r === 'string' ? new Request(r, init) : r;
    fetched.push({ url: key(q), cache: init.cache || q.cache });
    if (!net.online) throw new Error('offline');
    return resp(`${net.version}:${key(q).slice(BASE.length) || 'index'}`);
  }
  const listeners = {};
  const self = { location: { origin: new URL(BASE).origin, href: BASE + 'sw.js' }, clients: { claim: async () => {} }, skipped: false,
    skipWaiting() { this.skipped = true; }, addEventListener: (t, f) => { listeners[t] = f; } };
  const ctx = vm.createContext({ self, caches, fetch: fetchFn, Request, Response: { error: () => ({ ok: false, body: null }) }, URL, Promise, console });
  vm.runInContext(SW_SRC, ctx);
  const fire = async (type, extra = {}) => {
    let p = Promise.resolve(), responded;
    const ev = { ...extra, waitUntil: x => { p = x; }, respondWith: x => { responded = x; } };
    listeners[type](ev);
    await p; return responded ? await responded : undefined;
  };
  const get = (file, mode = 'cors') => fire('fetch', { request: new Request(file, { mode }) });
  return { store, fetched, net, fire, get, self, VERSION: vm.runInContext('VERSION', ctx) };
}

module.exports = [
  {
    name: 'Offline: a new version downloads fresh copies of every app file, not the browser\'s cached ones',
    why: 'GitHub Pages lets browsers reuse files for 10 minutes; without this, a new version could install the old index.html and keep it.',
    run() {
      return (async () => {
        const b = browser('new');
        await b.fire('install');
        const files = b.fetched.filter(f => /index\.html|model\.js|config\.js/.test(f.url));
        return [truthy(files.length === 3, `downloaded ${files.length} of index.html, model.js, config.js`),
          truthy(files.every(f => f.cache === 'reload'), `cache modes: ${files.map(f => f.cache).join(', ')} (need "reload")`, 'all fetched with cache: reload')];
      })();
    }
  },
  {
    name: 'Offline: the app opens from its own version\'s files, even when the network has something newer',
    why: 'Mixing versions (a new index.html with an old model.js) can break the page. New versions arrive only as a whole, via a new VERSION.',
    run() {
      return (async () => {
        const b = browser('v-old');
        await b.fire('install'); await b.fire('activate');
        b.net.version = 'v-new';                       // a release happens on the server
        const first = await b.get('./model.js');
        const again = await b.get('./model.js');       // a background refresh would show up here
        return [truthy(first.body === 'v-old:model.js' && again.body === 'v-old:model.js', `served ${first.body}, then ${again.body}`, 'stays on its own version until the new one takes over')];
      })();
    }
  },
  {
    name: 'Offline: works without a connection, including opening the page at any address',
    why: 'Everything must work without wifi after the first visit (CLAUDE.md non-negotiable).',
    run() {
      return (async () => {
        const b = browser('v1');
        await b.fire('install'); await b.fire('activate');
        b.net.online = false;
        const page = await b.get('./?from=home', 'navigate'), model = await b.get('./model.js');
        return [truthy(page && /^v1:index/.test(page.body), `page: ${page && page.body}`, `page: ${page && page.body}`), truthy(model && model.body === 'v1:model.js', `model.js: ${model && model.body}`)];
      })();
    }
  },
  {
    name: 'Offline: when a new version takes over, older versions\' files are deleted',
    why: 'Keeps storage small and makes sure nothing old is served by mistake.',
    run() {
      return (async () => {
        const b = browser('v1');
        b.store.set('net-worth-planner-v0', new Map([['x', 1]]));
        b.store.set('someone-elses-cache', new Map());
        await b.fire('install'); await b.fire('activate');
        const names = [...b.store.keys()];
        return truthy(names.length === 2 && names.includes(`net-worth-planner-${b.VERSION}`) && names.includes('someone-elses-cache'), `caches left: ${names.join(', ')}`, names.join(', '));
      })();
    }
  },
  {
    name: 'Updates: the page applies a waiting update and checks for new versions when it comes back to the screen',
    why: 'Phones resume the app without reloading, so an update prompt shown once is easy to miss and the old version can stay forever.',
    run() {
      const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      return [
        truthy(/reg\.waiting/.test(page), 'index.html never looks at reg.waiting (an update downloaded earlier)'),
        truthy(/visibilitychange[\s\S]{0,200}reg\.update\(\)|reg\.update\(\)[\s\S]{0,200}visibilitychange/.test(page) || /visibilitychange[\s\S]{0,400}check\(\)/.test(page), 'no update check when the app comes back to the screen'),
        truthy(/updateViaCache:\s*'none'/.test(page), "register sw.js with updateViaCache: 'none'"),
        truthy(/refreshApp/.test(page), 'no "Refresh app" escape hatch')
      ];
    }
  }
];
