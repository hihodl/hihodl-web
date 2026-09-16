import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";

/**
 * The API answers 404 for drafts and for spaces we took down, and this page
 * does not say which: a delisted space's reason is between us and its creator.
 */
export default function AdSpaceNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
          There&rsquo;s no HiSpace at this link.
        </h1>
        <p className="mt-5 max-w-xl text-body text-text-muted">
          Check the link with whoever shared it. It may not be published yet, or it may have been taken down.
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
