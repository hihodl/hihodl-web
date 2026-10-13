import type { Metadata } from "next";

import { BENEFITS_GROUND } from "@/components/ad-space/ground";
import { QrCode } from "@/components/ad-space/qr";
import { Footer } from "@/components/site/Footer";
import { TopNav } from "@/components/site/TopNav";
import { Block, BlockHead, Closing, PrimaryAction, Rules, SecondaryAction, Timeline } from "@/components/spaces-site/parts";
import { productHref } from "@/lib/app/paths";

/**
 * hihodl.xyz/partners: HOLD Partners, for the people who bring travellers.
 *
 * A partner earns a share of HOLD's MARGIN on what the travellers it brought
 * book, never a markup on their price. The share is set per partner when we
 * approve them, so this page names no percentage. The panel itself lives in
 * the product (app.hihodl.xyz/partners), where applying needs a HOLD account:
 * that account's Savings is where a partner is paid.
 */

export const metadata: Metadata = {
  title: "HOLD Partners",
  description:
    "For travel agencies, group trip organisers, travel creators and event organisers. Bring your travellers to HOLD and earn a share of our margin on every stay, flight and eSIM they book, paid monthly in USDC.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  const apply = productHref("/partners");

  return (
    <>
      <TopNav />

      <main>
        <section className="relative overflow-hidden" style={{ background: BENEFITS_GROUND }}>
          <div className="container-page relative pt-14 pb-20 md:pt-20 md:pb-28">
            <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
              <div className="max-w-2xl">
                <p className="text-small font-medium uppercase tracking-[0.14em] text-[#C9D4E0]">HOLD Partners</p>
                <h1 className="mt-5 font-display text-[44px] font-light leading-[1.05] tracking-[-0.03em] text-text text-balance md:text-h1">
                  You bring the travellers.
                  <br />
                  <span className="text-[#B9C7D6]">You earn on every booking.</span>
                </h1>
                <p className="mt-8 max-w-xl text-lead text-[#C9D4E0]">
                  Share your own HOLD link. Every stay, flight and eSIM your travellers book earns you a share of our
                  margin, paid every month in USDC into your HOLD account.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <PrimaryAction href={apply}>Become a partner</PrimaryAction>
                  <SecondaryAction href="#how-it-works">How it works</SecondaryAction>
                </div>
              </div>
              <div className="min-w-0">
                <LinkFigure />
              </div>
            </div>
          </div>
        </section>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="Who it is for"
            intro="Anyone whose people travel because of them. If you already send groups somewhere, HOLD pays you for the bookings that follow."
          />
          <Rules
            items={[
              { title: "Travel agencies", body: "Send clients your link before they fly. Their rooms, flights and data abroad earn for you, trip after trip." },
              { title: "Group trip organisers", body: "Retreats, tours, school and club trips. One chat for the group, one link for the deposit, and a share of what they book." },
              { title: "Travel creators", body: "Put your link in your bio and under every video. Your audience books at our prices and you earn on each booking." },
              { title: "Event organisers", body: "Festivals, conferences and races. Your attendees need a bed, a flight and data. Point them to HOLD and earn on it." },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber" id="how-it-works">
          <BlockHead title="How it works" intro="Three steps, and the first one takes two minutes." />
          <Timeline
            steps={[
              {
                title: "Apply with your HOLD account",
                body: "Pick the name of your link, tell us what you do, and we review it by hand. Your link name is kept for you from the moment you apply.",
              },
              {
                title: "Share your link and QR",
                body: "Your link opens HOLD for anyone who has it and sends everyone else to download it. Print the QR on flyers, put it on your site, send it in your group chats.",
              },
              {
                title: "Get paid every month",
                body: "Your panel shows signups, bookings and every commission as it moves from pending to payable to paid. Payouts land in your HOLD Savings in USDC.",
              },
            ]}
          />
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="What you earn"
            intro="A share of our margin on every booking your travellers make, for months after they join through you."
          />
          <Rules
            items={[
              {
                title: "Stays, flights and eSIMs",
                body: "Every booking counts, not only the first one. Your share is set when we approve you and shown in your panel.",
              },
              {
                title: "Paid monthly in USDC",
                body: "Earned commissions go out at the start of each month, straight into your HOLD Savings, where they keep earning.",
              },
              {
                title: "Your travellers never pay more",
                body: "They get HOLD's own prices plus HiPoints on what they book. There is never a markup for coming through you.",
              },
              {
                title: "Every number in one place",
                body: "Signups, travellers who booked, each commission with its status, and every payout with its transaction on Basescan.",
              },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead
            title="Run the trip from HOLD"
            intro="Partners get the tools to move a group, not only a link."
          />
          <Rules
            items={[
              {
                title: "A group chat per trip",
                body: "Make a trip, share its join link, and everyone lands in the same chat. New travellers sign up on the way in and count for you.",
              },
              {
                title: "Deposit links",
                body: "Set a deposit per traveller and get one pay link for the whole group. Payments land in your HOLD account.",
              },
              {
                title: "Rename without reprinting",
                body: "Change your link name whenever you like. Your old links keep working, so what you already shared still counts.",
              },
              {
                title: "Split costs inside the chat",
                body: "Shared dinners, transfers and tickets are split in the same group, and everyone settles up in dollars.",
              },
            ]}
          />
        </Block>
      </main>

      <Closing
        line="Your travellers already book somewhere. Let it pay you."
        body="Apply with your HOLD account. Once you are approved, your link, your trips and your payouts live in one panel."
        actions={
          <>
            <PrimaryAction href={apply}>Become a partner</PrimaryAction>
            <SecondaryAction href="/travel">See HOLD travel</SecondaryAction>
          </>
        }
      />

      <Footer />
    </>
  );
}

/** The partner's link as a card: what a traveller scans, and what it earns. */
function LinkFigure() {
  const link = "https://hihodl.xyz/invite/yourname";
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-[28px] border border-white/15 bg-white/[0.07] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-tiny font-medium uppercase tracking-[0.12em] text-[#C9D4E0]">Your link</p>
      <p className="mt-2 text-[20px] font-medium text-text">hihodl.xyz/invite/yourname</p>
      <div className="mt-6 flex items-center gap-5">
        <div className="w-[132px] shrink-0 overflow-hidden rounded-[16px] bg-white p-1.5">
          <QrCode text={link} title="Example partner QR code" className="block h-auto w-full" />
        </div>
        <ul className="flex min-w-0 flex-col gap-2.5">
          {["Stays", "Flights", "eSIMs"].map((k) => (
            <li key={k} className="flex items-center gap-2.5 text-small text-text">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber" aria-hidden />
              {k} they book
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 border-t border-white/10 pt-4 text-small text-[#C9D4E0]">Paid monthly in USDC to your HOLD Savings.</p>
    </div>
  );
}
