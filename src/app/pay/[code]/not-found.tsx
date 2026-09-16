import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";

/** An unknown code. It never says whether a link ever existed. */
export default function PayLinkNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-amber`}>Pay link</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
          There&rsquo;s no pay link at this address.
        </h1>
        <p className="mt-5 max-w-xl text-body text-text-muted">
          Check the link with whoever sent it. Don&rsquo;t send money to an address someone gives you instead.
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
