/**
 * The team: a creator who is really an agency.
 *
 * A creator sells; somebody on their team turns up at the event and does the
 * thing. This page is where the creator invites those people, says what each
 * of them may do, and takes them off again — and where somebody who was sent
 * an invitation takes their seat.
 *
 * WE NEVER MOVE THIS MONEY
 *
 * Said on this page in so many words, because a screen that lists people next
 * to amounts reads like payroll, and it is not. The sponsor's payment is one
 * transaction the sponsor signs, paying the creator's own address, with our
 * fee beside it; a team changes nothing about that. What a member is owed is
 * the creator's own bookkeeping, and the creator pays it themselves. No
 * sentence here says or implies that HOLD sends it, holds it or guarantees it.
 *
 * WHY ACCEPTING IS A BUTTON AND NEVER AUTOMATIC
 *
 * A seat is taken once, and taking it puts this account on somebody's team and
 * lets them see it there. Arriving on a link is not agreeing to that, so the
 * page says whose team it is — read from the seat by the server, never from
 * the editable rest of the link — and waits for a yes.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { btnPrimary, btnSmallSecondary, card, eyebrow } from "@/components/ad-space/ui";
import { CreatorApiError } from "@/lib/creator/api";
import { acceptSeat } from "@/lib/creator/listings";
import { describeTeamError } from "@/lib/creator/problems";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import {
  creatorText,
  dayText,
  forgetSeat,
  pendingSeat,
  rememberSeat,
  seatHref,
  type SeatLookup,
  type TeamMember,
} from "@/lib/creator/team";

import { Notice } from "./parts";
import { SignIn } from "./SignIn";
import { Members, ROLE_TEXT, Seats } from "./team/Members";
import { Earnings, Owed } from "./team/Money";

interface Props {
  /** The seat code from the link, already checked for shape. */
  seat: string | null;
  /** What the server said about that seat before anybody signed in. */
  lookup: SeatLookup | null;
}

export function Team({ seat: seatFromUrl, lookup }: Props) {
  const { session, configured } = useCreatorSession();
  const [seat, setSeat] = useState<string | null>(seatFromUrl);
  // Bumped whenever a seat is taken, so the list of teams you are on re-reads.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (seatFromUrl) {
      // A seat that is gone or ran out is not worth offering back later.
      if (lookup?.kind === "refused") forgetSeat();
      else rememberSeat(seatFromUrl);
      return;
    }
    // Back from a sign-in link, which lands wherever the email sent it and
    // without the seat. The kept one is reopened by its address, so the server
    // reads whose it is exactly as it did the first time.
    const kept = pendingSeat();
    if (kept) window.location.replace(seatHref(kept.seat));
  }, [seatFromUrl, lookup]);

  const done = () => {
    forgetSeat();
    setSeat(null);
    // The seat is a one-time credential: once it has been answered it has no
    // business in the address bar or in a link somebody copies from it.
    window.history.replaceState(null, "", "/creator/team");
  };

  const who = lookup?.kind === "found" ? creatorText(lookup.invite) : null;
  const refused = lookup?.kind === "refused" ? lookup.code : null;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-6 py-18">
      <header className="flex flex-col gap-3">
        <p className={`${eyebrow} text-text-faint`}>Your team</p>
        <h1 className="text-h3 font-light text-text">The people who do the work with you</h1>
        <p className="text-lead font-light text-text-muted">
          You sell; somebody on your team turns up at the event and does the thing. Invite them, say what they may do,
          and put them on the listings they work, for a share of each one.
        </p>
      </header>

      {session === undefined ? (
        <p className="text-small text-text-muted">Checking whether you are signed in…</p>
      ) : session === null ? (
        <>
          {seat && refused ? <SeatRefused code={refused} onDone={done} /> : null}
          {seat && !refused ? <SeatWaiting who={who} /> : null}
          <SignIn configured={configured} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-small text-text-muted">
            <span className="min-w-0 break-all">
              Signed in as <span className="text-text">{session.user.email}</span>
            </span>
            <button type="button" className={btnSmallSecondary} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>

          {seat && refused ? <SeatRefused code={refused} onDone={done} /> : null}
          {seat && !refused ? (
            <SeatOffer
              code={seat}
              who={who}
              lookup={lookup}
              onAccepted={() => {
                setVersion((v) => v + 1);
              }}
              onDone={done}
            />
          ) : null}

          <MoneyRule />
          <Members />
          <Owed />
          <Seats version={version} />
          <Earnings key={version} />
        </>
      )}

      <p className="text-tiny text-text-muted">
        <Link href="/creator" className="underline decoration-dotted underline-offset-4">
          Back to your account
        </Link>
      </p>
    </div>
  );
}

