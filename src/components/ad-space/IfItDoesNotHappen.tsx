import { FALLBACK_LABEL, FALLBACK_TEXT, SESSION_FALLBACK_TEXT, isSessionSpace } from "@/lib/ad-space/format";
import type { Space } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";

import { card, eyebrow } from "./ui";

/**
 * The cancellation policy, part of "Before you pay": what happens if the thing
 * the brand is paying for does not happen.
 *
 * The wording is the app's (`fallbackLabel`, `fallbackHint`,
 * `sessionFallbackHint`), composed the way the app composes it: the label, then
 * the creator's own note if they wrote one, else the standard sentence. The
 * checkout repeats it above the pay button, so a sponsor who taps a spot on the
 * drawing and pays straight away still reads it.
 *
 * Nothing renders for a policy this page has no words for.
 */
export function IfItDoesNotHappen({ space }: { space: Space }) {
  const session = isSessionSpace(space);
  const label = FALLBACK_LABEL[space.fallback];
  const hint = (session ? SESSION_FALLBACK_TEXT : FALLBACK_TEXT)[space.fallback];
  if (!label || !hint) return null;
  const note = space.fallbackNote?.trim();

  return (
    <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-labelledby="if-it-does-not-happen">
      <h3 id="if-it-does-not-happen" className={`${eyebrow} text-sp-ink/80`}>
        {session ? t("sponsor.fallback.titleSession") : t("sponsor.fallback.title")}
      </h3>
      <div>
        <p className="break-words text-body text-sp-ink [overflow-wrap:anywhere]">{label}</p>
        <p className="mt-1 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">{note || hint}</p>
      </div>
    </section>
  );
}
