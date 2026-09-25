"use client";

/**
 * The pieces of a crew both places use: Spaces › Crew (CrewScreen) and a
 * listing's "Sell with other creators" (creator/crew/ListingPackage). One set,
 * so a person, a share and an invite link read the same wherever they appear.
 */

import { useEffect, useMemo, useState } from "react";

import { ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { searchCreators, type HoldCreatorHit } from "@/lib/creator/analytics";
import {
  addCreator,
  blockerText,
  bpsFromPct,
  CREW_LIMITS,
  describeCrewError,
  inviteByLink,
  pctText,
  removeMember,
  shareOk,
  updateMember,
  whoText,
  type Crew,
  type CrewMember,
} from "@/lib/creator/crew";
import { packageBlockers, suggestShareBps } from "@/lib/creator/crew-package";
import { useT } from "@/lib/app/i18n/react";

import { Card, Divider, Field, inputCls, P, Tag } from "./kit";

export const fine = `text-[12px] leading-[17px] ${P.dim}`;
export const sheetCls = "flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5";
export const sheetTitle = "text-[18px] font-extrabold tracking-[-0.3px] text-white";

export function Terms({ service, share }: { service: string; share: string }) {
  const t = useT();
  return (
    <div className="flex items-end justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[12px] font-strong text-white/55">{t("spaces.crew.youBring")}</p>
        <p className="text-[15px] font-strong text-white">{service}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <p className="text-[12px] font-strong text-white/55">{t("spaces.crew.youGet")}</p>
        <p className="text-[22px] font-extrabold tabular-nums tracking-[-0.4px] text-white">{share}</p>
      </div>
    </div>
  );
}

export function PaidLine() {
  const t = useT();
  return <p className={fine}>{t("spaces.crew.paidLine")}</p>;
}

/** The people in a crew, read-only: who, what they bring, their share. */
export function Roster({ members }: { members: CrewMember[] }) {
  return (
    <Card>
      {members.map((m, i) => (
        <div key={m.id} className="flex flex-col gap-2.5">
          {i > 0 ? <Divider /> : null}
          <PersonLine member={m} />
        </div>
      ))}
    </Card>
  );
}

export function PersonLine({ member, right }: { member: CrewMember; right?: React.ReactNode }) {
  const t = useT();
  const blocker = packageBlockers([member])[0]?.reason ?? null;
  return (
    <div className="flex items-center gap-3">
      <Avatar member={member} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">
            {member.byLink ? t("spaces.crew.invitedByLink") : whoText(member)}
          </p>
          {member.isLead ? <Tag label={t("spaces.crew.lead")} /> : null}
          {blocker ? <Tag label={blockerText(blocker)} tone={blocker === "invited" ? "dim" : "caution"} /> : null}
        </div>
        <p className="line-clamp-2 text-[12.5px] font-strong leading-[17px] text-white/55">{member.service}</p>
      </div>
      {right ?? <p className="shrink-0 text-[15px] font-extrabold tabular-nums text-white">{member.share}</p>}
    </div>
  );
}

export function Avatar({ member }: { member: CrewMember }) {
  if (member.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.avatarUrl} alt="" className="h-[34px] w-[34px] shrink-0 rounded-[17px] object-cover" />;
  }
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.08] text-white/[0.62]">
      <Ion name={member.byLink ? "mail-outline" : "person-outline"} size={16} />
    </span>
  );
}

