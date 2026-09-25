"use client";

/**
 * Spaces › Crew: creators who sell one package together.
 *
 * One brings marketing and short form, one brings the cameras, one brings the
 * interviews. The sponsor pays once, and that one payment reaches every
 * member's wallet with their part: nobody collects and forwards, and HOLD
 * holds none of it. The crew also shares an expenses group, for the coffee at
 * the event: "Group expenses & chat" opens that group's thread, the same screen
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
import { useCallback, useEffect, useState } from "react";

import { BackHeader, ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import {
  agreeToCrew,
  createCrew,
  CREW_LIMITS,
  crewSales,
  describeCrewError,
  joinCrew,
  leaveCrew,
  myCrews,
  notReadyText,
  previewCrewInvite,
  takePendingJoin,
  whoText,
  type Crew,
  type CrewInvitePreview,
  type CrewSale,
} from "@/lib/creator/crew";
import { CreatorApiError } from "@/lib/creator/api";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { useHref, useProductHref } from "../base";
import { AddCreatorForm, EditableMember, fine, LinkCard, LinkForm, PaidLine, Roster, sheetCls, sheetTitle, Terms } from "./CrewParts";
import { Body, Card, Divider, Empty, Field, inputCls, SectionLabel, SheetRow, Tag } from "./kit";

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
  // Opened from a `crew_invite` push or link: an invitation reads as one, with
  // the one tap that takes it, never as the crew's own page.
  if (open && open.you?.status === "invited") {
    return (
      <Column>
        <BackHeader title={t("spaces.crew.invitationTitle")} backHref={href("/crew")} />
        <Invitation
          crew={open}
          onDone={() => {
            void load();
          }}
        />
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

/**
 * A crew this person was added to by name: what they bring, their part, the
 * whole split, and the listings it sells. Saying yes is the one tap.
 */
function Invitation({ crew, onDone }: { crew: Crew; onDone: () => void }) {
  const t = useT();
  const productHref = useProductHref();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsPayout, setNeedsPayout] = useState(false);
  const me = crew.members.find((m) => m.id === crew.you?.memberId) ?? null;
  const lead = crew.members.find((m) => m.isLead);

  const run = (which: "yes" | "no") => {
    setBusy(which);
    setNotice(null);
    setNeedsPayout(false);
    void (which === "yes" ? agreeToCrew(crew.id, crew.termsVersion) : leaveCrew(crew.id))
      .then(onDone)
      .catch((e) => {
        setNotice(describeCrewError(e));
        setNeedsPayout(e instanceof CreatorApiError && e.code === "crew_payout_address_required");
        // The split may have moved: read it again so the next yes is to the new one.
        if (which === "yes") onDone();
      })
      .finally(() => setBusy(null));
  };

  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{crew.name}</p>
      <Body dim>{lead ? t("spaces.crew.wantsYou", { who: whoText(lead) }) : t("spaces.crew.aCreatorWantsYou")}</Body>
      {me ? <Terms service={me.service} share={me.share} /> : null}
      {crew.spaces.length ? <ListingsSold spaces={crew.spaces} /> : null}
      <Roster members={crew.members} />
      <PaidLine />
      <p className={fine}>{t("spaces.crew.groupLine")}</p>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      {needsPayout ? <SheetRow icon="wallet-outline" title={t("spaces.crew.setPayout")} meta={t("spaces.crew.setPayoutMeta")} href={productHref("/account?view=payout")} /> : null}
      <div className="flex gap-2">
        <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy !== null} onClick={() => run("no")}>
          {busy === "no" ? t("spaces.crew.working") : t("spaces.crew.decline")}
        </button>
        <button type="button" className={`${ctaPrimary} flex-1`} disabled={busy !== null} onClick={() => run("yes")}>
          {busy === "yes" ? t("spaces.crew.joining") : me ? t("spaces.crew.sayYesTo", { share: me.share }) : t("spaces.crew.sayYesJoin")}
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
      {invite.spaces?.length ? <ListingsSold spaces={invite.spaces} /> : null}
      {invite.members.length ? (
        <Card>
          {invite.members.map((m, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[14px] font-strong text-white">
                      {m.isThisInvite ? t("spaces.crew.you") : m.handle ? `@${m.handle}` : m.name ?? t("spaces.overview.inspired.aCreator")}
                    </p>
                    {m.isLead ? <Tag label={t("spaces.crew.lead")} /> : null}
                  </div>
                  <p className={fine}>{m.service}</p>
                </div>
                {m.share ? <p className="shrink-0 text-[15px] font-extrabold tabular-nums text-white">{m.share}</p> : null}
              </div>
            </div>
          ))}
        </Card>
      ) : null}
      <PaidLine />
      <p className={fine}>{t("spaces.crew.groupLine")}</p>
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

/** The listings a crew sells, for somebody about to say yes to it. */
function ListingsSold({ spaces }: { spaces: { id: string; title: string }[] }) {
  const t = useT();
  return (
    <Card>
      <p className="text-[12px] font-strong text-white/55">{t("spaces.crew.sells", { count: spaces.length })}</p>
      {spaces.map((sp) => (
        <p key={sp.id} className="flex items-center gap-2 text-[14px] font-strong text-white">
          <Ion name="pricetag-outline" size={14} className="shrink-0 text-white/55" />
          <span className="truncate">{sp.title}</span>
        </p>
      ))}
    </Card>
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

      <SectionLabel>{t("spaces.crew.splitCosts")}</SectionLabel>
      {crew.groupId ? (
        <SheetRow
          icon="chatbubbles-outline"
          title={t("spaces.crew.groupRow")}
          meta={t("spaces.crew.groupLine")}
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
                <p className={fine}>
                  {s.paidAt
                    ? t("spaces.crew.toCrewOn", { amount: `$${s.totalUsdc}`, date: fmtDate(s.paidAt, { year: "numeric", month: "numeric", day: "numeric" }) })
                    : t("spaces.crew.toCrew", { amount: `$${s.totalUsdc}` })}
                </p>
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
