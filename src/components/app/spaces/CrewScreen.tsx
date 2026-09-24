"use client";

/**
 * Spaces › Crew: creators who sell one package together.
 *
 * One brings marketing and short form, one brings the cameras, one brings the
 * interviews. The sponsor pays once, and that one payment reaches every
 * member's wallet with their part: nobody collects and forwards, and HOLD
 * holds none of it. The crew also shares an expenses group, for the coffee at
 * the event: "Expenses & chat" opens that group's thread, the same screen
 * Payments › Groups opens (components/app/payments/GroupThread), never a copy.
 *
 * WHAT THIS SCREEN DOES
 *
 * The crews this person is in, and the ones they have been asked into; one
 * crew at a time (`?crew=`); starting one. The lead adds creators by their
 * HOLD username or X handle ("Add creator"), or sends a link to somebody not
 * on HOLD yet, sets each share, and takes people off. Everybody says yes to the
 * split they are shown, and says it again whenever it changes: the page asks
 * with the terms version it read, so a yes never lands on a split nobody saw.
 *
 * `?join=<code>` is a link invitation, reached through the lead's invite link
 * (`/invite/<ref>?crew=<code>`). Opened signed out, the code is kept in this
 * browser across the sign-in and reopened here.
 *
 * Built from the console's own pieces (Team's cards, the one-time link card),
 * so a crew reads like the rest of Spaces.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BackHeader, ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { searchCreators, type HoldCreatorHit } from "@/lib/creator/analytics";
import {
  addCreator,
  agreeToCrew,
  bpsFromPct,
  createCrew,
  CREW_LIMITS,
  crewSales,
  describeCrewError,
  inviteByLink,
  joinCrew,
  leaveCrew,
  myCrews,
  notReadyText,
  pctText,
  previewCrewInvite,
  removeMember,
  takePendingJoin,
  updateMember,
  whoText,
  type Crew,
  type CrewInvitePreview,
  type CrewMember,
  type CrewSale,
} from "@/lib/creator/crew";

import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { useHref, useProductHref } from "../base";
import { Body, Card, Divider, Empty, Field, inputCls, P, SectionLabel, SheetRow, Tag } from "./kit";

const fine = `text-[12px] leading-[17px] ${P.dim}`;
const sheetCls = "flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5";
const sheetTitle = "text-[18px] font-extrabold tracking-[-0.3px] text-white";

export function CrewScreen({ crewId, join }: { crewId: string | null; join: string | null }) {
  const t = useT();
  const href = useHref();
  const router = useRouter();
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setCrews((await myCrews()).crews);
    } catch (e) {
      setCrews((c) => c ?? []);
      setNotice(describeCrewError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Back from signing in: a link opened before it is reopened by its address.
  useEffect(() => {
    if (join) return;
    const kept = takePendingJoin();
    if (kept) router.replace(`${href("/crew")}?join=${encodeURIComponent(kept)}`);
  }, [join, router, href]);

  if (join) {
    return (
      <Column>
        <JoinByLink
          code={join}
          onJoined={(c) => {
            void load();
            router.replace(`${href("/crew")}?crew=${c.id}`);
          }}
        />
      </Column>
    );
  }

  const open = crewId ? crews?.find((c) => c.id === crewId) ?? null : null;
  if (crewId && crews && !open) {
    return (
      <Column>
        <HoldNotice>{t("spaces.crew.gone")}</HoldNotice>
        <SheetRow icon="people-outline" title={t("spaces.crew.yourCrews")} href={href("/crew")} />
      </Column>
    );
  }
  if (open) {
    return (
      <Column>
        <BackHeader title={open.name} backHref={href("/crew")} />
        <CrewDetail
          crew={open}
          onChanged={(next) => setCrews((list) => (list ?? []).map((c) => (c.id === next.id ? next : c)))}
          onLeft={() => {
            void load();
            router.replace(href("/crew"));
          }}
        />
      </Column>
    );
  }

  const asked = (crews ?? []).filter((c) => c.you?.status === "invited");
  const mine = (crews ?? []).filter((c) => c.you?.status === "active");

  return (
    <Column>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <Card>
        <p className="text-[16px] font-strong tracking-[-0.2px] text-white">{t("spaces.crew.introTitle")}</p>
        <Body dim>{t("spaces.crew.introBody1")}</Body>
        <Body dim>{t("spaces.crew.introBody2")}</Body>
      </Card>

      {asked.length ? (
        <>
          <SectionLabel>{t("spaces.crew.askedToJoin")}</SectionLabel>
          {asked.map((c) => (
            <Invitation key={c.id} crew={c} onDone={() => void load()} />
          ))}
        </>
      ) : null}

      <SectionLabel>{t("spaces.crew.yourCrews")}</SectionLabel>
      {crews === null ? (
        <Empty icon="hourglass-outline" title={t("common.loading")} />
      ) : mine.length === 0 ? (
        <Empty icon="people-outline" title={t("spaces.crew.noneTitle")} body={t("spaces.crew.noneBody")} />
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((c) => (
            <SheetRow
              key={c.id}
              icon="people-outline"
              title={c.name}
              meta={
                <span className={c.ready ? undefined : "text-amber"}>
                  {c.ready
                    ? t("spaces.crew.rowMeta", { count: c.members.length, share: c.you?.share ?? "–" })
                    : t("spaces.crew.rowMetaNotSelling", { count: c.members.length, share: c.you?.share ?? "–" })}
                </span>
              }
              attention={!c.ready || c.you?.agreed === false}
              href={`${href("/crew")}?crew=${c.id}`}
            />
          ))}
        </div>
      )}

      {starting ? (
        <StartCrew
          onCancel={() => setStarting(false)}
          onStarted={(c) => {
            setStarting(false);
            void load();
            router.push(`${href("/crew")}?crew=${c.id}`);
          }}
        />
      ) : (
        <button type="button" className={ctaPrimary} onClick={() => setStarting(true)}>
          <Ion name="add" size={18} />
          {t("spaces.crew.start")}
        </button>
      )}
    </Column>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">{children}</div>;
}

/* ── Starting one ─────────────────────────────────────────────────── */

