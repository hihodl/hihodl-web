"use client";

/**
 * Your X account: the app's X account screen (ad-space/x-account.tsx, built
 * from XAccountPanel and XAccountFooter), on the web. Its copy is the app's
 * adSpace `x.*` strings.
 *
 * Connecting is the existing trip (`POST /x-account/link` with
 * `surface: "web"`; X sends the browser back to /creator/x, which the website
 * forwards to /spaces/x to finish), so the return URL contract is untouched.
 * Disconnecting is `DELETE /x-account`, which the server refuses while the
 * account fronts a live listing; the app asks in an alert, the web in a card.
 */

import { useState } from "react";

import { describeCreatorError, startXLink } from "@/lib/creator/api";
import { MIN_X_ACCOUNT_AGE_DAYS, type XAccountStatus } from "@/lib/creator/types";
import { t as tr, type MessageKey } from "@/lib/app/i18n";
import { fmtCompact, fmtDate, fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { unlinkX } from "@/lib/app/me";
import { useListings, useRefresh, useX } from "@/lib/app/spaces-data";

import { BackHeader, Column, ctaPrimary, ctaSecondary, holdCard, Notice } from "../hold";
import { Ion, type IonName } from "../ion";
import { Card } from "../spaces/kit";
import { Skeleton } from "../ui";

type Linked = Extract<XAccountStatus, { linked: true }>;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** "3 years", "7 months", "45 days": the app's formatAge. */
function formatAge(iso: string | null | undefined): string | null {
  const days = daysSince(iso);
  if (days == null) return null;
  if (days >= 365) return tr("account.x.ageYears", { count: Math.floor(days / 365) });
  if (days >= 60) return tr("account.x.ageMonths", { count: Math.floor(days / 30) });
  return tr("account.x.ageDays", { count: days });
}

function formatCount(n: number): string {
  return n >= 10_000 ? fmtCompact(n) : fmtNumber(n);
}

function formatDay(iso: string): string {
  return fmtDate(iso, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const VERIFIED: Record<string, MessageKey> = {
  blue: "account.x.verifiedBlue",
  business: "account.x.verifiedBusiness",
  government: "account.x.verifiedGovernment",
};

/** XAccountPanel's refusal line, word for word. */
function refusalLine(x: Linked): string | null {
  switch (x.refusal) {
    case "x_not_verified":
      return tr("account.x.refusalNotVerified");
    case "x_account_too_new": {
      const age = daysSince(x.accountCreatedAt);
      if (x.accountCreatedAt && age != null) {
        const ready = formatDay(new Date(Date.parse(x.accountCreatedAt) + MIN_X_ACCOUNT_AGE_DAYS * 86_400_000).toISOString());
        return tr("account.x.refusalTooNew", { age: fmtNumber(age), min: MIN_X_ACCOUNT_AGE_DAYS, date: ready });
      }
      return tr("account.x.refusalTooNewNoDate", { min: MIN_X_ACCOUNT_AGE_DAYS });
    }
    case "x_relink_needed":
      return tr("account.x.refusalRelink");
    default:
      return null;
  }
}

function Fact({ icon, text, attention }: { icon: IonName; text: string; attention?: boolean }) {
  return (
    <p className="flex items-center gap-2">
      <Ion name={icon} size={15} className={attention ? "text-amber" : "text-white/[0.62]"} />
      <span className={`text-[13.5px] font-strong ${attention ? "text-amber" : "text-white/[0.62]"}`}>{text}</span>
    </p>
  );
}

function XMark() {
  return (
    <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[21px] bg-white/[0.08] text-white">
      <Ion name="logo-x" size={20} />
    </span>
  );
}

export function XScreen({ onBack }: { onBack: () => void }) {
  const x = useX();
  const listings = useListings();
  const refresh = useRefresh();
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const t = useT();
  const status = x.data;
  const linked = status?.linked ? (status as Linked) : null;
  // The server keeps an X account while a live listing is published under it
  // (409 x_fronts_a_live_space on DELETE /x-account, "busy" on a change).
  const live = (listings.data ?? []).filter((l) => l.status === "live");

  const link = async () => {
    setBusy("link");
    setNotice(null);
    try {
      const { authorizeUrl } = await startXLink();
      // This tab goes to X and X brings it back (to /creator/x, then /spaces/x).
      window.location.href = authorizeUrl;
    } catch (e) {
      setNotice(describeCreatorError(e));
      setBusy(null);
    }
  };

  const unlink = async () => {
    setBusy("unlink");
    setNotice(null);
    try {
      await unlinkX();
      setConfirm(false);
      await refresh("x");
    } catch (e) {
      setNotice(describeCreatorError(e));
    } finally {
      setBusy(null);
    }
  };

  const relink = linked?.refusal === "x_relink_needed" || linked?.refusal === "x_not_verified";

  let panel: React.ReactNode;
  if (status === undefined && !x.error) {
    panel = <Skeleton className="h-40 rounded-[18px]" />;
  } else if (!status) {
    panel = (
      <Card>
        <Notice icon="cloud-offline-outline" tone="calm">
          {x.error ? t("account.x.checkFailedWith", { reason: describeCreatorError(x.error) }) : t("account.x.checkFailed")}
        </Notice>
        <button type="button" className={ctaSecondary} onClick={() => void refresh("x")}>
          {t("common.tryAgain")}
        </button>
      </Card>
    );
  } else if (!linked) {
    panel = (
      <Card>
        <div className="flex items-center gap-3">
          <XMark />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-strong tracking-[-0.2px] text-white">{t("account.x.linkTitle")}</p>
            <p className="mt-0.5 text-[13px] leading-[18px] text-white/[0.62]">
              {t("account.x.linkBody", { min: MIN_X_ACCOUNT_AGE_DAYS })}
            </p>
          </div>
        </div>
        {!status.configured ? <Notice>{t("account.x.notOn")}</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
      </Card>
    );
  } else {
    const verifiedKey = linked.verifiedType ? VERIFIED[linked.verifiedType] : undefined;
    const verified = verifiedKey ? t(verifiedKey) : null;
    const age = formatAge(linked.accountCreatedAt);
    const refusal = refusalLine(linked);
    panel = (
      <Card>
        <div className="flex items-center gap-3">
          {linked.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={linked.avatarUrl} alt="" className="h-[42px] w-[42px] shrink-0 rounded-[21px] bg-white/[0.08] object-cover" />
          ) : (
            <XMark />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-strong tracking-[-0.2px] text-white">{linked.name || `@${linked.handle}`}</p>
            <p className="mt-0.5 truncate text-[13px] text-white/[0.62]">@{linked.handle}</p>
          </div>
          {linked.canPublish ? (
            <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[12px] bg-[rgba(14,155,104,0.14)] px-[9px] text-[11.5px] font-strong text-[#2FBE8A]">
              <Ion name="checkmark-circle" size={14} />
              {t("account.x.canPublish")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-[7px]">
          <Fact icon={verified ? "checkmark-circle-outline" : "remove-circle-outline"} text={verified ?? t("account.x.noCheck")} attention={!verified} />
          {linked.identityVerified ? <Fact icon="id-card-outline" text={t("account.x.idVerified")} /> : null}
          {age ? <Fact icon="time-outline" text={t("account.x.age", { age })} attention={linked.refusal === "x_account_too_new"} /> : null}
          {linked.followers != null ? <Fact icon="people-outline" text={t("account.x.followers", { count: linked.followers, formatted: formatCount(linked.followers) })} /> : null}
        </div>
        {refusal ? <Notice>{refusal}</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
      </Card>
    );
  }

  return (
    <Column>
      <BackHeader title={t("account.home.x")} onBack={onBack} />
      <div className="flex flex-col gap-3.5">
        {panel}

        {status && !linked ? (
          <button type="button" className={ctaPrimary} disabled={!status.configured || busy !== null} onClick={() => void link()}>
            <Ion name="logo-x" size={16} />
            {busy === "link" ? t("account.x.taking") : t("account.x.connect")}
          </button>
        ) : null}

        {linked && confirm ? (
          <div className={`${holdCard} flex flex-col gap-3 p-5`}>
            <p className="text-[17px] font-strong text-white">{t("account.x.unlinkTitle")}</p>
            <p className="text-[14px] leading-5 text-white/[0.72]">
              {live.length
                ? t("account.x.frontsLive", { handle: linked.handle, count: live.length })
                : t("account.x.unlinkBody")}
            </p>
            {live.length ? null : (
              <button type="button" className={ctaSecondary} disabled={busy !== null} onClick={() => void unlink()}>
                {busy === "unlink" ? t("account.x.unlinking") : t("account.x.unlink")}
              </button>
            )}
            <button type="button" className="h-11 text-[15px] font-strong text-white/80 hover:text-white" disabled={busy !== null} onClick={() => setConfirm(false)}>
              {live.length ? t("common.ok") : t("common.cancel")}
            </button>
          </div>
        ) : linked ? (
          <div className="flex flex-col gap-2.5">
            <button type="button" className={ctaPrimary} disabled={busy !== null} onClick={() => void link()}>
              <Ion name={relink ? "refresh" : "swap-horizontal"} size={16} />
              {busy === "link" ? t("account.x.taking") : relink ? t("account.x.linkAgain") : t("account.x.change")}
            </button>
            <button type="button" className={ctaSecondary} disabled={busy !== null} onClick={() => setConfirm(true)}>
              <Ion name="log-out-outline" size={16} />
              {t("account.x.disconnect")}
            </button>
          </div>
        ) : null}

        <p className="px-1 text-center text-[12px] leading-4 text-white/55">{t("account.x.privacy")}</p>
      </div>
    </Column>
  );
}
