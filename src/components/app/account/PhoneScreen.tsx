"use client";

/**
 * Your phone: the phones linked to this account. A linked phone, iPhone or
 * Android, approves and signs in the HOLD app every payment started on the
 * web; the web never pays by itself (documentation/one-wallet-every-device.md).
 *
 *   rows     how many, on Settings › Security (where the app keeps "Link
 *            with the web")
 *   screen   each phone and when it was linked      → Account ?view=phone
 *
 * "Link your phone" opens the link screen, /wallet/link (a full load: it
 * carries the wallet pages' strict CSP). It is there whatever is linked
 * already.
 *
 * Nothing is removed from here. Removing a phone needs a proof the web no
 * longer has (it has no passkey, Alex 2026-09-24), so it is done in the HOLD
 * app, Settings › Devices, and this screen says so.
 */

import { useCallback, useEffect, useState } from "react";

import type { MessageKey } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { activeLinkedDevices, type LinkedDevice } from "@/lib/link/api";
import { explain } from "@/lib/wallet/explain";

import { BackHeader, Column, ctaCommit, ctaSecondary, HoldCard, Notice, SectionTitle } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";

const PLATFORM: Record<LinkedDevice["platform"], MessageKey> = { android: "account.phone.android", ios: "account.phone.iphone", other: "account.phone.other" };
const HOW: Record<LinkedDevice["platform"], MessageKey> = {
  android: "account.phone.howAndroid",
  ios: "account.phone.howAndroid",
  other: "account.phone.howOther",
};

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
}

export function useLinkedPhones() {
  const [devices, setDevices] = useState<LinkedDevice[] | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setDevices(await activeLinkedDevices());
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => void load(), [load]);
  return { devices, error, reload: load };
}

export function PhoneScreenView({
  devices,
  error,
  linkHref,
  onBack,
}: {
  devices: LinkedDevice[] | undefined;
  error: unknown;
  linkHref: string;
  onBack: () => void;
}) {
  const t = useT();
  return (
    <Column>
      <BackHeader title={t("account.phone.title")} onBack={onBack} />
      {devices === undefined && !error ? (
        <Skeleton className="h-40 rounded-[28px]" />
      ) : (
        <>
          <p className="mb-2 px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
            {t("account.phone.introEvery")}
          </p>
          {devices && devices.length > 0 ? (
            <>
              <SectionTitle>{t("account.phone.linked")}</SectionTitle>
              <HoldCard>
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-[18px] py-[18px]">
                    <Ion name="phone-portrait-outline" size={18} className="mt-[2px] self-start text-white" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-strong leading-5 text-white">{t(PLATFORM[d.platform])}</p>
                      <p className="mt-0.5 text-[12px] leading-4 text-[#9FB7C2]">
                        {d.linkedAt ? t("account.phone.howLinked", { how: t(HOW[d.platform]), date: when(d.linkedAt) }) : t(HOW[d.platform])}
                      </p>
                    </div>
                  </div>
                ))}
              </HoldCard>
            </>
          ) : null}
          {devices && devices.length > 0 ? (
            <p className="mt-3 px-1 text-[12px] leading-[17px] text-[#9FB7C2]">{t("account.phone.removeInApp")}</p>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Notice>{explain(error)}</Notice>
            </div>
          ) : null}
          {devices ? (
            <div className="mt-6">
              {/* A full load: the link screen carries the wallet pages' strict CSP. */}
              <a href={linkHref} className={devices.length === 0 ? ctaCommit : ctaSecondary}>
                <Ion name="qr-code-outline" size={16} />
                {devices.length === 0 ? t("account.phone.link") : t("account.phone.linkAnother")}
              </a>
            </div>
          ) : null}
        </>
      )}
    </Column>
  );
}

export function PhoneScreen({ onBack, linkHref }: { onBack: () => void; linkHref: string }) {
  const { devices, error } = useLinkedPhones();
  return <PhoneScreenView devices={devices} error={error} linkHref={linkHref} onBack={onBack} />;
}
