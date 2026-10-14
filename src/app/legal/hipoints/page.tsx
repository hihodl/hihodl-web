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
 * points a booking earns is a share of our margin and changes, so this page
 * never states a rate: the checkout shows the number before you pay.
 */

import React from "react";
import LegalDoc, { A, P, Ul } from "@/components/site/LegalDoc";

export default function HiPointsTermsPage() {
  return (
    <LegalDoc
      title="HiPoints Terms"
      reviewed="October 15, 2026"
      callout={
        <>
          <p>
            HiPoints are HOLD&apos;s rewards: points you earn on some purchases in the app and spend as a discount on
            others. The programme is run by HIHODL TECHNOLOGIES OÜ, an Estonian company (registry code 17460059).
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
                Purchases that earn HiPoints show how many points they earn before you pay. The number depends on the
                product, the price and your plan, and we may change how many points a product earns at any time; the
                number shown when you confirmed is the one you get.
              </P>
              <P>
                Points are credited when the purchase is used, not when it is paid: a stay after check-out, an
                experience after it takes place, a data plan when it is activated. Until then they are shown as pending.
                If the purchase is cancelled or refunded before that, its points are not credited.
              </P>
              <P>
                Bonuses, such as for inviting a friend under the referral programme, are credited as their own terms
                say. Earning may not be available on every account or in every country while the programme is rolling
                out.
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
                when you spend it. You can spend points where the app offers them, for example on our fee for a stay or
                on fees for some wallet services. Where a purchase accepts points, the checkout shows how many you can use
                and what they take off; points cover our part of the price only, never the supplier&apos;s.
              </P>
              <P>
                A flight earns either airline miles or HiPoints, never both, and earns or accepts HiPoints only where the
                flight checkout shows it.
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
