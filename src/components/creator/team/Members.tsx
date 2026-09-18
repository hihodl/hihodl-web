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

import { Field, Text } from "../listing/parts";
import { Loading, Notice, Section } from "../parts";

/** What each role may do, said to the creator choosing it and to the person who holds it. */
export const ROLE_TEXT: Record<TeamRole, { label: string; pill: string; body: string; yours: string; invited: string }> = {
  manager: {
    label: "Manager",
    pill: "Manager",
    body: "Publishes, edits, answers offers. Sees sales.",
    yours: "You publish, edit and answer offers on their listings.",
    invited: "Role: manager. You publish, edit and answer offers on their listings. Brands always pay them, never you.",
  },
  rep: {
    label: "Rep",
    pill: "Rep",
    body: "Delivers the work. Sees no money.",
    yours: "You upload proof and mark work delivered.",
    invited: "Role: rep. You upload proof and mark work delivered on their listings.",
  },
};

/** An invitation just made, with the address it was sent to, if any. */
interface Made {
  invitation: Invitation;
  email: string | null;
}

export function Members({ onChanged }: { onChanged?: () => void } = {}) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);

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
    <Section title={`Members${team ? ` · ${team.length} of ${TEAM_LIMITS.MAX_MEMBERS}` : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
        {/* The list scrolls inside itself on a wide screen, so the page stays one screen. */}
        <div className="flex min-w-0 flex-col gap-3 lg:max-h-[calc(var(--app-vh,100dvh)-236px)] lg:overflow-y-auto lg:pr-1">
          {team === null ? (
            <Loading what="your team" />
          ) : team.length === 0 ? (
            <p className="text-small text-text-muted">No members yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {team.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onRemoved={() => {
                    if (made?.invitation.member.id === m.id) setMade(null);
                    void load();
                    onChanged?.();
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* One thing at a time: the invitation just made, or the form for the next one. */}
          {made ? (
            <InvitationCard made={made} onClose={() => setMade(null)} />
          ) : (
            <InviteForm
              full={full}
              onInvited={(next) => {
                setMade(next);
                void load();
                onChanged?.();
              }}
            />
          )}
        </div>

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
    <li className={`${card} flex flex-col gap-3 px-4 py-3`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-small font-medium text-text">
          {member.label.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-small text-text">{member.label}</p>
          <p className="truncate text-tiny text-text-muted">{ROLE_TEXT[member.role].label}</p>
        </div>
        <span className={`${status.cls} hidden sm:inline-flex`}>{status.text}</span>
        {asking ? null : (
          <button
            type="button"
            className="shrink-0 text-tiny text-text-muted underline decoration-dotted underline-offset-4 hover:text-text"
            onClick={() => setAsking(true)}
          >
            {invited ? "Cancel" : "Remove"}
          </button>
        )}
      </div>
      <span className={`${status.cls} self-start sm:hidden`}>{status.text}</span>

      {asking ? (
        <div className="flex flex-col gap-3 rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3">
          <p className="text-small text-text">
            {invited ? `Cancel the invitation for ${member.label}?` : `Take ${member.label} off your team?`}
          </p>
          {invited ? null : <p className="text-small text-text-muted">What they are owed stays owed.</p>}
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
      ) : null}

      {notice ? <Notice>{notice}</Notice> : null}
    </li>
  );
}

function InviteForm({ full, onInvited }: { full: boolean; onInvited: (made: Made) => void }) {
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("rep");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmed = label.trim();
  const address = email.trim();
  // The server refuses a malformed address before anything is made (400); say so first.
  const badEmail = address !== "" && !EMAIL.test(address);

  return (
    <div className={`${card} flex flex-col gap-4 p-5`}>
      <h3 className="text-body text-text">Invite</h3>

      <Field label="Name" hint="Only you see this.">
        <Text value={label} onChange={setLabel} maxLength={TEAM_LIMITS.LABEL_MAX} placeholder="Maria, Singapore crew" />
      </Field>

      <Field label="Email" hint="Optional" problems={badEmail ? ["That is not an email address."] : []}>
        <Text type="email" value={email} onChange={setEmail} maxLength={254} placeholder="maria@studio.co" />
      </Field>

      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="Role" className="grid grid-cols-2 gap-2">
          {(["rep", "manager"] as const).map((r) => {
            const on = role === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRole(r)}
                className={`flex h-10 items-center justify-center rounded-[20px] border text-small transition-colors ${
                  on ? "border-amber/60 bg-amber/15 text-[#FFE2A1]" : "border-[color:var(--color-hairline-strong)] text-text-muted hover:bg-white/5"
                }`}
              >
                {ROLE_TEXT[r].label}
              </button>
            );
          })}
        </div>
        <p className="text-tiny text-text-muted">{ROLE_TEXT[role].body}</p>
      </div>

      <div>
        <button
          type="button"
          className={btnSmall}
          disabled={busy || full || !trimmed || badEmail}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            void inviteToTeam(trimmed, role, address || null)
              .then((inv) => {
                setLabel("");
                setEmail("");
                onInvited({ invitation: inv, email: address || null });
              })
              .catch((e) => setNotice(describeTeamError(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? (address ? "Sending…" : "Creating…") : address ? "Send invite" : "Create invite link"}
        </button>
        {full ? <p className="mt-2 text-tiny text-text-muted">Team full.</p> : null}
      </div>

      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/** The link as a button: the address itself is long and nobody reads it. */
function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div>
      <button
        type="button"
        className={btnSmall}
        onClick={() => {
          const done = navigator.clipboard?.writeText(url);
          if (done) void done.then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </div>
  );
}

/** Loose on purpose: the server has the last word, this only catches typos. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The one time the link exists anywhere a person can read it. */
function InvitationCard({ made, onClose }: { made: Made; onClose: () => void }) {
  const { invitation, email } = made;
  const { member, url } = invitation;
  const sent = !!email && invitation.emailed === true;
  return (
    <div className={`flex flex-col gap-4 rounded-card border p-5 ${sent ? "border-success/40 bg-success/10" : "border-amber/40 bg-amber/10"}`}>
      <p className="break-words text-body text-text">
        {sent ? `Invitation sent to ${email}` : email ? "Couldn’t email it, copy the link instead" : `Send this link to ${member.label}`}
      </p>
      <CopyLink url={url} />
      <p className="text-tiny text-text-muted">
        Shown once · one person · expires
        {member.inviteExpiresAt ? ` ${dayText(member.inviteExpiresAt)}` : ` in ${TEAM_LIMITS.INVITE_DAYS} days`}
      </p>
      <div>
        <button type="button" className={btnSmallSecondary} onClick={onClose}>
          {sent ? "Invite someone else" : "Done"}
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
