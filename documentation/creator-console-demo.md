# Creator console: local demo mode

Click through every screen of `/creator` in a browser, with no backend and no sign-in. For reviewing the UX, not for testing the backend.

Local preview only. It lives on `preview/spaces-demo` and is never merged to main.

## Run it

```bash
cd hihodl-web/.worktrees/spaces-demo
rm -rf .next   # only if a dev server ran here before with other flags
NEXT_PUBLIC_CREATOR_DEMO=1 AD_SPACE_FIXTURE=1 npx next dev -p 3311
```

Then open http://localhost:3311/creator. You are signed in as the creator `@coinempress` at once.

- `NEXT_PUBLIC_CREATOR_DEMO=1` turns on the console demo: a fake session, the in-memory mock at `/api/creator-demo/*`, stubbed wallets and the DEMO badge.
- `AD_SPACE_FIXTURE=1` turns on the public (brand-side) fixture, so the links the console hands out open real pages.
- Both flags are ignored when `NODE_ENV=production`. With `NEXT_PUBLIC_CREATOR_DEMO` unset the console behaves exactly as before and `/api/creator-demo/*` answers 404.
- If port 3311 is taken, pick another one. If Google Fonts time out on your network, add `NODE_OPTIONS=--dns-result-order=ipv4first`.

The mock keeps everything in memory. Restarting the dev server, or pressing **Reset** on the badge, puts the seeded account back.

## What is fake, and what is not

