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
 *
 * The screen is the app's Your team (hihodl-wallet app/(drawer)/(internal)/
 * ad-space/team.tsx with TeamParts): the lead card, the people in one card,
 * "Invite someone", what each role may do, then the way into the money and
 * the teams this person is on. The app's invite sheet and its "are you sure"
 * alert are drawn in place here.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { Body, Card, Divider, Empty, Field, inputCls, P, SectionLabel, Tag } from "@/components/app/spaces/kit";
import { getTeam, inviteToTeam, mySeats, removeFromTeam } from "@/lib/creator/listings";
import { describeTeamError } from "@/lib/creator/problems";
import { creatorText, dayText, TEAM_LIMITS, type Invitation, type TeamMember, type TeamRole } from "@/lib/creator/team";

/** What each role may do, said to the creator choosing it and to the person who holds it (the app's roleName / roleLine). */
export const ROLE_TEXT: Record<TeamRole, { label: string; pill: string; line: string; body: string; yours: string; invited: string }> = {
  manager: {
    label: "Manager",
    pill: "Manager",
    line: "Sells for you: publishes, edits and answers offers.",
    body: "Publishes, edits, answers offers. Sees sales.",
    yours: "You publish, edit and answer offers on their listings.",
    invited: "Role: manager. You publish, edit and answer offers on their listings. Brands always pay them, never you.",
  },
  rep: {
    label: "Rep",
    pill: "Rep",
    line: "Turns up and delivers: uploads proof and marks it done. Sees no prices and no money.",
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

const fine = `text-[12px] leading-[17px] ${P.dim}`;

export function Members({ onChanged }: { onChanged?: () => void } = {}) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [inviting, setInviting] = useState(false);

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
  // sortTeam: people on the team first, then the invitations waiting.
  const list = team ? [...team].sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active")) : [];

  return (
    <div className="flex flex-col gap-2.5">
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}

      <Card>
        <p className="text-[16px] font-strong tracking-[-0.2px] text-white">You sell. They turn up and do it.</p>
        <Body dim>Invite the people who work with you, then put them on a listing for a share of what you receive from it.</Body>
        <Body dim>
          Brands still pay you directly, in one payment, and HOLD never touches that money. What your team is owed is your own record: you pay them
          yourself.
        </Body>
      </Card>

      <SectionLabel right={team ? <span className="text-[12px] font-strong tabular-nums text-white/55">{`${team.length} of ${TEAM_LIMITS.MAX_MEMBERS}`}</span> : null}>
        Your team
      </SectionLabel>
      {team === null ? (
        <Empty icon="hourglass-outline" title="Loading…" />
      ) : list.length === 0 ? (
        <Empty icon="people-outline" title="Just you, for now" body="Invite a manager to sell for you, or a rep to turn up at the event and deliver." />
      ) : (
        <Card>
          {list.map((m, i) => (
            <div key={m.id} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <MemberRow
                member={m}
                onRemoved={() => {
                  if (made?.invitation.member.id === m.id) setMade(null);
                  void load();
                  onChanged?.();
                }}
              />
            </div>
          ))}
        </Card>
      )}

      {team ? (
        made ? (
          <InvitationCard
            made={made}
            onClose={() => {
              setMade(null);
              setInviting(false);
            }}
          />
        ) : inviting ? (
          <InviteForm
            full={full}
            onCancel={() => setInviting(false)}
            onInvited={(next) => {
              setMade(next);
              void load();
              onChanged?.();
            }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" className={ctaPrimary} disabled={full} onClick={() => setInviting(true)}>
              <Ion name="person-add-outline" size={18} />
              Invite someone
            </button>
            {full ? (
              <HoldNotice>Your team is full: {TEAM_LIMITS.MAX_MEMBERS} people, invitations included. Remove someone to invite another.</HoldNotice>
            ) : (
              <p className={fine}>Each invitation is your own HOLD invite link, so anyone new signs up as your referral.</p>
            )}
          </div>
        )
      ) : null}

      <Card>
        {(["manager", "rep"] as const).map((r, i) => (
          <div key={r} className={`flex flex-col gap-0.5 ${i > 0 ? "pt-2" : ""}`}>
            <p className="text-[14px] font-strong text-white">{ROLE_TEXT[r].label}</p>
            <p className={fine}>{ROLE_TEXT[r].line}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

/** memberStatusLine */
function statusLine(m: TeamMember, now = Date.now()): string {
  if (m.status === "active") return m.acceptedAt ? `Joined ${dayText(m.acceptedAt)}` : "Joined";
  const expires = m.inviteExpiresAt ? new Date(m.inviteExpiresAt).getTime() : null;
  if (expires !== null && expires < now) return "Invitation expired. Invite them again.";
  return m.inviteExpiresAt ? `Invited, hasn't accepted yet · link works until ${dayText(m.inviteExpiresAt)}` : "Invited, hasn't accepted yet";
}

/** TeamParts' MemberRow, with the app's "are you sure" drawn under it. */
function MemberRow({ member, onRemoved }: { member: TeamMember; onRemoved: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = member.status !== "active";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] text-white/[0.62] ${pending ? "bg-white/[0.04]" : "bg-white/[0.08]"}`}>
          <Ion name={pending ? "mail-outline" : "person-outline"} size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">{member.label}</p>
            <Tag label={ROLE_TEXT[member.role].label} tone={pending ? "dim" : "calm"} />
          </div>
          <p className="line-clamp-2 text-[12.5px] font-strong leading-[17px] text-white/55">{statusLine(member)}</p>
        </div>
        {asking ? null : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            aria-label={pending ? `Withdraw the invitation for ${member.label}` : `Remove ${member.label} from your team`}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.06] text-white/[0.62] transition-colors hover:bg-white/10 hover:text-white"
          >
            <Ion name={pending ? "close" : "person-remove-outline"} size={17} />
          </button>
        )}
      </div>

      {asking ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[15px] font-strong text-white">
            {pending ? `Withdraw the invitation for ${member.label}?` : `Remove ${member.label} from your team?`}
          </p>
          <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
            {pending
              ? "The link you sent stops working. You can invite them again any time."
              : "They come off every listing at once and can't act on your spaces any more. Anything they have already earned stays owed to them: removing somebody isn't how you stop owing them."}
          </p>
          <div className="flex gap-2">
            <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setAsking(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`${ctaPrimary} flex-1`}
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
              {busy ? "Working…" : pending ? "Withdraw" : "Remove"}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
    </div>
  );
}

/** TeamParts' RolePicker: a card per role, a round check, selecting changes a colour. */
function RolePicker({ value, onChange }: { value: TeamRole; onChange: (r: TeamRole) => void }) {
  return (
    <div role="radiogroup" aria-label="What will they do?" className="flex flex-col gap-2">
      {(["manager", "rep"] as const).map((r) => {
        const on = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r)}
            className={`flex items-center gap-3 rounded-[14px] border px-3 py-[11px] text-left transition-colors ${
              on ? "border-[#F1F5F9] bg-[#F1F5F9]/[0.12]" : "border-white/10 bg-transparent hover:bg-white/[0.04]"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] border ${on ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : "border-white/35"}`}
            >
              {on ? <Ion name="checkmark" size={13} /> : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14.5px] font-strong text-white">{ROLE_TEXT[r].label}</span>
              <span className="text-[12.5px] leading-[17px] text-white/[0.62]">{ROLE_TEXT[r].line}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const sheetCls = "flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5";
const sheetTitle = "text-[18px] font-strong tracking-[-0.3px] text-white";

/** InviteSheet, first half: who, what they do, and (on the web) where to email the link. */
function InviteForm({ full, onCancel, onInvited }: { full: boolean; onCancel: () => void; onInvited: (made: Made) => void }) {
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
    <div className={sheetCls}>
      <p className={sheetTitle}>Invite someone</p>
      <Field label="Who is it?" hint="A name you'll recognise. Only you see it." htmlFor="invite-label">
        <input
          id="invite-label"
          className={inputCls}
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={TEAM_LIMITS.LABEL_MAX}
          placeholder="Maria, the Lisbon crew…"
        />
      </Field>
      <Field label="Email (optional)" hint="We send them the link too." error={badEmail ? "That is not an email address." : null} htmlFor="invite-email">
        <input
          id="invite-email"
          type="email"
          className={`${inputCls} ${badEmail ? "border-amber" : ""}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          placeholder="maria@studio.co"
        />
      </Field>
      <p className="text-[12.5px] font-strong text-white/[0.62]">What will they do?</p>
      <RolePicker value={role} onChange={setRole} />
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <button
        type="button"
        className={ctaPrimary}
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
        {busy ? (address ? "Sending…" : "Creating…") : address ? "Send invite" : "Get their invite link"}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/** Loose on purpose: the server has the last word, this only catches typos. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useCopied() {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = (what: "link" | "code", text: string) => {
    const done = navigator.clipboard?.writeText(text);
    if (done) void done.then(() => setCopied(what), () => setCopied(null));
  };
  return { copied, copy };
}

/** InviteSheet, second half: the one time the link exists anywhere a person can read it. */
function InvitationCard({ made, onClose }: { made: Made; onClose: () => void }) {
  const { invitation, email } = made;
  const { member, url, code } = invitation;
  const sent = !!email && invitation.emailed === true;
  const { copied, copy } = useCopied();
  return (
    <div className={sheetCls}>
      <p className={`${sheetTitle} break-words`}>
        {sent ? `Invitation sent to ${email}` : email ? "Couldn’t email it, copy the link instead" : `Send ${member.label} this link`}
      </p>
      <HoldNotice icon="eye-off-outline">
        This link is shown once. We keep only a scrambled copy of its code, so we can&apos;t show it to you again. Copy or share it now; if it gets
        lost, invite them again.
      </HoldNotice>
      <button
        type="button"
        onClick={() => copy("link", url)}
        className="flex min-h-[52px] items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] py-1.5 pl-3.5 pr-1.5 text-left transition-colors hover:bg-white/[0.09]"
      >
        <span className="line-clamp-2 flex-1 break-all text-[13px] font-strong text-white">{url.replace(/^https?:\/\//, "")}</span>
        <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-white/10 px-3 text-[13px] font-strong text-white">
          <Ion name={copied === "link" ? "checkmark" : "copy-outline"} size={14} />
          {copied === "link" ? "Copied" : "Copy"}
        </span>
      </button>
      <button type="button" onClick={() => copy("code", code)} className="flex items-center gap-2 px-0.5 text-left">
        <span className="text-[12px] font-strong text-white/55">Just the code</span>
        <span className="flex-1 truncate text-[12px] tabular-nums text-white/[0.62]">{code}</span>
        <Ion name={copied === "code" ? "checkmark" : "copy-outline"} size={14} className="text-white/55" />
      </button>
      <p className={fine}>
        It&apos;s your own HOLD invite link. Somebody without an account signs up through it, so everyone you bring onto your team joins HOLD as your
        referral. Open until {member.inviteExpiresAt ? dayText(member.inviteExpiresAt) : `${TEAM_LIMITS.INVITE_DAYS} days from now`}.
      </p>
      <button type="button" className={ctaSecondary} onClick={onClose}>
        Done
      </button>
    </div>
  );
}

/**
 * The teams this person is on, for somebody who works for other creators:
 * the app's "Teams you're on" card. Whose team, never the label: that is what
 * the creator calls this person in private.
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
  if (seats === null) return <Empty icon="hourglass-outline" title="Loading…" />;

  return (
    <div className="flex flex-col gap-2.5">
      {seats.length ? (
        <Card>
          {seats.map((s, i) => (
            <div key={s.id} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-[14px] font-strong text-white">{creatorText(s) ?? "A creator on HOLD"}</p>
                <p className={fine}>
                  {ROLE_TEXT[s.role].label} · {ROLE_TEXT[s.role].line}
                </p>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
    </div>
  );
}
