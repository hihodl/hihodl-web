"use client";

/**
 * /legal/flights — the terms for a flight booked in HOLD, linked from the
 * flight checkout ("By paying you accept the Flight Terms").
 *
 * Every number here is the backend's (hihodl-backend, server/services/travel):
 * the 8 EUR service fee per booking and per change (flight-pricing.ts), the
 * extras markup (EUR 4 a bag, EUR 3 a seat, nothing on cancellation cover),
 * HiPoints on flights (flight-points.service.ts), refunds in USDC to the paying wallet at the rate paid
 * (flight-refund.service.ts), up to 4 travellers and no more lap infants than
 * adults (flights.router.ts). Change one there, change it here.
 */

import React from "react";
import LegalDoc, { A, P, Ul } from "@/components/site/LegalDoc";

export default function FlightTermsPage() {
  return (
    <LegalDoc
      title="Flight Terms"
      reviewed="October 18, 2026"
      callout={
        <>
          <p>
            You book your flight through HIHODL TECHNOLOGIES OÜ, an Estonian company (registry code 17460059), acting as
            your booking agent. The airline is the carrier: your contract of carriage is with the airline, under its own
            conditions of carriage and the fare rules of the ticket you chose.
          </p>
          <p>
            We take your payment, issue the booking with the airline through our flight-booking partner Duffel, and
            handle changes, cancellations and refunds with you. Where something is decided by the airline rather than by
            us, this page says so.
          </p>
        </>
      }
      sections={[
        {
          title: "One flight booking, on its own",
          body: (
            <>
              <P>
                A flight booked in HOLD is a single travel service. We do not sell it as part of a package or a linked
                travel arrangement, and booking a stay, a data plan or anything else through HOLD does not combine with
                it. Optional extras sold with the flight (seats, bags, cancellation cover) belong to this booking only.
              </P>
            </>
          ),
        },
        {
          title: "Price and what you pay us",
          body: (
            <>
              <P>
                The price shown before you pay is the total for everyone on the booking, in the currency shown, and it
                includes our service fee of EUR 8 per booking. You pay it in USDC from your HOLD balance; the amount in
                USDC is fixed when you confirm.
              </P>
              <Ul
                items={[
                  "Bags you add are charged at the airline's price plus EUR 4 each, and paid seats at the airline's price plus EUR 3 each, included in the price shown for them. Free seats and bags cost nothing extra.",
                  "Cancellation cover, where offered, is charged at its provider's price with nothing added, and is sold on that provider's own terms, linked where you choose it.",
                  "The service fee is for the work of booking and is not refunded if the flight is later cancelled or refunded, except where the cancellation is our fault.",
                ]}
              />
              <P>
                Airline prices change quickly. If the airline&apos;s price changes before the booking is issued, we
                show you the new price and do not charge it unless you confirm it. If the airline refuses the booking
                after you paid, the full amount comes back to you.
              </P>
            </>
          ),
        },
        {
          title: "Travellers, names and children",
          body: (
            <>
              <P>
                A booking can include up to 4 travellers. Each name must be entered exactly as it appears in the passport
                or identity document that person will travel with. Airlines can refuse boarding for a name that does not
                match, and corrections, where an airline allows them at all, are at its discretion and may cost a fee.
              </P>
              <P>
                The person who books must be 18 or over and books on behalf of every traveller, as set out in Section 3.1
                of our <A href="/terms">Terms of Service</A>. Travellers aged 18 or over on the day of travel are adults,
                travellers under 2 are infants on an adult&apos;s lap, and those in between are children. A booking
                cannot have more infants than adults. HOLD does not book unaccompanied minors; children travel under the
                airline&apos;s own rules for minors.
              </P>
            </>
          ),
        },
        {
          title: "Documents, visas and check-in",
          body: (
            <>
              <P>
                You are responsible for every traveller holding a valid passport or identity document, any visa, transit
                visa or travel authorisation, and any health document required by the countries of departure, transit and
                arrival. A traveller refused boarding or entry for missing documents is not entitled to a refund from us.
                Any information HOLD shows about entry rules is general guidance, not a guarantee.
              </P>
              <P>
                Check-in, boarding times, baggage allowances and seating on the day are the airline&apos;s. Check in
                with the airline using the booking reference we give you, and be at the airport in time.
              </P>
            </>
          ),
        },
        {
          title: "Changes",
          body: (
            <>
              <P>
                Whether a ticket can be changed, and what it costs, is set by the fare rules shown before you pay. Where
                a change is allowed, you pay any fare difference and penalty the airline charges, plus our change fee of
                EUR 8. We show the full cost before you confirm a change.
              </P>
            </>
          ),
        },
        {
          title: "Cancellations and refunds",
          body: (
            <>
              <P>
                Whether a ticket is refundable, and how much, is set by its fare rules. When you cancel, you receive what
                the airline refunds for the ticket and extras, without our service fee. Refunds are paid in USDC to the
                wallet the booking was paid from, converted at the same rate used when you paid, as soon as the airline
                releases them to us.
              </P>
              <P>
                The withdrawal right for distance contracts in EU law does not apply to passenger transport booked for a
                specific date. You can still cancel under the fare rules.
              </P>
            </>
          ),
        },
        {
          title: "When the airline changes or cancels your flight",
          body: (
            <>
              <P>
                Airlines move and cancel flights. When the airline tells us about a change, we tell you and show what
                you can do, which may include accepting the new time, choosing another flight, or cancelling for a
                refund, as the airline offers.
              </P>
              <P>
                Your rights to assistance, rerouting and compensation for delays, cancellations and denied boarding, for
                example under Regulation (EC) No 261/2004 or similar rules in other countries, are rights against the
                operating airline. We will help you with the information you need to claim them.
              </P>
            </>
          ),
        },
        {
          title: "Loyalty programmes",
          body: (
            <>
              <P>
                We do not add frequent flyer numbers to bookings made in HOLD, so we cannot promise that an airline
                will credit miles for them. Where the checkout shows it, a flight earns HiPoints instead, credited once
                the flight has departed; a booking cancelled before departure earns none.
              </P>
              <P>
                Where the checkout offers it, you can use HiPoints as a discount on our part of the price. If the
                booking is not issued or the airline cancels the flight, the points come back to you. If you cancel the
                booking yourself, points used on it are not returned, like our service fee. See the{" "}
                <A href="/legal/hipoints">HiPoints Terms</A>.
              </P>
            </>
          ),
        },
        {
          title: "Our responsibility",
          body: (
            <>
              <P>
                We are responsible for making the booking you asked for, with the details you gave us, and for passing
                on refunds we receive. We are not the airline and are not responsible for the performance of the flight,
                including delays, cancellations, lost or damaged baggage, or service on board; those are the
                airline&apos;s, under its conditions of carriage and international conventions such as the Montreal
                Convention. Nothing here limits your rights as a consumer.
              </P>
            </>
          ),
        },
        {
          title: "Your data",
          body: (
            <>
              <P>
                To book a flight we pass each traveller&apos;s name, date of birth, gender, contact details and, where
                the airline requires it, document details to Duffel and the airline. Airlines may pass passenger data to
                border authorities as the law requires. Our <A href="/privacy">Privacy Policy</A> covers the rest.
              </P>
            </>
          ),
        },
        {
          title: "Changes to these terms, law, and contact",
          body: (
            <>
              <P>
                The version of these terms that governs a booking is the one published when you confirmed it. These terms
                sit alongside our <A href="/terms">Terms of Service</A>; where they say different things about a flight,
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
