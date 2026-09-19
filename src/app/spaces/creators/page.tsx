import type { Metadata } from "next";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import {
  Block,
  BlockHead,
  Closing,
  Door,
  FACE_ZONES,
  PrimaryAction,
  Rules,
  SecondaryAction,
  SpacesHero,
  SuitcaseFigure,
  Timeline,
} from "@/components/spaces-site/parts";
import { productOrigin } from "@/lib/app/paths";
import { HOLD_KEEPS, bps } from "@/lib/rates.config";

/**
 * /spaces/creators: everything a creator can do in Spaces, and the rules they
 * sell under.
 *
 * Every limit on this page is the product's own (src/lib/creator/listing.ts
 * LIMITS, src/lib/creator/types.ts MIN_X_ACCOUNT_AGE_DAYS, the backend's
 * AD_SPACE rules). If one of those changes, this page changes with it.
 *
 * Not on this page because it is not on main yet: the photo of the creator's
 * own product with spots dragged onto it (feat/spaces-photo-with-squares), and
 * the Creative Director switch kept on the server rather than in the browser.
 */

const FEE = bps(HOLD_KEEPS.spaces.feeBps);
const REFERRAL = bps((HOLD_KEEPS.spaces.feeBps * HOLD_KEEPS.spaces.referralShareOfFeeBps) / 10_000);

/** The console, on its own origin in production and under /app anywhere else. */
function sellHref(): string {
  const origin = productOrigin();
  return origin ? `${origin}/spaces` : "/app/spaces";
}

export const metadata: Metadata = {
  title: "Spaces for creators",
  description:
    "Sell spots on what you carry to an event, the posts you make about it and your time in the room. Fixed price, offers or bids, paid in USDC straight to your wallet.",
  alternates: { canonical: "/spaces/creators" },
};

