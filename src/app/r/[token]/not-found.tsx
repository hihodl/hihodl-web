import Link from "next/link";

import { SpacesGround } from "@/components/ad-space/ground";
import { SlimHeader } from "@/components/ad-space/sections";
import { btnSecondary, eyebrow } from "@/components/ad-space/ui";
import { t } from "@/lib/app/i18n";

/** A report link the API does not know. It never says whether a report exists. */
export default function ReportNotFound() {
  return (
    <SpacesGround>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">{t("publicPages.report.missingTitle")}</h1>
        <p className="mt-5 max-w-xl text-body text-sp-ink/85">{t("publicPages.report.missingBody")}</p>
        <div className="mt-10">
          <Link href="/" className={btnSecondary}>
            {t("publicPages.goToHold")}
          </Link>
        </div>
      </main>
    </SpacesGround>
  );
}
