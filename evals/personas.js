/*
  Test households. They cover different life stages so a model change that helps
  one kind of household but breaks another shows up. Add your own here.
  Each persona is a function returning a plan (the same shape the app saves).
*/
'use strict';
const { M, plan } = require('./lib');
const Y0 = M.Y0;

module.exports = {
  // The example household from config.js
  example: () => M.EXAMPLE(),

  single_renter_early_career: () => plan({
    people: { p1: { name: 'Riley', age: 32, retireAge: 65, planToAge: 95 } },
    assets: [
      { label: "Riley's 401(k)", kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 40000, contribution: 9000, employerContribution: 4500 },
      { label: 'Savings', kind: 'nonretirement', owner: 'joint', balance: 15000, contribution: 0, employerContribution: 0 }
    ],
    income: [
      { label: "Riley's salary", type: 'salary', owner: 'p1', amount: 95000, startAge: null, endAge: null },
      { label: "Riley's Social Security", type: 'benefit', owner: 'p1', amount: 26000, startAge: 67, endAge: null }
    ],
    spending: [
      { label: 'Rent', category: 'home', when: 'always', amount: 26000, fromAge: null, toAge: null },
      { label: 'Everything else', category: 'other', when: 'always', amount: 30000, fromAge: null, toAge: null }
    ]
  }),

  underfunded_family: () => plan({
    people: { p1: { name: 'Alex', age: 45, retireAge: 65, planToAge: 95 }, p2: { enabled: true, name: 'Blair', age: 43, retireAge: 65, planToAge: 95 } },
    dependents: [
      { name: 'Kid 1', age: 12, college: true, collegeCost: 25000, collegeStartAge: 18, collegeYears: 4 },
      { name: 'Kid 2', age: 9, college: true, collegeCost: 25000, collegeStartAge: 18, collegeYears: 4 }
    ],
    assets: [
      { label: 'Retirement accounts', kind: 'retirement', owner: 'joint', taxType: 'pretax', balance: 60000, contribution: 6000, employerContribution: 3000 },
      { label: 'Savings', kind: 'nonretirement', owner: 'joint', balance: 20000, contribution: 0, employerContribution: 0 },
      { label: 'Home', kind: 'other', owner: 'joint', balance: 420000, contribution: 0, employerContribution: 0 }
    ],
    liabilities: [{ label: 'Mortgage', balance: 280000, rate: 4.5, monthlyPayment: null, endYear: Y0 + 22 }],
    income: [
      { label: "Alex's salary", type: 'salary', owner: 'p1', amount: 72000, startAge: null, endAge: null },
      { label: "Blair's salary", type: 'salary', owner: 'p2', amount: 48000, startAge: null, endAge: null },
      { label: "Alex's Social Security", type: 'benefit', owner: 'p1', amount: 24000, startAge: 67, endAge: null },
      { label: "Blair's Social Security", type: 'benefit', owner: 'p2', amount: 18000, startAge: 67, endAge: null }
    ],
    spending: [{ label: 'Living', category: 'other', when: 'always', amount: 72000, fromAge: null, toAge: null }]
  }),

  near_retirement_couple: () => plan({
    people: { p1: { name: 'Pat', age: 60, retireAge: 65, planToAge: 95 }, p2: { enabled: true, name: 'Lee', age: 58, retireAge: 63, planToAge: 95 } },
    assets: [
      { label: "Pat's 401(k)", kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 1300000, contribution: 31000, employerContribution: 9000 },
      { label: "Lee's 403(b)", kind: 'retirement', owner: 'p2', taxType: 'pretax', balance: 500000, contribution: 23000, employerContribution: 4000 },
      { label: 'Roth IRAs', kind: 'retirement', owner: 'joint', taxType: 'roth', balance: 300000, contribution: 0, employerContribution: 0 },
      { label: 'Brokerage', kind: 'nonretirement', owner: 'joint', balance: 200000, contribution: 0, employerContribution: 0 },
      { label: 'Home', kind: 'other', owner: 'joint', balance: 900000, contribution: 0, employerContribution: 0 }
    ],
    income: [
      { label: "Pat's salary", type: 'salary', owner: 'p1', amount: 150000, startAge: null, endAge: null },
      { label: "Lee's salary", type: 'salary', owner: 'p2', amount: 80000, startAge: null, endAge: null },
      { label: "Pat's Social Security", type: 'benefit', owner: 'p1', amount: 36000, startAge: 67, endAge: null },
      { label: "Lee's Social Security", type: 'benefit', owner: 'p2', amount: 24000, startAge: 67, endAge: null }
    ],
    spending: [
      { label: 'Living', category: 'other', when: 'always', amount: 95000, fromAge: null, toAge: null },
      { label: 'Health insurance before Medicare', category: 'health', when: 'ages', amount: 18000, fromAge: 65, toAge: 66 },
      { label: 'Travel in early retirement', category: 'travel', when: 'ages', amount: 20000, fromAge: 65, toAge: 75 }
    ]
  }),

  already_retired_single: () => plan({
    people: { p1: { name: 'Morgan', age: 70, retireAge: 65, planToAge: 95 } },
    assets: [
      { label: 'IRA', kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 700000, contribution: 0, employerContribution: 0 },
      { label: 'Savings', kind: 'nonretirement', owner: 'joint', balance: 200000, contribution: 0, employerContribution: 0 }
    ],
    income: [{ label: 'Social Security', type: 'benefit', owner: 'p1', amount: 30000, startAge: null, endAge: null }],
    spending: [{ label: 'Living', category: 'other', when: 'always', amount: 62000, fromAge: null, toAge: null }]
  }),

  // Coast FIRE: a high-paying job now, a lower-paying one later, then full retirement
  coast_fire_couple: () => plan({
    people: { p1: { name: 'Casey', age: 38, retireAge: 58, planToAge: 95 }, p2: { enabled: true, name: 'Drew', age: 36, retireAge: 56, planToAge: 95 } },
    assets: [
      { label: "Casey's 401(k)", kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 350000, contribution: 23500, employerContribution: 10000 },
      { label: "Drew's 401(k)", kind: 'retirement', owner: 'p2', taxType: 'pretax', balance: 120000, contribution: 8000, employerContribution: 3000 },
      { label: 'Brokerage', kind: 'nonretirement', owner: 'joint', balance: 250000, contribution: 0, employerContribution: 0 }
    ],
    income: [
      { label: "Casey's tech job", type: 'salary', owner: 'p1', amount: 240000, startAge: null, endAge: 45 },
      { label: "Casey's coast job", type: 'salary', owner: 'p1', amount: 70000, startAge: 46, endAge: 58 },
      { label: "Drew's salary", type: 'salary', owner: 'p2', amount: 90000, startAge: null, endAge: 56 },
      { label: "Casey's Social Security", type: 'benefit', owner: 'p1', amount: 38000, startAge: 67, endAge: null },
      { label: "Drew's Social Security", type: 'benefit', owner: 'p2', amount: 26000, startAge: 67, endAge: null }
    ],
    spending: [
      { label: 'Living', category: 'other', when: 'always', amount: 90000, fromAge: null, toAge: null },
      { label: 'Travel', category: 'travel', when: 'ret', amount: 15000, fromAge: null, toAge: null }
    ]
  }),

  high_earner_early_retirement: () => plan({
    people: { p1: { name: 'Sky', age: 35, retireAge: 45, planToAge: 95 } },
    assets: [
      { label: '401(k)', kind: 'retirement', owner: 'p1', taxType: 'pretax', balance: 450000, contribution: 24500, employerContribution: 12000 },
      { label: 'Roth IRA', kind: 'retirement', owner: 'p1', taxType: 'roth', balance: 90000, contribution: 7500, employerContribution: 0 },
      { label: 'Brokerage', kind: 'nonretirement', owner: 'joint', balance: 700000, contribution: 0, employerContribution: 0 }
    ],
    income: [
      { label: 'Salary', type: 'salary', owner: 'p1', amount: 400000, startAge: null, endAge: null },
      { label: 'Social Security', type: 'benefit', owner: 'p1', amount: 30000, startAge: 67, endAge: null }
    ],
    spending: [{ label: 'Living', category: 'other', when: 'always', amount: 90000, fromAge: null, toAge: null }]
  })
};
