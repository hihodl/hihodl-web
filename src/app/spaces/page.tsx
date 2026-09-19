import type { Metadata } from "next";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import {
  Block,
  BlockHead,
  Closing,
  Door,
  FACE_ZONES,
  Offers,
  PrimaryAction,
  Rules,
  SIDE_ZONES,
  SecondaryAction,
  SpacesPhotoHero,
  SuitcaseFigure,
  Timeline,
} from "@/components/spaces-site/parts";
import { productHref } from "@/lib/app/paths";
import { HOLD_KEEPS, bps } from "@/lib/rates.config";

/**
 * /spaces: what Spaces is, for both sides of the sale.
 *
 * One page for the market as a whole, two more for each side of it
 * (/spaces/creators, /spaces/brands). This one explains the three things on
 * sale, how one sale goes from listing to proof, and where the money goes, and
 * then sends each reader through their own door.
 *
 * The rules for what these pages may and may not say are in the header of
 * src/components/spaces-site/parts.tsx. The fee is read from HOLD_KEEPS.spaces,
 * which records where it was measured.
 */

const FEE = bps(HOLD_KEEPS.spaces.feeBps);

export const metadata: Metadata = {
  title: "Spaces",
  description:
    "Creators sell spots on what they carry to an event, the content they post about it and their time in the room. Brands pay in USDC, straight to the creator's wallet.",
  alternates: { canonical: "/spaces" },
};

