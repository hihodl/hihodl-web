"use client";

/**
 * Business › Your events: the host of a Luma event (or a whole Luma calendar)
 * proves it here and sells its sponsorship on HOLD
 * (organiser-sells-its-event-contract.md, section 2 and round 2 item 6).
 *
 *   Claim an event   paste the Luma link, get a HOLD code, paste it anywhere
 *                    in the event's description, Verify reads the page now
 *   Your events      every claim with its status; a verified one has its
 *                    sponsor link to copy, its packages on sale and
 *                    "Add a package" into the listing wizard
 *
 * WHO A CLAIM IS FOR
 *
 * Working as a business, the claim names it (`actingForBusinessId`, the
 * owner's user id), and an event proved for a business is that business's
 * only. One's own account claims for the person, or for their own business
 * when they have a business profile. The list shows the claims made for the
 * business on screen.
 *
 * A server without claims answers 404 on `claims/mine`: the tab then says the
 * door is not open yet, never an error.
 */

import { useEffect, useMemo, useState } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { HoldApiError } from "@/lib/app/hold-api";
import { t as tNow } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { startClaim, useMyClaims, usePackageCount, verifyClaim, type ClaimWithEvent } from "@/lib/app/organiser";
import {
  canRestart,
  canVerify,
  claimErrorKey,
  claimPill,
  lumaKeyOf,
  sponsorLinkOf,
} from "@/lib/app/organiser-rules";
import { useCreatorSession } from "@/lib/creator/session";

import { useHref } from "../base";
import { Notice } from "../hold";
import { Ion } from "../ion";
import { btnGlassPill, btnWhite, Card, Empty, EventLine, Field, inputCls, SectionLabel, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";

/** A claim refusal as a calm sentence, in the language on screen. */
function claimErrorText(e: unknown): string {
  if (e instanceof HoldApiError) return tNow(claimErrorKey(e.code, e.status));
  return tNow("common.somethingWentWrong");
}

function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return [
    copied,
    (text: string) => {
      void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined);
    },
  ];
}

