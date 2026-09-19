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
import { DOWNLOAD_ANCHOR } from "@/lib/appLinks";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";
import { HOLD_KEEPS, bps } from "@/lib/rates.config";

/**
 * /spaces/brands: everything a brand (a sponsor, a project, a client) can do in
 * Spaces.
 *
 * Two absences shape this page and must not be papered over:
 *   - There is no public board to browse every creator. Brands find a creator
 *     through the creator's own link or an event's page. Do not write
 *     "browse", "discover" or "marketplace of creators".
 *   - The sponsor does not confirm delivery of a spot or a post; the creator's
 *     public link is the proof. Only a session asks the buyer whether it
 *     happened. Do not promise an approval step that does not exist.
 *
 * HiPoints for sponsors are live on the backend's main (SPONSOR_POINTS_SHARE_BPS)
 * and only for payments made from the HOLD app. A payment from any other wallet
 * earns none, and the page says so.
 */

const FEE = bps(HOLD_KEEPS.spaces.feeBps);
const POINTS_OF_PRICE = bps((HOLD_KEEPS.spaces.feeBps * HOLD_KEEPS.spaces.sponsorPointsShareOfFeeBps) / 10_000);

export const metadata: Metadata = {
  title: "Spaces for brands",
  description:
    "Sponsor a creator at an event: a spot on what they carry, a post about you, or their time in the room. Pay in USDC from any wallet, straight to the creator.",
  alternates: { canonical: "/spaces/brands" },
};

