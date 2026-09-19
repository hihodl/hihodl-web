import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";

/**
 * The API answers 404 for a handle nobody has and for one with nothing a
 * sponsor could buy today, and this page does not say which: whether somebody
 * has an account at all is not ours to publish.
 */
export default function CreatorNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
          There&rsquo;s nothing on sale at this link.
        </h1>
        <p className="mt-5 max-w-xl text-body text-sp-ink/85">
          Check the handle with whoever shared it. This creator may have nothing open right now, or may never have
          opened a space.
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
