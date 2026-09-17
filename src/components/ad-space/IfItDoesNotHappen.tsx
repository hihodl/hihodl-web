import { FALLBACK_LABEL, FALLBACK_TEXT, SESSION_FALLBACK_TEXT, isSessionSpace } from "@/lib/ad-space/format";
import type { Space } from "@/lib/ad-space/types";

import { card, eyebrow } from "./ui";

/**
 * The two things a brand needs before it picks a spot, not after it has paid:
 * what happens if the thing it is paying for does not happen, and what HOLD
 * takes out of the payment.
 *
 * Both used to live at the bottom of the page, under "What the creator
 * promises". That is the wrong side of the decision. Somebody who arrives from
 * a post on X, reads the board, picks a spot and signs never scrolls that far,
 * and the first time they ask "what if the venue says no" is the moment it has
 * already gone wrong — which is exactly the thread this block exists because of.
 * So the policy sits here, beside the spots, in the creator's own words.
 *
 * The wording is the app's (`fallbackLabel`, `fallbackHint`,
 * `sessionFallbackHint`), composed the way the app composes it: the label, then
 * the creator's own note if they wrote one, else the standard sentence. A brand
 * that reads the space here and the creator who reads it in the app are looking
 * at the same promise.
 *
 * Nothing renders for a policy this page has no words for: a space from a server
 * that sends a fallback we do not know loses the block rather than showing an
 * empty one.
 */
export function IfItDoesNotHappen({ space }: { space: Space }) {
  const session = isSessionSpace(space);
  const label = FALLBACK_LABEL[space.fallback];
  const hint = (session ? SESSION_FALLBACK_TEXT : FALLBACK_TEXT)[space.fallback];
  if (!label || !hint) return null;

  const note = space.fallbackNote?.trim();
  const feePct = `${space.feeBps / 100}%`;
  /* Who carries the fee, and nothing more. A worked example here would print
     our margin on the creator's own page, which is not ours to publish. */
  const fee =
    space.feePayer === "creator"
      ? `HOLD's fee is ${feePct}, paid by the creator out of what they receive, so the price you see is the price you pay.`
      : `HOLD's fee is ${feePct}, paid by the ${session ? "buyer" : "sponsor"} on top of the price.`;

  return (
    <section className={`${card} p-5 md:p-6`} aria-labelledby="if-it-does-not-happen">
      <h2 id="if-it-does-not-happen" className={`${eyebrow} text-moonlight`}>
        {session ? <>If the session can&rsquo;t happen</> : "If the venue says no"}
      </h2>
      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
        <div className="min-w-0">
          <p className="break-words text-body text-text [overflow-wrap:anywhere]">{label}</p>
          <p className="mt-1 break-words text-small text-text-muted [overflow-wrap:anywhere]">{note || hint}</p>
        </div>
        <div className="min-w-0">
          <h3 className={`${eyebrow} text-text-faint`}>What HOLD charges</h3>
          <p className="mt-3 text-small text-text-muted">{fee}</p>
        </div>
      </div>
    </section>
  );
}
