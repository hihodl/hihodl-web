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
import { useCallback, useEffect, useState } from "react";

import { BackHeader, ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import {
  agreeToCrew,
  createCrew,
  CREW_GROUP_LINE,
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

import { useHref, useProductHref } from "../base";
import { AddCreatorForm, EditableMember, fine, LinkCard, LinkForm, PaidLine, Roster, sheetCls, sheetTitle, Terms } from "./CrewParts";
import { Body, Card, Divider, Empty, Field, inputCls, SectionLabel, SheetRow, Tag } from "./kit";

export function CrewScreen({ crewId, join }: { crewId: string | null; join: string | null }) {
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
        <HoldNotice>That crew isn&apos;t here any more.</HoldNotice>
        <SheetRow icon="people-outline" title="Your crews" href={href("/crew")} />
      </Column>
    );
  }
  // Opened from a `crew_invite` push or link: an invitation reads as one, with
  // the one tap that takes it, never as the crew's own page.
  if (open && open.you?.status === "invited") {
    return (
      <Column>
        <BackHeader title="Crew invitation" backHref={href("/crew")} />
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
        <p className="text-[16px] font-strong tracking-[-0.2px] text-white">Sell together. Get paid together.</p>
        <Body dim>
          Put creators who work an event together into one crew, each with what they bring. Brands buy the whole package from one listing.
        </Body>
        <Body dim>
          The brand pays once, and that one payment reaches every wallet in the crew with its part. Nobody collects and pays the others later,
          and HOLD never holds the money.
        </Body>
      </Card>

      {asked.length ? (
        <>
          <SectionLabel>Asked to join</SectionLabel>
          {asked.map((c) => (
            <Invitation key={c.id} crew={c} onDone={() => void load()} />
          ))}
        </>
      ) : null}

      <SectionLabel>Your crews</SectionLabel>
      {crews === null ? (
        <Empty icon="hourglass-outline" title="Loading…" />
      ) : mine.length === 0 ? (
        <Empty icon="people-outline" title="No crew yet" body="Start one, then add the creators you work events with." />
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((c) => (
            <SheetRow
              key={c.id}
              icon="people-outline"
              title={c.name}
              meta={
                <span className={c.ready ? undefined : "text-amber"}>
                  {`${c.members.length} ${c.members.length === 1 ? "person" : "people"} · you get ${c.you?.share ?? "–"}${c.ready ? "" : " · not selling yet"}`}
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
          Start a crew
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
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>Start a crew</p>
      <Field label="Crew name" hint="Brands see it on the listing." htmlFor="crew-name">
        <input
          id="crew-name"
          className={inputCls}
          autoFocus
          value={name}
          maxLength={CREW_LIMITS.NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Balkans crew"
        />
      </Field>
      <Field label="What you bring" hint="One line, shown next to your name." htmlFor="crew-service">
        <input
          id="crew-service"
          className={inputCls}
          value={service}
          maxLength={CREW_LIMITS.SERVICE_MAX}
          onChange={(e) => setService(e.target.value)}
          placeholder="Marketing and short form"
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
        {busy ? "Creating…" : "Create crew"}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        Cancel
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
      <Body dim>{lead ? `${whoText(lead)} wants you in their crew.` : "A creator wants you in their crew."}</Body>
      {me ? <Terms service={me.service} share={me.share} /> : null}
      {crew.spaces.length ? (
        <Card>
          <p className="text-[12px] font-strong text-white/55">{crew.spaces.length === 1 ? "Sells" : `Sells ${crew.spaces.length} listings`}</p>
          {crew.spaces.map((sp) => (
            <p key={sp.id} className="flex items-center gap-2 text-[14px] font-strong text-white">
              <Ion name="pricetag-outline" size={14} className="shrink-0 text-white/55" />
              <span className="truncate">{sp.title}</span>
            </p>
          ))}
        </Card>
      ) : null}
      <Roster members={crew.members} />
      <PaidLine />
      <p className={fine}>{CREW_GROUP_LINE}</p>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      {needsPayout ? <SheetRow icon="wallet-outline" title="Set your payout address" meta="Then say yes" href={productHref("/account?view=payout")} /> : null}
      <div className="flex gap-2">
        <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy !== null} onClick={() => run("no")}>
          {busy === "no" ? "Working…" : "Decline"}
        </button>
        <button type="button" className={`${ctaPrimary} flex-1`} disabled={busy !== null} onClick={() => run("yes")}>
          {busy === "yes" ? "Joining…" : me ? `Say yes to ${me.share}` : "Say yes and join"}
        </button>
      </div>
    </div>
  );
}

/** A link invitation, read with the code and taken in one step. */
function JoinByLink({ code, onJoined }: { code: string; onJoined: (c: Crew) => void }) {
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

  if (!invite) return notice ? <HoldNotice>{notice}</HoldNotice> : <Empty icon="hourglass-outline" title="Opening the invitation…" />;

  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>Join {invite.name}</p>
      <Body dim>{invite.leadHandle ? `@${invite.leadHandle} wants you in their crew.` : "A creator wants you in their crew."}</Body>
      <Terms service={invite.service} share={invite.share} />
      {invite.members.length ? (
        <Card>
          {invite.members.map((m, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {i > 0 ? <Divider /> : null}
              <p className="text-[14px] font-strong text-white">
                {m.handle ? `@${m.handle}` : "A creator"} {m.isLead ? <Tag label="Lead" /> : null}
              </p>
              <p className={fine}>{m.service}</p>
            </div>
          ))}
        </Card>
      ) : null}
      <PaidLine />
      <p className={fine}>{CREW_GROUP_LINE}</p>
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
        {busy ? "Joining…" : "Say yes and join"}
      </button>
    </div>
  );
}

/* ── One crew ─────────────────────────────────────────────────────── */

function CrewDetail({ crew, onChanged, onLeft }: { crew: Crew; onChanged: (c: Crew) => void; onLeft: () => void }) {
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
          Everyone said yes. Brands can buy from this crew&apos;s listings.
        </HoldNotice>
      ) : readyText ? (
        <HoldNotice>{readyText}</HoldNotice>
      ) : null}

      {crew.you && !crew.you.agreed ? (
        <div className={sheetCls}>
          <p className={sheetTitle}>The split changed</p>
          <Body dim>You now get {crew.you.share} of every sale. Say yes so the crew can keep selling.</Body>
          <button type="button" className={ctaPrimary} disabled={busy} onClick={() => void done(agreeToCrew(crew.id, crew.termsVersion))}>
            {busy ? "Working…" : `Say yes to ${crew.you.share}`}
          </button>
        </div>
      ) : null}

      {notice ? <HoldNotice>{notice}</HoldNotice> : null}

      <SectionLabel right={<span className="text-[12px] font-strong tabular-nums text-white/55">{`${crew.members.length} of ${CREW_LIMITS.MAX_MEMBERS}`}</span>}>
        The crew
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
        Shares are of what the crew receives from each sale. The lead gets whatever the others don&apos;t, and keeps the rounding.
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
              Add creator
            </button>
            <button type="button" className={ctaSecondary} disabled={full} onClick={() => setAdding("link")}>
              Invite someone not on HOLD
            </button>
            {full ? <HoldNotice>A crew is at most {CREW_LIMITS.MAX_MEMBERS} people.</HoldNotice> : null}
          </div>
        )
      ) : null}

      <SectionLabel>Listings sold as this crew</SectionLabel>
      {crew.spaces.length ? (
        <div className="flex flex-col gap-2">
          {crew.spaces.map((s) => (
            <SheetRow key={s.id} icon="pricetag-outline" title={s.title} meta={s.status} href={lead ? href(`/listings/${s.id}`) : undefined} />
          ))}
        </div>
      ) : (
        <Empty
          icon="pricetag-outline"
          title="No listing yet"
          body={lead ? "Open one of your listings and choose Sell with other creators. Brands then pay everyone in one payment." : "The lead puts listings on the crew."}
        />
      )}

      <SectionLabel>Split costs</SectionLabel>
      {crew.groupId ? (
        <SheetRow
          icon="chatbubbles-outline"
          title="Group expenses & chat"
          meta={CREW_GROUP_LINE}
          href={productHref(`/payments/groups/${encodeURIComponent(crew.groupId)}?crew=${crew.id}`)}
        />
      ) : (
        <Card>
          <p className="text-[15px] font-strong text-white">Expenses group</p>
          <Body dim>This crew has no expenses group yet. Make a group under Payments › Groups and add the crew to it.</Body>
        </Card>
      )}

      <Sales crewId={crew.id} />

      {!lead && crew.you?.status === "active" ? <Leave crew={crew} onLeft={onLeft} /> : null}
    </>
  );
}

