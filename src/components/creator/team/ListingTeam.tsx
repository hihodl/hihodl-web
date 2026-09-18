/**
 * Who works this listing, and for what share of it.
 *
 * WHAT A SHARE IS A SHARE OF
 *
 * What the creator RECEIVES from each sale on this listing — never what the
 * sponsor paid. When the sponsor carries our fee the two differ, and a share
 * of the gross would have the creator paying their team out of money that was
 * ours. So every percentage on this card says "of what you receive".
 *
 * WHY THE ROOM LEFT IS ALWAYS ON SCREEN
 *
 * Everybody on one listing together may reach 100% and never pass it: past
 * that the creator would owe more than each sale pays them. The obvious way to
 * get there is three people given 40% each on three separate days, so the card
 * says what is left before anybody types, and an edit is measured against
 * everybody ELSE on the listing, the way the server measures it.
 *
 * WHO SEES THIS CARD
 *
 * The owner alone. The server answers `not_found` to anybody else — a manager
 * may sell the listing and still not see what anybody on it takes — and this
 * card then renders nothing rather than a refusal about a card they were never
 * meant to see.
 *
 * WHEN A SHARE STARTS COUNTING
 *
 * From the moment somebody is put on the listing. A sale that was paid before
 * that owes them nothing, and taking them off keeps what they were already
 * owed. Both are said where the buttons are.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { btnSmall, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { CreatorApiError } from "@/lib/creator/api";
import { assignToListing, getTeam, listingTeam, unassignFromListing } from "@/lib/creator/listings";
import { describeTeamError } from "@/lib/creator/problems";
import {
  bpsFromPercent,
  percentFromBps,
  roomLeftBps,
  shareProblem,
  shareText,
  TEAM_LIMITS,
  type Assignment,
  type TeamMember,
} from "@/lib/creator/team";

import { Dropdown, Field, Text } from "../listing/parts";
import { Loading, Notice, Section } from "../parts";
import { ROLE_TEXT } from "./Members";

/** The same sentence the server's refusal gets, for the same rule checked before sending. */
function shareSentence(code: string | null): string | null {
  return code ? describeTeamError(new CreatorApiError(code, 422)) : null;
}

export function ListingTeam({ spaceId }: { spaceId: string }) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [hidden, setHidden] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([listingTeam(spaceId), getTeam()]);
      setAssignments(a.assignments);
      setTeam(t.team);
      setNotice(null);
    } catch (e) {
      if (e instanceof CreatorApiError && e.code === "not_found") {
        setHidden(true);
        return;
      }
      setAssignments((x) => x ?? []);
      setNotice(describeTeamError(e));
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (hidden) return null;

  const room = assignments ? roomLeftBps(assignments) : TEAM_LIMITS.SHARE_TOTAL_MAX_BPS;
  const onIt = new Set((assignments ?? []).map((a) => a.memberId));
  const free = team.filter((m) => m.status === "active" && !onIt.has(m.id));
  const waiting = team.filter((m) => m.status === "invited").length;

  return (
    <Section label="Who works it" title="Your team on this listing">
      {assignments === null ? (
        <Loading what="who is on this listing" />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-body text-text-muted">
            A share is a percentage of what you receive from each sale on this listing, counted from the day you put
            somebody on it. It is a note of what you owe them: brands still pay you directly, and you pay your team
            yourself.
          </p>

          <RoomLeft room={room} />

          {assignments.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {assignments.map((a) => (
                <AssignmentRow
                  key={a.memberId}
                  spaceId={spaceId}
                  assignment={a}
                  all={assignments}
                  onChanged={() => void load()}
                />
              ))}
            </ul>
          ) : null}

          {team.length === 0 ? (
            <p className="text-small text-text-muted">
              Nobody on your team yet.{" "}
              <Link href="/creator/team" className="text-text underline decoration-dotted underline-offset-4">
                Invite somebody
              </Link>{" "}
              and put them on this listing once they have accepted.
            </p>
          ) : free.length === 0 ? (
            <p className="text-small text-text-muted">
              {assignments.length > 0 ? "Everybody on your team who has accepted is on this listing." : "Nobody on your team has accepted yet."}
              {waiting > 0
                ? ` ${waiting} ${waiting === 1 ? "invitation is" : "invitations are"} still waiting — somebody can be put on a listing once they have accepted.`
                : ""}
            </p>
          ) : (
            <AddForm spaceId={spaceId} free={free} assignments={assignments} room={room} onChanged={() => void load()} />
          )}

          {notice ? <Notice>{notice}</Notice> : null}
        </div>
      )}
    </Section>
  );
}

function RoomLeft({ room }: { room: number }) {
  const taken = TEAM_LIMITS.SHARE_TOTAL_MAX_BPS - room;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-small">
        <span className="text-text">
          {taken === 0 ? "Nothing given away yet" : `${shareText(taken)} given to your team`}
        </span>
        <span className="text-text-muted">{shareText(room)} left</span>
      </div>
      {/* Width only ever says how much: the colour is the same amber at 10% and at 100%. */}
      <div className="h-2 w-full overflow-hidden rounded-[4px] bg-white/[0.06]" aria-hidden>
        <div className="h-full rounded-[4px] bg-amber" style={{ width: `${taken / 100}%` }} />
      </div>
    </div>
  );
}

