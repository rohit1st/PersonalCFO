# Net Worth Planner — project context for Claude

Read this first in every session. It carries over the decisions made while building the app in a claude.ai chat (Personal CFO project), so work can continue in Cowork or Claude Code without re-explaining.

## What it is

A private, offline net worth and retirement planner for friends and family: "Your confidential companion 🤫 You can run me without wifi." Static site (no server, no build step, no dependencies) hosted on GitHub Pages and installable as a PWA. People answer a short quick start, then refine inputs; the app projects net worth year by year with best / mid / worst cases from a 1,000-path Monte Carlo simulation and headlines a **work-optional age**.

Owner: the user (admin). They edit `config.js` for defaults and the example household.

## Non-negotiables

1. **Privacy.** Nothing a user enters ever leaves their device. Data is saved in the browser's localStorage only. The page's CSP includes `connect-src 'none'`; never add network calls, analytics, CDNs, external fonts or images.
2. **Offline.** Everything must work without wifi after first load (service worker caches app files).
3. **Not advice.** Keep the educational framing and disclaimer. Terms of use live in `config.js`; users must tick an acceptance box on the quick start welcome screen. Don't write copy that sounds like personalized financial advice.
4. **Design system.** Pastel, light, uncluttered. Off-white background, soft teal primary (`--teal-deep #2B6B7E`), green = good, coral = bad, amber = caution. **No purple anywhere.** Rounded cards, soft shadows, system font stack. Every screen must work on phones (test at 360–375px wide).
5. **Run the evals** (`node evals/run.js`) after any change to `model.js` or `config.js`, and don't update golden results unless the change was intended.

## Files

| File | Role |
| --- | --- |
| `index.html` | Entire UI: HTML, CSS and page JavaScript in one file |
| `model.js` | Pure projection math, shared by the page and the evals (`NWPModel.create(config, { year })`) |
| `config.js` | Admin settings: starting assumptions, quick start guesses, US tax tables, example household, disclaimer/terms |
| `sw.js` | Service worker (offline cache). **Bump `VERSION` on every release**: it's the only way installed copies get changes (including config.js edits) |
| `manifest.webmanifest`, `icons/` | PWA install metadata |
| `evals/` | Automated checks; see `evals/README.md` |
| `README.md` | Deploy and admin guide for the owner |
| `CHANGELOG.md` | Version history |

## How the model works (model.js)