export default function SpacesCreatorsPage() {
  const sell = sellHref();

  return (
    <>
      <TopNav />

      <main>
        <SpacesHero
          current="creators"
          title="You are going anyway."
          titleMuted="Let a brand come with you."
          lead={
            <>
              List the spots on your suitcase, the posts you will make and the hour you can give
              on site. Share one link. Brands pay you in USDC, straight to your wallet, and your
              page shows every sale you delivered.
            </>
          }
          actions={
            <>
              <PrimaryAction href={sell}>Start selling on the web</PrimaryAction>
              <SecondaryAction href="#who-can-sell">Who can sell</SecondaryAction>
            </>
          }
          figure={
            <SuitcaseFigure
              face={[
                { ...FACE_ZONES.headline, state: "sold" },
                { ...FACE_ZONES.upperLeft, state: "sold" },
                { ...FACE_ZONES.upperRight, state: "open", price: "$200" },
                { ...FACE_ZONES.lowerLeft, state: "held" },
                { ...FACE_ZONES.lowerRight, state: "open", price: "$175" },
              ]}
              callout={{ title: "Headline spot, 40 × 15 cm", detail: "Sold. Paid to your wallet on confirmation." }}
              caption="You set a price on each spot. The catalog already knows their sizes."
            />
          }
        />

        <Block tone="abyss" hairline="moonlight" id="who-can-sell">
          <BlockHead
            title="Who can sell, and what you need"
            intro="Three things, all checked before your first listing goes live. The console shows which ones you still have to do."
          />
          <Rules
            items={[
              {
                title: "An X account verified by X, 90 days or older",
                body: "Blue, business or government. Brands see the facts about it (followers, the account's age, the check) rather than a score from us. One X account belongs to one HOLD account.",
              },
              {
                title: "A wallet to be paid in",
                body: "If you have HOLD, you are paid there. If not, sign a message from your own Solana or EVM wallet to prove it is yours. On Solana that wallet needs a USDC account already.",
              },
              {
                title: "No app needed",
                body: "Sign in on the web with a code sent to your email. The whole listing can be built and published from a browser.",
              },
              {
                title: "No fee to list",
                body: `Listing is free. We take ${FEE} on what sells, and you choose who pays it.`,
              },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead
            title="What you can list"
            intro="Pick one kind per listing. Tie it to an event, or leave it open all year."
          />
          <Rules
            columns={1}
            items={[
              {
                title: "Spots on what you carry",
                body: "Nine products in the catalog, each with its spots drawn to real size: suitcase, laptop, phone case, bike frame, race kit and helmet, temporary tattoos, long dress, blazer, and jacket or tote bag. Each spot takes a logo, a QR code, text or a photo. Missing a product? Ask for it; you cannot draw your own zones yet.",
              },
              {
                title: "Content on your feed",
                body: "A short video, a sponsored post, an event wrap, an interview, a product demo, a collab, or a format you name and describe yourself. You promise what, where and by when. You always disclose that it is sponsored.",
              },
              {
                title: "Your time in the room",
                body: "Host a side event, moderate a panel, time at a booth, pitch reviews, office hours, a guide to the event. Always at an event, always in a public place, from $50 a slot. The buyer confirms it happened.",
              },
              {
                title: "Events, and the same listing at several",
                body: "Choose the event, or create it if nobody has yet (we catch duplicates as you type). Going to more than one? Copy a listing to up to 10 events; each copy sells its own spots.",
              },
            ]}
          />
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="How you price it"
            intro="Choose per listing. Nothing is binding until a brand pays, and nobody's money is locked while you decide."
          />
          <Rules
            items={[
              {
                title: "Fixed price",
                body: "First to pay wins the spot. From $5 to $25,000 a spot. You can also let brands make an offer on it.",
              },
              {
                title: "Offers",
                body: "No price shown. You accept, counter (up to three times) or decline, and each side has 48 hours to answer. Set a hidden minimum and anything under it gets your counter automatically.",
              },
              {
                title: "Bids",
                body: "For spots on what you carry. An opening bid, a hidden reserve and a countdown. A bid in the last minutes adds 10, up to six times. If you do nothing, the highest backed bid wins.",
              },
              {
                title: "A ladder of tiers",
                body: "Up to six rungs, each with its own price and up to five lines of what it includes. Each rung can sell its own way.",
              },
              {
                title: "Takeover",
                body: "A sold spot can be taken by paying double. The brand it displaces is repaid in full inside the same transaction. On Solana only.",
              },
              {
                title: "Who pays the fee",
                body: `On top, paid by the brand, so you receive your full price (the default). Or out of the price, so the brand pays exactly the number on the page. ${FEE} either way.`,
              },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead title="After the sale" intro="What you do, and what your page shows for it." />
          <Timeline
            steps={[
              {
                title: "Paid, straight to you",
                body: "USDC arrives in your wallet on the network the brand paid from: Solana, Base or Polygon. We never hold it, so there is nothing to withdraw.",
              },
              {
                title: "Approve the artwork",
                body: "The brand sends a logo, a QR link, text or a photo. It goes public only when you approve it. Rejecting it needs a reason, and they send another.",
              },
              {
                title: "Print, wear, post",
                body: "Printing and artwork are yours to arrange. A QR spot gets our short link, so a wrong destination is fixed by editing it, never by reprinting. You see how many times it was scanned.",
              },
              {
                title: "Mark it delivered",
                body: "Each spot and each promised post gets a public link as proof. Photo updates show on the listing as you go. Seven days past its date, a missing deliverable counts as missed.",
              },
              {
                title: "Your record grows",
                body: "Delivered and missed, on your page, for the next brand to read before they pay. It is the one thing on Spaces nobody can buy.",
              },
            ]}
          />
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="If the event does not happen"
            intro="You pick one when you publish. The brand reads it before paying, and it is the only remedy there is: HOLD cannot refund a payment it never held."
          />
          <Rules
            items={[
              { title: "Content anyway", body: "The default. You still deliver what does not depend on the venue. Every listing must include at least one such deliverable." },
              { title: "Next event", body: "The whole deal moves to your next event, within 90 days." },
              { title: "Refund", body: "You return the price from your own wallet." },
              { title: "Declarations", body: "Before publishing you confirm what the venue asks, such as having checked the event's rules on branding. We do not check them for you." },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead
            title="Run it as a team"
            intro="Turn on Creative Director in your account and bring people in to sell and deliver with you."
          />
          <Rules
            items={[
              { title: "Up to 25 people", body: "Invite them by email or by link." },
              { title: "Two roles", body: "A manager sells for you. A rep delivers and never sees the money." },
              { title: "A split per listing", body: "Each person's share is a percent of what you receive on that listing. You mark it paid when you have paid them; HOLD never moves team money." },
              {
                title: "Invite other creators",
                body: `Your listing pages carry your own invite link. When a creator you brought sells, ${REFERRAL} of each sale, paid out of our ${FEE}, is yours for ${HOLD_KEEPS.spaces.referralMonths} months. It never comes out of their price.`,
              },
            ]}
          />
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead title="What cannot be sold here" />
          <p className="mt-8 max-w-3xl text-body leading-relaxed text-text-muted">
            Introductions to investors, investment advice, equity or a share of income, paid
            &ldquo;alpha&rdquo;, token presales or wallet-connect airdrops, gambling, adult
            content, weapons, drugs or vapes, and political campaigns. Sessions are never in a
            private place.
          </p>
          <div className="mt-16 max-w-xl">
            <Door
              href="/spaces/brands"
              title="See it from the brand's side"
              body="What a brand reads on your page before paying, and how they pay you from any wallet."
              cta="For brands"
            />
          </div>
        </Block>
      </main>

      <Closing
        line="One link for everything you sell, and a record that follows you."
        body="Sign in with your email, connect your X account and a wallet, and publish your first listing from the browser."
        actions={
          <>
            <PrimaryAction href={sell}>Start selling on the web</PrimaryAction>
            <SecondaryAction href="/spaces">How Spaces works</SecondaryAction>
          </>
        }
      />

      <Footer />
    </>
  );
}
