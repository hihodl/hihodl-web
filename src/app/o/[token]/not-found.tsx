import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";

/** A manage link the API does not know. It never says whether an offer exists. */
export default function OfferNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
          This offer link doesn&rsquo;t work.
        </h1>
        <p className="mt-5 max-w-xl text-body text-sp-ink/85">
          Check that you copied all of it: it is the link the page showed you after you sent your offer or bid, and the
          one we emailed you if you gave an email address.
        </p>
        <div className="mt-10">
          <Link href="/" className={btnSecondary}>
            Go to HOLD
          </Link>
        </div>
      </main>
    </>
  );
}
