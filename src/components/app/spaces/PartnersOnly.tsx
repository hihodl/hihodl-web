"use client";

/**
 * What a selling page of Spaces draws for somebody Ad Space is not open to:
 * opening a space, listing an event and claiming one come with HOLD Partners
 * (lib/app/ad-space-access). One line on what it is and the way to Partners.
 */

import Link from "next/link";

import { useT } from "@/lib/app/i18n/react";

import { useProductHref } from "../base";
import { ctaPrimary } from "../hold";
import { Ion } from "../ion";

export function PartnersOnly({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const productHref = useProductHref();
  return (
    <section
      className={`flex w-full flex-col gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#15202C,#0C1620_55%,#0A121A)] ${
        compact ? "p-4" : "max-w-[520px] p-5 sm:p-6"
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/[0.14] text-amber">
        <Ion name="megaphone-outline" size={20} />
      </span>
      <div>
        <h2 className="text-[18px] font-extrabold leading-tight text-white">{t("shell.adSpace.partnersTitle")}</h2>
        <p className="mt-1.5 text-[14px] leading-[21px] text-white/[0.72]">{t("shell.adSpace.partnersBody")}</p>
      </div>
      <Link href={productHref("/partners")} className={`${ctaPrimary} ${compact ? "!w-auto self-start px-5" : ""}`}>
        {t("shell.adSpace.partnersCta")}
      </Link>
    </section>
  );
}