/** What the crew's sales sent, and this person's part. */
function Sales({ crewId }: { crewId: string }) {
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
      <SectionLabel right={<span className="text-[12px] font-strong tabular-nums text-white/55">{`$${data.yoursUsdc} to you`}</span>}>
        Sales
      </SectionLabel>
      <Card>
        {data.sales.map((s, i) => (
          <div key={s.orderId} className="flex flex-col gap-2.5">
            {i > 0 ? <Divider /> : null}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-[14px] font-strong text-white">{s.title}</p>
                <p className={fine}>{`$${s.totalUsdc} to the crew${s.paidAt ? ` · ${new Date(s.paidAt).toLocaleDateString()}` : ""}`}</p>
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
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  if (!asking) {
    return (
      <button type="button" className={ctaSecondary} onClick={() => setAsking(true)}>
        Leave the crew
      </button>
    );
  }
  return (
    <div className={sheetCls}>
      <p className="text-[15px] font-strong text-white">Leave {crew.name}?</p>
      <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
        Your share goes back to the lead. Sales already paid stay yours, and you stay in the expenses group until you&apos;ve settled up.
      </p>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <div className="flex gap-2">
        <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setAsking(false)}>
          Stay
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
          {busy ? "Leaving…" : "Leave"}
        </button>
      </div>
    </div>
  );
}
