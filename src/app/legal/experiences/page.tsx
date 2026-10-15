"use client";

/**
 * /legal/experiences: the terms for activities, tours, and museum and
 * attraction tickets found in HOLD, linked from the experience screen next to
 * Book.
 *
 * Today HOLD is a Tiqets affiliate: Book opens the activity on tiqets.com
 * through our partner link, Tiqets sells the ticket and takes the payment, and
 * HOLD may earn a commission (hihodl-wallet travel/experience/[code].tsx). The
 * in-app checkout section applies only when the app shows that checkout; it
 * describes Tiqets' Booking API model (30 minute reservation, lead traveller
 * name, email and phone, the Tiqets PDF voucher unchanged). Change the product,
 * change this page in the same PR.
 */

import React from "react";
import LegalDoc, { A, P, Ul } from "@/components/site/LegalDoc";

export default function ExperienceTermsPage() {
  return (
    <LegalDoc
      title="Experience Terms"
      reviewed="October 15, 2026"
      callout={
        <>
          <p>
            The activities, tours, and museum and attraction tickets in HOLD come from our partner Tiqets International
            B.V., Amsterdam (&quot;Tiqets&quot;). HIHODL TECHNOLOGIES OÜ, an Estonian company (registry code 17460059),
            shows them in the app.
          </p>
          <p>
            Today you book and pay on Tiqets&apos; own site. Tiqets sells you the ticket under its own terms, and the
            venue or operator provides the visit under its own rules. HOLD is not the seller of the ticket, not the
            operator of the activity, and not the merchant of record. Where something is decided by Tiqets or the venue
            rather than by us, this page says so.
          </p>
        </>
      }
      sections={[
        {
          title: "One experience, on its own",
          body: (
            <P>
              An experience is always sold on its own. We never sell it at one price with a flight, a stay, a data plan
              or anything else, and we do not sell it as part of a package or a linked travel arrangement. Booking other
              travel through HOLD does not combine with it, as set out in Section 2.2 of our{" "}
              <A href="/terms">Terms of Service</A>.
            </P>
          ),
        },
        {
          title: "Who sells you the ticket",
          body: (
            <>
              <P>
                HOLD shows you Tiqets&apos; catalogue. When you tap Book, the activity opens on Tiqets&apos; site, where
                you choose the date, time and tickets, give your details and pay Tiqets. From that point:
              </P>
              <Ul
                items={[
                  "Your contract for the ticket is with Tiqets and with the venue or operator that provides the visit, not with HOLD.",
                  "Tiqets' terms and the venue's own rules apply to the ticket, including its cancellation policy.",
                  "Tiqets takes your payment, issues your ticket and handles changes, cancellations and refunds for it.",
                  "HOLD may earn a commission from Tiqets on your purchase. It costs you nothing extra.",
                ]}
              />
            </>
          ),
        },
        {
          title: "Prices, availability and what the app shows",
          body: (
            <>
              <P>
                The prices, descriptions, inclusions, cancellation policies and opening information shown in the app
                come from Tiqets. Prices and availability can change at any time, and a date or time slot can sell out.
                The price on Tiqets at checkout is the one that applies, not the one you saw earlier in the app.
              </P>
              <P>
                Photos are credited to their owners. Ratings and reviews come from Tiqets and are shown as Tiqets
                provides them; we do not write, edit or select them. Some descriptions are translated automatically and
                are marked as such.
              </P>
            </>
          ),
        },
        {
          title: "Booking in the app, where the checkout shows it",
          body: (
            <>
              <P>
                This section applies only when the app shows a checkout for the experience, paid from your HOLD balance.
                Until then, Section 2 applies. In that checkout, HOLD acts as your agent between you and Tiqets and the
                venue or operator: Tiqets and the venue still provide the ticket and the visit, and the checkout is
                marked &quot;Powered by Tiqets&quot;.
              </P>
              <Ul
                items={[
                  "Before you pay, we show you the experience's important information (what to know before you buy), its cancellation policy, and Tiqets' terms.",
                  "You pay in USDC from your HOLD balance; the amount in USDC is fixed when you confirm.",
                  "Your order is a reservation held for 30 minutes. It is confirmed only when your payment succeeds; if it does not, nothing is booked.",
                  "We need the lead traveller's name, email and phone number, and we pass them to Tiqets and the venue to issue the ticket.",
                  "Your ticket is Tiqets' own PDF voucher, unchanged. You get it in the app and by email.",
                ]}
              />
              <P>
                We are your support before and after you book. Where a problem is with the ticket or the visit, we take
                it up with Tiqets for you.
              </P>
            </>
          ),
        },
        {
          title: "Cancellations and refunds",
          body: (
            <>
              <P>
                Every experience has its own cancellation policy, shown before you buy, and that policy is the one that
                applies to your ticket. Many tickets are non-refundable. Where a refund is due, it goes back to the way
                you paid:
              </P>
              <Ul
                items={[
                  "For a ticket bought on Tiqets' site, Tiqets handles the cancellation and refunds you under its terms.",
                  "For a ticket paid from your HOLD balance, the refund is paid in USDC to the wallet the booking was paid from, converted at the same rate used when you paid, as soon as Tiqets releases it to us.",
                ]}
              />
              <P>
                Where the law allows, tickets for a specific date or time are not covered by the 14 day withdrawal right
                for distance contracts in EU law. You can still cancel under the experience&apos;s cancellation policy.
              </P>
            </>
          ),
        },
        {
          title: "On the day",
          body: (
            <P>
              Bring your ticket as the venue asks for it, and arrive in time. The venue or operator runs the visit under
              its own rules and may refuse entry to anyone who does not follow them. We cannot guarantee that a venue
              will be open or that you will be admitted. If a venue closes or cancels, what you are owed follows the
              experience&apos;s cancellation policy and Tiqets&apos; terms, and we will help you take it up with Tiqets.
            </P>
          ),
        },
        {
          title: "Booking for other people",
          body: (
            <P>
              The person who books must be 18 or over and can book for others, including children, as set out in Section
              3.1 of our <A href="/terms">Terms of Service</A>. When you give us details of the people you book for, you
              confirm that you may share them with us, with Tiqets and with the venue. Venues may apply their own rules
              for children and age limits.
            </P>
          ),
        },
        {
          title: "HiPoints",
          body: (
            <P>
              An experience earns or uses HiPoints only where the checkout in the app shows it; see the{" "}
              <A href="/legal/hipoints">HiPoints Terms</A>. A ticket bought on Tiqets&apos; site earns none.
            </P>
          ),
        },
        {
          title: "Our responsibility",
          body: (
            <P>
              We are responsible for what we do: showing you the catalogue as Tiqets gives it to us and, where you book
              in the app, making the booking with the details you gave us, charging the price shown and paying refunds
              you are owed. We are not the venue or the operator and are not responsible for the activity itself, the
              venue opening, or entry, which are theirs. Nothing here limits your rights as a consumer.
            </P>
          ),
        },
        {
          title: "Your data",
          body: (
            <>
              <P>
                When you book on Tiqets&apos; site, you give your details to Tiqets there; we do not send Tiqets your
                name or contact details.
              </P>
              <P>
                When you book in the app, we pass the lead traveller&apos;s name, email and phone number, and the booking
                details, to Tiqets and the venue or operator, who use them as independent controllers to issue and honour
                the ticket. Our <A href="/privacy">Privacy Policy</A> covers the rest.
              </P>
            </>
          ),
        },
        {
          title: "Help and complaints",
          body: (
            <>
              <P>
                Contact us through Help in the app or at <A href="mailto:legal@hihodl.xyz">legal@hihodl.xyz</A>. For a
                problem with a ticket, we take it up with Tiqets for you. So we can act quickly, tell us:
              </P>
              <Ul
                items={[
                  "the booking reference",
                  "the date and time of the visit, and the venue",
                  "how many tickets",
                  "what went wrong",
                  "what you would like us to do about it",
                ]}
              />
              <P>
                How we handle complaints, including referral to the Estonian Consumer Disputes Committee
                (Tarbijavaidluste komisjon), is set out in Section 19 of the Terms of Service.
              </P>
            </>
          ),
        },
        {
          title: "Changes to these terms, law, and contact",
          body: (
            <P>
              The version of these terms that governs a booking is the one published when you made it. These terms sit
              alongside our <A href="/terms">Terms of Service</A>; where they say different things about an experience,
              this page wins. Estonian law governs, without prejudice to the consumer protections of the country you
              live in. Legal questions: <A href="mailto:legal@hihodl.xyz">legal@hihodl.xyz</A>.
            </P>
          ),
        },
      ]}
    />
  );
}
