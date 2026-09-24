"use client";

/**
 * Invite friends: the app's `app/(drawer)/referral/index.tsx`.
 *
 * The same page from the same two reads (lib/app/referrals.ts): the points
 * each side is paid, the three counts, the link with Copy and WhatsApp, your
 * invites, and the fine print. The CTA shares the link: the browser's share
 * sheet where there is one, the clipboard where there is not.
 *
 * Left out, as the app leaves them out today: the promo ribbon (the round
 * ended on 14 July and none is running) and the per-invite detail screen,
 * which only repeats the row.
 */

import { useState } from "react";

import { fmtNumber } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";
import { useInvites, useReferralSummary, type Invite } from "@/lib/app/referrals";

import { CopyButton } from "../front/kit";
import { BackHeader, Column, ctaCommit, HoldCard } from "../hold";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Skeleton } from "../ui";

const GREEN = "#4ADE80";
const AMBER = "#FFD234";
const FRIEND = "#8ECAE6";
const TERMS = "https://hihodl.xyz/legal/referral-terms";

const pts = (n: number) => fmtNumber(n);

export function InviteScreen({ onBack }: { onBack: () => void }) {
  const summary = useReferralSummary();
  const t = useT();
  const s = summary.data;
  const perReferrer = s?.pointsPerReferrer;
  const invites = useInvites(s ? (perReferrer ?? 0) : undefined);

  if (summary.error && !s) {
    return (
      <Column>
        <BackHeader title={t("menu.invite.title")} onBack={onBack} />
        <HoldCard className="mt-4">
          <ReadFailed title={t("menu.invite.loadFailed")} onRetry={() => void summary.mutate()} />
        </HoldCard>
      </Column>
    );
  }

  const list = invites.data ?? [];
  const invited = s ? (s.invitedCount ?? s.referredCount ?? list.length) : 0;
  const activated = s ? (s.activatedCount ?? list.filter((i) => i.status === "activated").length) : 0;
  const earned = s ? (s.pointsEarned ?? activated * (perReferrer ?? 0)) : 0;
  const welcome = s?.pointsPerWelcome;
  const message = s?.inviteLink
    ? t("menu.invite.message", {
        points: welcome !== undefined ? t("menu.invite.points", { count: welcome }) : t("menu.invite.pointsWord"),
        link: s.inviteLink,
      })
    : "";

  return (
    <Column>
      <BackHeader title={t("menu.invite.title")} onBack={onBack} />

      {/* The hero: what you are paid, and what they are. */}
      <section className="mt-2 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#15202C,#0C1620_55%,#0A121A)] p-5">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.6px] text-white/55">{t("menu.invite.heroLabel")}</p>
        {s ? (
          <>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[40px] font-extrabold leading-[1.1] tracking-[-1px] tabular-nums text-white">{pts(perReferrer ?? 0)}</span>
              <span className="text-[16px] font-bold text-white/70">{t("menu.invite.pts")}</span>
            </p>
            <p className="mt-1 text-[13.5px] text-white/[0.72]">
              <Rich
                k="menu.invite.perFriend"
                vars={{ points: welcome !== undefined ? pts(welcome) : t("menu.invite.pointsWord") }}
                tags={{ friend: (c) => <span style={{ color: FRIEND }}>{c}</span> }}
              />
            </p>
          </>
        ) : (
          <Skeleton className="mt-2 h-[72px]" />
        )}
      </section>

      {/* The three counts. */}
      <div className="mt-3 flex gap-2">
        <Stat value={s ? pts(invited) : null} label={t("menu.invite.invited")} />
        <Stat value={s ? pts(activated) : null} label={t("menu.invite.activated")} color={GREEN} />
        <Stat value={s ? pts(earned) : null} label={t("menu.invite.ptsEarned")} color={AMBER} grow />
      </div>

      {/* The link. */}
      <HoldCard className="mt-5 p-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-white/55">{t("menu.invite.yourLink")}</p>
        {s?.inviteLink ? (
          <>
            <p className="mt-2 truncate text-[14px] text-white/80">{s.inviteLink}</p>
            <div className="mt-3 flex gap-2">
              <CopyButton
                value={s.inviteLink}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[20px] border border-white/[0.14] bg-white/[0.08] text-[14px] font-bold text-white transition-colors hover:bg-white/[0.14]"
              />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[20px] bg-[#1EB955] text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              >
                WhatsApp
              </a>
            </div>
            {s.qualifyUsd !== undefined ? (
              <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
                {t("menu.invite.qualify", { amount: `$${pts(s.qualifyUsd)}` })}
              </p>
            ) : null}
          </>
        ) : s ? (
          <p className="mt-2 text-[13.5px] text-white/[0.72]">{t("menu.invite.linkNotReady")}</p>
        ) : (
          <Skeleton className="mt-2 h-10" />
        )}
      </HoldCard>

      {/* Your invites. */}
      <div className="mt-6 flex items-baseline justify-between px-0.5">
        <h2 className="text-[16px] font-bold text-white">{t("menu.invite.yourInvites")}</h2>
        {list.length > 0 ? (
          <p className="text-[12.5px] text-white/55">
            <Rich
              k="menu.invite.sentSummary"
              vars={{ count: pts(invited), points: pts(earned) }}
              tags={{ green: (c) => <span style={{ color: GREEN }}>{c}</span> }}
            />
          </p>
        ) : null}
      </div>
      <div className="mt-3">
        {invites.error && !invites.data ? (
          <HoldCard>
            <ReadFailed compact title={t("menu.invite.loadFailed")} onRetry={() => void invites.mutate()} />
          </HoldCard>
        ) : !invites.data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[60px]" />
            <Skeleton className="h-[60px]" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Ion name="people-outline" size={24} className="text-white/30" />
            <p className="text-[13.5px] text-white/55">{t("menu.invite.empty")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[12px] leading-[18px] text-white/45">
        <Rich
          k="menu.invite.terms"
          tags={{
            link: (c) => (
              <a href={TERMS} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white/70">
                {c}
              </a>
            ),
          }}
        />
      </p>

      {s?.inviteLink ? (
        <div className="mt-5">
          <ShareButton message={message} link={s.inviteLink} />
        </div>
      ) : null}
    </Column>
  );
}

function Stat({ value, label, color = "#FFFFFF", grow }: { value: string | null; label: string; color?: string; grow?: boolean }) {
  return (
    <div className={`${grow ? "flex-[1.3]" : "flex-1"} rounded-[16px] border border-white/[0.08] bg-white/[0.05] px-3 py-3`}>
      {value === null ? (
        <Skeleton className="h-6 w-10" />
      ) : (
        <p className="truncate text-[20px] font-extrabold tabular-nums" style={{ color }}>
          {value}
        </p>
      )}
      <p className="mt-0.5 text-[12px] text-white/55">{label}</p>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function InviteRow({ invite }: { invite: Invite }) {
  const t = useT();
  const activated = invite.status === "activated";
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.05] px-3.5 py-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
        style={activated ? { background: "rgba(74,222,128,0.22)", color: "#FFFFFF" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
      >
        {initials(invite.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold text-white">{invite.name}</span>
        {activated ? (
          <span className="block text-[12.5px]" style={{ color: GREEN }}>
            {t("menu.invite.rowActivated", { points: pts(invite.pointsAwarded) })}
          </span>
        ) : invite.status === "in_progress" ? (
          <span className="block text-[12.5px] text-white/55">
            {invite.daysLeft != null ? (
              <Rich
                k="menu.invite.rowProgressLeft"
                vars={{ done: invite.stepsDone, days: invite.daysLeft }}
                tags={{ left: (c) => <span className="text-amber">{c}</span> }}
              />
            ) : (
              t("menu.invite.rowProgress", { done: invite.stepsDone })
            )}
          </span>
        ) : (
          <span className="block text-[12.5px] text-white/45">{t("menu.invite.expired")}</span>
        )}
      </span>
    </div>
  );
}

/** The app's sticky CTA: the share sheet where the browser has one, the clipboard where it does not. */
function ShareButton({ message, link }: { message: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message });
        return;
      } catch (e) {
        // Dismissed: done. Refused (no permission, nothing to share to): copy instead.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard?.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* the link is on screen above */
    }
  }
  return (
    <button type="button" onClick={() => void share()} className={ctaCommit}>
      <Ion name="gift-outline" size={18} />
      {copied ? t("menu.invite.linkCopied") : t("menu.invite.title")}
    </button>
  );
}
