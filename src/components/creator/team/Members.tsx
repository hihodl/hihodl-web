/**
 * Who is on the team, how they got there, and how they come off it.
 *
 * WHY A PENDING INVITATION IS A ROW LIKE ANY OTHER
 *
 * The server writes the seat, with its name and its role, the moment the
 * creator makes the invitation — before anybody has accepted. So an invitation
 * nobody took is something the creator can see, recognise and cancel, not a
 * link that went out into the world and was never heard of again.
 *
 * WHY THE LINK IS SHOWN ONCE, AND SAYS SO
 *
 * The server keeps only a hash of the code in it, so nobody can read it back:
 * not the creator, not us. A page that showed it and then quietly forgot it
 * would leave a creator hunting for a link that no longer exists anywhere, so
 * the card holding it says, beside the copy button, that it will not be shown
 * again and what to do if it is lost.
 *
 * WHAT REMOVING SOMEBODY DOES, AND WHAT IT DOES NOT
 *
 * It takes them off every listing at once and they stop seeing any of them. It
 * does NOT cancel what they are already owed: the sales they worked were made,
 * and removing somebody is not how a creator stops owing them. The button asks
 * twice and says that in the asking.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { btnSmall, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { getTeam, inviteToTeam, mySeats, removeFromTeam } from "@/lib/creator/listings";
import { spacesPath } from "@/lib/app/paths";
import { describeTeamError } from "@/lib/creator/problems";
import { creatorText, dayText, TEAM_LIMITS, type Invitation, type TeamMember, type TeamRole } from "@/lib/creator/team";

import { Choice, Field, Text } from "../listing/parts";
import { Address, Loading, Notice, Section } from "../parts";

/** What each role may do, said to the creator choosing it and to the person who holds it. */
export const ROLE_TEXT: Record<TeamRole, { label: string; pill: string; body: string; yours: string; invited: string }> = {
  manager: {
    label: "Manager",
    pill: "Manager",
    body: "Publishes, edits and answers offers on their listings. Sees sales. Can’t change the team or pay anyone.",
    yours: "You publish, edit and answer offers on their listings.",
    invited: "Role: manager. You publish, edit and answer offers on their listings. Brands always pay them, never you.",
  },
  rep: {
    label: "Rep",
    pill: "Rep",
    body: "Uploads proof and marks work delivered. Sees no prices or money.",
    yours: "You upload proof and mark work delivered.",
    invited: "Role: rep. You upload proof and mark work delivered on their listings.",
  },
};

