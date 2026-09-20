# Web demo: every screen, no backend

Branch `preview/web-together-demo` (from `integrate/web-together`, with `preview/spaces-demo` merged in). Never merged. Its Vercel preview renders every screen of app.hihodl.xyz and of the public Spaces pages with demo data, without a backend, without Supabase and without an account.

## Open it

- Preview: `<preview host>/app/screens`, the index of every screen and state (about 260 links, grouped as the product is).
- Locally: `npx next build && npx next start -p 3330`, then http://localhost:3330/app/screens.

Every link is a full page load that carries the demo state it needs, so it lands on exactly that state whatever was clicked before.

## The DEMO badge

Bottom right on every page. It shows who you are and which wallet the account has, and opens the controls:

- **All screens**: back to the index.
- **Viewing as**: Creator (`@demo_creator`), Manager (Dana), Rep (Kai), Invitee (Sam, holding a seat link).
- **Wallet**: web wallet, app wallet, no wallet, a web wallet on another account.
- **Linked phone**: none, Android, iPhone.
- **X account**: linked, not linked, not verified, too new, link again.
- **Session**: sign out or in; everything back to default.
- **Account (Spaces)**: reset to mid-life or to empty.
- **Make the next call fail**: arm a real refusal code for the next matching call.

## State in the address bar

| Query | Effect |
| --- | --- |
| `demo-role=owner\|manager\|rep\|invitee` | Who is signed in |
| `demo-wallet=web\|app\|none\|other` | The account's wallet |
| `demo-phone=none\|android\|ios` | The linked phone |
| `demo-account=done\|new\|half` | How far onboarding got (`half`: username and passkey, no codes, no wallet) |
| `demo-signed=in\|out` | Signed in or at the door |
| `demo-remembered=none\|google\|email` | What "Welcome back" remembers |
| `demo-x=linked\|none\|unverified\|too-new\|relink` | The creator's X account |
| `demo=seeded\|empty` | Re-seed the Spaces account |
| `demo-fail=<code>` | The next call answers that code |
| `demo-open=<steps>` | Press buttons once the page renders (`a>b`, alternatives `a\|b`, `@spot` for an open spot, `b:` for buttons only) |
| `demo-checkout=paid` | A spot's checkout opens on its receipt |

Screens with several states on one address read their own parameter: `/welcome?step=username|profile|passkey|recovery|wallet|app-wallet|link`; the link step's `state=qr|qr-iphone|qr-android|sas|sas-no-wallet|sending|done-android|done-ios|mismatch|expired|failed`; `/link/<id>?phone=android|ios|computer` (ids `demo-done`, `demo-expired`, `demo-other` for those states); `/wallet?unlock=1`, `screen=receive|withdraw|settings|export|add`, and with `screen=withdraw` a `state=form|form-filled|form-invalid|review|link-first|on-phone|passkey|sending|sent|rejected|expired|failed`; the listing editor's `step=basics|includes|sell|publish` on a draft; Deliveries' `pane=brief|deliver` on a production spot. The product's own parameters (`view`, `tab`, `event`, `listing`, `item`, `offer`, `status`) work as usual.

## What is fake

| Part | In demo mode |
| --- | --- |
| Session | No Supabase client is ever made. You are the demo role, kept in this browser's localStorage. The door's buttons sign you straight in; the email code takes any six digits. |
| Backend | A `window.fetch` shim (`src/lib/demo/fetch.ts`), installed by the root layout before any screen asks, answers every call to the HOLD API and to Supabase in the browser. `API_BASE` is `https://api.demo.invalid/api/v1` on this branch, so a call that slipped past could never reach api.hihodl.xyz; `api.hihodl.xyz` and `*.supabase.co` are refused on the spot. |
| Stores | Spaces: the console's in-memory store from `preview/spaces-demo`, extended with content production, the product photo, settings and Insights (`src/lib/creator/demo-store.dev.ts`, `src/lib/demo/insights.ts`). The catalogue it offers is the backend's whole one, copied to `src/lib/creator/demo-catalog.dev.ts` from `catalog-data.ts` — 13 products and 13 services and sessions, with the backend's own zones, so "Use this idea" on a dress opens the editor on the dress. Account, wallet, phone link and withdrawals: `src/lib/demo/account.ts`. Money — balances, prices and their history, transfers, the ledger's accounts and its split, Kamino and Aave, cost basis, schedules, payouts, rails and the alias: `src/lib/demo/money.ts`. Public checkout, offers, bookings and production delivery: `src/lib/demo/public.ts`. Writes are kept in this tab's sessionStorage until a link from the index or the badge resets them. |
| Passkeys | Answer at once with a demo credential and a fixed PRF (`src/lib/demo/passkey.ts`). The wallet crypto is the real code on a fixed demo phrase: create, unlock, export, add a passkey, link a phone (SAS and seal) and a passkey-approved withdrawal all run for real. |
| Phone | An Android phone "joins" a link five seconds after the QR shows; an Android withdrawal is approved six seconds after it is asked (`phone-answer=reject` declines it). |
| Public pages | Rendered from `src/lib/ad-space/fixture.dev.ts`, on in every build here. The Solana Pay QR is "scanned" six seconds after it shows, then the order is paid. |

The creator is fictional (`@demo_creator`, "Demo Creator") and so are the brands (Northwind, Lumen Labs, Paperclip, Mesa, Stackd, Kopi Labs, Acme, Nodeline, Orbit).

## The money the fixture person has

Home, Activity, Payments, Savings, Invest and Add money are all drawn from `src/lib/demo/money.ts`, one person with four accounts:

| | Liquid | Working (Kamino) |
| --- | --- | --- |
| Main | $2,790.55 in dollars, 6.421 SOL, 0.418 ETH | — |
| Savings | $40.00 | $3,233.56 |
| Travel fund (pocket) | $12.50 | $858.91 |
| New camera (pocket) | $640.00 | — |

One pooled Kamino position of $4,092.47 over $4,050 of principal, split between Savings and the Travel fund by the ledger's own rows, so Savings shows a blended 5.4% net and the interest it has earned. Thirty-two transfers over the last three months — brands paying in, collaborators paid out, three merchants (one stay paid from two chains, which folds into one row), two swaps and the moves that funded Savings and the pockets — give Activity its day dividers and its rewind, and Payments eight conversations. One monthly schedule and one bank payout on its way. Every counterparty is invented and every address belongs to nobody.

`?demo-wallet=none` answers with no money at all: that is the link to the app's own empty Home, empty Activity and empty Payments.

## Checks

Before each push: `tsc` 0, eslint on the touched files, `next build`, then a puppeteer pass (kept outside the repo) that opens `/app/screens`, follows every link and fails on an error page, a script error, or any request to api.hihodl.xyz, Supabase or `*.invalid`; and one that clicks the live flows (onboarding end to end, unlock and withdraw on Android and iPhone, create a wallet, export the words, the QR checkout, a brand's acceptance).
