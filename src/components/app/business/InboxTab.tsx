"use client";

/**
 * Business › Inbox: every enquiry a brand sent about the business's spaces,
 * from the app and from the web, in one list (GET /ad-space/enquiries lists
 * every owner the caller works for). Open one to read it, answer it, send a
 * quote for a spot, withdraw a quote, archive the thread.
 *
 * Both kinds are answered in place. A guest (web) thread is stored and the
 * guest is emailed a link; an in-app thread is a Payment Thread between the
 * brand and the owner, and the reply goes from the owner's account with
 * "sent by" beside it. The owner can also open that thread in Payments.
 *
 * Reads are per person: opening a thread marks it read for the caller only.
 */

import { useEffect, useMemo, useState } from "react";

import {
  markEnquiryRead,
  replyToEnquiry,
  sendQuote,
  setArchived,
  useBusinessRefresh,
  useEnquiries,
  useEnquiry,
  withdrawQuote,
  type ArchivedFilter,
  type EnquiryRow,
  type EnquiryThread,
  type QuoteView,
} from "@/lib/app/business";
import { can, centsFromInput, type BusinessRole } from "@/lib/app/business-rules";
import { fmtDateTime, fmtRelative } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { getListing } from "@/lib/creator/listings";

import { useProductHref } from "../base";
import { Notice } from "../hold";
import { Ion } from "../ion";
import { LIST_PANEL, MasterDetail } from "../spaces/common";
import { btnGlassPill, btnWhite, Card, Chip, ChipRow, Empty, Field, inputCls, KV, SectionLabel, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { ErrorNote } from "./parts";

export function InboxTab({ role, open, onOpen }: { role: BusinessRole; open: string | null; onOpen: (id: string | null) => void }) {
  const t = useT();
  const [archived, setArchivedFilter] = useState<ArchivedFilter>("exclude");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const list = useEnquiries(spaceId, archived);
  // The space chips come from the unfiltered rows seen so far, so picking one does not empty the row of chips.
  const [spaces, setSpaces] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    const rows = list.data?.enquiries ?? [];
    setSpaces((prev) => {
      const m = new Map(prev.map((s) => [s.id, s]));
      for (const r of rows) m.set(r.space.id, r.space);
      return [...m.values()];
    });
  }, [list.data]);

  const rows = list.data?.enquiries ?? [];

  const listPane = (
    <div className="flex flex-col gap-2.5">
      <ChipRow label={t("business.inbox.filter")}>
        <Chip label={t("business.inbox.open")} selected={archived === "exclude"} onClick={() => setArchivedFilter("exclude")} count={archived === "exclude" ? list.data?.unread || undefined : undefined} />
        <Chip label={t("business.inbox.archived")} selected={archived === "only"} onClick={() => setArchivedFilter("only")} />
        <Chip label={t("business.inbox.all")} selected={archived === "include"} onClick={() => setArchivedFilter("include")} />
      </ChipRow>
      {spaces.length > 1 ? (
        <ChipRow label={t("business.inbox.bySpace")}>
          <Chip label={t("business.inbox.everySpace")} selected={spaceId === null} onClick={() => setSpaceId(null)} />
          {spaces.map((s) => (
            <Chip key={s.id} label={s.title} selected={spaceId === s.id} onClick={() => setSpaceId(s.id)} />
          ))}
        </ChipRow>
      ) : null}
      <Card className={`gap-0 overflow-y-auto py-1.5 ${LIST_PANEL}`}>
        {list.error ? (
          <ErrorNote error={list.error} />
        ) : !list.data ? (
          <Skeleton className="h-24" />
        ) : rows.length === 0 ? (
          <Empty icon="mail-open-outline" title={archived === "only" ? t("business.inbox.noArchived") : t("business.inbox.emptyTitle")} body={archived === "only" ? undefined : t("business.inbox.emptyBody")} />
        ) : (
          rows.map((r) => <EnquiryListRow key={r.enquiryId} row={r} selected={open === r.enquiryId} onClick={() => onOpen(r.enquiryId)} />)
        )}
      </Card>
    </div>
  );

  return (
    <MasterDetail
      showDetail={open !== null}
      list={listPane}
      detail={
        open ? (
          <Thread id={open} role={role} onBack={() => onOpen(null)} />
        ) : (
          <Card>
            <Empty icon="chatbubbles-outline" title={t("business.inbox.pickTitle")} />
          </Card>
        )
      }
    />
  );
}

