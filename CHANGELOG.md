# Changelog

Bump `VERSION` in `sw.js` with each release.

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
