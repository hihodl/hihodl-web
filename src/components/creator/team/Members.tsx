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
import { t } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";

/** What each role may do, said to the creator choosing it and to the person who holds it (the app's roleName / roleLine). */
export function roleText(role: TeamRole): { label: string; pill: string; line: string; body: string; yours: string; invited: string } {
  return role === "manager"
    ? {
        label: t("creator.role.manager.label"),
        pill: t("creator.role.manager.label"),
        line: t("creator.role.manager.line"),
        body: t("creator.role.manager.body"),
        yours: t("creator.role.manager.yours"),
        invited: t("creator.role.manager.invited"),
      }
    : {
        label: t("creator.role.rep.label"),
        pill: t("creator.role.rep.label"),
        line: t("creator.role.rep.line"),
        body: t("creator.role.rep.body"),
        yours: t("creator.role.rep.yours"),
        invited: t("creator.role.rep.invited"),
      };
}

/** An invitation just made, with the address it was sent to, if any. */
interface Made {
  invitation: Invitation;
  email: string | null;
}

const fine = `text-[12px] leading-[17px] ${P.dim}`;

export function Members({ onChanged }: { onChanged?: () => void } = {}) {
  const t = useT();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { team: list } = await getTeam();
      setTeam(list);
    } catch (e) {
      setTeam((prev) => prev ?? []);
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
        <p className="text-[16px] font-strong tracking-[-0.2px] text-white">{t("creator.members.leadTitle")}</p>
        <Body dim>{t("creator.members.leadBody")}</Body>
        <Body dim>{t("creator.members.leadMoney")}</Body>
      </Card>

      <SectionLabel right={team ? <span className="text-[12px] font-strong tabular-nums text-white/55">{t("creator.members.countOf", { count: team.length, max: TEAM_LIMITS.MAX_MEMBERS })}</span> : null}>
        {t("creator.members.yourTeam")}
      </SectionLabel>
      {team === null ? (
        <Empty icon="hourglass-outline" title={t("common.loading")} />
      ) : list.length === 0 ? (
        <Empty icon="people-outline" title={t("creator.members.justYou")} body={t("creator.members.justYouBody")} />
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
              {t("creator.members.invite")}
            </button>
            {full ? (
              <HoldNotice>{t("creator.members.full", { max: TEAM_LIMITS.MAX_MEMBERS })}</HoldNotice>
            ) : (
              <p className={fine}>{t("creator.members.referralNote")}</p>
            )}
          </div>
        )
      ) : null}

      <Card>
        {(["manager", "rep"] as const).map((r, i) => (
          <div key={r} className={`flex flex-col gap-0.5 ${i > 0 ? "pt-2" : ""}`}>
            <p className="text-[14px] font-strong text-white">{roleText(r).label}</p>
            <p className={fine}>{roleText(r).line}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

/** memberStatusLine */
function statusLine(m: TeamMember, now = Date.now()): string {
  if (m.status === "active") return m.acceptedAt ? t("creator.members.joinedOn", { date: dayText(m.acceptedAt) }) : t("creator.members.joined");
  const expires = m.inviteExpiresAt ? new Date(m.inviteExpiresAt).getTime() : null;
  if (expires !== null && expires < now) return t("creator.members.inviteExpired");
  return m.inviteExpiresAt ? t("creator.members.invitedUntil", { date: dayText(m.inviteExpiresAt) }) : t("creator.members.invited");
}

/** TeamParts' MemberRow, with the app's "are you sure" drawn under it. */
function MemberRow({ member, onRemoved }: { member: TeamMember; onRemoved: () => void }) {
  const t = useT();
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
            <Tag label={roleText(member.role).label} tone={pending ? "dim" : "calm"} />
          </div>
          <p className="line-clamp-2 text-[12.5px] font-strong leading-[17px] text-white/55">{statusLine(member)}</p>
        </div>
        {asking ? null : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            aria-label={pending ? t("creator.members.withdrawFor", { name: member.label }) : t("creator.members.removeFrom", { name: member.label })}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.06] text-white/[0.62] transition-colors hover:bg-white/10 hover:text-white"
          >
            <Ion name={pending ? "close" : "person-remove-outline"} size={17} />
          </button>
        )}
      </div>

      {asking ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[15px] font-strong text-white">
            {pending ? t("creator.members.withdrawAsk", { name: member.label }) : t("creator.members.removeAsk", { name: member.label })}
          </p>
          <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
            {pending
              ? t("creator.members.withdrawBody")
              : t("creator.members.removeBody")}
          </p>
          <div className="flex gap-2">
            <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setAsking(false)}>
              {t("common.cancel")}
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
              {busy ? t("creator.members.working") : pending ? t("creator.members.withdraw") : t("common.remove")}
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
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("creator.members.whatWillTheyDo")} className="flex flex-col gap-2">
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
              <span className="text-[14.5px] font-bold text-white">{roleText(r).label}</span>
              <span className="text-[12.5px] leading-[17px] text-white/[0.62]">{roleText(r).line}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const sheetCls = "flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5";
const sheetTitle = "text-[18px] font-extrabold tracking-[-0.3px] text-white";

/** InviteSheet, first half: who, what they do, and (on the web) where to email the link. */
function InviteForm({ full, onCancel, onInvited }: { full: boolean; onCancel: () => void; onInvited: (made: Made) => void }) {
  const t = useT();
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
      <p className={sheetTitle}>{t("creator.members.invite")}</p>
      <Field label={t("creator.members.whoIsIt")} hint={t("creator.members.whoIsItHint")} htmlFor="invite-label">
        <input
          id="invite-label"
          className={inputCls}
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={TEAM_LIMITS.LABEL_MAX}
          placeholder={t("creator.members.labelPlaceholder")}
        />
      </Field>
      <Field
        label={t("creator.members.emailLabel")}
        hint={t("creator.members.emailHint")}
        error={badEmail ? t("creator.members.badEmail") : null}
        htmlFor="invite-email"
      >
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
      <p className="text-[12.5px] font-strong text-white/[0.62]">{t("creator.members.whatWillTheyDo")}</p>
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
        {busy
          ? address
            ? t("creator.members.sending")
            : t("creator.members.creating")
          : address
            ? t("creator.members.sendInvite")
            : t("creator.members.getLink")}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        {t("common.cancel")}
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
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
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
  const t = useT();
  return (
    <div className={sheetCls}>
      <p className={`${sheetTitle} break-words`}>
        {sent
          ? t("creator.members.sentTo", { email })
          : email
            ? t("creator.members.couldNotEmail")
            : t("creator.members.sendThisLink", { name: member.label })}
      </p>
      <HoldNotice icon="eye-off-outline">
        {t("creator.members.shownOnce")}
      </HoldNotice>
      <button
        type="button"
        onClick={() => copy("link", url)}
        className="flex min-h-[52px] items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] py-1.5 pl-3.5 pr-1.5 text-left transition-colors hover:bg-white/[0.09]"
      >
        <span className="line-clamp-2 flex-1 break-all text-[13px] font-strong text-white">{url.replace(/^https?:\/\//, "")}</span>
        <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-white/10 px-3 text-[13px] font-strong text-white">
          <Ion name={copied === "link" ? "checkmark" : "copy-outline"} size={14} />
          {copied === "link" ? t("common.copied") : t("common.copy")}
        </span>
      </button>
      <button type="button" onClick={() => copy("code", code)} className="flex items-center gap-2 px-0.5 text-left">
        <span className="text-[12px] font-strong text-white/55">{t("creator.members.justCode")}</span>
        <span className="flex-1 truncate text-[12px] tabular-nums text-white/[0.62]">{code}</span>
        <Ion name={copied === "code" ? "checkmark" : "copy-outline"} size={14} className="text-white/55" />
      </button>
      <p className={fine}>
        {member.inviteExpiresAt
          ? t("creator.members.ownLinkUntil", { date: dayText(member.inviteExpiresAt) })
          : t("creator.members.ownLinkDays", { days: TEAM_LIMITS.INVITE_DAYS })}
      </p>
      <button type="button" className={ctaSecondary} onClick={onClose}>
        {t("common.done")}
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
  const t = useT();
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
  if (seats === null) return <Empty icon="hourglass-outline" title={t("common.loading")} />;

  return (
    <div className="flex flex-col gap-2.5">
      {seats.length ? (
        <Card>
          {seats.map((s, i) => (
            <div key={s.id} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-[14px] font-strong text-white">{creatorText(s) ?? t("creator.members.aCreator")}</p>
                <p className={fine}>
                  {roleText(s.role).label} · {roleText(s.role).line}
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
