"use client";

/**
 * "Button for your site" on one of the person's pay links: a snippet to paste
 * into Carrd, Notion, Webflow, Linktree or any page, and a live preview of it.
 *
 *   HTML     a self-contained <a> with inline styles (a new tab)
 *   Script   hihodl.xyz/button.js draws the same button (a popup on a
 *            computer, a new tab on a phone)
 *
 * The snippets are lib/pay-links/pay-button; the preview is that same HTML.
 */

import { useMemo, useState } from "react";

import { usdFromCents } from "@/lib/ad-space/format";
import { useT } from "@/lib/app/i18n/react";
import { buttonHtml, buttonScript } from "@/lib/pay-links/pay-button";
import type { MyPayLink } from "@/lib/pay-links/mine";

import { SectionLabel } from "../wallet/app-kit";
import { holdCard } from "../hold";

import { CodeBlock, Pills } from "./dev-kit";

type Label = "hold" | "title";
type Variant = "html" | "script";

export function PayButtonSection({ link }: { link: Pick<MyPayLink, "url" | "title" | "amount"> }) {
  const t = useT();
  const [label, setLabel] = useState<Label>("hold");
  const [variant, setVariant] = useState<Variant>("html");
  const spec = useMemo(
    () => ({
      url: link.url,
      label: label === "title" && link.title.trim() ? link.title.trim() : t("developers.button.labelHold"),
      amount: link.amount.mode === "fixed" ? usdFromCents(link.amount.cents) : null,
    }),
    [link.url, link.title, link.amount, label, t],
  );
  const preview = useMemo(() => buttonHtml(spec), [spec]);
  const code = variant === "html" ? preview : buttonScript(spec);

  return (
    <section className="mt-4">
      <SectionLabel>{t("developers.button.title")}</SectionLabel>
      <div className={`${holdCard} flex flex-col gap-3 p-4`}>
        <p className="text-[13px] leading-[18px] text-[#CFE3EC]">{t("developers.button.body")}</p>
        <Pills
          label={t("developers.button.title")}
          value={label}
          onChange={setLabel}
          options={[
            { value: "hold", label: t("developers.button.labelHold") },
            { value: "title", label: t("developers.button.labelTitle") },
          ]}
        />
        <div className="flex min-h-[88px] items-center justify-center rounded-[14px] bg-[#F4F6F8] p-4" aria-label={t("developers.button.preview")}>
          {/* Our own markup, every value escaped by buttonHtml: exactly what the creator pastes. */}
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
        <Pills
          label={t("developers.button.copy")}
          value={variant}
          onChange={setVariant}
          options={[
            { value: "html", label: t("developers.button.html") },
            { value: "script", label: t("developers.button.script") },
          ]}
        />
        <CodeBlock code={code} copyLabel={t("developers.button.copy")} copiedLabel={t("developers.button.copied")} />
        <p className="text-[12px] leading-[17px] text-white/55">{variant === "html" ? t("developers.button.htmlNote") : t("developers.button.scriptNote")}</p>
      </div>
    </section>
  );
}
