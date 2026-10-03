/*
  Net Worth Planner: projection model
  -----------------------------------
  Pure math, no page code. Used by index.html in the browser and by the evals in Node:
    const M = NWPModel.create(config, { year: 2026 });
    const result = M.project(M.EXAMPLE());
*/
(function (root) {
'use strict';

function create(userConfig, opts) {
  opts = opts || {};
  const Y0 = opts.year || new Date().getFullYear();
  const RUNS = opts.runs || 1000;
  const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const n = v => { const x = +v; return Number.isFinite(x) ? x : 0; };
  const has = v => v !== null && v !== undefined && v !== '' && Number.isFinite(+v);
  const clone = o => JSON.parse(JSON.stringify(o));
  const nameOf = (s, p) => (s.people[p].name || '').trim() || (p === 'p1' ? 'Partner 1' : 'Partner 2');

  /* ---------- Settings (config.js) ---------- */
  // Built-in copy of config.js, used if config.js is missing. The admin edits config.js, not this.
    // (Keep in sync with config.js; the evals check that they match.)
  const BUILTIN_CONFIG = {
  
    // Starting assumptions for every new plan (quick start and "start over") and for the example.
    // People can change these in their own plan under Assumptions.
    assumptions: {
      retirementReturn: 5,          // typical yearly return on 401(k), IRA, Roth, before inflation
      nonRetirementReturn: 6,       // typical yearly return on brokerage and savings, before inflation
      homeAndOtherGrowth: 3.5,      // yearly growth of home and other assets
      inflation: 2.5,
      salaryGrowth: 3.5,            // yearly raise on salaries
      collegeInflation: 4.5,        // yearly rise in college costs
      retirementWithdrawalTax: 18,  // tax on money taken out of retirement accounts
      stateIncomeTax: 5,            // state and local income tax, as a share of taxable pay
      taxesOnPay: null,             // null = estimate taxes automatically; or a number like 28 for a flat overall rate
      marketUpsAndDowns: 12         // volatility; drives the gap between best and worst case
    },
  
    // Investment mix presets offered under Assumptions. Returns here are AFTER inflation: the typical (median, compound)
    // yearly growth. Picking one sets both return fields to this plus the plan's inflation, and sets market ups and downs.
    investmentMixes: [
      { id: 'stocks',       label: 'Mostly stocks', returnAfterInflation: 4.5, marketUpsAndDowns: 16, description: 'About 80% or more in stock funds.' },
      { id: 'balanced',     label: 'Balanced',      returnAfterInflation: 3.5, marketUpsAndDowns: 11, description: 'Roughly 60% stocks and 40% bonds.' },
      { id: 'conservative', label: 'Conservative',  returnAfterInflation: 2,   marketUpsAndDowns: 6,  description: 'Mostly bonds and cash.' }
    ],
    // A gentle note appears when a market return after inflation is outside this range
    returnAfterInflationNote: { below: 0.5, above: 6 },
  
    // Suggested values for the life ideas in Scenarios (people can change every one). Dollar amounts in today's dollars.
    lifeIdeas: {
      childcarePerYear: 18000, childcareUntilAge: 5,      // another kid: childcare until this age
      kidCostsPerYear: 10000, kidCostsUntilAge: 18,       // ...and everyday costs until this age
      newHomeVsCurrentPct: 30, newHomePriceIfNone: 600000, // new home: this much more than the current home (or this price)
      homeDownPaymentPct: 20, homeCostsPct: 5,            // down payment; closing, moving and selling costs
      mortgageRate: 6.5, mortgageYears: 30, homeUpkeepPct: 1.5,
      moveLivingCostChangePct: 10, movingCost: 15000,      // move: change in yearly spending, one-time moving cost
      downsizeAge: 70, downsizePricePct: 60, downsizeCostsPct: 6,
      helpFamilyPerYear: 12000, helpFamilyYears: 5,
      windfall: 100000, bigPurchase: 40000
    },
  
    // Color themes people can pick in Settings (saved on their device). The first is the default.
    // Pastel and light; never purple. Green, coral and amber are reserved for good / bad / caution,
    // so a theme changes only the neutrals and the main accent. The evals check contrast and hue.
    themes: [
      { id: 'lagoon', name: 'Lagoon', note: 'Calm sea teal, the original',
        colors: { bg: '#F3F6F7', surface: '#FFFFFF', well: '#F6F9FA', line: '#E1E8EB', ink: '#26333A', muted: '#66757D',
                  accent: '#7FB8CC', accentSoft: '#D3EAF2', accentDeep: '#2B6B7E', accentHover: '#225767', accentSofter: '#EEF7FA', accentSoftHover: '#C3E1EC',
                  heroA: '#DDEFF5', heroB: '#E3F4EA' } },
      { id: 'harbor', name: 'Harbor', note: 'Clear sky and deep-water blue',
        colors: { bg: '#F2F5F9', surface: '#FFFFFF', well: '#F5F8FB', line: '#DFE6EE', ink: '#243142', muted: '#5F6D7E',
                  accent: '#8DB0D8', accentSoft: '#DCE8F6', accentDeep: '#2B5C8F', accentHover: '#234C77', accentSofter: '#EEF4FB', accentSoftHover: '#C6D9EF',
                  heroA: '#DCE8F6', heroB: '#E4F2EC' } },
      { id: 'linen', name: 'Linen', note: 'Warm paper and espresso',
        colors: { bg: '#F6F2EC', surface: '#FFFDF9', well: '#FAF6F0', line: '#E8E0D5', ink: '#33302B', muted: '#6B635A',
                  accent: '#C9B49A', accentSoft: '#EFE6DA', accentDeep: '#6B5137', accentHover: '#57412C', accentSofter: '#F7F1E9', accentSoftHover: '#E4D6C4',
                  heroA: '#F1E7DA', heroB: '#E8F1E4' } },
      { id: 'graphite', name: 'Graphite', note: 'Quiet slate, all business',
        colors: { bg: '#F3F4F5', surface: '#FFFFFF', well: '#F7F8F9', line: '#E2E5E8', ink: '#22272B', muted: '#5F6870',
                  accent: '#9AA6B1', accentSoft: '#E3E7EB', accentDeep: '#34404A', accentHover: '#27313A', accentSofter: '#F1F3F5', accentSoftHover: '#D3D9DF',
                  heroA: '#E5E9ED', heroB: '#E3F2EA' } }
    ],
  
    // "What's new" note shown once to people who already use the planner, after an update. Newest first.
    // Add one for every release, with version matching VERSION in sw.js (the evals check this). Keep it short and friendly.
    whatsNew: [
      { version: 'v13', note: "Make it yours 🎨 Color themes in the new Settings drawer, and life ideas in Scenarios: try a new home, another kid or a move." },
      { version: 'v12', note: "You asked, we fixed 🛠️ Try an Inflation slider, −/+ buttons for decimals, and no state tax on Social Security. Pensions can skip raises." },
      { version: 'v11', note: "Cleaner still 🧹 Your key numbers are back on top, the sliders are simpler, and quick start shows which step you're on." },
      { version: 'v10', note: "A tidier look ✨ Your chart comes first, and your work-optional age now sits with your key numbers underneath." },
      { version: 'v9', note: "Milestones on your chart 🏁, a Share button, and smoother updates. If the planner ever seems stuck, tap Refresh app at the bottom." },
      { version: 'v8', note: "We listened 👂 Tap a scenario to see exactly what you changed, and your key numbers now have tiles of their own." },
      { version: 'v7', note: "Fresh this week 🌱 Pick an investment mix under Assumptions, and every return now shows what's left after inflation." }
    ],
  
    planUntilAge: 95,               // default "plan until" age for new plans
    workOptionalConfidence: 85,     // work-optional = savings last in at least this many of 100 simulated markets
  
    // Guesses used by quick start. Everything quick start guesses is marked "Estimated" for the user.
    quickStart: {
      defaultRetireAge: 65,
      collegeCostPerYear: 30000,
      collegeStartAge: 18,
      collegeYears: 4,
      socialSecurityStartAge: 67,
      socialSecurityPercentOfPay: 40,   // rough share of pre-tax pay replaced by Social Security...
      socialSecurityMin: 12000,         // ...but at least this...
      socialSecurityMax: 45000,         // ...and at most this, per person
      spendingPercentOfTakeHome: 85,    // first guess for spending: this share of take-home pay, minus the mortgage
      retirementSpendingPercent: 85,    // retirement spending starts at this share of today's spending
      mortgageRate: 4,
      mortgageYearsLeft: 25
    },
  
    // US federal tax estimate (update each year). Amounts are in today's dollars.
    // Brackets: each row is [taxable income up to, rate %]; use null for "and above".
    taxes: {
      taxYear: 2026,
      standardDeduction: { single: 16100, joint: 32200 },
      brackets: {
        single: [[12400, 10], [50400, 12], [105700, 22], [201775, 24], [256225, 32], [640600, 35], [null, 37]],
        joint:  [[24800, 10], [100800, 12], [211400, 22], [403550, 24], [512450, 32], [768700, 35], [null, 37]]
      },
      socialSecurityWageBase: 184500,
      socialSecurityRate: 6.2,
      medicareRate: 1.45,
      additionalMedicareRate: 0.9,
      additionalMedicareThreshold: { single: 200000, joint: 250000 },
      taxableShareOfBenefits: 50,       // share of Social Security counted as taxable (pensions and annuities are fully taxable)
      stateTaxesSocialSecurity: false   // most states don't tax Social Security; set true if yours does
    },
  
    // Required minimum distributions (RMDs) from pre-tax retirement accounts. Roth accounts have none.
    // Each year from the start age: last year-end balance ÷ the divisor for that age, taxed at the withdrawal rate.
    requiredWithdrawals: {
      startAge: 73,                     // born 1951 to 1959
      startAgeBornFrom1960: 75,         // born 1960 or later (SECURE 2.0)
      // IRS Uniform Lifetime Table (2022 onward): divisors for ages firstAge, firstAge + 1, ... (the last one repeats)
      firstAge: 72,
      divisors: [27.4, 26.5, 25.5, 24.6, 23.7, 22.9, 22.0, 21.1, 20.2, 19.4, 18.5, 17.7, 16.8, 16.0, 15.2, 14.4, 13.7, 12.9, 12.2, 11.5,
                 10.8, 10.1, 9.5, 8.9, 8.4, 7.8, 7.3, 6.8, 6.4, 6.0, 5.6, 5.2, 4.9, 4.6, 4.3, 4.1, 3.9, 3.7, 3.5, 3.4,
                 3.3, 3.1, 3.0, 2.9, 2.8, 2.7, 2.5, 2.3, 2.0]
    },
  
    // The made-up household people see when they tap "Look at an example first".
    // owner: 'you', 'partner' or 'joint'. Set partner to null for a single-person example.
    example: {
      you:     { name: 'Sam',    age: 30, retireAge: 62, planUntilAge: 95 },
      partner: { name: 'Jordan', age: 30, retireAge: 62, planUntilAge: 95 },
      kids: [
        { name: 'Maya', age: 5, collegeCostPerYear: 40000 },
        { name: 'Leo',  age: 3,  collegeCostPerYear: 40000 }
      ],
      // type: 'retirement', 'non_retirement' or 'home_or_other'
      // taxTreatment (retirement only): 'pre_tax' (traditional 401(k)/IRA, the default) or 'roth'
      assets: [
        { name: "Sam's 401(k)",      type: 'retirement',     owner: 'you',     balance: 40000,  youAddPerYear: 24000, employerAddsPerYear: 8000 },
        { name: "Jordan's 401(k)",   type: 'retirement',     owner: 'partner', balance: 40000,  youAddPerYear: 22000, employerAddsPerYear: 6000 },
        { name: 'Roth IRAs',         type: 'retirement',     owner: 'joint',   balance: 10000,   youAddPerYear: 14000, employerAddsPerYear: 0, taxTreatment: 'roth' },
        { name: 'Brokerage account', type: 'non_retirement', owner: 'joint',   balance: 15000 },
        { name: 'Savings',           type: 'non_retirement', owner: 'joint',   balance: 60000 },
        { name: 'Home',              type: 'home_or_other',  owner: 'joint',   balance: 400000 }
      ],
      // Give a monthlyPayment, or leave it null and give paidOffInYears to have the payment calculated.
      loans: [
        { name: 'Mortgage', balance: 100000, interestRate: 3, monthlyPayment: null, paidOffInYears: 25 },
        { name: 'Car loan', balance: 18000,  interestRate: 5, monthlyPayment: 600,  paidOffInYears: null }
      ],
      // type: 'salary' (before-tax pay, stops at retirement), 'social_security' (or pension) or 'other'
      income: [
        { name: "Sam's salary",             type: 'salary',          owner: 'you',     perYear: 100000 },
        { name: "Jordan's salary",          type: 'salary',          owner: 'partner', perYear: 100000 },
        { name: "Sam's Social Security",    type: 'social_security', owner: 'you',     perYear: 40000, fromAge: 67 },
        { name: "Jordan's Social Security", type: 'social_security', owner: 'partner', perYear: 30000, fromAge: 67 }
      ],
      // category: home, food, health, transport, kids, travel, insurance, giving, other
      // when: 'always', 'before_retirement', 'in_retirement' or 'between_ages' (ages are "you")
      spending: [
        { name: 'Home upkeep, property tax and insurance', category: 'home',      when: 'always',            perYear: 19000 },
        { name: 'Groceries and dining',                    category: 'food',      when: 'always',            perYear: 18000 },
        { name: 'Health care',                             category: 'health',    when: 'before_retirement', perYear: 5000 },
        { name: 'Health insurance before Medicare',        category: 'health',    when: 'between_ages',      perYear: 13000, fromAge: 64, untilAge: 66 },
        { name: 'Health care in retirement',               category: 'health',    when: 'in_retirement',     perYear: 9000 },
        { name: 'Kids activities and childcare',           category: 'kids',      when: 'between_ages',      perYear: 18000, untilAge: 53 },
        { name: 'Cars and transportation',                 category: 'transport', when: 'always',            perYear: 9000 },
        { name: 'Travel and fun',                          category: 'travel',    when: 'before_retirement', perYear: 15000 },
        { name: 'Travel in early retirement',              category: 'travel',    when: 'between_ages',      perYear: 24000, fromAge: 64, untilAge: 80 },
        { name: 'Everything else',                         category: 'other',     when: 'always',            perYear: 35000 }
      ],
      purchases: [
        { name: 'Kitchen remodel', inYears: 1, cost: 80000 },
        { name: 'Replace a car',   inYears: 3, cost: 45000, repeatEveryYears: 8, untilInYears: 35 }
      ],
      assumptions: {}   // optional: override any of the assumptions above for the example only
    },
  
    // Legal text shown on the quick start welcome screen and at the bottom of every page.
    // Have a lawyer review this before sharing widely.
    disclaimer: {
      short: 'For education and planning conversations only. This is not financial, investment, tax or legal advice, and projections are estimates, not guarantees.',
      terms: [
        'Net Worth Planner is an educational tool. It does not provide financial, investment, tax, legal or retirement advice, and it is not a substitute for advice from a qualified professional who knows your situation. Its creators and anyone who shares it are not acting as your financial adviser, broker, tax preparer or lawyer.',
        'All results are hypothetical estimates based on the information and assumptions you enter and on simplified models of markets, inflation and taxes. They may be inaccurate or incomplete, and they are not predictions or guarantees of future results. Markets, tax laws and your circumstances will change.',
        'Talk to a qualified financial, tax or legal professional before making any decision based on this tool. You are solely responsible for your decisions and their results.',
        'The tool is provided "as is" and "as available", without warranties of any kind, express or implied, including accuracy, completeness, merchantability or fitness for a particular purpose.',
        'To the fullest extent permitted by law, the creators and anyone who shares this tool are not liable for any loss or damage of any kind, direct or indirect, arising from your use of or reliance on the tool or its results.',
        'Your information is stored only on your own device. You are responsible for keeping backup copies; lost data cannot be recovered by anyone else.',
        'By using Net Worth Planner you agree to these terms. If you do not agree, please do not use it.'
      ]
    }
  };
  function mergeConfig(base, over) {
    if (!over || typeof over !== 'object' || Array.isArray(over)) return base;
    const out = { ...base };
    for (const k of Object.keys(over)) {
      const b = base[k], o = over[k];
      out[k] = (b && typeof b === 'object' && !Array.isArray(b) && o && typeof o === 'object' && !Array.isArray(o)) ? mergeConfig(b, o) : o;
    }
    return out;
  }
  const CFG = mergeConfig(BUILTIN_CONFIG, userConfig);
  const cfgNum = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? d : +v;
  function assumptionsFrom(a) {
    a = a || {};
    return {
      retReturn: cfgNum(a.retirementReturn, 6), nonReturn: cfgNum(a.nonRetirementReturn, 5), otherGrowth: cfgNum(a.homeAndOtherGrowth, 3),
      inflation: cfgNum(a.inflation, 2.5), earningsGrowth: cfgNum(a.salaryGrowth, 3), eduInflation: cfgNum(a.collegeInflation, 4.5),
      withdrawalTax: cfgNum(a.retirementWithdrawalTax, 15), stateTax: cfgNum(a.stateIncomeTax, 5),
      payTaxRate: (a.taxesOnPay === null || a.taxesOnPay === undefined || a.taxesOnPay === '') ? null : cfgNum(a.taxesOnPay, null),
      volatility: cfgNum(a.marketUpsAndDowns, 12)
    };
  }
  const DEFAULT_ASSUMPTIONS = () => assumptionsFrom(CFG.assumptions);
  const QS = CFG.quickStart || {};
  const PLAN_TO = cfgNum(CFG.planUntilAge, 95);
  const OWNER = { you: 'p1', partner: 'p2', joint: 'joint' };
  const WHEN = { always: 'always', before_retirement: 'pre', in_retirement: 'ret', between_ages: 'ages' };
  const ASSET_KIND = { retirement: 'retirement', non_retirement: 'nonretirement', home_or_other: 'other' };
  const INCOME_TYPE = { salary: 'salary', social_security: 'benefit', pension: 'pension', other: 'other' };
  const EXAMPLE = () => {
    const e = CFG.example || {}, you = e.you || {}, pt = e.partner;
    const person = (x, def) => ({ name: x.name || '', age: cfgNum(x.age, def), retireAge: cfgNum(x.retireAge, 65), planToAge: cfgNum(x.planUntilAge, PLAN_TO) });
    return {
      incomeBasis: 'gross',
      people: {
        p1: person(you, 42),
        p2: pt ? { enabled: true, ...person(pt, 40) } : { enabled: false, name: '', age: 40, retireAge: 65, planToAge: PLAN_TO }
      },
      dependents: (e.kids || []).map(k => ({ name: k.name || '', age: cfgNum(k.age, 5), college: k.college !== false, collegeCost: cfgNum(k.collegeCostPerYear, cfgNum(QS.collegeCostPerYear, 30000)), collegeStartAge: cfgNum(k.collegeStartAge, cfgNum(QS.collegeStartAge, 18)), collegeYears: cfgNum(k.collegeYears, cfgNum(QS.collegeYears, 4)) })),
      assets: (e.assets || []).map(x => ({ label: x.name || '', kind: ASSET_KIND[x.type] || 'nonretirement', owner: OWNER[x.owner] || 'joint', taxType: x.taxTreatment === 'roth' ? 'roth' : 'pretax', balance: cfgNum(x.balance, 0), contribution: cfgNum(x.youAddPerYear, 0), employerContribution: cfgNum(x.employerAddsPerYear, 0) })),
      liabilities: (e.loans || []).map(x => ({ label: x.name || '', balance: cfgNum(x.balance, 0), rate: cfgNum(x.interestRate, 5), monthlyPayment: cfgNum(x.monthlyPayment, null), endYear: has(x.paidOffInYears) ? Y0 + n(x.paidOffInYears) : null })),
      income: (e.income || []).map(x => ({ label: x.name || '', type: INCOME_TYPE[x.type] || 'other', owner: OWNER[x.owner] || 'p1', amount: cfgNum(x.perYear, 0), startAge: cfgNum(x.fromAge, null), endAge: cfgNum(x.untilAge, null) })),
      spending: (e.spending || []).map(x => ({ label: x.name || '', category: x.category || 'other', when: WHEN[x.when] || 'always', amount: cfgNum(x.perYear, 0), fromAge: cfgNum(x.fromAge, null), toAge: cfgNum(x.untilAge, null) })),
      purchases: (e.purchases || []).map(x => ({ label: x.name || '', year: Y0 + cfgNum(x.inYears, 1), amount: cfgNum(x.cost, 0), repeatEvery: cfgNum(x.repeatEveryYears, null), until: has(x.untilInYears) ? Y0 + n(x.untilInYears) : null })),
      assumptions: { ...DEFAULT_ASSUMPTIONS(), ...assumptionsFrom({ ...CFG.assumptions, ...(e.assumptions || {}) }) }
    };
  };

  const BLANK = () => ({
    incomeBasis: 'gross',
    people: {
      p1: { name: '', age: 40, retireAge: cfgNum(QS.defaultRetireAge, 65), planToAge: PLAN_TO },
      p2: { enabled: false, name: '', age: 40, retireAge: cfgNum(QS.defaultRetireAge, 65), planToAge: PLAN_TO }
    },
    dependents: [], assets: [], liabilities: [], income: [],
    spending: [],
    purchases: [],
    assumptions: DEFAULT_ASSUMPTIONS()
  });

  /* ---------- Before and after inflation ---------- */
  // Rates in percent: what's left after inflation, and back again
  const realRate = (nominal, inflation) => ((1 + n(nominal) / 100) / (1 + n(inflation) / 100) - 1) * 100;
  const nominalRate = (real, inflation) => ((1 + n(real) / 100) * (1 + n(inflation) / 100) - 1) * 100;
  const MIXES = (Array.isArray(CFG.investmentMixes) ? CFG.investmentMixes : [])
    .filter(m => m && m.id && has(m.returnAfterInflation) && has(m.marketUpsAndDowns))
    .map(m => ({ ...m, returnAfterInflation: +m.returnAfterInflation, marketUpsAndDowns: +m.marketUpsAndDowns }));
  // Assumption values for an investment mix preset at this inflation (returns shown to 0.1%), or null for custom
  function mixAssumptions(id, inflation) {
    const m = MIXES.find(x => x.id === id);
    if (!m) return null;
    const r = Math.round(nominalRate(m.returnAfterInflation, inflation) * 10) / 10;
    return { retReturn: r, nonReturn: r, volatility: m.marketUpsAndDowns };
  }

  /* ---------- Tax estimate ---------- */
  const TX = CFG.taxes || {};
  function bracketTax(taxable, filing) {
    const rows = (TX.brackets && TX.brackets[filing]) || [];
    let tax = 0, prev = 0;
    for (const [top, rate] of rows) {
      const cap = top === null || top === undefined ? Infinity : +top;
      if (taxable <= prev) break;
      tax += (Math.min(taxable, cap) - prev) * (+rate / 100);
      prev = cap;
    }
    return tax;
  }
  // All amounts in today's dollars. wages: pay per person; other: other taxable income; benefits: Social Security and pensions;
  // pretax: retirement contributions taken from pay. Returns federal + Social Security/Medicare + state tax.
  // benefits: Social Security (partly taxable federally; state tax only if config says so). pensions: fully taxable.
  function estimateTaxes({ wages, other, benefits, pensions = 0, pretax, filing, stateRate }) {
    const w = wages.reduce((a, b) => a + b, 0), ss = benefits * cfgNum(TX.taxableShareOfBenefits, 50) / 100;
    const agi = Math.max(0, w + other + pensions + ss - pretax);
    const stateBase = TX.stateTaxesSocialSecurity ? agi : Math.max(0, w + other + pensions - pretax);
    const std = (TX.standardDeduction && TX.standardDeduction[filing]) || 0;
    const fed = bracketTax(Math.max(0, agi - std), filing);
    const base = cfgNum(TX.socialSecurityWageBase, Infinity);
    let fica = 0;
    for (const x of wages) fica += Math.min(x, base) * cfgNum(TX.socialSecurityRate, 6.2) / 100 + x * cfgNum(TX.medicareRate, 1.45) / 100;
    const thr = (TX.additionalMedicareThreshold && TX.additionalMedicareThreshold[filing]) || Infinity;
    fica += Math.max(0, w - thr) * cfgNum(TX.additionalMedicareRate, 0.9) / 100;
    return fed + fica + stateBase * stateRate;
  }
  // Does this income rise with inflation each year? Social Security and other income do unless set otherwise;
  // pensions and annuities don't (many have no cost-of-living raise) unless set.
  const incomeGrows = i => (i.cola === true || i.cola === false ? i.cola : i.type !== 'pension');

  /* ---------- Required minimum distributions ---------- */
  const RMD = CFG.requiredWithdrawals || {};
  const RMD_DIV = Array.isArray(RMD.divisors) ? RMD.divisors.map(Number).filter(x => x > 0) : [];
  // Age RMDs start for someone this old today (birth year taken as this year minus age)
  const rmdStartAge = age => (Y0 - n(age) >= 1960 ? cfgNum(RMD.startAgeBornFrom1960, 75) : cfgNum(RMD.startAge, 73));
  // Share of the balance that must come out at this age (0 before the start age)
  function rmdShare(age, startAge) {
    if (!RMD_DIV.length || age < startAge) return 0;
    const i = Math.min(RMD_DIV.length - 1, Math.max(0, age - cfgNum(RMD.firstAge, 72)));
    return 1 / RMD_DIV[i];
  }

  /* ---------- Projection model ---------- */
  // Monthly payment: the one entered, or (if blank) the payment that pays the loan off by its end year.
  function loanPayment(l) {
    if (has(l.monthlyPayment) && n(l.monthlyPayment) > 0) return n(l.monthlyPayment);
    const B = n(l.balance), i = n(l.rate) / 1200;
    if (!has(l.endYear) || B <= 0) return 0;
    const m = Math.max(12, (n(l.endYear) - Y0) * 12);
    return i === 0 ? B / m : B * i / (1 - Math.pow(1 + i, -m));
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function project(s, NR = RUNS) {
    const A = s.assumptions, p1 = s.people.p1, p2 = s.people.p2, two = !!p2.enabled;
    const a1 = n(p1.age), a2 = n(p2.age);
    const H = Math.max(1, Math.min(100, Math.max(n(p1.planToAge) - a1, two ? n(p2.planToAge) - a2 : 0)));
    const W = H + 1;
    const infl = n(A.inflation) / 100, eg = n(A.earningsGrowth) / 100, edu = n(A.eduInflation) / 100;

    const working = (o, t) => {
      if (o === 'p2') return two && a2 + t < n(p2.retireAge);
      if (o === 'p1') return a1 + t < n(p1.retireAge);
      return a1 + t < n(p1.retireAge) || (two && a2 + t < n(p2.retireAge));
    };
    const allRetired = t => !working('joint', t);
    // Share of a pre-tax account that is Partner 2's, for required withdrawals (joint accounts split evenly)
    const share2 = o => (!two ? 0 : o === 'p2' ? 1 : o === 'joint' ? 0.5 : 0);
    const ageNow = o => (o === 'p2' ? a2 : a1);

    function incomeActive(i, t) {
      const own = i.owner || 'p1';
      if (own === 'p2' && !two) return false;
      const who = own === 'p2' ? p2 : p1;
      const age = ageNow(own) + t;
      if (has(i.startAge) && age < n(i.startAge)) return false;
      if (own !== 'joint' && age > n(who.planToAge)) return false;
      // Salaries always stop at retirement; an end age can only stop them sooner
      if (i.type === 'salary' && !working(own, t)) return false;
      if (has(i.endAge)) return age <= n(i.endAge);
      return true;
    }

    // Spending items: 'always', 'pre' (before everyone has retired), 'ret' (after), or 'ages' (Partner 1's ages)
    function spendActive(x, t) {
      const w = x.when || 'always';
      if (w === 'pre') return !allRetired(t);
      if (w === 'ret') return allRetired(t);
      if (w === 'ages') { const a = a1 + t; return !(has(x.fromAge) && a < n(x.fromAge)) && !(has(x.toAge) && a > n(x.toAge)); }
      return true;
    }
    const catSpend = {};
    const inc = new Float64Array(W), spend = new Float64Array(W), debtPay = new Float64Array(W),
      special = new Float64Array(W), contrib = new Float64Array(W), rothC = new Float64Array(W), debtBal = new Float64Array(W), contrib2 = new Float64Array(W);
    const events = Array.from({ length: W }, () => []);

    // A loan with a start year (e.g. a mortgage for a home bought later) begins at the end of that year: its
    // today's-dollar balance grows with inflation until then, and payments start the following year.
    const debts = s.liabilities.map(l => {
      const st = has(l.startYear) ? Math.max(1, n(l.startYear) - Y0) : 0, r = n(l.rate) / 100;
      const endT = has(l.endYear) ? Math.max(st + 1, n(l.endYear) - Y0) : Infinity;
      const d = { label: l.label || 'Loan', r, endT, startT: st, bal: st ? 0 : n(l.balance), pending: st ? n(l.balance) * Math.pow(1 + infl, st) : 0 };
      if (st) {
        const i = r / 12, m = Number.isFinite(endT) ? (endT - st) * 12 : 360;
        d.pay = has(l.monthlyPayment) && n(l.monthlyPayment) > 0 ? n(l.monthlyPayment) : i === 0 ? d.pending / m : d.pending * i / (1 - Math.pow(1 + i, -m));
      } else d.pay = loanPayment(l);
      return d;
    });
    debtBal[0] = debts.reduce((x, d) => x + d.bal, 0);

    // Retirement and benefit-start events
    const tr1 = n(p1.retireAge) - a1, tr2 = two ? n(p2.retireAge) - a2 : -1;
    if (two && tr1 === tr2 && tr1 >= 1 && tr1 <= H) events[tr1].push('Both retire');
    else {
      if (tr1 >= 1 && tr1 <= H) events[tr1].push(`${nameOf(s, 'p1')} retires`);
      if (tr2 >= 1 && tr2 <= H) events[tr2].push(`${nameOf(s, 'p2')} retires`);
    }
    for (const i of s.income) {
      if (i.type === 'salary' || !has(i.startAge)) continue;
      if ((i.owner === 'p2') && !two) continue;
      const t = n(i.startAge) - ageNow(i.owner || 'p1');
      if (t >= 1 && t <= H) events[t].push(`${i.label || 'Income'} begins`);
    }

    // Purchases
    const purch = new Float64Array(W);
    for (const p of s.purchases) {
      if (!has(p.year)) continue;
      const step = Math.max(0, Math.round(n(p.repeatEvery)));
      const until = has(p.until) ? n(p.until) : Y0 + H;
      let y = n(p.year), guard = 0;
      do {
        const t = Math.max(1, y - Y0);
        if (t <= H) { purch[t] += n(p.amount) * Math.pow(1 + infl, t); events[t].push(p.label || 'Purchase'); }
        y += step;
      } while (step > 0 && y <= until && ++guard < 200);
    }

    // Pay, contributions and estimated taxes for year t (t = 0 is this year, as entered)
    const grossBasis = (s.incomeBasis || 'gross') === 'gross', filing = two ? 'joint' : 'single';
    const stateRate = n(A.stateTax) / 100, flatRate = has(A.payTaxRate) ? n(A.payTaxRate) / 100 : null;
    function money_in(t) {
      const f = Math.pow(1 + infl, t), wages = { p1: 0, p2: 0, joint: 0 };
      let other = 0, ben = 0, pens = 0, you = 0, emp = 0, pre = 0, roth = 0, into2 = 0;
      for (const i of s.income) {
        if (!incomeActive(i, t)) continue;
        const amt = n(i.amount) * (i.type === 'salary' ? Math.pow(1 + eg, t) : incomeGrows(i) ? f : 1);
        if (i.type === 'salary') wages[i.owner || 'p1'] += amt; else if (i.type === 'benefit') ben += amt; else if (i.type === 'pension') pens += amt; else other += amt;
      }
      for (const a of s.assets) if (a.kind === 'retirement' && working(a.owner || 'p1', t)) {
        const mine = n(a.contribution) * f, theirs = n(a.employerContribution) * f;
        you += mine; emp += theirs;
        if (a.taxType === 'roth') roth += mine + theirs;
        else { pre += mine; into2 += (mine + theirs) * share2(a.owner || 'p1'); }   // employer money never reduces your taxes
      }
      const total = wages.p1 + wages.p2 + wages.joint + other + ben + pens;
      let tx = 0;
      if (grossBasis && total > 0) {
        if (flatRate !== null) tx = flatRate * (wages.p1 + wages.p2 + wages.joint + other + pens + ben * cfgNum(TX.taxableShareOfBenefits, 50) / 100);
        else tx = estimateTaxes({ wages: [wages.p1 / f, wages.p2 / f, wages.joint / f], other: other / f, benefits: ben / f, pensions: pens / f, pretax: pre / f, filing, stateRate }) * f;
      }
      return { total, tax: tx, you, emp, roth, into2 };
    }
    const taxes = new Float64Array(W), youC = new Float64Array(W);
    for (let t = 1; t < W; t++) {
      const f = Math.pow(1 + infl, t);
      const mi = money_in(t);
      inc[t] = mi.total; taxes[t] = mi.tax; youC[t] = grossBasis ? mi.you : 0; contrib[t] = mi.you + mi.emp - mi.roth; rothC[t] = mi.roth; contrib2[t] = mi.into2;
      for (const x of s.spending) {
        if (!spendActive(x, t)) continue;
        const v = n(x.amount) * f, c = x.category || 'other';
        spend[t] += v;
        (catSpend[c] || (catSpend[c] = new Float64Array(W)))[t] += v;
      }
      let db = 0;
      for (const d of debts) {
        if (d.bal > 0.5) {
          // Standard monthly amortization: interest accrues monthly at rate/12, then the payment is applied.
          let paid = 0;
          for (let m = 0; m < 12 && d.bal > 0.005; m++) {
            const due = d.bal * (1 + d.r / 12), pay = Math.min(d.pay, due);
            d.bal = due - pay; paid += pay;
          }
          let lump = false;
          if (t >= d.endT && d.bal > 0.5) { paid += d.bal; d.bal = 0; lump = true; } // anything left by the end year is paid in full
          debtPay[t] += paid;
          if (d.bal <= 0.5) { d.bal = 0; events[t].push(lump && paid > d.pay * 13 ? `${d.label} paid off with a lump sum` : `${d.label} paid off`); }
        }
        if (d.startT && t === d.startT) { d.bal = d.pending; events[t].push(`${d.label} begins`); }
        db += d.bal;
      }
      debtBal[t] = db;
      for (const d of s.dependents) {
        if (!d.college) continue;
        const da = n(d.age) + t, st = n(d.collegeStartAge), yrs = n(d.collegeYears);
        if (da >= st && da < st + yrs) {
          special[t] += n(d.collegeCost) * Math.pow(1 + edu, t);
          if (da === st) events[t].push(`${d.name || 'Dependent'} starts college`);
        }
      }
      special[t] += purch[t];
    }

    let retireT = null;
    for (let t = 0; t <= H; t++) if (allRetired(t)) { retireT = t; break; }

    // Monte Carlo
    // R1/R2: pre-tax retirement by owner (joint split evenly; Partner 1's if single), Q: Roth, N: non-retirement, O: home and other
    let R10 = 0, R20 = 0, Q0 = 0, N0 = 0, O0 = 0;
    for (const a of s.assets) {
      if (a.kind === 'retirement') {
        if (a.taxType === 'roth') Q0 += n(a.balance);
        else { const k = share2(a.owner || 'p1'); R10 += n(a.balance) * (1 - k); R20 += n(a.balance) * k; }
      }
      else if (a.kind === 'nonretirement') N0 += n(a.balance);
      else if (!has(a.fromYear)) O0 += n(a.balance);   // homes bought later join in their year (below)
    }
    // Required withdrawals: share of each owner's pre-tax balance per year, and when they start
    const rmdAge1 = rmdStartAge(a1), rmdAge2 = rmdStartAge(a2);
    const rs1 = new Float64Array(W), rs2 = new Float64Array(W);
    let rmdOn = false;
    // After one partner's plan ends, the other inherits their accounts and withdraws at their own age
    for (let t = 1; t < W; t++) {
      const in1 = a1 + t <= n(p1.planToAge), in2 = two && a2 + t <= n(p2.planToAge);
      const own1 = in1 ? rmdShare(a1 + t, rmdAge1) : 0, own2 = in2 ? rmdShare(a2 + t, rmdAge2) : 0;
      rs1[t] = in1 ? own1 : own2;
      rs2[t] = in2 ? own2 : own1;
      if (rs1[t] || rs2[t]) rmdOn = true;
    }
    const hasPre1 = R10 > 0 || s.assets.some(a => a.kind === 'retirement' && a.taxType !== 'roth' && share2(a.owner || 'p1') < 1 && n(a.contribution) + n(a.employerContribution) > 0);
    const hasPre2 = R20 > 0 || s.assets.some(a => a.kind === 'retirement' && a.taxType !== 'roth' && share2(a.owner || 'p1') > 0 && n(a.contribution) + n(a.employerContribution) > 0);
    const tm1 = rmdAge1 - a1, tm2 = rmdAge2 - a2;
    if (hasPre1 && tm1 >= 1 && tm1 <= H && a1 + tm1 <= n(p1.planToAge)) events[tm1].push(`${nameOf(s, 'p1')}'s required withdrawals start`);
    if (two && hasPre2 && tm2 >= 1 && tm2 <= H && a2 + tm2 <= n(p2.planToAge)) events[tm2].push(`${nameOf(s, 'p2')}'s required withdrawals start`);
    const rr = n(A.retReturn) / 100, rn = n(A.nonReturn) / 100, og = n(A.otherGrowth) / 100,
      vol = Math.max(0, n(A.volatility)) / 100, tax = Math.min(0.9, Math.max(0, n(A.withdrawalTax) / 100));
    const muR = Math.log(Math.max(0.01, 1 + rr)), muN = Math.log(Math.max(0.01, 1 + rn));
    // Home and other assets bought later (fromYear: today's-dollar price, inflated to that year) or sold
    // (sellYear: its grown value moves into non-retirement savings). Home values aren't random, so these are exact.
    const oAdd = new Float64Array(W), oSell = new Float64Array(W);
    let oMove = false;
    for (const a of s.assets) {
      if (a.kind !== 'other' || (!has(a.fromYear) && !has(a.sellYear))) continue;
      const t0 = has(a.fromYear) ? Math.max(1, n(a.fromYear) - Y0) : 0, v0 = t0 ? n(a.balance) * Math.pow(1 + infl, t0) : n(a.balance);
      if (t0 && t0 <= H) { oAdd[t0] += v0; oMove = true; events[t0].push(`${a.label || 'Home'} bought`); }
      if (has(a.sellYear)) {
        const ts = Math.max(1, n(a.sellYear) - Y0);
        if (ts > t0 && ts <= H) { oSell[ts] += v0 * Math.pow(1 + og, ts - t0); oMove = true; events[ts].push(`${a.label || 'Home'} sold`); }
      }
    }
    const t0 = clockNow();
    const rand = mulberry32(20240611);
    let spare = null;
    const gauss = () => {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0; while (u === 0) u = rand();
      const v = rand(), m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    };

    const nw = new Float64Array(NR * W), liq = new Float64Array(NR * W), depl = new Float64Array(NR), rmdAll = new Float64Array(rmdOn ? NR * W : 0);
    for (let r = 0; r < NR; r++) {
      let R1 = R10, R2 = R20, Q = Q0, N = N0, O = O0, dep = Infinity;
      // (oAdd/oSell: homes bought or sold later, worked out below the growth rates)
      const b = r * W;
      nw[b] = R1 + R2 + Q + N + O - debtBal[0]; liq[b] = R1 + R2 + Q + N;
      for (let t = 1; t < W; t++) {
        const z = gauss();
        // Required withdrawals are figured on last year-end's pre-tax balances
        const m1 = R1 * rs1[t], m2 = R2 * rs2[t];
        const gR = Math.exp(muR + vol * z); R1 *= gR; R2 *= gR; Q *= gR;
        N *= Math.exp(muN + vol * z);
        O *= 1 + og;
        if (oMove) { O += oAdd[t] - oSell[t]; N += oSell[t]; }
        let rmd = 0;
        if (rmdOn) { const x1 = Math.min(m1, R1), x2 = Math.min(m2, R2); R1 -= x1; R2 -= x2; rmd = x1 + x2; rmdAll[b + t] = rmd; }
        R1 += contrib[t] - contrib2[t]; R2 += contrib2[t]; Q += rothC[t];
        // They pay for the year first (after withdrawal tax); anything left over is saved
        const net = inc[t] - taxes[t] - youC[t] - spend[t] - debtPay[t] - special[t] + rmd * (1 - tax);
        if (net >= 0) N += net;
        else {
          let need = -net;
          const fromN = Math.min(Math.max(N, 0), need); N -= fromN; need -= fromN;
          if (need > 0) {
            // Pre-tax accounts next (taxed on the way out, from both partners in proportion), then Roth (tax-free)
            const gross = need / (1 - tax), R = R1 + R2;
            if (R >= gross) { const k = 1 - gross / R; R1 *= k; R2 *= k; need = 0; }
            else { need -= R * (1 - tax); R1 = R2 = 0; }
            if (need > 0) {
              if (Q >= need) Q -= need;
              else { Q = 0; if (dep === Infinity) dep = t; }
            }
          }
        }
        nw[b + t] = R1 + R2 + Q + N + O - debtBal[t]; liq[b + t] = R1 + R2 + Q + N;
      }
      depl[r] = dep;
    }
    const ms = clockNow() - t0;
    const spendAt = t => s.spending.reduce((x, it) => x + (spendActive(it, t) ? n(it.amount) : 0), 0);
    const spendNow = spendAt(0), spendRet = retireT === null ? null : spendAt(Math.max(retireT, 1));
    const now = money_in(0), incNow = now.total, taxNow = now.tax, youNow = grossBasis ? now.you : 0, empNow = now.emp;
    // Loan payments over the next 12 months, in today's dollars (college and big purchases are treated as withdrawals from savings)
    const outNext = W > 1 ? debtPay[1] / (1 + infl) : 0;

    const p10 = new Float64Array(W), p50 = new Float64Array(W), p90 = new Float64Array(W), liq50 = new Float64Array(W), rmd50 = new Float64Array(W);
    const col = new Float64Array(NR), i10 = Math.floor(0.1 * (NR - 1)), i50 = Math.round(0.5 * (NR - 1)), i90 = Math.ceil(0.9 * (NR - 1));
    for (let t = 0; t < W; t++) {
      for (let r = 0; r < NR; r++) col[r] = nw[r * W + t];
      col.sort(); p10[t] = col[i10]; p50[t] = col[i50]; p90[t] = col[i90];
      for (let r = 0; r < NR; r++) col[r] = liq[r * W + t];
      col.sort(); liq50[t] = col[i50];
      if (rmdOn && (rs1[t] || rs2[t])) { for (let r = 0; r < NR; r++) col[r] = rmdAll[r * W + t]; col.sort(); rmd50[t] = col[i50]; }
    }
    let ok = 0; for (let r = 0; r < NR; r++) if (depl[r] === Infinity) ok++;
    const ds = Float64Array.from(depl).sort();

    return {
      H, infl, two, a1, a2, retireT,
      names: [nameOf(s, 'p1'), nameOf(s, 'p2')],
      inc, spend, debtPay, special, debtBal, events,
      p10, p50, p90, liq50, rmd: rmd50, rmdAges: [rmdAge1, two ? rmdAge2 : null],
      success: ok / NR, deplMid: ds[i50], deplWorst: ds[i10],
      empty: s.assets.length === 0 && s.income.length === 0,
      retire1: tr1, retire2: tr2, contrib, rothC, ms, incNow, taxNow, youNow, empNow, outNext, grossBasis, taxes, youC, spendNow, spendRet, catSpend
    };
  }

  /* ---------- Moving retirement (Retire at slider, work-optional age) ---------- */
  // Retire d years later (or sooner if negative): both partners move by the same years, and so does the
  // end of each person's last salary (the one that starts latest), e.g. a lower-paying "coast" job before
  // retiring. Earlier salaries keep their end ages; salaries with no end age already stop at retirement.
  function shiftRetirement(s, d) {
    const c = clone(s), two = !!c.people.p2.enabled;
    d = n(d);
    c.people.p1.retireAge = n(c.people.p1.retireAge) + d;
    if (two) c.people.p2.retireAge = n(c.people.p2.retireAge) + d;
    const start = i => (has(i.startAge) ? n(i.startAge) : -Infinity), end = i => (has(i.endAge) ? n(i.endAge) : Infinity);
    for (const own of two ? ['p1', 'p2', 'joint'] : ['p1', 'joint']) {
      let last = null;
      for (const i of c.income) {
        if (i.type !== 'salary' || (i.owner || 'p1') !== own) continue;
        if (!last || start(i) > start(last) || (start(i) === start(last) && end(i) >= end(last))) last = i;
      }
      if (last && has(last.endAge)) last.endAge = n(last.endAge) + d;
    }
    return c;
  }

  /* ---------- Work-optional age ---------- */
  const WO_TARGET = cfgNum(CFG.workOptionalConfidence, 85) / 100;
  function workOptional(s) {
    const p1 = s.people.p1, r1 = n(p1.retireAge), a1 = n(p1.age);
    const minA = Math.max(a1, 30), maxA = Math.min(80, Math.max(minA, n(p1.planToAge) - 1));
    const test = A => project(shiftRetirement(s, A - r1), 400).success >= WO_TARGET;
    if (!test(maxA)) return null;
    if (test(minA)) return minA;
    let lo = minA, hi = maxA;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (test(m)) hi = m; else lo = m; }
    return hi;
  }

  /* ---------- Scenario details: what differs between two plans ---------- */
  // Returns rows { section, label, field, format, from, to, change: 'changed' | 'added' | 'removed' } in reading order.
  // Values are raw (numbers, ids); the page formats them. Items in lists are matched by position.
  const ASSUMPTION_LABELS = {
    mix: 'Investment mix', retReturn: 'Retirement account return', nonReturn: 'Non-retirement return', otherGrowth: 'Home and other growth',
    volatility: 'Market ups and downs', inflation: 'Inflation', earningsGrowth: 'Salary growth', eduInflation: 'College cost inflation',
    withdrawalTax: 'Tax on retirement withdrawals', stateTax: 'State and local income tax', payTaxRate: 'Taxes on pay'
  };
  const PERSON_FIELDS = [['name', 'name', 'text'], ['age', 'age', 'age'], ['retireAge', 'retirement age', 'age'], ['planToAge', 'plan until age', 'age']];
  const LISTS = [
    ['dependents', 'Kids', 'Dependent', [['name', 'name', 'text'], ['age', 'age', 'age'], ['college', 'college', 'bool'], ['collegeCost', 'college cost per year', 'money'], ['collegeStartAge', 'college starts at', 'age'], ['collegeYears', 'years of college', 'int']]],
    ['assets', 'Assets', 'Asset', [['label', 'name', 'text'], ['kind', 'type', 'enum'], ['owner', 'whose', 'owner'], ['taxType', 'tax treatment', 'enum'], ['balance', 'balance', 'money'], ['contribution', 'you add per year', 'money'], ['employerContribution', 'employer adds per year', 'money'], ['fromYear', 'bought in', 'year'], ['sellYear', 'sold in', 'year']]],
    ['liabilities', 'Loans', 'Loan', [['label', 'name', 'text'], ['balance', 'balance', 'money'], ['rate', 'interest', 'pct'], ['monthlyPayment', 'monthly payment', 'money'], ['startYear', 'starts', 'year'], ['endYear', 'paid off by', 'year']]],
    ['income', 'Income', 'Income', [['label', 'name', 'text'], ['type', 'type', 'enum'], ['owner', 'whose', 'owner'], ['amount', 'per year', 'money'], ['startAge', 'from age', 'age'], ['endAge', 'until age', 'age'], ['cola', 'rises with inflation', 'bool']]],
    ['spending', 'Spending', 'Spending', [['label', 'name', 'text'], ['category', 'category', 'enum'], ['when', 'when', 'enum'], ['amount', 'per year', 'money'], ['fromAge', 'from age', 'age'], ['toAge', 'until age', 'age']]],
    ['purchases', 'Big purchases', 'Purchase', [['label', 'name', 'text'], ['year', 'year', 'year'], ['amount', 'cost', 'money'], ['repeatEvery', 'repeats every (years)', 'int'], ['until', 'repeats until', 'year']]]
  ];
  const kindKind = k => (k === 'bool' ? 'bool' : ['text', 'enum', 'owner'].includes(k) ? 'text' : 'num');
  function norm(v, k) {
    if (v === undefined || v === null || v === '') return null;
    if (k === 'bool') return !!v;
    if (kindKind(k) === 'num') return has(v) ? +v : null;
    return String(v);
  }
  function planDiff(a, b) {
    const out = [];
    const add = (section, label, field, format, from, to, change = 'changed') => out.push({ section, label, field, format, from, to, change });
    const cmp = (section, label, field, format, x, y) => {
      const f = norm(x, format), t = norm(y, format);
      if (f !== t) add(section, label, field, format, f, t);
    };
    // People (names come from the scenario, so labels match what the person sees)
    const two = !!(a.people.p2.enabled || b.people.p2.enabled);
    if (!!a.people.p2.enabled !== !!b.people.p2.enabled) add('People', 'Partner included', 'people.p2.enabled', 'bool', !!a.people.p2.enabled, !!b.people.p2.enabled);
    for (const p of two ? ['p1', 'p2'] : ['p1']) {
      if (p === 'p2' && !(a.people.p2.enabled && b.people.p2.enabled)) continue;
      const who = nameOf(b, p);
      for (const [f, l, k] of PERSON_FIELDS) cmp('People', f === 'name' ? `${nameOf(a, p)}'s name` : `${who}'s ${l}`, `people.${p}.${f}`, k, a.people[p][f], b.people[p][f]);
    }
    for (const [key, section, noun, fields] of LISTS) {
      const xa = a[key] || [], xb = b[key] || [], nameIt = (it, i) => ((it && (key === 'dependents' ? it.name : it.label)) || '').trim() || `${noun} ${i + 1}`;
      for (let i = 0; i < Math.max(xa.length, xb.length); i++) {
        if (i >= xa.length) { add(section, nameIt(xb[i], i), `${key}.${i}`, 'item', null, xb[i], 'added'); continue; }
        if (i >= xb.length) { add(section, nameIt(xa[i], i), `${key}.${i}`, 'item', xa[i], null, 'removed'); continue; }
        for (const [f, l, k] of fields) {
          if ((f === 'label' || f === 'name')) { cmp(section, `${nameIt(xa[i], i)}: renamed`, `${key}.${i}.${f}`, k, xa[i][f], xb[i][f]); continue; }
          if (f === 'taxType' && (xa[i].kind !== 'retirement' || xb[i].kind !== 'retirement')) continue;
          if (f === 'cola') { if (xa[i].type !== 'salary' || xb[i].type !== 'salary') cmp(section, `${nameIt(xb[i], i)}: ${l}`, `${key}.${i}.${f}`, k, incomeGrows(xa[i]), incomeGrows(xb[i])); continue; }
          cmp(section, `${nameIt(xb[i], i)}: ${l}`, `${key}.${i}.${f}`, k, xa[i][f], xb[i][f]);
        }
      }
    }
    const A = a.assumptions || {}, B = b.assumptions || {};
    for (const [f, l] of Object.entries(ASSUMPTION_LABELS)) {
      if (f === 'mix') cmp('Assumptions', l, 'assumptions.mix', 'enum', mixAssumptions(A.mix, 0) ? A.mix : 'custom', mixAssumptions(B.mix, 0) ? B.mix : 'custom');
      else cmp('Assumptions', l, `assumptions.${f}`, 'pct', A[f], B[f]);
    }
    return out;
  }

  /* ---------- Key results (tiles under Your Projections) ---------- */
  // All money in the projection's own (nominal) dollars; the page converts for display.
  function keyResults(res) {
    if (!res || res.empty) return null;
    const rt = res.retireT, k = { retireT: rt, H: res.H, atRetirement: rt === null ? null : res.p50[rt], atEnd: res.p50[res.H],
      success: res.success, worstRunOutAge: res.deplWorst === Infinity ? null : res.a1 + res.deplWorst, midRunOutAge: res.deplMid === Infinity ? null : res.a1 + res.deplMid, drawRate: null };
    // First full year of retirement: spending, loan payments, college/purchases and taxes not covered by income,
    // as a share of mid-case savings (not home) when retirement starts, in the same year's dollars
    if (rt !== null) {
      const t = Math.max(rt, 1);
      if (t <= res.H && res.liq50[rt] > 0) {
        const gap = res.spend[t] + res.debtPay[t] + res.special[t] + res.taxes[t] + (res.youC ? res.youC[t] : 0) - res.inc[t];
        k.drawRate = Math.max(0, gap / Math.pow(1 + res.infl, t - rt)) / res.liq50[rt];
      }
    }
    return k;
  }

  /* ---------- Chart milestones ---------- */
  // Round-number net worth milestones (today's dollars, mid case) and the year savings reach 25× spending (the 4% rule).
  // Returns [{ t, kind: 'networth' | 'fourPercent', amount? }] in year order. Life events (college, loans, benefits) come from res.events.
  const NW_MILESTONES = [1e6, 2e6, 5e6, 1e7, 2.5e7, 5e7, 1e8];
  function milestones(res) {
    if (!res || res.empty) return [];
    const real = t => res.p50[t] / Math.pow(1 + res.infl, t);
    let nw = [];
    for (const v of NW_MILESTONES) {
      if (real(0) >= v) continue;                       // already there today
      for (let t = 1; t <= res.H; t++) if (real(t) >= v) { nw.push({ t, kind: 'networth', amount: v }); break; }
    }
    if (nw.length > 4) nw = [nw[0], ...nw.slice(-3)];    // the first one, and the three biggest
    const out = nw;
    // 4% rule: mid-case savings (not the home) × 4% cover that year's spending and loan payments
    const costs = t => res.spend[t] + res.debtPay[t];
    const already = res.H >= 1 && costs(1) > 0 && res.liq50[0] * 0.04 * (1 + res.infl) >= costs(1);
    if (!already) for (let t = 1; t <= res.H; t++) if (costs(t) > 0 && res.liq50[t] * 0.04 >= costs(t)) { out.push({ t, kind: 'fourPercent' }); break; }
    return out.sort((a, b) => a.t - b.t);
  }

  /* ---------- Life ideas: ready-made scenario changes ---------- */
  // ideaDefaults(plan, id) suggests values from the plan and config.js (with a note on where each came from);
  // applyIdea(plan, id, params) returns a new plan with the idea written into ordinary plan items, so ideas
  // stack, show up in scenario details, and can be edited like anything else. The original plan is untouched.
  const LI = CFG.lifeIdeas || {};
  const IDEAS = [
    { id: 'kid', name: 'Have another kid' }, { id: 'home', name: 'Buy a new home' }, { id: 'move', name: 'Move somewhere new' },
    { id: 'break', name: 'Take a career break' }, { id: 'downsize', name: 'Downsize later' }, { id: 'family', name: 'Help family' },
    { id: 'windfall', name: 'Windfall' }, { id: 'purchase', name: 'Big purchase' }
  ];
  const rnd = (v, step) => Math.round(v / step) * step;
  const short$ = v => (v >= 1e6 ? `$${+(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}k`);
  const yrs = v => `${v} yr${v === 1 ? '' : 's'}`;
  // The home you'd sell in a given year: owned by then (bought earlier, or owned now) and not already sold;
  // the most recently bought one wins, so ideas stack (buy a new home, then downsize it later).
  function homeOf(p, year) {
    const by = has(year) ? n(year) : Infinity;
    const others = p.assets.filter(a => a.kind === 'other' && !has(a.sellYear) && (!has(a.fromYear) || n(a.fromYear) < by));
    const named = others.filter(a => /home|house|condo|apartment|flat|property/i.test(a.label || ''));
    const pool = named.length ? named : others;
    return pool.slice().sort((a, b) => (has(b.fromYear) ? n(b.fromYear) : 0) - (has(a.fromYear) ? n(a.fromYear) : 0) || n(b.balance) - n(a.balance))[0] || null;
  }
  function spendingNow(p) {
    const a1 = n(p.people.p1.age), working = n(p.people.p1.retireAge) > a1 || (p.people.p2.enabled && n(p.people.p2.retireAge) > n(p.people.p2.age));
    return p.spending.reduce((x, it) => { const w = it.when || 'always';
      const on = w === 'always' || (w === 'pre' && working) || (w === 'ret' && !working) || (w === 'ages' && !(has(it.fromAge) && a1 < n(it.fromAge)) && !(has(it.toAge) && a1 > n(it.toAge)));
      return x + (on ? n(it.amount) : 0); }, 0);
  }
  // Pay off loans secured on a home when it's sold: keep today's payment and clear the rest that year
  function payOffHomeLoans(c, year) {
    for (const l of c.liabilities) if (!has(l.startYear) && /mortgage|home loan|heloc/i.test(l.label || '') && (!has(l.endYear) || n(l.endYear) > year)) {
      if (!(has(l.monthlyPayment) && n(l.monthlyPayment) > 0)) l.monthlyPayment = Math.round(loanPayment(l));
      l.endYear = year;
    }
  }
  function ideaDefaults(p, id) {
    const A = p.assumptions || {}, cur = homeOf(p, Y0 + 3), v = x => cfgNum(x, 0);
    const D = {
      kid: { params: { inYears: 1, childcare: v(LI.childcarePerYear), childcareUntil: v(LI.childcareUntilAge), extra: v(LI.kidCostsPerYear), extraUntil: v(LI.kidCostsUntilAge), college: true, collegeCost: cfgNum(QS.collegeCostPerYear, 30000) },
        notes: { childcare: 'Typical full-time childcare; set in config.js', extra: 'Food, clothes, activities and more', collegeCost: 'Same as the quick start college guess' } },
      home: { params: { inYears: 3, price: cur ? rnd(n(cur.balance) * (1 + v(LI.newHomeVsCurrentPct) / 100), 10000) : v(LI.newHomePriceIfNone), downPct: v(LI.homeDownPaymentPct), costsPct: v(LI.homeCostsPct), rate: v(LI.mortgageRate), years: v(LI.mortgageYears), sellCurrent: !!cur, upkeepPct: v(LI.homeUpkeepPct) },
        notes: { price: cur ? `Your ${cur.label || 'home'} is ${short$(n(cur.balance))}; this is about ${v(LI.newHomeVsCurrentPct)}% more` : 'A starting point; use a real price if you have one', costsPct: 'Closing, moving and selling costs', upkeepPct: 'Property tax, insurance and upkeep each year, as a share of the price', rate: 'A typical 30-year rate; check today\'s' } },
      move: { params: { inYears: 2, livingPct: v(LI.moveLivingCostChangePct), movingCost: v(LI.movingCost), stateTax: n(A.stateTax) },
        notes: { livingPct: `Of your spending now (${short$(spendingNow(p))} a year); negative if it's cheaper`, stateTax: 'Applies to the whole plan in this scenario' } },
      break: { params: { who: 'p1', inYears: 1, years: 1 }, notes: { years: 'Pay stops for these years, then picks up where it left off' } },
      downsize: { params: { atAge: Math.max(n(p.people.p1.age) + 1, v(LI.downsizeAge)), price: cur ? rnd(n(cur.balance) * v(LI.downsizePricePct) / 100, 10000) : 0, costsPct: v(LI.downsizeCostsPct) },
        notes: { price: cur ? `About ${v(LI.downsizePricePct)}% of your ${cur.label || 'home'} today` : 'Add your home under Assets first' } },
      family: { params: { inYears: 1, years: v(LI.helpFamilyYears), perYear: v(LI.helpFamilyPerYear) }, notes: { perYear: 'For example, helping a parent with care' } },
      windfall: { params: { inYears: 5, amount: v(LI.windfall) }, notes: { amount: 'Like an inheritance or gift; not taxed' } },
      purchase: { params: { inYears: 2, amount: v(LI.bigPurchase), label: 'Big purchase' }, notes: { amount: 'A wedding, a boat, a trip of a lifetime' } }
    };
    return D[id] ? clone(D[id]) : null;
  }
  function applyIdea(p, id, prm) {
    const c = clone(p), a1 = n(c.people.p1.age), N = Math.max(1, Math.round(n(prm.inYears) || 1)), y = Y0 + N;
    if (id === 'kid') {
      const name = prm.name || `Kid ${c.dependents.length + 1}`;
      c.dependents.push({ name, age: -N, college: !!prm.college, collegeCost: n(prm.collegeCost), collegeStartAge: cfgNum(QS.collegeStartAge, 18), collegeYears: cfgNum(QS.collegeYears, 4) });
      if (n(prm.childcare) > 0) c.spending.push({ label: `${name}: childcare`, category: 'kids', when: 'ages', amount: n(prm.childcare), fromAge: a1 + N, toAge: a1 + N + Math.max(1, n(prm.childcareUntil)) - 1 });
      if (n(prm.extra) > 0) c.spending.push({ label: `${name}: everyday costs`, category: 'kids', when: 'ages', amount: n(prm.extra), fromAge: a1 + N, toAge: a1 + N + Math.max(1, n(prm.extraUntil)) - 1 });
    } else if (id === 'home') {
      const price = n(prm.price), down = Math.min(100, Math.max(0, n(prm.downPct))), cur = prm.sellCurrent ? homeOf(c, y) : null, curVal = cur ? n(cur.balance) : 0;
      c.purchases.push({ label: 'New home: down payment and costs', year: y, amount: Math.round(price * (down + n(prm.costsPct)) / 100), repeatEvery: null, until: null });
      c.assets.push({ label: 'New home', kind: 'other', owner: 'joint', taxType: 'pretax', balance: price, contribution: 0, employerContribution: 0, fromYear: y });
      if (down < 100) c.liabilities.push({ label: 'New home mortgage', balance: Math.round(price * (100 - down) / 100), rate: n(prm.rate), monthlyPayment: null, startYear: y, endYear: y + Math.max(1, n(prm.years)) });
      if (cur) { cur.sellYear = y; payOffHomeLoans(c, y); }
      const upkeep = rnd(Math.max(0, price - curVal) * n(prm.upkeepPct) / 100, 100);
      if (upkeep > 0) c.spending.push({ label: 'New home: extra upkeep and property tax', category: 'home', when: 'ages', amount: upkeep, fromAge: a1 + N, toAge: null });
    } else if (id === 'move') {
      const change = rnd(spendingNow(c) * n(prm.livingPct) / 100, 100);
      if (change) c.spending.push({ label: 'Move: cost of living change', category: 'other', when: 'ages', amount: change, fromAge: a1 + N, toAge: null });
      if (n(prm.movingCost) > 0) c.purchases.push({ label: 'Moving costs', year: y, amount: n(prm.movingCost), repeatEvery: null, until: null });
      if (has(prm.stateTax)) c.assumptions.stateTax = n(prm.stateTax);
    } else if (id === 'break') {
      const who = prm.who === 'p2' && c.people.p2.enabled ? 'p2' : 'p1', aw = n(c.people[who].age);
      const pay = c.income.filter(i => i.type === 'salary' && (i.owner || 'p1') === who && !(has(i.startAge) && n(i.startAge) > aw)).sort((a, b) => n(b.amount) - n(a.amount))[0];
      if (pay) {
        const from = aw + N, to = from + Math.max(1, n(prm.years)), endWas = has(pay.endAge) ? n(pay.endAge) : null;
        const after = { ...pay, label: `${pay.label || 'Salary'} (after the break)`, startAge: to, endAge: endWas };
        delete pay.est; delete after.est;
        pay.endAge = endWas === null ? from - 1 : Math.min(endWas, from - 1);
        if (endWas === null || endWas >= to) c.income.push(after);
      }
    } else if (id === 'downsize') {
      const yy = Y0 + Math.max(1, Math.round(n(prm.atAge)) - a1), cur = homeOf(c, yy);
      if (cur) {
        const price = n(prm.price);
        cur.sellYear = yy; payOffHomeLoans(c, yy);
        if (price > 0) {
          c.assets.push({ label: 'Smaller home', kind: 'other', owner: 'joint', taxType: 'pretax', balance: price, contribution: 0, employerContribution: 0, fromYear: yy });
          c.purchases.push({ label: 'Smaller home: price and costs', year: yy, amount: Math.round(price * (1 + n(prm.costsPct) / 100)), repeatEvery: null, until: null });
        }
      }
    } else if (id === 'family') {
      c.spending.push({ label: 'Helping family', category: 'giving', when: 'ages', amount: n(prm.perYear), fromAge: a1 + N, toAge: a1 + N + Math.max(1, n(prm.years)) - 1 });
    } else if (id === 'windfall') {
      c.purchases.push({ label: prm.label || 'Windfall (inheritance or gift)', year: y, amount: -Math.abs(n(prm.amount)), repeatEvery: null, until: null });
    } else if (id === 'purchase') {
      c.purchases.push({ label: prm.label || 'Big purchase', year: y, amount: n(prm.amount), repeatEvery: has(prm.repeatEvery) && n(prm.repeatEvery) > 0 ? n(prm.repeatEvery) : null, until: null });
    }
    return c;
  }
  // A short name for a scenario built from ideas, e.g. "New $1.2M home in 3 yrs + Another kid in 1 yr"
  function ideaLabel(id, prm) {
    const N = Math.max(1, Math.round(n(prm.inYears) || 1));
    return ({ kid: `Another kid in ${yrs(N)}`, home: `${short$(n(prm.price))} home in ${yrs(N)}`, move: `Move in ${yrs(N)}`, break: `Career break (${yrs(Math.max(1, n(prm.years)))})`,
      downsize: `Downsize at ${Math.round(n(prm.atAge))}`, family: `Help family for ${yrs(Math.max(1, n(prm.years)))}`, windfall: `${short$(Math.abs(n(prm.amount)))} windfall`,
      purchase: `${prm.label || 'Big purchase'} in ${yrs(N)}` })[id] || id;
  }

  return {
    Y0, RUNS, CFG, BUILTIN_CONFIG, n, has, clone, nameOf, cfgNum, assumptionsFrom, DEFAULT_ASSUMPTIONS, QS, PLAN_TO,
    EXAMPLE, BLANK, TX, realRate, nominalRate, MIXES, mixAssumptions, bracketTax, estimateTaxes, loanPayment, rmdStartAge, rmdShare, shiftRetirement, planDiff, keyResults, milestones, incomeGrows, IDEAS, ideaDefaults, applyIdea, ideaLabel, mulberry32, project, WO_TARGET, workOptional
  };
}

const api = { create };
if (typeof module === 'object' && module.exports) module.exports = api;
else root.NWPModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