function StartCrew({ onCancel, onStarted }: { onCancel: () => void; onStarted: (c: Crew) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{t("spaces.crew.start")}</p>
      <Field label={t("spaces.crew.nameLabel")} hint={t("spaces.crew.nameHint")} htmlFor="crew-name">
        <input
          id="crew-name"
          className={inputCls}
          autoFocus
          value={name}
          maxLength={CREW_LIMITS.NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("spaces.crew.namePlaceholder")}
        />
      </Field>
      <Field label={t("spaces.crew.youBringLabel")} hint={t("spaces.crew.youBringHint")} htmlFor="crew-service">
        <input
          id="crew-service"
          className={inputCls}
          value={service}
          maxLength={CREW_LIMITS.SERVICE_MAX}
          onChange={(e) => setService(e.target.value)}
          placeholder={t("spaces.crew.youBringPlaceholder")}
        />
      </Field>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <button
        type="button"
        className={ctaPrimary}
        disabled={busy || !name.trim() || !service.trim()}
        onClick={() => {
          setBusy(true);
          setNotice(null);
          void createCrew(name.trim(), service.trim())
            .then(({ crew }) => onStarted(crew))
            .catch((e) => setNotice(describeCrewError(e)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? t("spaces.crew.creating") : t("spaces.crew.create")}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        {t("common.cancel")}
      </button>
    </div>
  );
}

/* ── Saying yes ───────────────────────────────────────────────────── */

/** A crew this person was added to by name: what they bring, their part, who else. */
function Invitation({ crew, onDone }: { crew: Crew; onDone: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const me = crew.members.find((m) => m.id === crew.you?.memberId) ?? null;
  const lead = crew.members.find((m) => m.isLead);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{crew.name}</p>
      <Body dim>{lead ? t("spaces.crew.wantsYou", { who: whoText(lead) }) : t("spaces.crew.aCreatorWantsYou")}</Body>
      {me ? <Terms service={me.service} share={me.share} /> : null}
      <Roster members={crew.members} />
      <PaidLine />
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className={`${ctaSecondary} flex-1`}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void leaveCrew(crew.id)
              .then(onDone)
              .catch((e) => setNotice(describeCrewError(e)))
              .finally(() => setBusy(false));
          }}
        >
          {t("spaces.crew.decline")}
        </button>
        <button
          type="button"
          className={`${ctaPrimary} flex-1`}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            void agreeToCrew(crew.id, crew.termsVersion)
              .then(onDone)
              .catch((e) => {
                setNotice(describeCrewError(e));
                onDone();
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? t("spaces.crew.working") : t("spaces.crew.sayYesJoin")}
        </button>
      </div>
    </div>
  );
}

/** A link invitation, read with the code and taken in one step. */
function JoinByLink({ code, onJoined }: { code: string; onJoined: (c: Crew) => void }) {
  const t = useT();
  const [invite, setInvite] = useState<CrewInvitePreview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(() => {
    setNotice(null);
    void previewCrewInvite(code)
      .then(({ invite: i }) => setInvite(i))
      .catch((e) => setNotice(describeCrewError(e)));
  }, [code]);
  useEffect(read, [read]);

  if (!invite) return notice ? <HoldNotice>{notice}</HoldNotice> : <Empty icon="hourglass-outline" title={t("spaces.crew.opening")} />;

  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{t("spaces.crew.join", { name: invite.name })}</p>
      <Body dim>{invite.leadHandle ? t("spaces.crew.wantsYou", { who: `@${invite.leadHandle}` }) : t("spaces.crew.aCreatorWantsYou")}</Body>
      <Terms service={invite.service} share={invite.share} />
      {invite.members.length ? (
        <Card>
          {invite.members.map((m, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {i > 0 ? <Divider /> : null}
              <p className="text-[14px] font-strong text-white">
                {m.handle ? `@${m.handle}` : t("spaces.overview.inspired.aCreator")} {m.isLead ? <Tag label={t("spaces.crew.lead")} /> : null}
              </p>
              <p className={fine}>{m.service}</p>
            </div>
          ))}
        </Card>
      ) : null}
      <PaidLine />
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <button
        type="button"
        className={ctaPrimary}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setNotice(null);
          void joinCrew(code, invite.termsVersion)
            .then(({ crew }) => onJoined(crew))
            .catch((e) => {
              setNotice(describeCrewError(e));
              // The split moved: read it again so the next yes is to the new one.
              read();
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? t("spaces.crew.joining") : t("spaces.crew.sayYesJoin")}
      </button>
    </div>
  );
}

function Terms({ service, share }: { service: string; share: string }) {
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

function PaidLine() {
  const t = useT();
  return <p className={fine}>{t("spaces.crew.paidLine")}</p>;
}

/** The people in a crew, read-only: who, what they bring, their share. */
function Roster({ members }: { members: CrewMember[] }) {
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

function PersonLine({ member, right }: { member: CrewMember; right?: React.ReactNode }) {
  const t = useT();
  const waiting = member.status === "invited";
  return (
    <div className="flex items-center gap-3">
      <Avatar member={member} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">
            {member.byLink ? t("spaces.crew.invitedByLink") : whoText(member)}
          </p>
          {member.isLead ? <Tag label={t("spaces.crew.lead")} /> : null}
          {waiting ? <Tag label={t("spaces.crew.invited")} tone="dim" /> : member.agreed ? null : <Tag label={t("spaces.crew.notYes")} tone="caution" />}
        </div>
        <p className="line-clamp-2 text-[12.5px] font-strong leading-[17px] text-white/55">{member.service}</p>
      </div>
      {right ?? <p className="shrink-0 text-[15px] font-extrabold tabular-nums text-white">{member.share}</p>}
    </div>
  );
}

function Avatar({ member }: { member: CrewMember }) {
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

/* ── One crew ─────────────────────────────────────────────────────── */

function CrewDetail({ crew, onChanged, onLeft }: { crew: Crew; onChanged: (c: Crew) => void; onLeft: () => void }) {
  const t = useT();
  const href = useHref();
  const productHref = useProductHref();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<"none" | "creator" | "link">("none");
  const [link, setLink] = useState<{ url: string; code: string } | null>(null);
  const lead = crew.youAreLead;
  const readyText = notReadyText(crew.notReady);
  const others = crew.members.filter((m) => !m.isLead).reduce((s, m) => s + m.shareBps, 0);
  const full = crew.members.length >= CREW_LIMITS.MAX_MEMBERS;

  const done = (p: Promise<{ crew: Crew }>) => {
    setBusy(true);
    setNotice(null);
    return p
      .then(({ crew: next }) => onChanged(next))
      .catch((e) => setNotice(describeCrewError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      {crew.ready ? (
        <HoldNotice icon="checkmark-circle-outline" tone="good">
          {t("spaces.crew.everyoneYes")}
        </HoldNotice>
      ) : readyText ? (
        <HoldNotice>{readyText}</HoldNotice>
      ) : null}

      {crew.you && !crew.you.agreed ? (
        <div className={sheetCls}>
          <p className={sheetTitle}>{t("spaces.crew.splitChanged")}</p>
          <Body dim>{t("spaces.crew.splitChangedBody", { share: crew.you.share })}</Body>
          <button type="button" className={ctaPrimary} disabled={busy} onClick={() => void done(agreeToCrew(crew.id, crew.termsVersion))}>
            {busy ? t("spaces.crew.working") : t("spaces.crew.sayYesTo", { share: crew.you.share })}
          </button>
        </div>
      ) : null}

      {notice ? <HoldNotice>{notice}</HoldNotice> : null}

      <SectionLabel right={<span className="text-[12px] font-strong tabular-nums text-white/55">{t("spaces.insights.xOfY", { x: crew.members.length, y: CREW_LIMITS.MAX_MEMBERS })}</span>}>
        {t("spaces.crew.theCrew")}
      </SectionLabel>
      {lead ? (
        <Card>
          {crew.members.map((m, i) => (
            <div key={m.id} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <EditableMember crew={crew} member={m} othersBps={others} onChanged={onChanged} />
            </div>
          ))}
        </Card>
      ) : (
        <Roster members={crew.members} />
      )}
      <p className={fine}>
        {t("spaces.crew.sharesNote")}
      </p>

      {lead ? (
        link ? (
          <LinkCard url={link.url} code={link.code} onClose={() => setLink(null)} />
        ) : adding === "creator" ? (
          <AddCreatorForm crew={crew} othersBps={others} onCancel={() => setAdding("none")} onAdded={(c) => (onChanged(c), setAdding("none"))} />
        ) : adding === "link" ? (
          <LinkForm
            crew={crew}
            othersBps={others}
            onCancel={() => setAdding("none")}
            onMade={(c, url, code) => {
              onChanged(c);
              setAdding("none");
              setLink({ url, code });
            }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" className={ctaPrimary} disabled={full} onClick={() => setAdding("creator")}>
              <Ion name="person-add-outline" size={18} />
              {t("spaces.crew.addCreator")}
            </button>
            <button type="button" className={ctaSecondary} disabled={full} onClick={() => setAdding("link")}>
              {t("spaces.crew.inviteNotOnHold")}
            </button>
            {full ? <HoldNotice>{t("spaces.crew.atMost", { count: CREW_LIMITS.MAX_MEMBERS })}</HoldNotice> : null}
          </div>
        )
      ) : null}

      <SectionLabel>{t("spaces.crew.listingsSold")}</SectionLabel>
      {crew.spaces.length ? (
        <div className="flex flex-col gap-2">
          {crew.spaces.map((s) => (
            <SheetRow key={s.id} icon="pricetag-outline" title={s.title} meta={s.status} href={lead ? href(`/listings/${s.id}`) : undefined} />
          ))}
        </div>
      ) : (
        <Empty
          icon="pricetag-outline"
          title={t("spaces.crew.noListing")}
          body={lead ? t("spaces.crew.noListingLead") : t("spaces.crew.noListingMember")}
        />
      )}

      <SectionLabel>{t("spaces.crew.expenses")}</SectionLabel>
      {crew.groupId ? (
        <SheetRow
          icon="chatbubbles-outline"
          title={t("spaces.crew.expensesChat")}
          meta={t("spaces.crew.expensesChatMeta")}
          href={productHref(`/payments/groups/${encodeURIComponent(crew.groupId)}?crew=${crew.id}`)}
        />
      ) : (
        <Card>
          <p className="text-[15px] font-strong text-white">{t("spaces.crew.expensesGroup")}</p>
          <Body dim>{t("spaces.crew.noExpensesGroup")}</Body>
        </Card>
      )}

      <Sales crewId={crew.id} />

      {!lead && crew.you?.status === "active" ? <Leave crew={crew} onLeft={onLeft} /> : null}
    </>
  );
}

/** One member, for the lead: their share can be changed and they can be taken off. */
function EditableMember({
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

function IconButton({ label, icon, onClick }: { label: string; icon: "create-outline" | "close"; onClick: () => void }) {
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
function ShareFields({
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

function shareOk(pct: string, othersBps: number): number | null {
  const bps = bpsFromPct(pct);
  if (bps === null || bps < CREW_LIMITS.MIN_SHARE_BPS || othersBps + bps > 10_000) return null;
  return bps;
}

/** "Add creator": somebody on HOLD, found by their username or X handle. */
function AddCreatorForm({
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
  const [pct, setPct] = useState("");
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

function HitAvatar({ hit }: { hit: HoldCreatorHit }) {
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
function LinkForm({
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
  const [pct, setPct] = useState("");
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
function LinkCard({ url, code, onClose }: { url: string; code: string; onClose: () => void }) {
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

/** What the crew's sales sent, and this person's part. */
function Sales({ crewId }: { crewId: string }) {
  const t = useT();
  const [data, setData] = useState<{ sales: CrewSale[]; yoursUsdc: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void crewSales(crewId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ sales: [], yoursUsdc: "0" }));
    return () => {
      alive = false;
    };
  }, [crewId]);
  if (!data || data.sales.length === 0) return null;
  return (
    <>
      <SectionLabel right={<span className="text-[12px] font-strong tabular-nums text-white/55">{t("spaces.crew.toYou", { amount: `$${data.yoursUsdc}` })}</span>}>
        {t("spaces.sales.crumb")}
      </SectionLabel>
      <Card>
        {data.sales.map((s, i) => (
          <div key={s.orderId} className="flex flex-col gap-2.5">
            {i > 0 ? <Divider /> : null}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-[14px] font-strong text-white">{s.title}</p>
                <p className={fine}>{s.paidAt
                    ? t("spaces.crew.toCrewOn", { amount: `$${s.totalUsdc}`, date: fmtDate(s.paidAt, { year: "numeric", month: "numeric", day: "numeric" }) })
                    : t("spaces.crew.toCrew", { amount: `$${s.totalUsdc}` })}</p>
              </div>
              <p className="shrink-0 text-[15px] font-extrabold tabular-nums text-white">${s.yoursUsdc}</p>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function Leave({ crew, onLeft }: { crew: Crew; onLeft: () => void }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  if (!asking) {
    return (
      <button type="button" className={ctaSecondary} onClick={() => setAsking(true)}>
        {t("spaces.crew.leaveCrew")}
      </button>
    );
  }
  return (
    <div className={sheetCls}>
      <p className="text-[15px] font-strong text-white">{t("spaces.crew.leaveAsk", { name: crew.name })}</p>
      <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
        {t("spaces.crew.leaveBody")}
      </p>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <div className="flex gap-2">
        <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setAsking(false)}>
          {t("spaces.crew.stay")}
        </button>
        <button
          type="button"
          className={`${ctaPrimary} flex-1`}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void leaveCrew(crew.id)
              .then(onLeft)
              .catch((e) => setNotice(describeCrewError(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? t("spaces.crew.leaving") : t("spaces.crew.leave")}
        </button>
      </div>
    </div>
  );
}
