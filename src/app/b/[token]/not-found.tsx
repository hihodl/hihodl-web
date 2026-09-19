import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";

/** A manage link the API does not know. It never says whether a booking exists. */
export default function BookingNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
          This booking link doesn&rsquo;t work.
        </h1>
        <p className="mt-5 max-w-xl text-body text-sp-ink/85">
          Check that you copied all of it: it is the link the checkout showed you after you paid. If you can&rsquo;t
          find it, email {SUPPORT_EMAIL} with the transaction of your payment.
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
