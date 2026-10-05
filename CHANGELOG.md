# Changelog

Bump `VERSION` in `sw.js` with each release.

## v14 — required withdrawals in Year by year
- Year by year has a Required withdrawals column next to Income (mid case; shown only when the plan has RMDs), so RMDs are visible each year rather than only in the notes. They stay separate from Income because they come out of your own pre-tax savings and vary with markets. The note above the table says so.
- Export projections adds a `required_withdrawals_mid` column.

## v13 — themes, a Settings drawer and life ideas
- Life ideas in Scenarios: Have another kid, Buy a new home, Move somewhere new, Take a career break, Downsize later, Help family, Windfall, Big purchase. Pick one and it opens as a plain sentence with suggested values (and where each comes from); edit any of them, see the effect live (work-optional age, chance savings last, net worth at plan end, and a line on the chart), then Save as scenario or Apply to my plan (with Undo). "+ Add another idea" stacks several into one scenario. Suggested values live in `config.js` (`lifeIdeas`).
- Model: loans can start in a future year (`startYear`), and home or other assets can be bought later (`fromYear`) or sold (`sellYear`, the value moves into savings). The plan form shows these fields so applied ideas stay editable.
- Evals: a whole-scenario check stacks seven ideas on one household and matches an independent year-by-year calculation to the dollar for 41 years; downsizing is checked numerically, including after buying a new home (it sells the new home).
- Color themes: Lagoon (the original teal), Harbor, Linen and Graphite. Pick one in Settings; it's saved on this device and applied before the page draws. Themes live in `config.js` (`themes`); the evals check every theme for readable contrast, light backgrounds and no purple. Green, coral and amber keep meaning good, bad and caution in every theme.
- Settings drawer (button top right; icon only on phones): theme swatches; Save a copy, Load a backup, Export projections, Erase my data; Add to home screen (with iPhone steps when needed), Share with friends, Refresh app with the version. Closes with ×, Esc or a tap outside.
- The header's Install button and the footer's Erase / Refresh links moved into Settings; the footer shows the version and a Settings link.
- The milestone share image uses the current theme's colors.