| Part | In demo mode |
| --- | --- |
| Session | No Supabase. You are the role picked on the badge (stored in this browser's localStorage). **Sign out** shows the real sign-in screen; **Email me a code** signs you straight back in. |
| Backend | Every console call goes to `/api/creator-demo/<same path>`, a stateful mock on this dev server that answers with the real shapes and real error codes. |
| Wallets | **Connect Phantom/MetaMask** returns a demo address and **Sign** returns a signature the mock accepts. No extension needed. |
| Screens | All real. Nothing in the console was forked for the demo except the sign-in box being pre-filled. |

## The seeded account

The creator is `@coinempress` (the same creator as the public fixture). They have:

- X linked, verified, created in 2019 (well over 90 days), so they can publish.
- A proved Solana payout address, and **no** Base/Polygon address yet. Publishing a listing that accepts Base or Polygon is refused with `no_evm_address` until you prove one on `/creator` (the demo MetaMask does it in three clicks). This is the real rule, left in on purpose.
- **TOKEN2049 short videos**: live, a fixed-price ladder that also takes offers. One spot sold, with the sponsor's artwork waiting for approval. Part of a **series across 3 events**: TOKEN2049 (live), Devcon 8 (live), Breakpoint (draft).
- **I'm covering Breakpoint London**: live ladder with a **bidding rung** (the flagship interview), four spots sold, a leading bid from Orbit and an outbid one from Mesa.
- **Devcon 8 hallway interviews**: a draft, half built.
- **Road to Korea Blockchain Week**: a closed suitcase with six sales, some delivered, one artwork still waiting, one promise missed.
- **3 offers waiting** in the inbox (Acme and Nodeline offers, Orbit's bid), plus a declined one.
- **A team**: Dana (manager, active), Kai (rep, active) and Maria (rep, invitation not yet taken). Dana and Kai are on listings with shares; some of what they are owed is marked paid, the rest is still owed.
- Earnings owed and paid, and a work list for Kai and Dana.

The empty seed has none of that: no listings, no team, X not linked, no payout address.

## The DEMO badge

Bottom left of every `/creator` page. Click it to open the controls.

- **Viewing as**: Creator (`@coinempress`), Manager (Dana), Rep (Kai), Invitee (Sam, a fresh account holding a seat link). Switching reloads the page as that person. The screens differ by role: a manager and a rep see the team from the member's side (`Teams you are on`, `What you are owed`, `What you have to deliver`), a rep is refused a listing's money page.
- **Reset to mid-life / Reset to empty**: re-seeds the whole mock.
- **Make the next call fail**: pick a refusal and press **Arm it**. The next call that matches answers with that real error code, once, so you can see how the screen says it. Presets cover publish (`x_account_too_new`, `x_not_verified`, `no_evm_address`, `creator_cannot_receive_usdc`), saving a listing (`bid_tier_sells_one`, `closes_too_soon`), opening a listing (`not_found`), answering an offer (`offer_changed`, `offer_expired`), series (`series_too_large`), shares (`shares_over_a_hundred`), invitations (`team_too_large`, `invite_expired`, `already_on_this_team`), the payout signature (`payout_signature_invalid`), delivery (`position_not_sold`) and any-call failures (`rate_limited`, `UNAUTHORIZED`, `server`). The free box arms any code on the very next call. **Disarm** cancels it.
- **Go to**: shortcuts to every screen below, including the seeded listings (their ids are new on every reset).

The same controls work from the address bar, for links that land on a state:

| Query | Effect |
| --- | --- |
| `?demo=empty` / `?demo=seeded` | Reset the mock first. |
| `?demo-role=owner\|manager\|rep\|invitee` | View as that person. |
| `?demo-fail=<code>` | The next call answers `<code>` (422). |

For example: http://localhost:3311/creator?demo=empty

## Screens to visit

Console (creator):

- `/creator`: account home (listings, money, offers waiting, team entry, payout addresses, X, what is missing).
- `/creator/listings/new`: the wizard (template, name and dates, ladder, go live).
- `/creator/listings/<id>`: one listing (link, series, offers and bids, floors, what you owe, team on the listing, updates). Use the badge's **Go to** links for the seeded ones.
- `/creator/listings/<id>/edit`: a draft back in the wizard.
- `/creator/team`: members, invite, what you owe your team, mark as paid.
- `/creator/x?result=denied`: the X return page (also `expired`, `taken`, `busy`, `failed`, `unavailable`). **Connect X** on the empty account goes through the success path.

Console (team member): switch the badge to Manager or Rep, then:

- `/creator/team`: `Teams you are on` and `What you are owed`.
- `/creator/team/work`: what they have to deliver, with **It is up** on each slot and promise.

Invitation: switch to Invitee, then open

- http://localhost:3311/invite/coin-3f2a1?seat=demo-seat-singapore-crew-2026 (redirects to `/creator/team?seat=...` and offers the seat; **Accept** takes it). Once taken, the same link says it cannot be taken. A new invitation made on `/creator/team` as the creator gives a fresh working link.

Public (brand side, from the fixture):

- `/s/coinempress`: the creator hub.
- `/s/coinempress/breakpoint-london-coverage`: tiered ladder with a bidding rung.
- `/s/coinempress/token2049-videos`, `/s/coinempress/road-to-token2049`, `/s/coinempress/token2049-takeover`, `/s/coinempress/token2049-pitch-reviews`, `/s/coinempress/token2049-afterparty-host`.
- `/events/token2049-singapore-2026`, `/events/devcon-8-mumbai-2026`, `/events/token-2049-singapore` (redirects).
- `/o/<token>`: an offer thread, one per state: `/o/fixture_pendingxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_counteredxxxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_acceptedxxxxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_paidxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_declinedxxxxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_expiredxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_bid_leadingxxxxxxxxxxxxxxxxxxxxxxxx`, `/o/fixture_bid_outbidxxxxxxxxxxxxxxxxxxxxxxxxx`.
- `/b/<token>`: a session booking: `fixture_awaiting_contact`, `fixture_awaiting_schedule`, `fixture_scheduled`, `fixture_awaiting_confirmation`, `fixture_delivered`, `fixture_disputed`, `fixture_window_closed`, `fixture_no_handle`.

The public pages read the fixture, not the console's mock, so a listing you publish in the demo does not appear on them (its link opens a 404 unless its slug is one of the fixture's). Buying, offering and bidding on the public pages still call the real API and fail locally.

## Where the code is

- `src/lib/creator/demo.ts`: the gate (`creatorDemoEnabled()`), roles, the browser-side session.
- `src/lib/creator/demo-store.dev.ts`: the in-memory backend (seed, routes, rules subset).
- `src/app/api/creator-demo/[...path]/route.ts`: serves it; 404 when the gate is off.
- `src/components/creator/DemoBadge.tsx`: the badge.
- Demo branches, each one line behind the gate: `session.ts`, `api.ts` (base URL), `wallets.ts`, `app/creator/team/page.tsx` (seat preview), `app/creator/layout.tsx` (badge), `SignIn.tsx` (pre-filled email).

The mock mirrors the shapes and refusal codes of `documentation/ad-space-api-v0.md` and a subset of the rules. It is not the authority on what the backend enforces.
