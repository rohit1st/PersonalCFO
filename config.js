/*
  Net Worth Planner — admin settings
  ----------------------------------
  Edit the values below, save, and upload this file to your GitHub repository.
  Then bump VERSION in sw.js (for example 'v3' to 'v4') so installed copies update.

  Percentages are written as plain numbers: 5 means 5%.
  Dollar amounts are yearly and in today's dollars unless the name says otherwise.
  If this file is missing or has a typo, the planner falls back to its built-in defaults.
*/
window.PLANNER_CONFIG = {

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

  // "What's new" note shown once to people who already use the planner, after an update. Newest first.
  // Add one for every release, with version matching VERSION in sw.js (the evals check this). Keep it short and friendly.
  whatsNew: [
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
    taxableShareOfBenefits: 50        // share of Social Security and pension income counted as taxable
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