export function EventsTab({
  actingForBusinessId,
  isOwn,
  prefill,
}: {
  /** The business owner's user id the claim is made for, or null for the person. */
  actingForBusinessId: string | null;
  /** The signed-in account's own console (claims for no business show here too). */
  isOwn: boolean;
  /** A Luma link handed over by the sponsor page's "Claim it". */
  prefill: string | null;
}) {
  const t = useT();
  const { session } = useCreatorSession();
  const myId = session?.user?.id ?? null;
  const claims = useMyClaims();
  const [link, setLink] = useState(prefill ?? "");
  const [active, setActive] = useState<ClaimWithEvent | null>(null);
  const [busy, setBusy] = useState<"start" | "verify" | null>(null);
  const [note, setNote] = useState<{ tone: "caution" | "calm" | "good"; text: string } | null>(null);

  // The claims made for the business on screen: one's own console also lists
  // the ones made for the person alone.
  const mine = useMemo(() => {
    const list = claims.data ?? [];
    return list.filter((c) => {
      const forId = c.claim.actingForBusinessId;
      if (isOwn) return forId === null || forId === myId;
      return forId === actingForBusinessId;
    });
  }, [claims.data, isOwn, myId, actingForBusinessId]);

  const key = lumaKeyOf(link);

  async function start(url: string) {
    if (busy) return;
    setBusy("start");
    setNote(null);
    try {
      const got = await startClaim(url, actingForBusinessId);
      setActive(got);
      setLink("");
      void claims.mutate();
    } catch (e) {
      setNote({ tone: "caution", text: claimErrorText(e) });
    } finally {
      setBusy(null);
    }
  }

  async function verify(target: ClaimWithEvent) {
    if (busy) return;
    setBusy("verify");
    setNote(null);
    try {
      let done: ClaimWithEvent;
      try {
        done = await verifyClaim(target.claim.id);
      } catch (e) {
        // The claim moved under the read (a new code, another business): once more, then say so.
        if (!(e instanceof HoldApiError && e.code === "claim_changed_try_again")) throw e;
        done = await verifyClaim(target.claim.id);
      }
      setActive(done);
      void claims.mutate();
      if (done.claim.status === "verified") setNote({ tone: "good", text: t("business.events.verifiedNow") });
    } catch (e) {
      // A claim that ran out or was turned down shows as such, with what can be done next.
      const code = e instanceof HoldApiError ? e.code : null;
      const settled = code === "claim_expired" ? "expired" : code === "claim_rejected" ? "rejected" : null;
      if (settled) setActive({ ...target, claim: { ...target.claim, status: settled } });
      setNote(settled === "rejected" ? null : { tone: "caution", text: claimErrorText(e) });
      void claims.mutate();
    } finally {
      setBusy(null);
    }
  }

  if (claims.data === null) {
    return (
      <Card>
        <Empty icon="calendar-outline" title={t("business.events.notYetTitle")} body={t("business.events.notYetBody")} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>{t("business.events.claimTitle")}</SectionLabel>
      <Card className="gap-3">
        <p className="text-[13.5px] leading-5 text-white/[0.82]">{t("business.events.claimBody")}</p>
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (key) void start(link.trim());
          }}
        >
          <Field
            label={t("business.events.linkLabel")}
            htmlFor="luma-link"
            hint={t("business.events.linkHint")}
            error={link.trim() && !key ? t("business.events.error.lumaUrlInvalid") : null}
          >
            <input
              id="luma-link"
              className={inputCls}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="luma.com/your-event"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={300}
            />
          </Field>
          <button type="submit" className={`${btnWhite} self-start`} disabled={!key || busy !== null}>
            {busy === "start" ? t("business.events.gettingCode") : t("business.events.getCode")}
          </button>
        </form>
      </Card>

      {note && !active ? <Notice tone={note.tone}>{note.text}</Notice> : null}

      {active ? (
        <ActiveClaim
          item={active}
          busy={busy}
          note={note}
          onVerify={() => void verify(active)}
          onRestart={() => void start(active.claim.lumaUrl)}
          onClose={() => {
            setActive(null);
            setNote(null);
          }}
        />
      ) : null}

      <SectionLabel>{t("business.events.yours")}</SectionLabel>
      {claims.error ? (
        <Notice icon="cloud-offline-outline">{claimErrorText(claims.error)}</Notice>
      ) : claims.data === undefined ? (
        <Skeleton className="h-32" />
      ) : mine.length === 0 ? (
        <Card>
          <Empty icon="megaphone-outline" title={t("business.events.emptyTitle")} body={t("business.events.emptyBody")} />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((c) => (
            <ClaimRow
              key={c.claim.id}
              item={c}
              onOpen={() => {
                setActive(c);
                setNote(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── The open claim: the code, big ───────────────────────────────── */

function ActiveClaim({
  item,
  busy,
  note,
  onVerify,
  onRestart,
  onClose,
}: {
  item: ClaimWithEvent;
  busy: "start" | "verify" | null;
  note: { tone: "caution" | "calm" | "good"; text: string } | null;
  onVerify: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [copied, copy] = useCopied();
  const { claim, event } = item;
  const calendar = event?.kind === "calendar";
  const pill = claimPill(claim.status);

  return (
    <Card className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-[15px] font-bold text-white">{event?.name ?? claim.lumaUrl}</p>
          {event ? <EventLine event={{ name: event.city, startsOn: event.startsOn, endsOn: event.endsOn }} /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tag label={t(pill.key)} tone={pill.tone} />
          <button
            type="button"
            aria-label={t("common.close")}
            className="flex h-8 w-8 items-center justify-center rounded-[16px] text-white/55 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <Ion name="close" size={16} />
          </button>
        </div>
      </div>

      {claim.status === "verified" ? (
        <Verified item={item} />
      ) : canVerify(claim.status) ? (
        <>
          <div className="flex flex-col items-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-5">
            <span className="text-[12px] font-strong uppercase tracking-[0.12em] text-white/55">{t("business.events.yourCode")}</span>
            <span className="select-all font-mono text-[34px] font-extrabold tracking-[0.06em] text-white">{claim.code}</span>
            <button type="button" className={btnGlassPill} onClick={() => copy(claim.code)}>
              <Ion name={copied ? "checkmark-circle-outline" : "copy-outline"} size={16} />
              {copied ? t("business.events.copied") : t("business.events.copyCode")}
            </button>
          </div>
          <p className="text-[13.5px] leading-5 text-white/[0.82]">
            {calendar ? t("business.events.pasteCalendar") : t("business.events.pasteEvent")}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={claim.lumaUrl} target="_blank" rel="noopener noreferrer" className={btnGlassPill}>
              <Ion name="open-outline" size={16} />
              {t("business.events.openLuma")}
            </a>
            <button type="button" className={btnWhite} disabled={busy !== null} onClick={onVerify}>
              {busy === "verify" ? t("business.events.verifying") : t("business.events.verify")}
            </button>
          </div>
          <p className="text-[12px] leading-4 text-white/55">{t("business.events.lumaTakesAMinute")}</p>
        </>
      ) : (
        <p className="text-[13.5px] leading-5 text-white/[0.82]">{statusLine(claim.status)}</p>
      )}

      {canRestart(claim.status) ? (
        <button type="button" className={`${btnWhite} self-start`} disabled={busy !== null} onClick={onRestart}>
          {busy === "start" ? t("business.events.gettingCode") : t("business.events.newCode")}
        </button>
      ) : null}

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
    </Card>
  );
}

function statusLine(status: string): string {
  switch (status) {
    case "review":
      return tNow("business.events.review");
    case "rejected":
      return tNow("business.events.rejectedLine");
    case "lost":
      return tNow("business.events.lostLine");
    case "expired":
      return tNow("business.events.expiredLine");
    default:
      return "";
  }
}

/* ── One row of the list ─────────────────────────────────────────── */

function ClaimRow({ item, onOpen }: { item: ClaimWithEvent; onOpen: () => void }) {
  const t = useT();
  const { claim, event } = item;
  const pill = claimPill(claim.status);
  return (
    <Card className="gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-[14.5px] font-bold text-white">{event?.name ?? claim.lumaUrl}</p>
          {event ? <EventLine event={{ name: event.city, startsOn: event.startsOn, endsOn: event.endsOn }} /> : null}
        </div>
        <Tag label={t(pill.key)} tone={pill.tone} />
      </div>
      {claim.status === "verified" ? (
        <Verified item={item} />
      ) : canVerify(claim.status) || canRestart(claim.status) ? (
        <button type="button" className={`${btnGlassPill} self-start`} onClick={onOpen}>
          {canVerify(claim.status) ? t("business.events.showCode") : t("business.events.newCode")}
        </button>
      ) : (
        <p className="text-[12.5px] leading-[17px] text-white/55">{statusLine(claim.status)}</p>
      )}
    </Card>
  );
}

/* ── A verified event: its sponsor link, its packages ────────────── */

function Verified({ item }: { item: ClaimWithEvent }) {
  const t = useT();
  const href = useHref();
  const [copied, copy] = useCopied();
  const key = lumaKeyOf(item.claim.lumaUrl);
  const count = usePackageCount(key);
  if (!key) return null;
  const link = sponsorLinkOf(SITE_URL, key);
  const calendar = item.event?.kind === "calendar";
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex min-w-0 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2">
        <a href={link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/[0.82] underline-offset-2 hover:underline">
          {link.replace(/^https?:\/\//, "")}
        </a>
        <button
          type="button"
          aria-label={t("business.events.copyLink")}
          title={t("business.events.copyLink")}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-[16px] px-2.5 text-[12.5px] font-strong text-white/[0.82] hover:bg-white/10 hover:text-white"
          onClick={() => copy(link)}
        >
          <Ion name={copied ? "checkmark-circle-outline" : "copy-outline"} size={14} />
          {copied ? t("business.events.copied") : t("business.events.copyLink")}
        </button>
      </div>
      <p className="text-[12.5px] leading-[17px] text-white/55">
        {calendar ? t("business.events.putLinkOnCalendar") : t("business.events.putLinkOnLuma")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {typeof count.data === "number" ? (
          <span className="text-[13px] font-strong text-white/[0.82]">{t("business.events.packagesOnSale", { count: count.data })}</span>
        ) : null}
        <a href={href(`/listings/new?claim=${encodeURIComponent(item.claim.id)}`)} className={btnWhite}>
          <Ion name="add" size={16} />
          {t("business.events.addPackage")}
        </a>
      </div>
    </div>
  );
}