function AssignmentRow({
  spaceId,
  assignment,
  all,
  onChanged,
}: {
  spaceId: string;
  assignment: Assignment;
  all: readonly Assignment[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [percent, setPercent] = useState(percentFromBps(assignment.shareBps));
  const [note, setNote] = useState(assignment.note ?? "");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const bps = bpsFromPercent(percent);
  const problem = shareSentence(shareProblem(bps, all, assignment.memberId));
  const roomForThem = roomLeftBps(all, assignment.memberId);

  return (
    <li className={`${card} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-body text-text">{assignment.label}</p>
          <p className="mt-1 text-tiny text-text-muted">{ROLE_TEXT[assignment.role].label}</p>
        </div>
        <span className={pill.neutral}>{shareText(assignment.shareBps)} of what you receive</span>
      </div>
      {assignment.note && !editing ? <p className="break-words text-small text-text-muted">{assignment.note}</p> : null}

      {editing ? (
        <div className="flex flex-col gap-4">
          <Field
            label="Their share"
            hint={`Up to ${shareText(roomForThem)} — what is left once everybody else on this listing has theirs.`}
            problems={percent.trim() && problem ? [problem] : []}
          >
            <Percent value={percent} onChange={setPercent} />
          </Field>
          <Field label="A note for yourself" hint="Optional. What they do on this one, say.">
            <Text value={note} onChange={setNote} maxLength={TEAM_LIMITS.NOTE_MAX} placeholder="Runs the booth both days" />
          </Field>
          <p className="text-tiny text-text-muted">
            A new share counts from sales made after you save it. What sales before now already owe them does not change.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSmall}
              disabled={busy || bps === null || problem !== null}
              onClick={() => {
                setBusy(true);
                setNotice(null);
                void assignToListing(spaceId, assignment.memberId, bps!, note)
                  .then(() => {
                    setEditing(false);
                    onChanged();
                  })
                  .catch((e) => setNotice(describeTeamError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={btnSmallSecondary}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setPercent(percentFromBps(assignment.shareBps));
                setNote(assignment.note ?? "");
                setNotice(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : asking ? (
        <div className="flex flex-col gap-3 rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3">
          <p className="text-small text-text">Take {assignment.label} off this listing?</p>
          <p className="text-small text-text-muted">
            Sales from now on owe them nothing. What earlier sales already owe them stays owed, and they stay on your team.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSmall}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setNotice(null);
                void unassignFromListing(spaceId, assignment.memberId)
                  .then(onChanged)
                  .catch((e) => setNotice(describeTeamError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Working…" : "Take them off"}
            </button>
            <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => setAsking(false)}>
              Keep them
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmallSecondary} onClick={() => setEditing(true)}>
            Change share
          </button>
          <button type="button" className={btnSmallSecondary} onClick={() => setAsking(true)}>
            Take off this listing
          </button>
        </div>
      )}

      {notice ? <Notice>{notice}</Notice> : null}
    </li>
  );
}

function AddForm({
  spaceId,
  free,
  assignments,
  room,
  onChanged,
}: {
  spaceId: string;
  free: TeamMember[];
  assignments: readonly Assignment[];
  room: number;
  onChanged: () => void;
}) {
  const [memberId, setMemberId] = useState(free[0].id);
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The list shrinks as people are added; never hold on to somebody no longer in it.
  const chosen = free.some((m) => m.id === memberId) ? memberId : free[0].id;
  const bps = bpsFromPercent(percent);
  const problem = shareSentence(shareProblem(bps, assignments, chosen));

  return (
    <div className="flex flex-col gap-5 border-t border-[color:var(--color-hairline)] pt-6">
      <h3 className="text-body text-text">Put somebody on this listing</h3>
      {room === 0 ? (
        <p className="text-small text-text-muted">
          All 100% of what you receive is already shared out on this listing. Lower somebody’s share to make room.
        </p>
      ) : (
        <>
          <Field label="Who">
            <Dropdown
              value={chosen}
              onChange={setMemberId}
              options={free.map((m) => ({ value: m.id, label: `${m.label} · ${ROLE_TEXT[m.role].pill}` }))}
            />
          </Field>
          <Field
            label="Their share"
            hint={`A percentage of what you receive from each sale. Up to ${shareText(room)} is left on this listing.`}
            problems={percent.trim() && problem ? [problem] : []}
          >
            <Percent value={percent} onChange={setPercent} />
          </Field>
          <Field label="A note for yourself" hint="Optional. What they do on this one, say.">
            <Text value={note} onChange={setNote} maxLength={TEAM_LIMITS.NOTE_MAX} placeholder="Runs the booth both days" />
          </Field>
          <div>
            <button
              type="button"
              className={btnSmall}
              disabled={busy || bps === null || problem !== null}
              onClick={() => {
                setBusy(true);
                setNotice(null);
                void assignToListing(spaceId, chosen, bps!, note)
                  .then(() => {
                    setPercent("");
                    setNote("");
                    onChanged();
                  })
                  .catch((e) => setNotice(describeTeamError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Saving…" : "Put them on it"}
            </button>
          </div>
        </>
      )}
      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/** A percentage, typed. `inputMode="decimal"` for the same reason as money: no stray scroll changes it. */
function Percent({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className="w-full rounded-input border border-[color:var(--color-hairline-strong)] bg-white/[0.04] py-3 pl-4 pr-10 text-body text-text outline-none transition-colors duration-180 placeholder:text-text-faint focus:border-amber/60"
        value={value}
        placeholder="20"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-body text-text-faint">%</span>
    </div>
  );
}
