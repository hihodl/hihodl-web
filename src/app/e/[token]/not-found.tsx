import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";
import { t } from "@/lib/app/i18n";

/** A conversation link the API does not know. It never says whether a conversation exists. */
export default function EnquiryNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">{t("enquiries.thread.missingTitle")}</h1>
        <p className="mt-5 max-w-xl text-body text-sp-ink/85">{t("enquiries.thread.missingBody")}</p>
        <div className="mt-10">
          <Link href="/" className={btnSecondary}>
            {t("board.listing.home")}
          </Link>
        </div>
      </main>
    </>
  );
}