/** Before sign-in: what the link is, so the sign-in form is not a wall between them and it. */
function SeatWaiting({ who }: { who: string | null }) {
  return (
    <div className={`${card} flex flex-col gap-3 p-6 sm:p-8`}>
      <h2 className="text-h4 font-light text-text">
        {who ? `${who} invited you to their team` : "You have been invited to a team"}
      </h2>
      <p className="text-small text-text-muted">
        Sign in with your email to take the seat. If you do not have a HOLD account yet, signing in makes one — there
        is nothing to install. We keep the invitation in this browser while you do.
      </p>
    </div>
  );
}

/** A seat the server already said no to, before anybody pressed anything. */
function SeatRefused({ code, onDone }: { code: string; onDone: () => void }) {
  return (
    <div className={`${card} flex flex-col gap-3 p-6 sm:p-8`}>
      <h2 className="text-h4 font-light text-text">This invitation cannot be taken</h2>
      <Notice>{describeTeamError(new CreatorApiError(code, 410))}</Notice>
      <div>
        <button type="button" className={btnSmallSecondary} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

/** Refusals of a seat that asking again will never change. */
const FINAL = new Set(["invite_not_found", "invite_expired", "invite_is_your_own", "already_on_this_team"]);

function SeatOffer({
  code,
  who,
  lookup,
  onAccepted,
  onDone,
}: {
  code: string;
  who: string | null;
  lookup: SeatLookup | null;
  onAccepted: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [taken, setTaken] = useState<TeamMember | null>(null);

  if (taken) {
    const theirs = creatorText(taken) ?? who;
    return (
      <div className={`${card} flex flex-col gap-3 p-6 sm:p-8`}>
        <h2 className="text-h4 font-light text-text">{theirs ? `You are on ${theirs}’s team` : "You are on the team"}</h2>
        <p className="text-small text-text-muted">
          They know you as <span className="text-text">{taken.label}</span>. {ROLE_TEXT[taken.role].yours}
        </p>
        <p className="text-small text-text-muted">
          The listings they put you on, and your share of each, are theirs to set. When a share is owed to you, they pay
          you themselves — HOLD never holds or sends that money.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/creator/team/work" className={btnPrimary}>
            What you have to deliver
          </Link>
          <button type="button" className={btnSmallSecondary} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const invite = lookup?.kind === "found" ? lookup.invite : null;

  return (
    <div className={`${card} flex flex-col gap-4 p-6 sm:p-8`}>
      <h2 className="text-h4 font-light text-text">
        {who ? `${who} invited you to their team` : "Somebody invited you to their team"}
      </h2>
      {invite ? (
        <p className="text-small text-text-muted">
          {ROLE_TEXT[invite.role].invited}
          {invite.expiresAt ? ` The invitation is open until ${dayText(invite.expiresAt)}.` : ""}
        </p>
      ) : null}
      <p className="text-small text-text-muted">
        Accepting puts you on their team. They choose which of their listings you work on and what share of each one
        you get. What you are owed is between you and them: they pay you themselves, and HOLD never holds, sends or
        guarantees that money.
      </p>
      {notice ? <Notice>{notice}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            void acceptSeat(code)
              .then(({ member }) => {
                forgetSeat();
                window.history.replaceState(null, "", "/creator/team");
                setTaken(member);
                onAccepted();
              })
              .catch((e) => {
                // A seat that is gone, spent or your own will not become
                // takeable by asking again, so it is not kept to be offered
                // back. A dropped connection is kept: that one is worth a retry.
                if (e instanceof CreatorApiError && FINAL.has(e.code)) forgetSeat();
                setNotice(describeTeamError(e));
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Accepting…" : "Accept"}
        </button>
        <button type="button" className={btnSmallSecondary} disabled={busy} onClick={onDone}>
          Not now
        </button>
      </div>
    </div>
  );
}

/** The rule, said once at the top where every other number on this page is read under it. */
function MoneyRule() {
  return (
    <div className="rounded-input border border-[color:var(--color-hairline)] px-4 py-3 text-small text-text-muted">
      <span className="text-text">We never move this money.</span> A brand still pays you directly, in one payment they
      sign, with our fee beside it. What you owe your team is your own bookkeeping, and you pay them yourself. We keep
      the note of who is owed what; we never send it, hold it or guarantee it.
    </div>
  );
}
