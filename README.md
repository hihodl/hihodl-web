This is a [Subframe](https://subframe.com) Next.js Starter Kit that provides just enough configuration to get off and running with Subframe.

## Getting Started

First, install dependencies:

```bash
npm install
```

And then run the project:

```bash
npm run dev
```

## Learn More

Once running, you can Install Subframe locally by "syncing" Subframe with your Starter Kit. This is achieved by running the Subframe [Sync Command](https://docs.subframe.com/installation)

---

# Founder Pass, fees and rewards

Four routes and one config file were added for the Founder Pass launch.

| Route | What it is |
|---|---|
| `/founders` | The Founder Pass sales page. Live seats counter, read from the database. |
| `/founders/checkout` | Three payment rails over one order model. |
| `/fees` | The fee schedule. The **only** page that states what HIHODL keeps. |
| `/rewards` | Tier comparison and the asset APY/LTV table. |
| `/travel` | How travel rewards work. Explanatory only, no exit links. |

## How to change a rate

**One file: [`src/lib/rates.config.ts`](src/lib/rates.config.ts).**

Every percentage, price, cap and band on all five routes is read from it. No page
hardcodes a number. Change a value there and every surface moves together — which
is the point, because the failure we are designing against is a marketing page
still quoting a rate the product stopped charging weeks ago.

Three rules when editing it:

1. **Say where the number came from.** Every value carries a `// measured:`
   comment naming a live contract, a provider API, or a named constant in a named
   file, plus the date it was read. Not a slide, not a memory, and never one of
   our own analyses quoted back at itself.
2. **Mark anything unsigned `provisional: true`.** It renders with a marker so a
   working assumption is never mistaken for a commitment. Tier names, prices and
   cashback bands are all provisional today.
3. **What we keep lives in `HIHODL_KEEPS`, and renders on `/fees` only.** Every
   other surface shows what the user receives, net. Use the `netApyPct()` /
   `blendedCashbackBps()` helpers rather than reaching for the raw share.

Headline rates are always phrased `up to X%`. Yields float and cashback bands
step down, so a flat claim is false the moment the market moves.

Re-measuring instructions and the list of sources are in the header comment of
the config file itself.

### Known divergence to fix before launch

`plans.service.ts` in `hihodl-backend` sets `priceMonthlyUSD: 0.20` behind a
`TODO: revert to 9.99 after testing`. The running backend charges **$0.20** while
these pages publish **$9.99**. Revert that override before `/fees` and `/rewards`
go live, or the site quotes a price the product does not charge.

## The order state machine

```
  created ──▶ awaiting_payment ──▶ confirming ──▶ paid ──▶ refunded
                     │                  │
                     └──────▶ expired ◀─┘
```

| State | Meaning | What moves it on |
|---|---|---|
| `created` | Row exists, seat reserved, nothing issued yet. | The server derives the receiving address (on-chain rails) or creates the Stripe session. |
| `awaiting_payment` | Address and quote issued, 20-minute clock running. | Funds seen on chain, or a signed Stripe webhook. |
| `confirming` | Funds seen on chain, below the confirmation threshold. | Reaching the threshold (6 on Base, 20 on Polygon, both env-overridable). |
| `expired` | The quote lapsed unpaid. | Terminal in normal use. A retry issues a **brand new** address. |
| `paid` | Settled. Founder number assigned. | — |
| `refunded` | Settled then returned. Keeps its founder number. | — |

**Only the server settles an order.** On the on-chain rails that means logs from
an RPC node; on Stripe it means a signature-verified webhook. Nothing the browser
sends can advance an order — the `success_url` redirect is a browser navigation
and is treated as one.

Expiry is enforced in the database (`expire_stale_founder_orders()`), called at
the top of every read path, so there is one definition of "lapsed" and no cron to
drift out of sync.

Late payments are still reconciled. A transfer landing a minute after the quote
lapsed is real money on an address the payer cannot recover it from, so an
`expired` order that receives funds still settles. The 500-seat cap holds
independently, inside `claim_founder_seat()`.

### One fresh address per order, never reused

`address_index` comes from a Postgres sequence and is `UNIQUE`. An address is
never issued twice, including for expired orders. Two reasons, both load-bearing:

- **Attribution.** The receiving address is the only thing binding a transfer on
  a public ledger back to a buyer. Reuse it and two payments become
  indistinguishable — we cannot tell who paid.
- **Income privacy.** One reused address publishes the whole Founder Pass revenue
  line to anyone with a block explorer.

Addresses are derived watch-only from an account-level BIP-32 **extended public
key** (`m/44'/60'/A'`), the same scheme as the backend's
`evm-derivation.service.ts`. There is no private key in this repo, its
environment, or its bundle: this app can mint receiving addresses and can never
spend what lands on them. Sweeping is a treasury operation from the device
holding the seed.

Only EVM chains settle this. ed25519 derivation is hardened-only, so a
per-order Solana address would require the seed on a serverless function.

### Database

`supabase/migrations/20260730120000_founder_orders.sql`.

`founder_orders` is server-authoritative: **RLS enabled with zero policies, and
all grants revoked from `anon` and `authenticated`** — on the table, the
sequences and the functions. Both halves are needed. RLS gates rows, `GRANT`
gates the table; a table behind RLS with zero policies but its default grants
intact is still fully readable, which is a mistake this project has made before.
The service role is granted back explicitly in the same file so the grant is
visible next to the revoke.

### Environment

| Variable | Used for |
|---|---|
| `FOUNDER_TREASURY_XPUB` | Account-level extended **public** key, `m/44'/60'/A'`. |
| `FOUNDER_TREASURY_ACCOUNT_INDEX` | Which BIP-44 account that xpub sits at. Default `0`. |
| `BASE_RPC_URL`, `POLYGON_RPC_URL` | Deposit detection. |
| `BASE_MIN_CONFIRMATIONS`, `POLYGON_MIN_CONFIRMATIONS` | Optional overrides. |
| `STRIPE_SECRET_KEY` | Checkout session creation. |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification. Fail-closed: without it the webhook rejects everything. |
| `SUPABASE_SERVICE_KEY` | The only key that reaches `founder_orders`. |
| `NEXT_PUBLIC_SITE_URL` | Stripe return URLs. |

Point the Stripe webhook at `/api/founders/stripe/webhook`.