## v12 — inflation, Social Security and pensions
- Play with it has an Inflation slider (0–8% in 0.25 steps). With an investment mix, returns follow inflation (as in Assumptions); hand-set returns stay, so higher inflation lowers what's left after it.
- Percent fields have − / + buttons (0.25 steps; 1 for market ups and downs and withdrawal tax), so decimals work even on phone keyboards without a decimal point.
- Social Security is no longer charged state tax by default (most states don't tax it); `taxes.stateTaxesSocialSecurity` in config.js turns it back on.
- Income types: Social Security and "Pension or annuity" are now separate. Pensions are fully taxable (federal and state); half of Social Security counts federally.
- Each non-salary income has "Rises with inflation each year": on for Social Security and other income, off by default for pensions (many have no cost-of-living raise).
- How the projection works explains that best, mid and worst differ only in market returns.
- Golden results updated: retirees no longer pay state tax on Social Security (e.g. the retired single household's tax this year $750 → $0; chances of lasting up 0.3–2.6 points; work-optional ages unchanged).

## v11 — simpler results, quick start steps
- Quick start shows "Step 3 of 7" next to the progress bar (the welcome screen isn't numbered; it promises seven questions).
- The four key result tiles are above the chart again, with the chart card (chart, then Play with it) below them.
- The milestone pills under the chart are gone; milestones stay as icons on the chart and in the hover tip.
- Play with it is just the three sliders; the preset chips (Retire 2 years sooner, Work 3 more years, Spend 10% less, Tough markets) are gone.

## v10 — clearer layout
- Results start with the chart card (chart, milestones, then the Play with it sliders right under it, so the what-if line moves in view), then the key result tiles. Less to scroll past before seeing results, especially on phones.
- The work-optional age is now the first of the four tiles (same green, 🎉 and number reveal), replacing the big headline card. The tiles: work-optional, savings last (% of markets and the worst case), net worth at retirement, first-year draw. Net worth at plan end moved out (it's where the chart ends).
- Under the chart: one sentence plus "How is this calculated?", which opens How the projection works. The 1,000-simulation details and run time live there now.
- Share moved from the header to the footer: "Built with love ❤️ for friends and family. ⇪ Click to share", with a share arrow; "Link copied ✓" now appears right there instead of at the top of the page.
- The Reset button is gone; Erase (and "Start your own plan" for the example) covers starting over.

## v9 — reliable updates, milestones, share and erase
- Chart milestones: net worth round numbers in today's dollars ($1M, $2M, $5M, $10M…, at most four) and the year savings reach the 4% rule (25× a year's spending), alongside work-optional age and life events. Listed in a strip under the chart so they show on phones too. (`milestones()` in model.js.)
- Share with friends 💌 in the header: shares only the planner's link, with a note that nothing they entered is shared. Phones get the share sheet; desktop copies the link ("Link copied ✓"); if copying is blocked, a small dialog shows the link to copy. There's always visible feedback.
- Erase my data: an Erase button in the Your plan toolbar and a footer link. Confirms (with "Save a copy first"), removes everything the planner stored in this browser, then shows an "All clear" screen.
- The title now lines up with "Your plan" on wide screens.
- Scenarios: "Current inputs" is now "Your plan".
- Fix: saving a scenario briefly showed "Work-optional when … is undefined".
- Fix: phones could stay on an old version. The "Update now" prompt disappeared after 20 seconds and never came back, and a phone that resumes the app from the background never reloads, so the new version could wait forever.
- A downloaded update is now applied when the app opens or comes back to the screen; otherwise "Update now" stays until used. The app checks for new versions at those moments and hourly.
- New versions download every file fresh (not from the browser's 10-minute cache), and each version's files are served together (no more one-file-at-a-time background refresh, which could mix versions).
- Footer shows the version and a **Refresh app** link that reloads the latest version without touching saved plans.
- Evals: `08-offline` runs the real `sw.js` against a stand-in browser (fresh downloads, no mixing, offline, cleanup) and checks the page's update handling. The eval runner now supports async evals.

## v8 — scenario details, key result tiles, what's new
- Scenarios: tap a scenario's name to see what's different from your current plan (inputs, before → after, in plain words) and how the results compare (work-optional age, chance savings last, net worth at plan end, worst case).
- Key result tiles under the headline: net worth at retirement (or in 10 years if retired), net worth at plan end, how savings hold up in tough markets, and how much the first year of retirement draws from savings.
- "What's new" note: people who used an earlier version see a short note once after updating (`whatsNew` in `config.js`).
- Fix: percent fields take a comma as the decimal point, and the quick start mortgage interest field now shows a keypad with a decimal point on iPhones.
- What-ifs that change returns now mark the investment mix as Custom.
- Evals: scenario differences, key results, and a check that `whatsNew` has a note for the version in `sw.js`.

## v7 — returns after inflation
- Every return field under Assumptions shows what's left after inflation ("≈ 3.5% after 2.5% inflation"), and the Play with it returns slider does too ("6.1%, ≈3.5% after inflation").
- Investment mix picker (Mostly stocks, Balanced, Conservative, Custom) sets both returns and market ups and downs together. Presets are defined after inflation in `config.js` (`investmentMixes`), so returns follow the plan's inflation; editing a return or ups and downs by hand switches to Custom.
- A gentle note when a market return after inflation is below 0.5% or above 6% (`returnAfterInflationNote` in `config.js`).
- Evals: before/after inflation conversion and the mix presets. No change to projections for existing plans.

## v6 — required withdrawals, projection check
- Required minimum distributions (RMDs): from 73 (75 if born 1960 or later), the IRS minimum comes out of each person's pre-tax accounts every year (Uniform Lifetime Table in `config.js`), taxed at the withdrawal rate, used for spending first, remainder saved. A surviving partner takes over the other's accounts. Noted under Income with the first year's mid-case amount, and as a milestone on the chart.
- Social Security guesses are labelled as rough, in quick start and on each estimated row under Income.
- Fix: a salary with an end age kept paying after retirement, so retiring earlier could show a higher end result and a too-early work-optional age. Salaries now always stop at retirement; the end age can only stop them sooner.
- Retire at slider (and its presets, "Use in my plan" and the work-optional age) now also moves the end of each person's last salary, so Coast FIRE plans work: a high-paying job now, a lower-paying one later, then retirement. Earlier salaries keep their end ages.
- Example household: kept the younger, lower-pay defaults from the "Updated defaults" commit on GitHub and scaled its spending to 60% so it fits that pay ($119k a year; lasts in 92% of markets, work-optional at 61).
- Today's / Future dollars toggle moved into the chart card, next to the legend.
- Evals: new Coast FIRE test household; checks that moving retirement shifts only each person's last salary and that the work-optional age matches the slider; salary end-age check; retiring later never lowers worst/mid/best at plan end; 6 RMD checks, and a whole-projection check that recalculates a detailed household year by year and must match to the dollar. Fixed the "config.js has changed" note showing on a passing eval.
- Golden results updated: mid and best net worth at plan end are 2 to 5% lower (RMDs are taxed as they come out); success rates up to 0.6 points higher; work-optional ages unchanged.

## v5 — model split out, evals
- Moved the projection math into `model.js` so it can be tested on its own.
- Added `evals/`: 39 checks across math, cash-flow timing, simulation properties, benchmarks and golden results; sensitivity report; CI workflow.
- Added `CLAUDE.md` project context for Cowork / Claude Code.

## v4 — saving and Roth
- Income summary: "Into retirement from pay" and a Total saving line with savings rate.
- Retirement accounts can be Pre-tax or Roth; Roth contributions don't lower taxes, Roth withdrawals are tax-free and come last.

## v3 — taxes, disclaimer, admin config
- Income entered before tax; federal, Social Security, Medicare and state taxes estimated (2026 tables); flat-rate override.
- Retirement accounts: separate "You add" and "Employer adds".
- Disclaimer and terms of use with acceptance on the welcome screen; footer disclaimer; contact email removed.
- `config.js` for starting assumptions (retirement 5%, non-retirement 6%), quick start guesses, tax tables, example household, legal text.
- Mobile "Year by year" uses the standard left caret.

## v2 — layout
- Balanced two-column layout, matching headings, all sections as cards; summary text moved under the chart; slider labels reworded; collapsible year-by-year on phones.

## v1 — installable app
- PWA (offline, installable), autosave on device, quick start, work-optional age highlight, Play with it sliders, life milestones on the chart, confetti, shareable milestone image.