export default function SpacesPage() {
  // Both sides sign up in the product. The pills above already lead to each
  // side's page, so the actions lead somewhere the pills do not.
  const join = productHref();

  return (
    <>
      <TopNav />

      <main>
        <SpacesPhotoHero
          current="overview"
          title="Sponsorship,"
          titleMuted="sold by the creator."
          lead={
            <>
              Creators already sell space on the suitcase they take to a conference, the posts
              they write about it and the hour they spend on a stage. Spaces gives that one link:
              the spots, the price, what the brand gets and what happens if the event falls
              through. Brands pay in USDC, straight to the creator&rsquo;s wallet.
            </>
          }
          actions={
            <>
              <PrimaryAction href={join}>I&rsquo;m a creator</PrimaryAction>
              <SecondaryAction href={join}>I&rsquo;m a brand</SecondaryAction>
            </>
          }
          photo={{
            wide: "/spaces/hero-airport-wide.jpg",
            square: "/spaces/hero-airport-square.jpg",
            alt: "A creator at the airport with her carry-on. Its front carries sponsor spots: a logo, a QR code and a solid amber panel sold, two spots still open.",
          }}
        />

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="Three things a creator can sell"
            intro="Each listing is one of these, tied to an event or open all year. On an event's page they sit under three tabs with these names, so a brand can see everything on sale for one conference in one place."
          />
          <Offers
            items={[
              {
                name: "On the ground",
                line: "A spot on something they carry.",
                body: "The creator picks a product from our catalog, each with its spots already drawn to size, and sets a price on each. The brand's logo, QR code, text or photo goes on it and travels to the event.",
                examples: ["Suitcase", "Laptop", "Phone case", "Blazer", "Jacket", "Race kit", "Helmet", "Tote bag"],
              },
              {
                name: "On the feed",
                line: "Content about the brand.",
                body: "Posts and videos the creator publishes, each one delivered as a public link by a date promised before the sale. Sponsorship is always disclosed.",
                examples: ["Short video", "Sponsored post", "Event wrap", "Interview", "Product demo", "Your own format"],
              },
              {
                name: "In the room",
                line: "Their time, in person.",
                body: "A session at an event, in a public place. The creator fixes the time and place, the buyer says whether it happened, and that answer is part of the creator's public record.",
                examples: ["Host a side event", "Moderate a panel", "Booth time", "Pitch review", "Office hours"],
              },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead
            title="How one sale goes"
            intro="From the listing to the proof, and who does each part."
          />
          <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Timeline
            steps={[
              {
                title: "The creator lists it",
                who: "Creator",
                body: "Spots or slots, a price for each or open to offers or bids, what else the brand gets and by when, and what happens if the event does not happen. All of it is on the page before anyone pays.",
              },
              {
                title: "One link goes out",
                who: "Creator",
                body: "The creator's page lists everything they are selling, grouped by event. It is the link they post on X, and the listing makes its own card there.",
              },
              {
                title: "The brand pays the creator",
                who: "Brand",
                body: "In USDC on Solana, Base or Polygon, from any wallet or from the HOLD app. No account needed. The payment goes to the creator's wallet in one transaction, and the spot is sold when the chain confirms it.",
              },
              {
                title: "The artwork is approved",
                who: "Both",
                body: "The brand sends a logo, a link for a QR code, text or a photo. It appears in public only once the creator approves it, and a rejection comes with a reason.",
              },
              {
                title: "The proof is public",
                who: "Creator",
                body: "Every spot and every promised post is marked delivered with a public link. A deliverable still missing seven days after its date counts as missed, and the tally is on the creator's page for the next brand to read.",
              },
            ]}
          />
          <div className="lg:sticky lg:top-28 lg:mt-14">
            <SuitcaseFigure
              face={[
                { ...FACE_ZONES.headline, state: "logo" },
                { ...FACE_ZONES.upperLeft, state: "qr" },
                { ...FACE_ZONES.upperRight, state: "held" },
                { ...FACE_ZONES.lowerLeft, state: "open", price: "$175" },
                { ...FACE_ZONES.lowerRight, state: "sold" },
              ]}
              side={[
                { ...SIDE_ZONES.upperLeft, state: "sold" },
                { ...SIDE_ZONES.upperRight, state: "open", price: "$125" },
                { ...SIDE_ZONES.lowerLeft, state: "open", price: "$125" },
                { ...SIDE_ZONES.lowerRight, state: "open", price: "$125" },
              ]}
              caption="What a brand sees on the listing: every spot with its size, its price and its state."
            />
          </div>
          </div>
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="Where the money goes"
            intro="Straight across. That is the whole design of it."
          />
          <Rules
            items={[
              {
                title: "It never passes through us",
                body: "The brand's wallet pays the creator's wallet. HOLD does not hold the money, cannot freeze it and cannot send it back. Each payment has a receipt on the chain it was made on.",
              },
              {
                title: "USDC on three networks",
                body: "Solana, Base and Polygon. The creator is paid on the network the brand paid from, so nothing is bridged on the way.",
              },
              {
                title: "The fallback is chosen before the sale",
                body: "If the event does not happen, the creator has already said what they will do: deliver the content anyway, move it to their next event, or refund the price themselves. The brand reads it before paying.",
              },
              {
                title: "The record is the reputation",
                body: "Delivered and missed, counted from public links and due dates, on every creator's page. We do not rate anyone; the record does.",
              },
            ]}
          />

          {/* Every product page carries this section, and it names only the
              take that belongs to that product. See rates.config.ts. */}
          <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
            <h2 className="font-display text-[34px] font-light text-text md:text-h2">How we make money here</h2>
            <div className="mt-8 space-y-6 text-body text-text-muted">
              <p>
                A {FEE} fee on each sale, and nothing else. The creator decides, listing by listing,
                whether it goes on top of the price for the brand to pay or comes out of the price.
                Either way it is shown at checkout before anyone signs.
              </p>
              <p className="text-text">
                No listing fee, no subscription, no cut of a refund, no charge to make an offer. If
                nothing sells, nothing is owed.
              </p>
            </div>
          </div>
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead title="Which side are you on?" />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Door
              href="/spaces/creators"
              title="I sell the space"
              body="Who can sell, what you can list, how to price it, how you get paid, and how to run it with a team."
              cta="For creators"
            />
            <Door
              href="/spaces/brands"
              title="I buy the space"
              body="How to find creators, what you see before you pay, how paying works from any wallet, and what you get after."
              cta="For brands"
            />
          </div>
        </Block>
      </main>

      <Closing
        line="The creator already had the audience. Now the sale has a page."
        body="Spaces is part of HOLD Benefits, next to Stays and eSIM. Creators can list from the web with no app; brands can pay from the wallet they already use."
        actions={
          <>
            <PrimaryAction href={join}>Start selling</PrimaryAction>
            <SecondaryAction href={join}>Sponsor a creator</SecondaryAction>
          </>
        }
      />

      <Footer />
    </>
  );
}
