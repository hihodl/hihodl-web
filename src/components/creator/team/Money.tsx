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
 * WHY EVERY ROW CARRIES ITS OWN NAMES
 *
 * The server sends each debt with the listing's title, the creator's X handle
 * and the label the creator gave the member — read from the seat even after
 * it was removed, because somebody taken off the team is still owed and still
 * has a name. So nothing here joins ids against a second list that might not
 * have them any more.
 *
 * WHY AMOUNTS KEEP THEIR FRACTIONS OF A CENT
 *
 * A share is rounded DOWN on the server, in USDC's own six decimals, and the
 * remainder stays with the creator. This is the figure they copy into a wallet
 * to pay somebody, so it is printed exactly rather than rounded again here.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Body, Card, Disclosure, Divider, Empty, Field, inputCls, KV, money, P, SectionLabel, Tag } from "@/components/app/spaces/kit";
import { markTeamPaid, teamEarnings, teamOwed } from "@/lib/creator/listings";
import { describeTeamError } from "@/lib/creator/problems";
import { baseOf, chainName, dayText, groupByMember, shareText, TEAM_LIMITS, usdcText, type Earning, type OwedGroup } from "@/lib/creator/team";
import { useT } from "@/lib/app/i18n/react";

const fine = `text-[12px] leading-[17px] ${P.dim}`;

/** One sale behind a total: the listing, the share, the chain, the day; what it added on the right. */
function SaleLine({ r, who }: { r: Earning; who: "you" | "they" }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2.5">
        <p className="line-clamp-2 flex-1 text-[12.5px] leading-[17px] text-white/55">
          {[
            r.listingTitle ?? t("creator.money.aListing"),
            t("creator.money.shareOfReceived", { share: shareText(r.shareBps) }),
            chainName(r.chain),
            dayText(r.createdAt),
          ].join(" · ")}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-[13px] font-strong tabular-nums text-white/[0.62]">{usdcText(baseOf(r.amountUsdc))}</p>
          {r.status === "paid" ? <Tag label={t("creator.money.markedPaid")} tone="dim" /> : null}
        </div>
      </div>
      {r.status === "paid" && (r.paidTx || r.paidNote) ? (
        <p className="break-all text-[12px] leading-4 text-white/55">
          {r.paidTx ? (who === "you" ? t("creator.money.yourTxNote", { tx: r.paidTx }) : t("creator.money.theirTxNote", { tx: r.paidTx })) : ""}
          {r.paidTx && r.paidNote ? " · " : ""}
          {r.paidNote ?? ""}
        </p>
      ) : null}
    </div>
  );
}

/* ── What I owe my team ───────────────────────────────────────────── */

export function Owed() {
  const t = useT();
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const o = await teamOwed();
      setRows(o.owed);
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
    <div className="flex flex-col gap-2.5">
      <Card>
        <Body dim>
          {t("creator.money.owedIntro")}
        </Body>
      </Card>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}

      {rows === null ? (
        <Empty icon="hourglass-outline" title={t("common.loading")} />
      ) : groups.length === 0 ? (
        <Empty icon="receipt-outline" title={t("creator.money.nothingOwed")} body={t("creator.money.nothingOwedBody")} />
      ) : (
        <>
          <SectionLabel>{t("creator.money.youOwe")}</SectionLabel>
          <Card>
            <p className="text-[12.5px] font-strong text-white/[0.62]">{t("creator.money.stillToPay")}</p>
            <p className={money}>{usdcText(owedTotal)}</p>
            <p className={fine}>
              {t("creator.money.payYourself")}
            </p>
          </Card>
          {groups.map((g) => (
            <PersonCard key={g.memberId} group={g} name={(g.owed[0] ?? g.paid[0])?.memberLabel ?? t("creator.money.unnamed")} onPaid={() => void load()} />
          ))}
        </>
      )}
    </div>
  );
}

