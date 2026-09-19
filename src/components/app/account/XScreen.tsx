"use client";

/**
 * Your X account: the card on Account, and its screen.
 *
 * Connecting is the existing trip (`POST /x-account/link` with
 * `surface: "web"`; X sends the browser back to /creator/x, which the website
 * forwards to /spaces/x to finish), so the return URL contract is untouched.
 * Disconnecting is `DELETE /x-account`, which the server refuses while the
 * account fronts a live listing.
 */

import { useState } from "react";

import { refusalText } from "@/components/creator/XAccount";
import { describeCreatorError, startXLink } from "@/lib/creator/api";
import { MIN_X_ACCOUNT_AGE_DAYS, type XAccountStatus } from "@/lib/creator/types";
import { unlinkX } from "@/lib/app/me";
import { useListings, useRefresh, useX } from "@/lib/app/spaces-data";

import { Avatar, btnGhost, btnLink, btnPrimary, Note, ScreenHeader, Warn } from "../front/kit";
import { IconChevronRight } from "../icons";
import { glass, Skeleton } from "../ui";

type Linked = Extract<XAccountStatus, { linked: true }>;

function statusOf(x: XAccountStatus | undefined): { text: string; tone: "done" | "todo" | "neutral" } {
  if (!x) return { text: "…", tone: "neutral" };
  if (!x.linked) return { text: "Not connected", tone: "neutral" };
  return x.canPublish ? { text: "Ready to publish", tone: "done" } : { text: "Not ready yet", tone: "todo" };
}

export function Chip({ tone, children }: { tone: "done" | "todo" | "neutral"; children: React.ReactNode }) {
  const cls =
    tone === "done"
      ? "border-success/40 bg-success/10 text-success"
      : tone === "todo"
        ? "border-amber/40 bg-amber/10 text-amber"
        : "border-white/15 text-[#9FB7C2]";
  return <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-[12px] border px-2.5 text-[11px] ${cls}`}>{children}</span>;
}

/** The two things the publish gate asks of an X account, each with its state. */
function requirements(x: Linked): { key: string; ok: boolean; label: string; sub: string }[] {
  const created = x.accountCreatedAt ? Date.parse(x.accountCreatedAt) : NaN;
  const days = Number.isFinite(created) ? Math.floor((Date.now() - created) / 86_400_000) : null;
  const oldEnough = days !== null && days >= MIN_X_ACCOUNT_AGE_DAYS;
  const readyOn = Number.isFinite(created)
    ? new Date(created + MIN_X_ACCOUNT_AGE_DAYS * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const check = x.verifiedType ? { blue: "Verified", business: "Verified business", government: "Verified government" }[x.verifiedType] : null;
  return [
    {
      key: "verified",
      ok: !!check,
      label: check ?? "No check mark",
      sub: check ? "X shows a check mark on this account" : "Needs X Premium, business or government",
    },
    {
      key: "age",
      ok: oldEnough,
      label: days !== null ? `${days.toLocaleString("en-US")} days on X` : "Account age not shared by X",
      sub: oldEnough ? `${MIN_X_ACCOUNT_AGE_DAYS} days or more` : readyOn ? `Needs ${MIN_X_ACCOUNT_AGE_DAYS} days: ready on ${readyOn}` : `Needs ${MIN_X_ACCOUNT_AGE_DAYS} days`,
    },
  ];
}

function Req({ ok, label, sub }: { ok: boolean; label: string; sub: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        role="img"
        aria-label={ok ? "Met" : "Not met"}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-semibold ${ok ? "bg-success/20 text-success" : "bg-amber/20 text-amber"}`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-small text-text">{label}</span>
        <span className="block truncate text-tiny text-[#9FB7C2]">{sub}</span>
      </span>
    </li>
  );
}

