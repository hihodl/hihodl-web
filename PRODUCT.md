# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary visitor is **someone who wants to download the app**. The marketing site
has one job: get them to the store, or onto the notify list until the store link is
live.

They are people who **earn in dollars and live somewhere that does not spend
dollars** — remote workers, freelancers, contractors and creators paid by clients
abroad. The recurring situation is a gap between the currency their income arrives in
and the currency their rent is denominated in, currently bridged with several
disconnected apps.

Secondary audiences exist and are served by dedicated routes, but they do not own the
homepage hierarchy: existing users (`/faq`, `/how-it-works/*`, `/legal/*`,
`/delete-account`) and Founders buyers (`/founders`, `/founders/checkout`).

## Product Purpose

A **self-custodial dollar account**: hold dollars as stablecoins, earn yield on them,
spend them with a card, send them to a bank account abroad, and use them for travel
and connectivity. The user holds their own keys; HOLD never takes custody.

Success for this site is a download or a notify-list signup. Success for the product
is a user who stops assembling this out of a bank, an exchange and a remittance app.

## Positioning

**Earn globally, live locally.** The mechanism a neighboring product cannot truthfully
copy is the combination of **self-custody with retail-grade usability**: the money is
the user's own on-chain balance the whole time, and it still behaves like an account
with a card, a yield rate and a payout rail.

The product is deliberately **not** a crypto-speculation product. The asset is dollars
that are meant to hold still, not an asset held through volatility. Copy and design
must not drift toward trading, charts, tickers or gains language.

## Operating Context

The visitor is usually on a **phone**, often on a connection that is not fast, and is
comparing against a bank app and a remittance app they already have installed. Many
read English as a second language. The site is the only surface between a referral or
an ad and an install.

Supported networks are **exactly four: Solana, Polygon, Base, Ethereum.** Never name
another one anywhere on the site.

## Capabilities and Constraints

- **Self-custody is a hard product fact, not a marketing angle.** No claim may imply
  HOLD holds, freezes or controls user funds.
- **The product never blocks by country.** No copy, form or illustration may present
  geography as an eligibility gate. The single exception is the eSIM offer, which is
  restricted by **place of sale**, not by destination.
- Surfaces in the product line: dollar balance, savings/yield, card, off-ramp to bank
  accounts, travel, eSIM, points.
- **Undecided and not to be invented:** launch date, pricing beyond what `/how-it-works/fees`
  already states, card availability by market, and any yield figure not read from the
  live rate source.

## Brand Commitments

- **The public product name on this site is `HOLD`.** Confirmed 2026-08-19. It is used
  across copy, the wordmark, OG and Twitter metadata. Do not substitute `HIHODL` or
  `Hi` in visitor-facing text.
- The legal entity is **HIHODL TECHNOLOGIES OÜ** (Estonia). It appears in Terms and
  legal pages only.
- **Open decision, recorded and not acted on:** a proposal exists to rename the
  consumer product to `Hi`. Until that is called, `HOLD` is binding here.
- **Never use red in the UI.** This is a standing rule across all HOLD surfaces.
- Amber is the action colour and is used sparingly; a single amber in the palette,
  separated by form (filled = action, tinted = attention).

## Evidence on Hand

**The site is pre-scale and must not present itself otherwise.** As of 2026-08-19
production holds single-digit real users and negligible revenue, against a waitlist in
the tens of thousands.

- **Removed 2026-08-19: three fabricated testimonials** (attributed to "Lucía R.",
  "Akin O.", "Maria S.") and the accompanying claim *"Loved by global earners in 80+
  countries"*. Alex confirmed they were invented. **Never regenerate social proof.**
  For a financial product, an invented testimonial is a regulatory exposure and not
  only a credibility one.
- Real assets that may be used: the product screens in `public/screens`, the referral
  and leaderboard mechanics (`/leaderboard`, `/invite/[code]`), the fee disclosures
  under `/how-it-works/*`, and the legal pack under `/legal/*`.
- **Absences future work must not fill by invention:** user counts, transaction
  volumes, country counts, press mentions, partner logos, ratings, and named customers.

## Product Principles

1. **The download is the only conversion.** Every section either moves the visitor
   toward the store or earns the right to keep their attention until it can.
2. **Self-custody is the argument, not a footnote.** Where a bank would say "your money
   is safe with us", HOLD says the money never left the user.
3. **Concrete over categorical.** The visitor's problem is a specific currency mismatch
   on a specific day; the copy stays at that altitude rather than at "the future of
   finance".
4. **Claim only what is measured.** No traction, geography, rate or partner is stated
   on this site unless it is read from a live source or independently verifiable.
5. **Nothing on this site is a gate.** No country check, no eligibility quiz, no
   artificial scarcity in front of the download.

## Accessibility & Inclusion

No formal standard has been adopted yet, and the current build does not meet WCAG AA:
a browser audit on 2026-08-19 found **52 contrast failures**, including body text at
2.4:1 and one text-on-gradient surface at 1.1:1.

Two product-specific needs are already established:

- **Text-bearing surfaces must be solid colour, never translucent over a gradient.**
  This is the direct cause of the worst measured failure.
- The audience reads English as a second language and often on a phone in bright
  daylight, so contrast and line length are usability requirements here, not
  compliance chores.