function PersonCard({ group, name, onPaid }: { group: OwedGroup; name: string; onPaid: () => void }) {
  const t = useT();
  const [paying, setPaying] = useState(false);
  const newest = (a: Earning, b: Earning) => b.createdAt.localeCompare(a.createdAt);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="flex-1 truncate text-[15px] font-strong tracking-[-0.2px] text-white">{name}</p>
        <p className="shrink-0 text-[16px] font-strong tabular-nums text-white">{usdcText(group.owedBase)}</p>
      </div>
      {[...group.owed].sort(newest).map((r) => (
        <SaleLine key={r.id} r={r} who="you" />
      ))}
      {group.paidBase > 0n ? <KV k={t("creator.money.markedPaid")} v={usdcText(group.paidBase)} /> : null}
      {group.paid.length ? (
        <Disclosure label={t("creator.money.whatYouMarked", { count: group.paid.length })}>
          {[...group.paid].sort(newest).map((r) => (
            <SaleLine key={r.id} r={r} who="you" />
          ))}
        </Disclosure>
      ) : null}
      {group.owed.length > 0 && !paying ? (
        <button type="button" className={ctaSecondary} onClick={() => setPaying(true)}>
          {t("creator.money.markAsPaid")}
        </button>
      ) : null}
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
    </Card>
  );
}

/** MarkPaidSheet: it changes a record and nothing else; the reference is a note, never proof. */
function PayForm({ name, owed, onCancel, onPaid }: { name: string; owed: Earning[]; onCancel: () => void; onPaid: () => void }) {
  const t = useT();
  const [tx, setTx] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Oldest first, and never more than one call can carry: a creator settling a
  // long tab clears it from the start, in the order the sales happened.
  const batch = [...owed].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, TEAM_LIMITS.PAID_BATCH_MAX);
  const total = batch.reduce((n, r) => n + baseOf(r.amountUsdc), 0n);

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
      <p className="text-[18px] font-extrabold tracking-[-0.3px] text-white">{t("creator.money.markNamePaid", { name })}</p>
      <Body dim>
        {owed.length > batch.length
          ? t("creator.money.recordsPartial", { name, amount: usdcText(total), count: batch.length })
          : t("creator.money.records", { name, amount: usdcText(total) })}
      </Body>
      <Field label={t("creator.money.reference")} hint={t("creator.money.referenceHint")} htmlFor={`paid-tx-${name}`}>
        <input id={`paid-tx-${name}`} className={inputCls} value={tx} onChange={(e) => setTx(e.target.value)} maxLength={TEAM_LIMITS.PAID_TX_MAX} autoComplete="off" />
      </Field>
      <Field label={t("creator.money.note")} htmlFor={`paid-note-${name}`}>
        <input id={`paid-note-${name}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={TEAM_LIMITS.PAID_NOTE_MAX} />
      </Field>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <button
        type="button"
        className={ctaPrimary}
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
        {busy ? t("common.saving") : t("creator.money.iPaid")}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        {t("common.cancel")}
      </button>
    </div>
  );
}

/* ── What I am owed, working for somebody ─────────────────────────── */

/**
 * For somebody on another creator's team. Hidden entirely for a creator who
 * works for nobody, so their own page does not carry an empty card about a
 * situation they are not in.
 *
 * Grouped by seat — one per creator you work for — and named by that
 * creator's X handle, as the listing was published under it.
 */
export function Earnings() {
  const t = useT();
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void teamEarnings()
      .then((e) => {
        if (!alive) return;
        setRows(e.earnings);
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
    <div className="flex flex-col gap-2.5">
      <SectionLabel>{t("creator.money.youreOwed")}</SectionLabel>
      <p className={fine}>{t("creator.money.youreOwedBody")}</p>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      {rows === null ? (
        <Empty icon="hourglass-outline" title={t("common.loading")} />
      ) : (
        groups.map((g) => {
          const handle = (g.owed[0] ?? g.paid[0])?.creatorHandle ?? null;
          const list = [...g.owed, ...g.paid].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return (
            <Card key={g.memberId}>
              <div className="flex items-center justify-between gap-3">
                <p className="flex-1 truncate text-[15px] font-strong tracking-[-0.2px] text-white">{handle ? `@${handle}` : t("creator.money.aCreatorYouWorkFor")}</p>
                <p className="shrink-0 text-[16px] font-strong tabular-nums text-white">{usdcText(g.owedBase)}</p>
              </div>
              {g.paidBase > 0n ? <KV k={t("creator.money.markedPaid")} v={usdcText(g.paidBase)} /> : null}
              <Divider />
              {list.map((r) => (
                <SaleLine key={r.id} r={r} who="they" />
              ))}
            </Card>
          );
        })
      )}
    </div>
  );
}
