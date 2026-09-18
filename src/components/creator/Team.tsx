/**
 * Taking a seat on a creator's team, from the invitation link.
 *
 * Rendered on its own, outside the product shell: the person holding the link
 * may have no HOLD account yet, so the invitation and the sign-in sit side by
 * side, and signing in is what makes the account.
 *
 * WE NEVER MOVE THIS MONEY
 *
 * Said on the card, because accepting puts a person next to amounts. The
 * sponsor's payment is one transaction the sponsor signs, paying the creator's
 * own address; what a member is owed is the creator's own bookkeeping, and the
 * creator pays it themselves.
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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { btnPrimary, btnSmallSecondary } from "@/components/ad-space/ui";
import { useHref } from "@/components/app/base";
import { glass } from "@/components/app/ui";
import { useRefreshAll } from "@/lib/app/spaces-data";
import { Wordmark } from "@/components/site/Wordmark";
import { CreatorApiError } from "@/lib/creator/api";
import { acceptSeat } from "@/lib/creator/listings";
import { describeTeamError } from "@/lib/creator/problems";
import { useCreatorSession } from "@/lib/creator/session";
import { creatorText, dayText, forgetSeat, rememberSeat, type SeatLookup, type TeamMember } from "@/lib/creator/team";

import { Notice } from "./parts";
import { SignIn } from "./SignIn";
import { ROLE_TEXT } from "./team/Members";

interface Props {
  /** The seat code from the link, already checked for shape. */
  seat: string;
  /** What the server said about that seat before anybody signed in. */
  lookup: SeatLookup;
}

export function SeatInvitation({ seat, lookup }: Props) {
  const { session, configured } = useCreatorSession();
  const router = useRouter();
  const href = useHref();

  useEffect(() => {
    // A seat that is gone or ran out is not worth offering back later; any
    // other is kept in this browser until it is answered, in case sign-in
    // happens through the email link and lands without it.
    if (lookup.kind === "refused") forgetSeat();
    else rememberSeat(seat);
  }, [seat, lookup]);

  const done = () => {
    forgetSeat();
    // The seat is a one-time credential: once answered it has no business in
    // the address bar or in a link somebody copies from it.
    router.replace(href());
  };

  const who = lookup.kind === "found" ? creatorText(lookup.invite) : null;
  const refused = lookup.kind === "refused" ? lookup.code : null;

  return (
    <div className={`${glass} flex w-full max-w-[480px] flex-col gap-6 p-6 sm:p-8`}>
      <div className="flex items-center gap-2.5">
        <Wordmark className="h-5 w-auto text-text" />
        <span className="h-4 w-px bg-white/20" aria-hidden />
        <span className="text-body font-medium text-amber">Spaces</span>
      </div>

      {refused ? (
        <SeatRefused code={refused} onDone={done} />
      ) : session === undefined ? null : session === null ? (
        <>
          <Invited who={who} lookup={lookup} />
          <div className="border-t border-white/10 pt-6">
            <SignIn configured={configured} />
          </div>
        </>
      ) : (
        <SeatOffer code={seat} who={who} lookup={lookup} onDone={done} />
      )}
    </div>
  );
}

function Invited({ who, lookup }: { who: string | null; lookup: SeatLookup }) {
  const invite = lookup.kind === "found" ? lookup.invite : null;
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h4 font-light text-text">{who ? `${who} invited you to their team` : "Team invitation"}</h1>
      {invite ? (
        <p className="text-small text-text-muted">
          {ROLE_TEXT[invite.role].invited}
          {invite.expiresAt ? ` Open until ${dayText(invite.expiresAt)}.` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** A seat the server already said no to, before anybody pressed anything. */
function SeatRefused({ code, onDone }: { code: string; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h4 font-light text-text">Invitation unavailable</h1>
      <Notice>{describeTeamError(new CreatorApiError(code, 410))}</Notice>
      <div>
        <button type="button" className={btnSmallSecondary} onClick={onDone}>
          Open Spaces
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
  onDone,
}: {
  code: string;
  who: string | null;
  lookup: SeatLookup;
  onDone: () => void;
}) {
  const href = useHref();
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [taken, setTaken] = useState<TeamMember | null>(null);

  if (taken) {
    const theirs = creatorText(taken) ?? who;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h4 font-light text-text">{theirs ? `You’re on ${theirs}’s team` : "You’re on the team"}</h1>
        <p className="text-small text-text-muted">
          As <span className="text-text">{taken.label}</span> · {ROLE_TEXT[taken.role].label}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={href("/deliveries")} className={btnPrimary} onClick={() => forgetSeat()}>
            Deliveries
          </Link>
          <button type="button" className={btnSmallSecondary} onClick={onDone}>
            Open Spaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Invited who={who} lookup={lookup} />
      <p className="text-tiny text-text-muted">The creator pays your share. HOLD never moves that money.</p>
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
                void refresh();
                setTaken(member);
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
