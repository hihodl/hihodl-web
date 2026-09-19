import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";

/** A delivery link the API does not know. It never says whether a spot exists. */
export default function ProductionNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
          This delivery link doesn&rsquo;t work.
        </h1>
        <p className="mt-5 max-w-xl text-body text-text-muted">
          Check that you copied all of it: it is the link the page showed you after you paid for your production spot.
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
