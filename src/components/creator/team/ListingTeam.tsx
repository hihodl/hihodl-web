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

import { ProgressBar, Tag } from "@/components/app/spaces/kit";
import { CreatorApiError } from "@/lib/creator/api";
import { assignToListing, getTeam, listingTeam, unassignFromListing } from "@/lib/creator/listings";
import { spacesPath } from "@/lib/app/paths";
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
import { Rich, useT } from "@/lib/app/i18n/react";

import { btnSmallGlass, Dropdown, Field, Text } from "../listing/parts";

/** The white plate, small: the action inside a row that moves on without taking money. */
const btnSmall =
  "inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[18px] bg-[#F1F5F9] px-3.5 text-[13px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/60";
const btnSmallSecondary = btnSmallGlass;
import { Loading, Notice, Section } from "../parts";
import { roleText } from "./Members";

/** The same sentence the server's refusal gets, for the same rule checked before sending. */
function shareSentence(code: string | null): string | null {
  return code ? describeTeamError(new CreatorApiError(code, 422)) : null;
}

export function ListingTeam({ spaceId }: { spaceId: string }) {
  const t = useT();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [hidden, setHidden] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, tm] = await Promise.all([listingTeam(spaceId), getTeam()]);
      setAssignments(a.assignments);
      setTeam(tm.team);
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
    <Section title={t("creator.listingTeam.title")}>
      {assignments === null ? (
        <Loading what={t("creator.listingTeam.loadingWhat")} />
      ) : (
        <div className="flex flex-col gap-3.5">
          <RoomLeft room={room} />

          {assignments.length > 0 ? (
            <ul className="flex flex-col gap-2">
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
            <p className="text-[14px] leading-5 text-white/[0.62]">
              <Rich
                k="creator.listingTeam.noTeam"
                tags={{
                  link: (c) => (
                    <Link href={spacesPath("/team")} className="text-white underline underline-offset-2">
                      {c}
                    </Link>
                  ),
                }}
              />
            </p>
          ) : free.length === 0 ? (
            <p className="text-[14px] leading-5 text-white/[0.62]">
              {t(assignments.length > 0 ? "creator.listingTeam.everyoneOn" : "creator.listingTeam.nobodyAccepted", { waiting })}
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
  const t = useT();
  const taken = TEAM_LIMITS.SHARE_TOTAL_MAX_BPS - room;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
        <span className="font-strong text-white">
          {taken === 0 ? t("creator.listingTeam.nothingGiven") : t("creator.listingTeam.given", { share: shareText(taken) })}
        </span>
        <span className="text-white/55">{t("creator.listingTeam.left", { share: shareText(room) })}</span>
      </div>
      {/* Width only ever says how much: the colour is the same amber at 10% and at 100%. */}
      <div aria-hidden>
        <ProgressBar value={taken / 10000} />
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
  const t = useT();
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
    <li className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-[11px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[14.5px] font-bold text-white">{assignment.label}</p>
          <p className="mt-0.5 text-[12.5px] text-white/55">{roleText(assignment.role).label}</p>
        </div>
        <Tag label={t("creator.listingTeam.ofWhatYouReceive", { share: shareText(assignment.shareBps) })} />
      </div>
      {assignment.note && !editing ? <p className="break-words text-[14px] leading-5 text-white/[0.62]">{assignment.note}</p> : null}

      {editing ? (
        <div className="flex flex-col gap-4">
          <Field
            label={t("creator.listingTeam.theirShare")}
            hint={t("creator.listingTeam.upTo", { share: shareText(roomForThem) })}
            problems={percent.trim() && problem ? [problem] : []}
          >
            <Percent value={percent} onChange={setPercent} />
          </Field>
          <Field label={t("creator.listingTeam.note")} hint={t("creator.listingTeam.noteHint")}>
            <Text value={note} onChange={setNote} maxLength={TEAM_LIMITS.NOTE_MAX} placeholder={t("creator.listingTeam.notePlaceholder")} />
          </Field>
          <p className="text-[12px] leading-4 text-white/55">{t("creator.listingTeam.fromNextSale")}</p>
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
              {busy ? t("common.saving") : t("common.save")}
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
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : asking ? (
        <div className="flex flex-col gap-2 rounded-[12px] bg-amber/[0.12] px-3 py-2.5">
          <p className="text-[13px] font-strong leading-[18px] text-amber">{t("creator.listingTeam.takeOffAsk", { name: assignment.label })}</p>
          <p className="text-[14px] leading-5 text-white/[0.62]">{t("creator.listingTeam.pastOwed")}</p>
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
              {busy ? t("creator.members.working") : t("creator.listingTeam.takeOff")}
            </button>
            <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => setAsking(false)}>
              {t("creator.listingTeam.keep")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmallSecondary} onClick={() => setEditing(true)}>
            {t("creator.listingTeam.changeShare")}
          </button>
          <button type="button" className={btnSmallSecondary} onClick={() => setAsking(true)}>
            {t("creator.listingTeam.takeOffListing")}
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
  const t = useT();
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
    <div className="flex flex-col gap-3.5 border-t border-white/[0.08] pt-3.5">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("creator.listingTeam.addTitle")}</h3>
      {room === 0 ? (
        <p className="text-[14px] leading-5 text-white/[0.62]">{t("creator.listingTeam.full")}</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
            <Field label={t("creator.listingTeam.who")}>
              <Dropdown
                value={chosen}
                onChange={setMemberId}
                options={free.map((m) => ({ value: m.id, label: `${m.label} · ${roleText(m.role).pill}` }))}
              />
            </Field>
            <Field
              label={t("creator.listingTeam.share")}
              hint={t("creator.listingTeam.upToLeft", { share: shareText(room) })}
              problems={percent.trim() && problem ? [problem] : []}
            >
              <Percent value={percent} onChange={setPercent} />
            </Field>
            <Field label={t("creator.listingTeam.note")} hint={t("creator.listingTeam.noteHint")}>
              <Text value={note} onChange={setNote} maxLength={TEAM_LIMITS.NOTE_MAX} placeholder={t("creator.listingTeam.notePlaceholder")} />
            </Field>
          </div>
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
              {busy ? t("common.saving") : t("common.add")}
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
        className="min-h-12 w-full rounded-[16px] border border-white/[0.12] bg-white/[0.06] py-3 pl-3.5 pr-10 text-[15.5px] text-white outline-none transition-colors placeholder:text-white/[0.28] focus:border-white/30"
        value={value}
        placeholder="20"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15.5px] text-white/55">%</span>
    </div>
  );
}
