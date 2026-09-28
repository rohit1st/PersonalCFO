# Net Worth Planner

Your confidential companion 🤫 A retirement and net worth planner that runs entirely on your device.

- **Private:** your plan is saved in your own browser's storage and never sent anywhere. The page includes a security rule (`connect-src 'none'`) that tells the browser to block any network request the page tries to make.
- **Works offline:** after the first visit it opens without wifi.
- **Installable:** add it to your phone's home screen or your computer's apps.

## Put it on GitHub Pages (about 5 minutes)

1. Sign in at github.com and click **New repository**. Name it, for example, `net-worth-planner`. Make it **Public** (free GitHub Pages needs a public repository; your *plans* are never in it, only the app's code).
2. On the new repository page, click **uploading an existing file**. Drag in everything from this folder: `index.html`, `config.js`, `model.js`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `README.md` and the `icons` folder. Click **Commit changes**.
   - Tip: `.nojekyll` is a hidden file. If your computer hides it, it's fine to skip it.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and click **Save**.
4. After a minute or two the page shows your link, like `https://YOUR-NAME.github.io/net-worth-planner/`. That's the link to share.

## How friends and family use it

Send them the link. The first visit walks them through a short quick start, then everything saves automatically.

- **iPhone / iPad (Safari):** tap **Share**, then **Add to Home Screen**. Recommended: Safari may clear a website's saved data after a few weeks without a visit, but not for apps added to the home screen.
- **Android (Chrome):** tap **Install app** in the planner, or the menu ⋮ then **Install app**.
- **Mac / Windows (Chrome or Edge):** click **Install app** in the planner, or the install icon in the address bar.

Each person's plan lives only on their own device. Nobody (including you) can see anyone else's plan.

**Moving to another device:** use **Save a copy** (the download icon in *Your plan*) on the old device, then **Open** it on the new one.

## Changing the settings (admin)

Everything you might want to adjust lives in **`config.js`**, with a comment next to each setting:

- **Starting assumptions** for new plans and the example: returns on retirement and non-retirement accounts, inflation, salary growth, college inflation, taxes, market ups and downs.
- **Quick start guesses:** default retirement age, college cost, Social Security estimate, spending guess, mortgage rate.
- **Tax tables:** federal brackets, standard deduction, Social Security wage base. Update these each year.
- **The example household:** names, ages, accounts, income, spending, loans and purchases.
- **The disclaimer and terms of use.**

To change something: edit `config.js` on GitHub (open the file, click the pencil icon, edit, **Commit changes**), then bump `VERSION` in `sw.js`. If you work on your computer, also run `node evals/sync-builtin.js` and `node evals/run.js` (see `evals/README.md`). New settings apply to new plans and the example; people's existing plans keep the assumptions they already have.

## Updating the app later

1. Upload the changed files to the repository (same as step 2).
2. Open `sw.js` and change `const VERSION = 'v1';` to `'v2'` (then `'v3'`, and so on). Commit.

People with the app open will see "A new version of the planner is ready" with an **Update now** button. Their saved plans are kept.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The whole app |
| `config.js` | Admin settings: assumptions, example household, tax tables, disclaimer |
| `model.js` | The projection math (used by the page and by the evals) |
| `evals/` | Automated checks for the math; see `evals/README.md` |
| `CLAUDE.md` | Project context for Claude (Cowork / Claude Code) |
| `CHANGELOG.md` | What changed in each version |
| `manifest.webmanifest` | Name, colors and icons for installing |
| `sw.js` | Service worker that makes it work offline |
| `icons/` | App icons |

You can also double-click `index.html` to run it straight from your computer. Installing and offline mode only work from the hosted link.

*A planning tool for conversations, not financial, tax or investment advice. Have a lawyer review the terms of use in `config.js` before sharing widely.*
