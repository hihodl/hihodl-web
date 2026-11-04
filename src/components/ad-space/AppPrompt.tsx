"use client";

import { useEffect, useState } from "react";

import { APP_STORE_URL, PLAY_STORE_URL, SMART_LINK_URL } from "@/lib/appLinks";
import { isMobile } from "@/lib/ad-space/wallets";
import { useT } from "@/lib/app/i18n/react";

import { QrCode } from "./qr";
import { btnSmallSecondary } from "./ui";

/**
 * The HOLD app, offered after an offer is made and never before
 * (hispace-offers-v0.md, decision 15). On a phone: the two store buttons. On a
 * computer: a QR of the smart link, which sends each phone to its own store.
 *
 * The server render is the desktop version; a phone swaps in its buttons after
 * mount, so the two renders never disagree during hydration.
 */
export function AppPrompt({ title, body }: { title: string; body?: string }) {
  const t = useT();
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(isMobile()), []);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-[color:var(--color-hairline)] bg-sp-ink/[0.03] p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-small text-sp-ink">{title}</p>
        {body && <p className="mt-1 text-tiny text-sp-ink/85">{body}</p>}
        {mobile && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
              App Store
            </a>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
              Google Play
            </a>
          </div>
        )}
      </div>
      {!mobile && (
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="w-[112px] rounded-tight bg-white p-1.5">
            <QrCode text={SMART_LINK_URL} title={t("sponsor.appPrompt.qrTitle")} className="h-auto w-full" />
          </div>
          <p className="text-tiny text-sp-ink/80">{t("sponsor.appPrompt.scan")}</p>
        </div>
      )}
    </div>
  );
}