function EnquiryListRow({ row: r, selected, onClick }: { row: EnquiryRow; selected: boolean; onClick: () => void }) {
  const t = useT();
  const who = r.asker.company ? `${r.asker.name} · ${r.asker.company}` : r.asker.name;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full min-w-0 flex-col gap-0.5 rounded-[12px] px-2 py-2.5 text-left transition-colors ${selected ? "bg-white/[0.09]" : "hover:bg-white/[0.04]"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-[14.5px] text-white ${r.unread ? "font-extrabold" : "font-bold"}`}>{who}</span>
        {r.unread ? <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[10px] bg-amber px-1.5 text-[11px] font-extrabold text-[#0F0F1A]">{r.unread}</span> : null}
        <span className="shrink-0 text-[12px] text-white/55">{fmtRelative(r.lastAt)}</span>
      </span>
      <span className="truncate text-[12.5px] text-white/[0.82]">{r.position ? `${r.position.label} · ${r.space.title}` : r.space.title}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/55">{r.lastFromAsker ? r.lastBody : t("business.inbox.youPrefix", { text: r.lastBody })}</span>
        <Tag label={r.channel === "web" ? t("business.inbox.web") : t("business.inbox.inApp")} tone="dim" />
        {r.archivedAt ? <Tag label={t("business.inbox.archivedTag")} tone="dim" /> : null}
      </span>
    </button>
  );
}

/* ── One thread ──────────────────────────────────────────────────── */

function Thread({ id, role, onBack }: { id: string; role: BusinessRole; onBack: () => void }) {
  const t = useT();
  const thread = useEnquiry(id);
  const refresh = useBusinessRefresh();
  const productHref = useProductHref();

  // Opening it marks it read for this person, then the list's badge follows.
  useEffect(() => {
    let live = true;
    markEnquiryRead(id)
      .then(() => live && refresh("enquiries"))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id, refresh]);

  if (thread.error) return <ErrorNote error={thread.error} />;
  if (!thread.data) return <Skeleton className="h-64" />;
  const e = thread.data.enquiry;
  const canReply = e.canReply;
  // The server says; a missing field (the quotes backend not out yet) falls back to the role.
  const canQuote = e.canQuote ?? false;
  const canArchive = e.canQuote ?? can(role, "enquiry.archive");
  const quotes = e.quotes ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-strong text-white/[0.82] hover:text-white lg:hidden">
        <Ion name="return-down-back-outline" size={15} />
        {t("business.inbox.back")}
      </button>
      <Card className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[17px] font-extrabold text-white">{e.asker.company ? `${e.asker.name} · ${e.asker.company}` : e.asker.name}</p>
            <p className="truncate text-[13px] text-white/[0.82]">{e.position ? `${e.position.label} · ${e.space.title}` : e.space.title}</p>
          </div>
          <Tag label={e.channel === "web" ? t("business.inbox.web") : t("business.inbox.inApp")} tone="dim" />
        </div>
        {e.asker.email ? <KV k={t("business.inbox.email")} v={<a className="underline-offset-2 hover:underline" href={`mailto:${e.asker.email}`}>{e.asker.email}</a>} /> : null}
        {e.asker.handle ? <KV k={t("business.inbox.handle")} v={e.asker.handle} /> : null}
        {e.channel === "web" && e.guestSeenAt ? <p className="text-[12.5px] text-white/55">{t("business.inbox.guestSeen", { when: fmtDateTime(e.guestSeenAt) })}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {e.channel === "app" && e.myRole === "owner" && e.asker.userId ? (
            <a href={productHref(`/payments?peer=${encodeURIComponent(e.asker.userId)}`)} className={btnGlassPill}>
              <Ion name="chatbubble-outline" size={15} />
              {t("business.inbox.openInPayments")}
            </a>
          ) : null}
          {canArchive ? <ArchiveButton thread={e} /> : null}
        </div>
      </Card>

      <Card className="gap-2.5">
        {e.messages.length === 0 ? <p className="text-[13.5px] text-white/55">{t("business.inbox.noMessages")}</p> : null}
        {e.messages.map((m) => (
          <div key={m.id} className={`flex flex-col gap-1 ${m.author === "business" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] px-3.5 py-2.5 text-[14.5px] leading-5 ${m.author === "business" ? "bg-[#F1F5F9] text-[#0A1420]" : "bg-white/[0.09] text-white"}`}>
              {m.body}
              {m.hasMedia ? <span className="mt-1 block text-[12px] opacity-70">{t("business.inbox.hasMedia")}</span> : null}
            </div>
            {m.quote ? <QuoteCard quote={m.quote} canWithdraw={false} /> : null}
            <span className="text-[11.5px] text-white/55">
              {m.author === "business" && m.sentBy ? `${t("business.inbox.sentBy", { name: m.sentBy.name })} · ` : ""}
              {fmtDateTime(m.createdAt)}
            </span>
          </div>
        ))}
      </Card>

      {quotes.length ? (
        <>
          <SectionLabel>{t("business.quote.quotes")}</SectionLabel>
          {quotes.map((q) => (
            <QuoteCard key={q.quoteId} quote={q} canWithdraw={canQuote} />
          ))}
        </>
      ) : null}

      {canReply ? <Reply thread={e} /> : <Notice tone="calm" icon="lock-closed-outline">{t("business.inbox.readOnly")}</Notice>}
      {canQuote ? <QuoteForm thread={e} /> : null}
    </div>
  );
}

function ArchiveButton({ thread: e }: { thread: EnquiryThread }) {
  const t = useT();
  const refresh = useBusinessRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const archived = !!e.archivedAt;
  return (
    <>
      <button
        type="button"
        className={btnGlassPill}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await setArchived(e.enquiryId, !archived);
            await refresh("enquiries", "enquiry");
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Ion name="archive-outline" size={15} />
        {archived ? t("business.inbox.unarchive") : t("business.inbox.archive")}
      </button>
      {error ? <div className="w-full"><ErrorNote error={error} /></div> : null}
    </>
  );
}

function Reply({ thread: e }: { thread: EnquiryThread }) {
  const t = useT();
  const refresh = useBusinessRefresh();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [dropped, setDropped] = useState(false);
  // An in-app reply is a payment note (280); a guest thread takes 2000.
  const max = e.channel === "app" ? 280 : 2000;

  async function send() {
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setError(null);
    setDropped(false);
    try {
      const out = await replyToEnquiry(e.enquiryId, message);
      // null in-app: the chat dropped it (blocked or muted). Said plainly, never as a failure.
      if (!out.message && e.channel === "app") setDropped(true);
      setText("");
      await refresh("enquiry", "enquiries");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-2.5">
      <Field label={t("business.inbox.reply")} htmlFor="b-reply" hint={e.channel === "web" ? t("business.inbox.replyWebHint") : t("business.inbox.replyAppHint")}>
        <textarea id="b-reply" className={`${inputCls} min-h-[96px]`} maxLength={max} value={text} onChange={(x) => setText(x.target.value)} />
      </Field>
      <ErrorNote error={error} />
      {dropped ? <Notice tone="calm">{t("business.inbox.dropped")}</Notice> : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-white/55">{`${text.length}/${max}`}</span>
        <button type="button" className={btnWhite} disabled={busy || !text.trim()} onClick={() => void send()}>
          <Ion name="send-outline" size={15} />
          {busy ? t("business.sending") : t("business.inbox.send")}
        </button>
      </div>
    </Card>
  );
}

/* ── Quotes ──────────────────────────────────────────────────────── */

const QUOTE_TONE: Record<QuoteView["state"], "good" | "calm" | "caution" | "dim"> = {
  open: "calm",
  accepted: "caution",
  paid: "good",
  expired: "dim",
  withdrawn: "dim",
  superseded: "dim",
};

function QuoteCard({ quote: q, canWithdraw }: { quote: QuoteView; canWithdraw: boolean }) {
  const t = useT();
  const refresh = useBusinessRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-1.5 rounded-[16px] border border-white/10 bg-white/[0.05] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[14px] font-bold text-white">{q.position.label}</span>
        <Tag label={t(`business.quote.state.${q.state}` as const)} tone={QUOTE_TONE[q.state]} />
      </div>
      <KV k={t("business.quote.price")} v={`${q.priceUsdc} USDC`} strong />
      {q.buyerPaysUsdc !== q.priceUsdc ? <KV k={t("business.quote.buyerPays")} v={`${q.buyerPaysUsdc} USDC`} /> : null}
      {q.note ? <p className="text-[13px] text-white/[0.82]">{q.note}</p> : null}
      {q.expiresAt ? (
        <p className="text-[12px] text-white/55">
          {q.state === "accepted" ? t("business.quote.heldUntil", { when: fmtDateTime(q.expiresAt) }) : t("business.quote.endsAt", { when: fmtDateTime(q.expiresAt) })}
        </p>
      ) : null}
      <ErrorNote error={error} />
      {canWithdraw && q.state === "open" ? (
        <button
          type="button"
          className={`${btnGlassPill} self-start`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await withdrawQuote(q.quoteId);
              await refresh("enquiry");
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t("business.quote.withdrawing") : t("business.quote.withdraw")}
        </button>
      ) : null}
    </div>
  );
}

type Spot = { id: string; label: string };

function QuoteForm({ thread: e }: { thread: EnquiryThread }) {
  const t = useT();
  const refresh = useBusinessRefresh();
  const [open, setOpen] = useState(false);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [spotsError, setSpotsError] = useState<unknown>(null);
  const [positionId, setPositionId] = useState<string>(e.position?.id ?? "");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [dropped, setDropped] = useState(false);

  // The spots still for sale on the space: the seller view lists them with their status.
  useEffect(() => {
    if (!open || spots) return;
    let live = true;
    getListing(e.space.id)
      .then(({ space }) => {
        if (!live) return;
        const list = space.positions.filter((p) => p.status === "open").map((p) => ({ id: p.id, label: p.title || p.label }));
        setSpots(list);
        setPositionId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? ""));
      })
      .catch((err) => live && setSpotsError(err));
    return () => {
      live = false;
    };
  }, [open, spots, e.space.id]);

  const cents = useMemo(() => centsFromInput(price), [price]);

  async function send() {
    if (!positionId || cents === null) return;
    setBusy(true);
    setError(null);
    setDropped(false);
    try {
      const out = await sendQuote(e.enquiryId, { positionId, priceCents: cents, expiresInDays: days, ...(note.trim() ? { note: note.trim() } : {}) });
      if (!out.quote) setDropped(true);
      else {
        setPrice("");
        setNote("");
        setOpen(false);
      }
      await refresh("enquiry", "enquiries");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={`${btnGlassPill} self-start`} onClick={() => setOpen(true)}>
        <Ion name="pricetag-outline" size={15} />
        {t("business.quote.send")}
      </button>
    );
  }

  return (
    <Card className="gap-3">
      <p className="text-[15px] font-bold text-white">{t("business.quote.send")}</p>
      <p className="text-[13px] leading-5 text-white/[0.82]">{t("business.quote.body")}</p>
      {spotsError ? <ErrorNote error={spotsError} /> : null}
      {spots && spots.length === 0 ? <Notice tone="calm">{t("business.quote.noSpots")}</Notice> : null}
      <Field label={t("business.quote.spot")} htmlFor="b-q-spot">
        <select id="b-q-spot" className={inputCls} value={positionId} onChange={(x) => setPositionId(x.target.value)} disabled={!spots?.length}>
          {(spots ?? []).map((s) => (
            <option key={s.id} value={s.id} className="bg-[#0A1420]">
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("business.quote.priceLabel")} htmlFor="b-q-price" hint={t("business.quote.priceHint")} error={price && cents === null ? t("business.quote.priceInvalid") : undefined}>
        <input id="b-q-price" className={inputCls} inputMode="decimal" value={price} onChange={(x) => setPrice(x.target.value)} placeholder="1500" />
      </Field>
      <Field label={t("business.quote.days")} htmlFor="b-q-days" hint={t("business.quote.daysHint")}>
        <input id="b-q-days" className={inputCls} type="number" min={1} max={30} value={days} onChange={(x) => setDays(Math.max(1, Math.min(30, Number(x.target.value) || 1)))} />
      </Field>
      <Field label={t("business.quote.note")} htmlFor="b-q-note" hint={t("business.quote.noteHint")}>
        <textarea id="b-q-note" className={`${inputCls} min-h-[72px]`} maxLength={280} value={note} onChange={(x) => setNote(x.target.value)} />
      </Field>
      <ErrorNote error={error} />
      {dropped ? <Notice tone="calm">{t("business.quote.dropped")}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnWhite} disabled={busy || !positionId || cents === null} onClick={() => void send()}>
          {busy ? t("business.sending") : t("business.quote.sendCta")}
        </button>
        <button type="button" className={btnGlassPill} onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </Card>
  );
}
