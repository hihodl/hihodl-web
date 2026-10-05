import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";
import { t } from "@/lib/app/i18n";
import { applyRequestLocale } from "@/lib/app/i18n/server";

/** The API answers 404 for an unknown slug and for an event we hid. */
export default async function EventNotFound() {
  const language = await applyRequestLocale();
  return (
    <>
      <SlimHeader language={language} />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
          {t("publicPages.event.missingTitle")}
        </h1>
        <p className="mt-5 max-w-xl text-body text-sp-ink/85">
          {t("publicPages.event.missingBody")}
        </p>
        <div className="mt-10">
          <Link href="/" className={btnSecondary}>
            {t("publicPages.goToHold")}
          </Link>
        </div>
      </main>
    </>
  );
}