export default function SpacesBrandsPage() {
  const contact = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Sponsoring through Spaces")}`;

  return (
    <>
      <TopNav />

      <main>
        <SpacesHero
          current="brands"
          title="Be seen at the event"
          titleMuted="without a booth."
          lead={
            <>
              Put your logo on a creator&rsquo;s suitcase, get a post or a video about you, or
              book their time on site. You see the exact spot, the price and what they promise
              before you pay, and you pay them directly in USDC from the wallet you already use.
            </>
          }
          actions={
            <>
              <PrimaryAction href="#how-to-pay">How paying works</PrimaryAction>
              <SecondaryAction href={contact}>Tell us what you want to sponsor</SecondaryAction>
            </>
          }
          figure={
            <SuitcaseFigure
              face={[
                { ...FACE_ZONES.headline, state: "open", price: "$500" },
                { ...FACE_ZONES.upperLeft, state: "logo" },
                { ...FACE_ZONES.upperRight, state: "qr" },
                { ...FACE_ZONES.lowerLeft, state: "sold" },
                { ...FACE_ZONES.lowerRight, state: "open", price: "$175" },
              ]}
              callout={{ title: "Headline spot, 40 × 15 cm", detail: "Open at $500. Yours when your payment confirms." }}
              caption="Your logo, a QR code to your page, text or a photo, on the spot you pick."
            />
          }
        />

        <Block tone="abyss" hairline="moonlight">
          <BlockHead
            title="Where you find creators"
            intro="There is no directory to scroll. Creators sell to the people who already follow them, so you find them where they post."
          />
          <Rules
            items={[
              {
                title: "The creator's link",
                body: "Every creator has one page with everything they are selling, grouped by event. It is the link they share on X, and each listing shows as its own card there.",
              },
              {
                title: "The event's page",
                body: "Every creator selling around one event, in three tabs: On the ground for spots, On the feed for content, In the room for time on site.",
              },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead
            title="What you read before you pay"
            intro="Everything that decides whether it is worth it is on the page, not in a DM."
          />
          <Rules
            items={[
              { title: "The exact spot", body: "Drawn on the product, with its size in centimetres and its state: open, being paid for, or sold." },
              { title: "What else you get, and by when", body: "Every post, video or mention the creator promised, each with a due date." },
              { title: "The creator's record", body: "How many deliveries they made and how many they missed, counted from public links. Plus the facts about their X account: followers, age and the check mark." },
              { title: "What happens if the event does not", body: "Content anyway, moved to their next event, or a refund from the creator. Chosen before the sale, shown before you pay." },
            ]}
          />
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead title="Four ways to buy" intro="The creator chooses which ones a listing accepts." />
          <Rules
            items={[
              { title: "Pay the price", body: "First to pay gets the spot. Nothing to negotiate." },
              { title: "Make an offer", body: "Name your number with a message. The creator accepts, counters or declines, and each side has 48 hours to answer. Nothing is charged until you pay an accepted offer." },
              { title: "Bid", body: "On spots on what the creator carries: the highest bid is public and the reserve is not. A late bid extends the clock by 10 minutes. Bidding asks you to show you have the funds, and you pay only if you win." },
              { title: "Take over a sold spot", body: "Pay double and it is yours. The brand you replace is repaid in full in the same transaction. On Solana only." },
            ]}
          />
          <p className="mt-10 max-w-2xl text-body text-text-muted">
            Offers and bids need no account: a name, a way to reach you (email, X or Telegram) and
            a private link to follow it. An accepted offer or a winning bid has 24 hours to be paid.
          </p>
        </Block>

        <Block tone="night" hairline="amber" id="how-to-pay">
          <BlockHead
            title="How paying works"
            intro="USDC only, on Solana, Base or Polygon. The payment goes from your wallet to the creator's in one transaction."
          />
          <Rules
            items={[
              {
                title: "From a Solana wallet",
                body: "Phantom, Solflare, Backpack or any wallet that reads a Solana Pay QR. You pay the network fee, which is cents.",
              },
              {
                title: "From a Base or Polygon wallet",
                body: "MetaMask, Coinbase Wallet, Rabby or any browser wallet. Two signatures and no gas: we submit them together, and either both go through or neither does.",
              },
              {
                title: "From the HOLD app",
                body: `No gas on any network, and you earn HiPoints worth ${POINTS_OF_PRICE} of the price. The same payment from any other wallet costs the same and earns none.`,
              },
              {
                title: "The fee is shown before you sign",
                body: `HOLD charges ${FEE} per sale. The creator decides whether it is added to the price or included in it, and checkout shows the total either way.`,
              },
            ]}
          />
        </Block>

        <Block tone="abyss" hairline="moonlight">
          <BlockHead title="After you pay" />
          <Timeline
            steps={[
              {
                title: "A receipt on the chain",
                body: "The spot is yours when the network confirms, with a link to the transaction.",
              },
              {
                title: "Send your artwork",
                body: "A logo, text, a photo, or the link for a QR code we draw for you. It goes public once the creator approves it; if they reject it, you get the reason and send another.",
              },
              {
                title: "A QR you can still change",
                body: "The code on the spot is our short link, pointed at your page. Fix a wrong destination without anything being reprinted.",
              },
              {
                title: "Follow what you were promised",
                body: "A checklist of the spot and every deliverable, each with its date, and a link to see it once the creator has marked it delivered.",
              },
              {
                title: "For a session, you confirm it",
                body: "Your contact and brief stay private to the creator, who sets the time and place. Afterwards you say whether it happened. “Didn't happen” is counted on their public record.",
              },
            ]}
          />
        </Block>

        <Block tone="night" hairline="amber">
          <BlockHead title="What we can and cannot promise" />
          <Rules
            items={[
              {
                title: "We never hold your money",
                body: "It goes from you to the creator. That is why HOLD cannot refund a sale: the remedy is the creator's fallback, which you read before paying.",
              },
              {
                title: "We do not rule on disputes",
                body: "What we keep is the record: delivered, missed and, for sessions, disputed, public on every creator's page.",
              },
              {
                title: "A check mark is not an identity check",
                body: "We require X's verification and an account at least 90 days old. We show you those facts; we do not vouch for the person.",
              },
              {
                title: "Scans are scans",
                body: "A QR count is how many times the link was opened, minus the preview bots we recognise. It is not a count of people.",
              },
            ]}
          />
          <div className="mt-16 max-w-xl">
            <Door
              href="/spaces/creators"
              title="See it from the creator's side"
              body="How creators list, price and deliver, and the rules they sell under."
              cta="For creators"
            />
          </div>
        </Block>
      </main>

      <Closing
        line="Pay the person who brings you into the room."
        body="Ask the creator you follow for their link, or tell us what you want to sponsor. Pay from the HOLD app to skip gas and earn HiPoints."
        actions={
          <>
            <PrimaryAction href={DOWNLOAD_ANCHOR}>Get HOLD</PrimaryAction>
            <SecondaryAction href={contact}>Write to us</SecondaryAction>
          </>
        }
      />

      <Footer />
    </>
  );
}
