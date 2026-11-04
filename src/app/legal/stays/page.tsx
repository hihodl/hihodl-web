"use client";

/**
 * /legal/stays — the terms for a stay booked in HOLD, linked from the stay
 * checkout ("By paying you accept the Stay Terms").
 *
 * The facts are the backend's (hihodl-backend): liteAPI (Nuitée) books the room
 * under its own terms and HOLD is not the seller of the room (travel.router.ts),
 * cancellation follows each rate's own policy (booking-cancel.service.ts),
 * refunds are what was paid minus the supplier's penalty, in USDC to the paying
 * wallet (refund.service.ts), and tourist taxes may be due at the property
 * (city-tax.ts). Change one there, change it here.
 */

import React from "react";
import LegalDoc, { A, P, Ul } from "@/components/site/LegalDoc";

export default function StayTermsPage() {
  return (
    <LegalDoc
      title="Stay Terms"
      reviewed="October 15, 2026"
      callout={
        <>
          <p>
            You book your stay through HIHODL TECHNOLOGIES OÜ, an Estonian company (registry code 17460059). We take your
            payment and reserve the room with our accommodation partner liteAPI (Nuitée), which books it with the
            property under its own terms.
          </p>
          <p>
            The property provides the stay: the room, the service, and the house rules are the property&apos;s. We
            handle the booking, cancellations and refunds with you. Where something is decided by the property or the
            supplier rather than by us, this page says so.
          </p>
        </>
      }
      sections={[
        {
          title: "One stay booking, on its own",
          body: (
            <P>
              A stay booked in HOLD is a single travel service. We do not sell it as part of a package or a linked travel
              arrangement, and booking a flight, a data plan or anything else through HOLD does not combine with it.
            </P>
          ),
        },
        {
          title: "Price and payment",
          body: (
            <>
              <P>
                The price shown before you pay is the total for the room, dates and guests you chose, in the currency
                shown, and it includes our margin. You pay it in USDC from your HOLD balance; the amount in USDC is fixed
                when you confirm. Where you use HiPoints, the discount is shown before you pay and is governed by the{" "}
                <A href="/legal/hipoints">HiPoints Terms</A>.
              </P>
              <P>
                Some destinations charge tourist or city taxes that the property collects from you on arrival. Where
                the supplier tells us about them, we show them before you pay as payable at the property; they are not
                part of the price you pay us.
              </P>
            </>
          ),
        },
        {
          title: "The rate you choose and its cancellation policy",
          body: (
            <>
              <P>
                Every rate has its own cancellation policy, shown before you pay and on your booking: free cancellation
                until a stated date and time, a penalty after it, or non-refundable. That policy is the one that applies
                to your booking.
              </P>
              <Ul
                items={[
                  "If you cancel while cancellation is free, you get back everything you paid.",
                  "If you cancel after that, you get back what you paid minus the penalty the property or supplier charges.",
                  "A non-refundable rate is not refunded if you cancel or do not arrive.",
                ]}
              />
              <P>
                The withdrawal right for distance contracts in EU law does not apply to accommodation booked for
                specific dates. You can still cancel under the rate&apos;s policy.
              </P>
            </>
          ),
        },
        {
          title: "Refunds",
          body: (
            <P>
              Refunds are paid in USDC to the wallet the booking was paid from, never as a credit. If the booking fails
              after you paid, or the property cannot honour it, you get back everything you paid.
            </P>
          ),
        },
        {
          title: "Guests and check-in",
          body: (
            <>
              <P>
                The lead guest&apos;s name must match the identity document shown at check-in. The person who books must
                be 18 or over and can book for others, including children, as set out in Section 3.1 of our{" "}
                <A href="/terms">Terms of Service</A>. Properties may set a minimum check-in age, ask for a deposit or a
                card on arrival for incidentals, and apply their own house rules; these are the property&apos;s, and you
                agree to follow them.
              </P>
              <P>
                Check-in and check-out times, the facilities and the room itself are as the property describes them. If
                you will arrive late, tell the property.
              </P>
            </>
          ),
        },
        {
          title: "If something is wrong when you arrive",
          body: (
            <P>
              Tell the property first, at once, so it can put it right. If it cannot, contact us with your booking
              reference while you are there; we will take it up with the supplier and, where the stay was not provided
              as booked, get you the refund that follows from that.
            </P>
          ),
        },
        {
          title: "Our responsibility",
          body: (
            <P>
              We are responsible for making the booking you asked for, with the details you gave us, and for paying
              refunds you are owed. We do not own or run the property and are not responsible for its condition,
              service, or the acts of its staff, which are the property&apos;s. Nothing here limits your rights as a
              consumer.
            </P>
          ),
        },
        {
          title: "Your data",
          body: (
            <P>
              To book a stay we pass the guests&apos; names, the dates and the contact details needed to hold the booking
              to liteAPI (Nuitée) and the property. Our <A href="/privacy">Privacy Policy</A> covers the rest.
            </P>
          ),
        },
        {
          title: "Changes to these terms, law, and contact",
          body: (
            <>
              <P>
                The version of these terms that governs a booking is the one published when you confirmed it. These terms
                sit alongside our <A href="/terms">Terms of Service</A>; where they say different things about a stay,
                this page wins. Estonian law governs, without prejudice to the consumer protections of the country you
                live in.
              </P>
              <P>
                Questions or complaints: <A href="mailto:legal@hihodl.xyz">legal@hihodl.xyz</A>, with your booking
                reference. How we handle complaints is set out in Section 19 of the Terms of Service.
              </P>
            </>
          ),
        },
      ]}
    />
  );
}
