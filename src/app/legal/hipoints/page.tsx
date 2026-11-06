"use client";

/**
 * /legal/hipoints — the HiPoints programme, linked from every checkout that
 * earns or spends points.
 *
 * The rules are the backend's (hihodl-backend): 1 point = USD 0.01 wherever it
 * is spent (rewards-economics.ts), 180 days per earned batch with soonest-
 * expiring spent first (hipoints.service.ts), stay points credited only once the
 * stay is completed and points spent on a cancelled stay given back with a new
 * window (booking-points.service.ts), no cash-out and no transfer. How many
 * points a stay earns is a share of our margin and changes, so this page
 * never states a rate: the checkout shows the number before you pay.
 *
 * What earns, as of 6 Nov 2026: stays, referrals (referral-terms) and HOLD
 * Spaces sponsors on what they pay. Flights, eSIMs and experiences can be paid
 * with points and earn none. There is no card and no cashback. Do not list a
 * product here as earning until the backend credits it.
 */

import React from "react";
import LegalDoc, { A, P, Ul } from "@/components/site/LegalDoc";

export default function HiPointsTermsPage() {
  return (
    <LegalDoc
      title="HiPoints Terms"
      reviewed="November 6, 2026"
      callout={
        <>
          <p>
            HiPoints are HOLD&apos;s rewards: points you earn on stays and by inviting friends, and spend as a discount
            at checkout. The programme is run by HIHODL TECHNOLOGIES OÜ, an Estonian company (registry code 17460059).
          </p>
          <p>
            HiPoints are not money, not a digital asset, and not held in your wallet. They cannot be cashed out, sold or
            transferred.
          </p>
        </>
      }
      sections={[
        {
          title: "Earning points",
          body: (
            <>
              <P>
                Stays booked in the app earn HiPoints. The checkout shows how many points a stay earns before you pay.
                The number depends on the stay, the price and your plan, and we may change how many points a stay earns
                at any time; the number shown when you confirmed is the one you get.
              </P>
              <P>
                Stay points are credited after check-out, not when you pay. Until then they are shown as pending. If the
                stay is cancelled or refunded before check-out, its points are not credited.
              </P>
              <P>
                Flights, eSIMs and experiences do not earn HiPoints. You can pay for them with points where the checkout
                offers it.
              </P>
              <P>
                You also earn points by inviting friends. When a friend joins with your invite link and, within 90 days,
                completes a stay of $100 or more or keeps $100 in Savings for 30 days, you get 2,500 points and your
                friend gets 1,000, for up to 10 friends, as the <A href="/legal/referral-terms">Referral Terms</A> set
                out. HOLD Spaces sponsors, who are HOLD partners, earn points on what they pay for a Space, as their
                agreement with us says. Earning may not be available on every account or in every country while the
                programme is rolling out.
              </P>
            </>
          ),
        },
        {
          title: "What points are worth and where you spend them",
          body: (
            <>
              <P>
                One HiPoint is worth USD 0.01 as a discount, converted into the currency of the purchase at the rate shown
                when you spend it. You can spend points where the app offers them: at checkout on stays, flights, eSIMs
                and experiences, and on some fees. Where a purchase accepts points, the checkout shows how many you can use
                and what they take off; points cover our part of the price only, never the supplier&apos;s.
              </P>
              <P>
                A flight does not earn HiPoints. It accepts them as a discount where the flight checkout shows it. Points
                used on a flight you cancel yourself are not returned; the{" "}
                <A href="/legal/flights">Flight Terms</A> explain when they are.
              </P>
            </>
          ),
        },
        {
          title: "Expiry",
          body: (
            <>
              <P>
                Each batch of points expires 180 days after it is credited. When you spend points, the ones that expire
                soonest are used first. We remind you before points expire.
              </P>
              <P>
                If you spend points on a booking that is then cancelled, fails or is not completed, the points come back
                to you with a new 180-day period.
              </P>
              <P>
                If a purchase is refunded after its points were credited, we take those points back. If some of them have
                already been spent or have expired, we take back only what is left of them.
              </P>
            </>
          ),
        },
        {
          title: "What you cannot do with points",
          body: (
            <Ul
              items={[
                "Exchange them for cash, stablecoins or any other asset.",
                "Transfer, sell, gift or combine them with another account.",
                "Earn them through fake accounts, self-referrals, bookings made only to be cancelled, or any other abuse of the programme.",
              ]}
            />
          ),
        },
        {
          title: "Corrections and abuse",
          body: (
            <P>
              We may correct a balance credited by mistake, and remove points earned through fraud or abuse of the
              programme, telling you why. Where an account is closed for breach of our Terms of Service, its points end
              with it.
            </P>
          ),
        },
        {
          title: "Changing or ending the programme",
          body: (
            <P>
              We may change these terms or end the programme. If we end it, or reduce what points are worth, we will give
              you at least 30 days&apos; notice in the app, during which you can still spend the points you have.
            </P>
          ),
        },
        {
          title: "Law and contact",
          body: (
            <P>
              These terms sit alongside our <A href="/terms">Terms of Service</A>. Estonian law governs, without prejudice
              to the consumer protections of the country you live in. Questions:{" "}
              <A href="mailto:legal@hihodl.xyz">legal@hihodl.xyz</A>.
            </P>
          ),
        },
      ]}
    />
  );
}
