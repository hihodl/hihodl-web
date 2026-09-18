/**
 * What a creator owes their team, and what somebody on a team is owed.
 *
 * WE NEVER MOVE THIS MONEY — SAID ON THE CARD, NOT ONLY HERE
 *
 * Every brand's payment went straight to the creator's own address, in one
 * transaction the brand signed, with our fee beside it. What these cards show
 * is the creator's own bookkeeping of what they owe out of it, written down
 * when each sale confirmed on chain. The creator pays it themselves, from
 * their own wallet, whenever and however they agree with the person.
 *
 * So "Mark as paid" records that the CREATOR SAYS they paid. The transaction
 * box beside it is their note, kept with the record and never read as proof;
 * we do not look it up, and nothing on either card says "confirmed" or
 * "verified" about it. The person on the other end sees the same mark with the
 * same words: their creator's word, not a receipt.
 *
 * WHY GROUPED BY PERSON
 *
 * A creator settles up with people, not with sales. Each group is one seat on
 * the team with one total, and the sales behind it are there to check, not to
 * pay one at a time.
 *
 * WHY AMOUNTS KEEP THEIR FRACTIONS OF A CENT
 *
 * A share is rounded DOWN on the server, in USDC's own six decimals, and the
 * remainder stays with the creator. This is the figure they copy into a wallet
 * to pay somebody, so it is printed exactly rather than rounded again here.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { btnSmall, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import type { SpaceCard } from "@/lib/creator/listing";
import { getTeam, markTeamPaid, myListings, mySeats, teamEarnings, teamOwed } from "@/lib/creator/listings";
import { describeTeamError } from "@/lib/creator/problems";
import {
  baseOf,
  chainName,
  dayText,
  groupByMember,
  shareText,
  TEAM_LIMITS,
  usdcText,
  type Earning,
  type OwedGroup,
  type TeamMember,
} from "@/lib/creator/team";

import { Field, Text } from "../listing/parts";
import { Loading, Notice, Section } from "../parts";

/** Somebody the team list no longer has: removed, and still owed. */
const GONE = "Somebody no longer on your team";

/* ── What I owe my team ───────────────────────────────────────────── */