/** One member, for the lead: their share can be changed and they can be taken off. */
export function EditableMember({
  crew,
  member,
  othersBps,
  onChanged,
}: {
  crew: Crew;
  member: CrewMember;
  othersBps: number;
  onChanged: (c: Crew) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(String(member.shareBps / 100));
  const [service, setService] = useState(member.service);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bps = bpsFromPct(pct);
  const left = bps === null ? null : 10_000 - (othersBps - member.shareBps + bps);

  if (member.isLead) return <PersonLine member={member} />;

  const run = (p: Promise<{ crew: Crew }>) => {
    setBusy(true);
    setNotice(null);
    void p
      .then(({ crew: next }) => {
        setEditing(false);
        setAsking(false);
        onChanged(next);
      })
      .catch((e) => setNotice(describeCrewError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <PersonLine
        member={member}
        right={
          <div className="flex shrink-0 items-center gap-1.5">
            <p className="text-[15px] font-extrabold tabular-nums text-white">{member.share}</p>
            {editing || asking ? null : (
              <>
                <IconButton label={t("spaces.crew.changeShare", { who: whoText(member) })} icon="create-outline" onClick={() => setEditing(true)} />
                <IconButton label={t("spaces.crew.takeOffLabel", { who: whoText(member) })} icon="close" onClick={() => setAsking(true)} />
              </>
            )}
          </div>
        }
      />
      {editing ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
          <Field label={t("spaces.crew.theyBring")} htmlFor={`svc-${member.id}`}>
            <input id={`svc-${member.id}`} className={inputCls} value={service} maxLength={CREW_LIMITS.SERVICE_MAX} onChange={(e) => setService(e.target.value)} />
          </Field>
          <Field
            label={t("spaces.crew.theirShare")}
            htmlFor={`pct-${member.id}`}
            hint={left !== null && left >= 0 ? t("spaces.crew.youKeep", { pct: pctText(left) }) : undefined}
            error={left !== null && left < 0 ? t("spaces.crew.over100") : null}
          >
            <input id={`pct-${member.id}`} inputMode="decimal" className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} />
          </Field>
          <p className={fine}>{t("spaces.crew.newShareNote")}</p>
          {notice ? <HoldNotice>{notice}</HoldNotice> : null}
          <div className="flex gap-2">
            <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className={`${ctaPrimary} flex-1`}
              disabled={busy || bps === null || (left ?? -1) < 0 || !service.trim()}
              onClick={() =>
                run(
                  updateMember(crew.id, member.id, {
                    ...(service.trim() !== member.service ? { service: service.trim() } : {}),
                    ...(bps !== member.shareBps && bps !== null ? { shareBps: bps } : {}),
                  }),
                )
              }
            >
              {busy ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      ) : null}
      {asking ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[15px] font-strong text-white">
            {member.status === "invited" ? t("spaces.crew.withdrawAsk") : t("spaces.crew.takeOffAsk", { who: whoText(member) })}
          </p>
          <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
            {t("spaces.crew.takeOffBody")}
          </p>
          {notice ? <HoldNotice>{notice}</HoldNotice> : null}
          <div className="flex gap-2">
            <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setAsking(false)}>
              {t("common.cancel")}
            </button>
            <button type="button" className={`${ctaPrimary} flex-1`} disabled={busy} onClick={() => run(removeMember(crew.id, member.id))}>
              {busy ? t("spaces.crew.working") : member.status === "invited" ? t("spaces.crew.withdraw") : t("spaces.crew.takeOff")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function IconButton({ label, icon, onClick }: { label: string; icon: "create-outline" | "close"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.06] text-white/[0.62] transition-colors hover:bg-white/10 hover:text-white"
    >
      <Ion name={icon} size={16} />
    </button>
  );
}

/** Share and service, the part both ways of adding somebody ask. */
export function ShareFields({
  id,
  othersBps,
  service,
  setService,
  pct,
  setPct,
}: {
  id: string;
  othersBps: number;
  service: string;
  setService: (v: string) => void;
  pct: string;
  setPct: (v: string) => void;
}) {
  const t = useT();
  const bps = bpsFromPct(pct);
  const left = bps === null ? null : 10_000 - othersBps - bps;
  return (
    <>
      <Field label={t("spaces.crew.theyBring")} hint={t("spaces.crew.theyBringHint")} htmlFor={`${id}-svc`}>
        <input
          id={`${id}-svc`}
          className={inputCls}
          value={service}
          maxLength={CREW_LIMITS.SERVICE_MAX}
          onChange={(e) => setService(e.target.value)}
          placeholder={t("spaces.crew.theyBringPlaceholder")}
        />
      </Field>
      <Field
        label={t("spaces.crew.theirShare")}
        htmlFor={`${id}-pct`}
        hint={left !== null && left >= 0 ? t("spaces.crew.youKeep", { pct: pctText(left) }) : t("spaces.crew.shareHint")}
        error={left !== null && left < 0 ? t("spaces.crew.over100") : null}
      >
        <input id={`${id}-pct`} inputMode="decimal" className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="30" />
      </Field>
    </>
  );
}

/** An even split for the next person, typed in for them; they change it if they like. */
function suggestedPct(crew: Crew): string {
  const bps = suggestShareBps(crew.members);
  return bps === null ? "" : String(bps / 100);
}

/** "Add creator": somebody on HOLD, found by their username or X handle. */
export function AddCreatorForm({
  crew,
  othersBps,
  onCancel,
  onAdded,
}: {
  crew: Crew;
  othersBps: number;
  onCancel: () => void;
  onAdded: (c: Crew) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<HoldCreatorHit[]>([]);
  const [picked, setPicked] = useState<HoldCreatorHit | null>(null);
  const [service, setService] = useState("");
  const [pct, setPct] = useState(() => suggestedPct(crew));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const taken = useMemo(() => new Set(crew.members.map((m) => m.handle?.toLowerCase()).filter(Boolean)), [crew.members]);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (picked || term.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void searchCreators(term, 6)
        .then(({ creators }) => alive && setHits(creators.filter((c) => !taken.has(c.handle.toLowerCase()))))
        .catch(() => alive && setHits([]));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, picked, taken]);

  const bps = shareOk(pct, othersBps);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{t("spaces.crew.addCreator")}</p>
      {picked ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] p-2.5">
          <HitAvatar hit={picked} />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-[15px] font-strong text-white">@{picked.handle}</p>
            {picked.name ? <p className={fine}>{picked.name}</p> : null}
          </div>
          <IconButton label={t("spaces.crew.pickElse")} icon="close" onClick={() => (setPicked(null), setQ(""))} />
        </div>
      ) : (
        <Field label={t("spaces.crew.who")} hint={t("spaces.crew.whoHint")} htmlFor="crew-find">
          <input id="crew-find" className={inputCls} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="@username" autoComplete="off" />
        </Field>
      )}
      {!picked && hits.length ? (
        <Card>
          {hits.map((h, i) => (
            <div key={h.handle} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <button type="button" className="flex items-center gap-3 text-left" onClick={() => setPicked(h)}>
                <HitAvatar hit={h} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-strong text-white">@{h.handle}</span>
                  <span className={fine}>{[h.name, h.username ? t("spaces.crew.onHoldAs", { username: h.username }) : null].filter(Boolean).join(" · ") || t("spaces.inspire.onHold")}</span>
                </span>
                <Ion name="add-circle-outline" size={20} className="text-white/55" />
              </button>
            </div>
          ))}
        </Card>
      ) : null}
      <ShareFields id="add" othersBps={othersBps} service={service} setService={setService} pct={pct} setPct={setPct} />
      <p className={fine}>{t("spaces.crew.askedNotAdded")}</p>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <button
        type="button"
        className={ctaPrimary}
        disabled={busy || !picked || !service.trim() || bps === null}
        onClick={() => {
          if (!picked || bps === null) return;
          setBusy(true);
          setNotice(null);
          void addCreator(crew.id, picked.handle, service.trim(), bps)
            .then(({ crew: next }) => onAdded(next))
            .catch((e) => setNotice(describeCrewError(e)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? t("spaces.crew.asking") : picked ? t("spaces.crew.askToJoin", { handle: picked.handle }) : t("spaces.crew.askThem")}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        {t("common.cancel")}
      </button>
    </div>
  );
}

export function HitAvatar({ hit }: { hit: HoldCreatorHit }) {
  if (hit.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={hit.avatarUrl} alt="" className="h-[34px] w-[34px] shrink-0 rounded-[17px] object-cover" />;
  }
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.08] text-white/[0.62]">
      <Ion name="person-outline" size={16} />
    </span>
  );
}

/** A link for somebody not on HOLD yet. */
export function LinkForm({
  crew,
  othersBps,
  onCancel,
  onMade,
}: {
  crew: Crew;
  othersBps: number;
  onCancel: () => void;
  onMade: (c: Crew, url: string, code: string) => void;
}) {
  const t = useT();
  const [service, setService] = useState("");
  const [pct, setPct] = useState(() => suggestedPct(crew));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bps = shareOk(pct, othersBps);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{t("spaces.crew.inviteNotOnHold")}</p>
      <ShareFields id="link" othersBps={othersBps} service={service} setService={setService} pct={pct} setPct={setPct} />
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <button
        type="button"
        className={ctaPrimary}
        disabled={busy || !service.trim() || bps === null}
        onClick={() => {
          if (bps === null) return;
          setBusy(true);
          setNotice(null);
          void inviteByLink(crew.id, service.trim(), bps)
            .then(({ crew: next, url, code }) => onMade(next, url, code))
            .catch((e) => setNotice(describeCrewError(e)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? t("spaces.crew.creating") : t("spaces.crew.getLink")}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        {t("common.cancel")}
      </button>
    </div>
  );
}

/** The one time a link exists anywhere a person can read it. */
export function LinkCard({ url, code, onClose }: { url: string; code: string; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{t("spaces.crew.sendLink")}</p>
      <HoldNotice icon="eye-off-outline">
        {t("spaces.crew.shownOnce")}
      </HoldNotice>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined)}
        className="flex min-h-[52px] items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] py-1.5 pl-3.5 pr-1.5 text-left transition-colors hover:bg-white/[0.09]"
      >
        <span className="line-clamp-2 flex-1 break-all text-[13px] font-strong text-white">{url.replace(/^https?:\/\//, "")}</span>
        <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-white/10 px-3 text-[13px] font-strong text-white">
          <Ion name={copied ? "checkmark" : "copy-outline"} size={14} />
          {copied ? t("common.copied") : t("common.copy")}
        </span>
      </button>
      <p className={fine}>
        {t("spaces.crew.linkNote", { days: CREW_LIMITS.INVITE_DAYS, code: code.slice(0, 6) })}
      </p>
      <button type="button" className={ctaSecondary} onClick={onClose}>
        {t("common.done")}
      </button>
    </div>
  );
}
