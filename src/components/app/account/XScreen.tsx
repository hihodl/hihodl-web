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
import { useRefresh, useX } from "@/lib/app/spaces-data";

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
        <span className="flex min-w-0 items-center gap-3">
          <Avatar src={linked.avatarUrl} name={linked.handle} size={48} />
          <span className="min-w-0">
            <span className="block truncate text-body text-text">@{linked.handle}</span>
            {linked.name ? <span className="block truncate text-tiny text-[#9FB7C2]">{linked.name}</span> : null}
          </span>
        </span>
      ) : (
        <span className="text-small text-[#9FB7C2]">Your listings publish under your X handle. Read-only: HOLD can&apos;t post.</span>
      )}
      <span className="flex items-center gap-1 text-small text-amber">
        {linked ? "Manage" : "Connect X"} <IconChevronRight />
      </span>
    </button>
  );
}

export function XScreen({ onBack }: { onBack: () => void }) {
  const x = useX();
  const refresh = useRefresh();
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = x.data;
  const linked = status?.linked ? (status as Linked) : null;
  const s = statusOf(status);

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
              {linked.name ? <p className="truncate text-small text-[#9FB7C2]">{linked.name}</p> : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Fact label="Check mark" value={linked.verifiedType ? { blue: "Verified", business: "Business", government: "Government" }[linked.verifiedType] : "None"} />
            <Fact label="On X since" value={linked.accountCreatedAt ? new Date(linked.accountCreatedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "Not shared by X"} />
            {linked.followers !== null ? <Fact label="Followers" value={linked.followers.toLocaleString("en-US")} /> : null}
            {linked.linkedAt ? <Fact label="Connected" value={new Date(linked.linkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} /> : null}
          </dl>
          {linked.refusal ? <Note>{refusalText(linked.refusal)}</Note> : <Note>Listings publish under this handle. Sponsors see it on your page.</Note>}
          {confirm ? (
            <div className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-small text-text">Disconnect @{linked.handle}? Your listings stay; publishing a new one needs an X account again.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => void unlink()}>
                  {busy === "unlink" ? "Disconnecting…" : "Disconnect"}
                </button>
                <button type="button" className={btnLink} disabled={busy !== null} onClick={() => setConfirm(false)}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={linked.refusal === "x_relink_needed" || linked.refusal === "x_not_verified" ? btnPrimary : btnGhost}
                disabled={busy !== null}
                onClick={() => void link()}
              >
                {busy === "link" ? "Taking you to X…" : "Connect X again"}
              </button>
              <button type="button" className={btnLink} disabled={busy !== null} onClick={() => setConfirm(true)}>
                Disconnect
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <Note>
            Listings publish under your X account: it is what a sponsor checks before paying you. It needs a check mark and
            to be at least {MIN_X_ACCOUNT_AGE_DAYS} days old. Read-only: handle, check mark, account age. HOLD can&apos;t post.
          </Note>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#9FB7C2]">{label}</dt>
      <dd className="mt-0.5 truncate text-small text-text">{value}</dd>
    </div>
  );
}