export function Owed() {
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [listings, setListings] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, t, l] = await Promise.all([
        teamOwed(),
        getTeam().catch(() => ({ team: [] as TeamMember[] })),
        myListings().catch(() => ({ spaces: [] as SpaceCard[] })),
      ]);
      setRows(o.owed);
      setNames(new Map(t.team.map((m) => [m.id, m.label])));
      setListings(new Map(l.spaces.map((s) => [s.id, s.serviceName || s.title])));
      setNotice(null);
    } catch (e) {
      setRows((r) => r ?? []);
      setNotice(describeTeamError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = rows ? groupByMember(rows) : [];
  const owedTotal = groups.reduce((n, g) => n + g.owedBase, 0n);

  return (
    <Section label="Settling up" title="What you owe your team">
      {rows === null ? (
        <Loading what="what you owe" />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-body text-text-muted">
            Each sale on a listing somebody works adds their share of what you received. You pay them yourself, from your
            own wallet — HOLD never sends, holds or guarantees this money. Marking it paid is your note that you did.
          </p>

          {groups.length === 0 ? (
            <p className="text-small text-text-muted">
              Nothing yet. When a listing with somebody on it sells, what you owe them shows up here.
            </p>
          ) : (
            <>
              <p className="text-small text-text">
                {owedTotal > 0n ? `${usdcText(owedTotal)} in USDC still to pay` : "Everything here is marked paid."}
              </p>
              <ul className="flex flex-col gap-3">
                {groups.map((g) => (
                  <OwedRow
                    key={g.memberId}
                    group={g}
                    name={names.get(g.memberId) ?? GONE}
                    listings={listings}
                    onPaid={() => void load()}
                  />
                ))}
              </ul>
            </>
          )}

          {notice ? <Notice>{notice}</Notice> : null}
        </div>
      )}
    </Section>
  );
}

function OwedRow({
  group,
  name,
  listings,
  onPaid,
}: {
  group: OwedGroup;
  name: string;
  listings: Map<string, string>;
  onPaid: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  return (
    <li className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-body text-text">{name}</p>
          <p className="mt-1 text-tiny text-text-muted">
            {group.owed.length > 0
              ? `${group.owed.length} ${group.owed.length === 1 ? "sale" : "sales"} not yet paid`
              : "All marked paid"}
            {group.paidBase > 0n ? ` · ${usdcText(group.paidBase)} marked paid so far` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-h4 font-light text-text">{usdcText(group.owedBase)}</p>
          <p className="text-tiny text-text-muted">USDC to pay</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.owed.length > 0 && !paying ? (
          <button type="button" className={btnSmall} onClick={() => setPaying(true)}>
            Mark as paid
          </button>
        ) : null}
        <button type="button" className={btnSmallSecondary} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide the sales" : "See the sales"}
        </button>
      </div>

      {paying ? (
        <PayForm
          name={name}
          owed={group.owed}
          onCancel={() => setPaying(false)}
          onPaid={() => {
            setPaying(false);
            onPaid();
          }}
        />
      ) : null}

      {open ? <Sales rows={[...group.owed, ...group.paid]} listings={listings} who="you" /> : null}
    </li>
  );
}

function PayForm({
  name,
  owed,
  onCancel,
  onPaid,
}: {
  name: string;
  owed: Earning[];
  onCancel: () => void;
  onPaid: () => void;
}) {
  const [tx, setTx] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Oldest first, and never more than one call can carry: a creator settling a
  // long tab clears it from the start, in the order the sales happened.
  const batch = [...owed]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, TEAM_LIMITS.PAID_BATCH_MAX);
  const total = batch.reduce((n, r) => n + baseOf(r.amountBase), 0n);
  const chains = [...new Set(batch.map((r) => chainName(r.chain)))];

  return (
    <div className="flex flex-col gap-4 rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-4">
      <p className="text-small text-text">
        Record that you paid {name} {usdcText(total)} in USDC for {batch.length} {batch.length === 1 ? "sale" : "sales"}
        {owed.length > batch.length ? ` — the oldest ${batch.length}; mark again for the rest` : ""}.
      </p>
      <p className="text-small text-text-muted">
        This only writes down what you tell us. HOLD does not send this money and does not check that it arrived. Send
        it from your own wallet first{chains.length ? ` — the sales were paid to you on ${chains.join(" and ")}` : ""}.
      </p>
      <Field
        label="The transaction, if you want it kept here"
        hint="Optional. A note for your records and theirs — we keep it as you type it and never look it up."
      >
        <Text value={tx} onChange={setTx} maxLength={TEAM_LIMITS.PAID_TX_MAX} placeholder="Transaction link or signature" />
      </Field>
      <Field label="A note" hint="Optional.">
        <Text value={note} onChange={setNote} maxLength={TEAM_LIMITS.PAID_NOTE_MAX} placeholder="Paid for Singapore, both days" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnSmall}
          disabled={busy || batch.length === 0}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            void markTeamPaid(
              batch.map((r) => r.id),
              tx,
              note,
            )
              .then(onPaid)
              .catch((e) => setNotice(describeTeamError(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Saving…" : "I paid it — record it"}
        </button>
        <button type="button" className={btnSmallSecondary} disabled={busy} onClick={onCancel}>
          Not yet
        </button>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/** The sales behind a total, newest first, each with what it added and whether it is marked paid. */
function Sales({ rows, listings, who }: { rows: Earning[]; listings: Map<string, string>; who: "you" | "they" }) {
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <ul className="flex flex-col divide-y divide-[color:var(--color-hairline)] border-t border-[color:var(--color-hairline)]">
      {sorted.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="min-w-0 break-words text-small text-text">
              {listings.get(r.spaceId) ?? "A listing"} · {dayText(r.createdAt)}
            </span>
            <span className="text-small text-text">{usdcText(baseOf(r.amountBase))}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-tiny text-text-muted">
            <span>
              {shareText(r.shareBps)} of what {who === "you" ? "you" : "they"} received · {chainName(r.chain)}
            </span>
            {r.status === "paid" ? (
              <span className={pill.neutral}>
                {who === "you" ? "You marked it paid" : "They marked it paid"}
                {r.paidAt ? ` ${dayText(r.paidAt)}` : ""}
              </span>
            ) : null}
          </div>
          {r.status === "paid" && (r.paidTx || r.paidNote) ? (
            <p className="break-all text-tiny text-text-muted">
              {r.paidTx ? `${who === "you" ? "Your" : "Their"} note of the transaction: ${r.paidTx}` : ""}
              {r.paidTx && r.paidNote ? " · " : ""}
              {r.paidNote ?? ""}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ── What I am owed, working for somebody ─────────────────────────── */

/**
 * For somebody on another creator's team. Hidden entirely for a creator who
 * works for nobody, so their own page does not carry an empty card about a
 * situation they are not in.
 *
 * Grouped by seat, and a seat is named by what that creator called you: the
 * server does not say whose team a seat is on, and the label is the one thing
 * both sides already share.
 */
export function Earnings() {
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [seats, setSeats] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([teamEarnings(), mySeats().catch(() => ({ seats: [] as TeamMember[] }))])
      .then(([e, s]) => {
        if (!alive) return;
        setRows(e.earnings);
        setSeats(new Map(s.seats.map((m) => [m.id, m.label])));
      })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setNotice(describeTeamError(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  if (rows !== null && rows.length === 0 && !notice) return null;

  const groups = rows ? groupByMember(rows) : [];

  return (
    <Section label="Working for others" title="What you are owed">
      {rows === null ? (
        <Loading what="what you are owed" />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-body text-text-muted">
            What the creators you work for have recorded owing you: your share of what they received from each sale on
            the listings you work. They pay you themselves. HOLD never sends, holds or guarantees this money, and
            “marked paid” is their word that they did — not a receipt. If something is marked paid and never arrived,
            take it up with them.
          </p>
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <EarningRow key={g.memberId} group={g} name={seats.get(g.memberId) ?? null} />
            ))}
          </ul>
          {notice ? <Notice>{notice}</Notice> : null}
        </div>
      )}
    </Section>
  );
}

function EarningRow({ group, name }: { group: OwedGroup; name: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-body text-text">
            {name ? (
              <>
                On a team as <span className="text-text">{name}</span>
              </>
            ) : (
              "A team you are no longer on"
            )}
          </p>
          <p className="mt-1 text-tiny text-text-muted">
            {group.paidBase > 0n ? `${usdcText(group.paidBase)} marked paid by them` : "Nothing marked paid yet"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-h4 font-light text-text">{usdcText(group.owedBase)}</p>
          <p className="text-tiny text-text-muted">USDC not yet paid</p>
        </div>
      </div>
      <div>
        <button type="button" className={btnSmallSecondary} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide the sales" : "See the sales"}
        </button>
      </div>
      {open ? <Sales rows={[...group.owed, ...group.paid]} listings={new Map()} who="they" /> : null}
    </li>
  );
}