export function Members() {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const load = useCallback(async () => {
    try {
      const { team: list } = await getTeam();
      setTeam(list);
    } catch (e) {
      setTeam((t) => t ?? []);
      setNotice(describeTeamError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const full = (team?.length ?? 0) >= TEAM_LIMITS.MAX_MEMBERS;

  return (
    <Section label="Your team" title="Members">
      <div className="flex flex-col gap-6">
        {team === null ? (
          <Loading what="your team" />
        ) : team.length === 0 ? (
          <p className="text-small text-text-muted">No members yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {team.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                onRemoved={() => {
                  if (invitation?.member.id === m.id) setInvitation(null);
                  void load();
                }}
              />
            ))}
          </ul>
        )}

        {invitation ? <InvitationCard invitation={invitation} onClose={() => setInvitation(null)} /> : null}

        <InviteForm
          full={full}
          count={team?.length ?? 0}
          onInvited={(inv) => {
            setInvitation(inv);
            void load();
          }}
        />

        {notice ? <Notice>{notice}</Notice> : null}
      </div>
    </Section>
  );
}

function statusOf(m: TeamMember, now = Date.now()): { cls: string; text: string } {
  if (m.status === "active") {
    return { cls: pill.done, text: m.acceptedAt ? `On your team since ${dayText(m.acceptedAt)}` : "On your team" };
  }
  const expires = m.inviteExpiresAt ? new Date(m.inviteExpiresAt).getTime() : null;
  if (expires !== null && expires < now) return { cls: pill.neutral, text: "Invitation ran out" };
  return {
    cls: pill.attention,
    text: m.inviteExpiresAt ? `Invited · open until ${dayText(m.inviteExpiresAt)}` : "Invited",
  };
}

function MemberRow({ member, onRemoved }: { member: TeamMember; onRemoved: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = statusOf(member);
  const invited = member.status !== "active";

  return (
    <li className={`${card} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-body text-text">{member.label}</p>
          <p className="mt-1 text-tiny text-text-muted">{ROLE_TEXT[member.role].label}</p>
        </div>
        <span className={status.cls}>{status.text}</span>
      </div>

      {asking ? (
        <div className="flex flex-col gap-3 rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3">
          <p className="text-small text-text">
            {invited
              ? `Cancel the invitation for ${member.label}? The link you sent stops working.`
              : `Take ${member.label} off your team?`}
          </p>
          {invited ? null : (
            <p className="text-small text-text-muted">
              They come off every listing at once and stop seeing all of them. Anything they are already owed stays
              owed: removing somebody is not how you stop owing them.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSmall}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setNotice(null);
                void removeFromTeam(member.id)
                  .then(onRemoved)
                  .catch((e) => setNotice(describeTeamError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Working…" : invited ? "Cancel it" : "Take them off"}
            </button>
            <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => setAsking(false)}>
              Keep them
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className={btnSmallSecondary} onClick={() => setAsking(true)}>
            {invited ? "Cancel invitation" : "Remove"}
          </button>
        </div>
      )}

      {notice ? <Notice>{notice}</Notice> : null}
    </li>
  );
}

function InviteForm({
  full,
  count,
  onInvited,
}: {
  full: boolean;
  count: number;
  onInvited: (inv: Invitation) => void;
}) {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<TeamRole>("rep");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmed = label.trim();

  return (
    <div className="flex flex-col gap-5 border-t border-[color:var(--color-hairline)] pt-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-body text-text">Invite</h3>
      </div>

      <Field label="Name" hint="Only you see this.">
        <Text value={label} onChange={setLabel} maxLength={TEAM_LIMITS.LABEL_MAX} placeholder="Maria, Singapore crew" />
      </Field>

      <Field label="Role">
        <Choice
          name="team-role"
          value={role}
          onChange={setRole}
          options={(["rep", "manager"] as const).map((r) => ({
            value: r,
            label: ROLE_TEXT[r].label,
            body: ROLE_TEXT[r].body,
          }))}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div>
          <button
            type="button"
            className={btnSmall}
            disabled={busy || full || !trimmed}
            onClick={() => {
              setBusy(true);
              setNotice(null);
              void inviteToTeam(trimmed, role)
                .then((inv) => {
                  setLabel("");
                  onInvited(inv);
                })
                .catch((e) => setNotice(describeTeamError(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Creating…" : "Create invite link"}
          </button>
        </div>
        <p className="text-tiny text-text-muted">
          {full
            ? `Team full: ${TEAM_LIMITS.MAX_MEMBERS} of ${TEAM_LIMITS.MAX_MEMBERS}, invitations included.`
            : `${count} of ${TEAM_LIMITS.MAX_MEMBERS} seats used`}
        </p>
      </div>

      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/** The one time the link exists anywhere a person can read it. */
function InvitationCard({ invitation, onClose }: { invitation: Invitation; onClose: () => void }) {
  const { member, url } = invitation;
  return (
    <div className="flex flex-col gap-4 rounded-card border border-amber/40 bg-amber/10 p-5">
      <p className="text-body text-text">Send this link to {member.label}</p>
      <Address value={url} />
      <p className="text-small text-text">Shown once. Works once, for one person.</p>
      <p className="text-small text-text-muted">
        Expires
        {member.inviteExpiresAt ? ` ${dayText(member.inviteExpiresAt)}` : ` in ${TEAM_LIMITS.INVITE_DAYS} days`}.
      </p>
      <div>
        <button type="button" className={btnSmallSecondary} onClick={onClose}>
          I have sent it
        </button>
      </div>
    </div>
  );
}

/**
 * The teams this person is on, for somebody who works for other creators.
 *
 * Each row says whose team it is — the creator's X account, from the server —
 * what that creator calls them, and what they may do, and leads to the one
 * screen somebody on a team needs: what they have to deliver.
 */
export function Seats({ version }: { version: number }) {
  const [seats, setSeats] = useState<TeamMember[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void mySeats()
      .then(({ seats: list }) => {
        if (alive) setSeats(list);
      })
      .catch((e) => {
        if (!alive) return;
        setSeats([]);
        setNotice(describeTeamError(e));
      });
    return () => {
      alive = false;
    };
  }, [version]);

  if (seats !== null && seats.length === 0 && !notice) return null;

  return (
    <Section label="Working for others" title="Teams you’re on">
      {seats === null ? (
        <Loading what="the teams you are on" />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {seats.map((s) => (
              <li key={s.id} className={`${card} flex flex-col gap-2 p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-body text-text">
                    {creatorText(s) ? `${creatorText(s)}’s team` : "A creator’s team"}
                  </p>
                  <span className={pill.neutral}>{ROLE_TEXT[s.role].pill}</span>
                </div>
                <p className="text-tiny text-text-muted">
                  They know you as <span className="text-text">{s.label}</span>
                  {s.acceptedAt ? ` · since ${dayText(s.acceptedAt)}` : ""}
                </p>
                <div>
                  <Link href={spacesPath("/deliveries")} className={btnSmallSecondary}>
                    Deliveries
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {notice ? <Notice>{notice}</Notice> : null}
        </div>
      )}
    </Section>
  );
}