export function XCard({ onOpen }: { onOpen: () => void }) {
  const x = useX();
  const s = statusOf(x.data);
  const linked = x.data?.linked ? (x.data as Linked) : null;
  return (
    <button type="button" onClick={onOpen} className={`${glass} flex min-h-[180px] w-full min-w-0 flex-col justify-between gap-4 p-5 text-left transition-colors hover:bg-white/[0.06] sm:p-6`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-text">X account</span>
        <Chip tone={s.tone}>{s.text}</Chip>
      </span>
      {x.data === undefined && !x.error ? (
        <Skeleton className="h-12" />
      ) : linked ? (
        <span className="flex min-w-0 flex-col gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <Avatar src={linked.avatarUrl} name={linked.handle} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-body text-text">@{linked.handle}</span>
              {linked.name ? <span className="block truncate text-tiny text-[#9FB7C2]">{linked.name}</span> : null}
            </span>
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-tiny">
            {requirements(linked).map((r) => (
              <span key={r.key} className={r.ok ? "text-[#CFE3EC]" : "text-amber"}>
                {r.ok ? "✓" : "!"} {r.key === "verified" ? r.label : r.ok ? `${MIN_X_ACCOUNT_AGE_DAYS}+ days old` : `Under ${MIN_X_ACCOUNT_AGE_DAYS} days`}
              </span>
            ))}
          </span>
        </span>
      ) : (
        <span className="text-small text-[#9FB7C2]">
          Listings publish under your X handle. It must be verified and {MIN_X_ACCOUNT_AGE_DAYS}+ days old. Read-only: HOLD can&apos;t post.
        </span>
      )}
      <span className="flex items-center gap-1 text-small text-amber">
        {linked ? "Change or disconnect" : "Connect X"} <IconChevronRight />
      </span>
    </button>
  );
}

export function XScreen({ onBack }: { onBack: () => void }) {
  const x = useX();
  const listings = useListings();
  const refresh = useRefresh();
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = x.data;
  const linked = status?.linked ? (status as Linked) : null;
  const s = statusOf(status);
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

  const fixOnX = linked?.refusal === "x_relink_needed" || linked?.refusal === "x_not_verified";

  return (
    <section className={`${glass} flex w-full max-w-[560px] flex-col gap-5 p-5 sm:p-6`}>
      <ScreenHeader title="X account" onBack={onBack} action={status ? <Chip tone={s.tone}>{s.text}</Chip> : null} />

      {status === undefined && !x.error ? (
        <Skeleton className="h-32" />
      ) : x.error ? (
        <Warn>{describeCreatorError(x.error)}</Warn>
      ) : status?.configured === false ? (
        <Warn>Connecting X is not set up here yet.</Warn>
      ) : linked ? (
        <>
          <div className="flex min-w-0 items-center gap-4">
            <Avatar src={linked.avatarUrl} name={linked.handle} size={64} />
            <div className="min-w-0">
              <p className="truncate text-[20px] font-medium text-text">@{linked.handle}</p>
              <p className="truncate text-small text-[#9FB7C2]">
                {[linked.name, linked.followers !== null ? `${linked.followers.toLocaleString("en-US")} followers` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-tiny text-[#9FB7C2]">To publish, your X account must be</p>
            <ul className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
              {requirements(linked).map((r) => (
                <Req key={r.key} ok={r.ok} label={r.label} sub={r.sub} />
              ))}
            </ul>
            {linked.refusal === "x_relink_needed" ? <Note>{refusalText(linked.refusal)}</Note> : null}
            {linked.linkedAt ? (
              <p className="text-tiny text-[#9FB7C2]">
                Connected {new Date(linked.linkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Read-only:
                HOLD can&apos;t post.
              </p>
            ) : null}
          </div>

          {confirm ? (
            <div className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
              {live.length ? (
                <p className="text-small text-text">
                  @{linked.handle} is on {live.length === 1 ? "a live listing" : `${live.length} live listings`}, so it stays connected until{" "}
                  {live.length === 1 ? "it closes" : "they close"}: sponsors paid for that handle. Drafts are not affected.
                </p>
              ) : (
                <p className="text-small text-text">Disconnect @{linked.handle}? Your listings stay; publishing a new one needs an X account again.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {live.length ? null : (
                  <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => void unlink()}>
                    {busy === "unlink" ? "Disconnecting…" : "Disconnect"}
                  </button>
                )}
                <button type="button" className={btnLink} disabled={busy !== null} onClick={() => setConfirm(false)}>
                  {live.length ? "OK" : "Keep it"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={fixOnX ? btnPrimary : btnGhost} disabled={busy !== null} onClick={() => void link()}>
                {busy === "link" ? "Taking you to X…" : fixOnX ? "Connect again" : "Change account"}
              </button>
              <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => setConfirm(true)}>
                Disconnect
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <Note>
            Listings publish under your X account: it is what a sponsor checks before paying you. Read-only: handle, check mark,
            account age. HOLD can&apos;t post.
          </Note>
          <ul className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
            <Req ok={false} label="Verified on X" sub="X Premium, business or government" />
            <Req ok={false} label={`${MIN_X_ACCOUNT_AGE_DAYS}+ days old`} sub="Counted from when the account was made" />
          </ul>
          <div>
            <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void link()}>
              {busy === "link" ? "Taking you to X…" : "Connect X"}
            </button>
          </div>
        </>
      )}
      {notice ? <Warn>{notice}</Warn> : null}
    </section>
  );
}