- Year 0 = today's balances; each later row is a full year. Balances grow by that year's return, then the year's flows apply at year end.
- Returns are lognormal: `exp(ln(1 + r) + vol·z)`, one shared market shock per year for all investment accounts, fixed random seed (`mulberry32(20240611)`), 1,000 paths. Entered return = median growth. Best/mid/worst = 90th/50th/10th percentile per year.
- Balances: pre-tax retirement per person (R1, R2; joint pre-tax split evenly, all Partner 1's if single), Roth (Q), non-retirement (N), home and other (O, never sold).
- Income is **before tax** (`incomeBasis: 'gross'`). Taxes are estimated per year in today's dollars: federal brackets + standard deduction (single/joint by partner toggle), Social Security (wage base) + Medicare + additional Medicare, flat state rate. Pre-tax contributions reduce taxable income; Roth ones don't. 50% of Social Security/pension counted. Optional flat override (`payTaxRate`). Plans saved before this used take-home pay (`incomeBasis: 'net'`): no tax applied, and the UI offers "Switch to pay before taxes".
- Cash flow per year: income − taxes − your contributions − spending − loan payments − college/purchases. Surplus goes to non-retirement. Shortfall draws from non-retirement, then pre-tax (grossed up by withdrawal tax), then Roth (tax-free); if all are empty, savings "ran out" that year.
- **RMDs**: from 73 (75 if born 1960+, birth year = this year − age), each year's minimum = last year-end pre-tax balance ÷ IRS Uniform Lifetime Table divisor (`requiredWithdrawals` in config). Taken after growth, taxed at the flat withdrawal rate, applied to the year's cash flow before any other withdrawal; surplus goes to non-retirement. After one partner's plan-until age, the other takes RMDs on their accounts at their own age. No still-working exception; RMDs don't affect the pay-tax estimate. Result: `rmd` (mid case, nominal) and `rmdAges`.
- Salaries grow at salary growth and always stop at the owner's retirement age (a salary end age can only stop them sooner; work after retiring = Other income); everything else entered in today's dollars rises with inflation (college with college inflation). Contributions stop when the owner retires (joint when both have).
- Loans amortize monthly; if only a paid-off year is given, the payment is calculated; if both are given, any remainder is paid as a lump sum in that year.
- Spending items: `always`, `pre` (before everyone has retired), `ret`, or `ages` (Partner 1's ages).
- **Moving retirement** (`shiftRetirement(plan, years)`): both partners move by the same years, and so does the end age of each person's last salary (latest start; ties → latest end), for Coast FIRE plans. Earlier salaries keep their end ages. Used by the Play with it slider/presets and by work-optional; editing "Retire at" in the plan does not shift salaries.
- **Work-optional age**: earliest Partner 1 retirement age (moved with `shiftRetirement`) where savings last the whole plan in ≥ 85% of paths (`workOptionalConfidence` in config). Binary search using 400-path runs.

## UI conventions and decisions (keep these)

- App name "Net Worth Planner"; headings "Your plan" (left) and "Your Projections" (right) sit at the same height above their cards; toolbar icons (Open, Save a copy, Export, Reset, Erase) next to "Your plan"; "Share with friends 💌" in the header (app link only, never plan data: share sheet on touch devices, falling back to copy unless they closed it; copy + "Link copied ✓" on desktop; a copy-the-link dialog if the clipboard is blocked); header, banners and columns share one width (1360px); Today's/Future dollars toggle inside the chart card, next to the chart legend.
- Left column is a full-height sticky sidebar on desktop; right column is a stack of equal cards: highlight (work-optional), chart card (Play with it sliders + chart + summary text under the chart), Scenarios, Year by year, How the projection works.
- Play with it slider labels: retire at "62"; spending "$219k/year (+10%)"; returns "5.5% (−1 pt), ≈3% after inflation". Preset chips: Retire 2 years sooner, Work 3 more years, Spend 10% less, Tough markets.
- Scenario table shows mid-case figures only, with a caption "Mid case, in today's dollars"; the first row is "Your plan" (the saved-file format still labels it "(current inputs)"); eye toggle and trash icons (delete has Undo). No "Load" action.
- Chart milestones: life events (college 🎓, loans paid off ✅/🏡, benefits 💵), work-optional 🎉, and `milestones()` from model.js: net worth round numbers in today's dollars 💰 (at most four) and the 4% rule 🏁 (mid-case savings, not home, × 4% ≥ that year's spending + loan payments). The fun ones also appear in a strip under the chart and in the hover tip.
- Erase my data (toolbar + footer): confirmation dialog with "Save a copy first", removes every `netWorthPlanner.*` localStorage key and stops autosave, then an "All clear" screen (Close tries window.close; Start fresh reloads).
- On phones, "Year by year" starts collapsed and uses the same left-caret collapse control as the input sections.
- Assumptions: returns are stored before inflation (the model's inputs), but each return field shows the after-inflation rate, with an amber note outside `returnAfterInflationNote`. The Investment mix picker (presets in config `investmentMixes`, defined after inflation) fills both returns and ups and downs; `assumptions.mix` holds the choice ('custom' or missing = hand-set). Changing inflation re-derives preset returns; editing a return or ups and downs switches to Custom. Helpers `realRate`, `nominalRate`, `mixAssumptions` live in model.js.
- Key result tiles under the headline card (`keyResults()` in model.js): net worth at retirement (or in 10 years if already retired), at plan end, tough markets (worst case lasts / runs out at), first-year draw from savings (tone: ≤4% green, ≤5% amber). They don't repeat the headline's work-optional age and chance of lasting. Two columns on phones.
- Scenario details: tapping a saved scenario's name expands a row listing what differs from the current plan (`planDiff()` in model.js: sections, plain labels, before → after, items added/removed by position) and a current → scenario comparison of work-optional age, chance savings last, net worth at plan end and worst case.
- "What's new": `whatsNew` in config.js (newest first, one per release, ≤160 characters, playful). Shown once at the top to people who had a saved plan from an earlier version; `netWorthPlanner.seenVersion` in localStorage remembers the last one seen. New visitors don't see it.
- Updates (sw.js + the registration code at the end of index.html): each version installs every app file fresh (`cache: 'reload'`) into its own cache and serves only from it (cache first, no background refresh, so versions never mix). The page registers with `updateViaCache: 'none'`, applies a waiting update on open or when it becomes visible again, checks `reg.update()` on visibility and hourly, and otherwise shows a sticky "Update now". Footer: "Version vN" (from `whatsNew[0]`) and **Refresh app** (unregisters the worker, deletes `net-worth-planner-*` caches, reloads; localStorage untouched).
- Number entry: percent fields use `inputmode="decimal"` and accept "," as the decimal point (some iOS keyboards); money fields treat "," as thousands.
- Names flow everywhere: renaming a person updates labels like "Sam's 401(k)".
- Quick start: welcome (privacy note, disclaimer, accept checkbox, example / open links) → people → retire age → kids → savings → home → pay before tax + your contributions + employer → spending (pre-filled guess). Guesses are tagged "Estimated" until edited. A plan-detail checklist in "Your plan" guides refinement.
- Income summary: before tax, taxes (%), "Into retirement from pay", take-home, then a "Total saving" line (contributions + employer + what's left after spending and loan payments; college and big purchases excluded because they're paid from savings).
- Footer: "Built with love ❤️" + short disclaimer + Terms of use link. No contact email.
- Copy style: plain, friendly, sentence case, no jargon without explanation; info "i" tooltips for concepts like market ups and downs and taxes.

## Working agreements

- Before changing the math: write or update an eval first, run `node evals/run.js`, then change the code.
- After editing `config.js`: `node evals/sync-builtin.js` (keeps model.js's fallback copy in sync), then `node evals/run.js`. Example-household golden results will move; update them with `--update` if intended.
- Before shipping: evals pass; test the page at desktop and ~375px; check the browser console is clean; bump `VERSION` in `sw.js`; add a line to `CHANGELOG.md`; add a matching `whatsNew` note in `config.js` (the evals check it).
- Test locally with `python3 -m http.server 8000` in this folder (service worker and install need http, not file://).
- Keep everything dependency-free and in these few files unless there's a strong reason.

## Known limitations / ideas backlog

- Taxes: no itemized deductions, credits, capital gains on brokerage withdrawals, IRMAA or state brackets; withdrawal tax (including on RMDs) is one flat rate, so RMDs never push anyone into a higher bracket.
- Returns are independent year to year (no mean reversion); defaults are conservative (4% rule ≈ 77% success vs ~90–95% historically).
- Spending doesn't change if a partner dies; Social Security guesses in quick start are very rough (labelled as such in quick start and under Income).
- No sync between devices (by design). Idea: QR-code transfer between phone and laptop.
- Ideas raised but not built: shareable milestone card exists; could add plan-completeness rewards, Personal CFO modules (CSV imports, expenses, marketplace) from the PRD in the chat project.
