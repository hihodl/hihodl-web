import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";

/** The API answers 404 for an unknown slug and for an event we hid. */
export default function EventNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-amber`}>Ad Space</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
          There&rsquo;s no event at this link.
        </h1>
        <p className="mt-5 max-w-xl text-body text-text-muted">
          Check the link with whoever shared it. If you are going to an event, you can add it from the HOLD app
          when you open your space.
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
