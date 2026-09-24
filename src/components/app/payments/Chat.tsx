"use client";

/**
 * The thread, ported from the app's `PaymentsThread.tsx`, its
 * `.components.tsx`, `ThreadComposer.tsx` and `GifPickerSheet.tsx`.
 *
 * PAYMENTS AND MESSAGES ARE ONE LIST
 *
 * This screen was built as a Payments card with a Conversation under it. That
 * is not a thread — it is two lists about the same person, and it left a
 * payment from July sitting below a message from an hour ago. The app renders
 * `AnyMsg = TxMsg | RequestMsg | ChatMsg` in a single chronological run,
 * because what happened between two people happened in one order. So does
 * this: a payment is a bubble, a message is a bubble, and the day turns
 * between them where the day actually turned.
 *
 * WHERE THE COMPOSER SITS, AND WHY
 *
 * At the foot, under the history. The thread is a money screen: what somebody
 * opened it to see is what happened, and a composer above it would make this
 * look like a chat that happens to move money rather than the other way round.
 * The app lands on the same order for the same reason.
 *
 * THE FOUR STATES OF THE BAR (the app's own list, unchanged)
 *
 *   1. Hidden       no user id for the other side — there is nobody to send to
 *   2. Open         type and send
 *   3. Waiting      your request is unanswered; the field stays and goes quiet,
 *                   because a bar that vanishes reads as a bug and a bar that
 *                   keeps taking text lies about where the text goes
 *   4. First message  it does not announce itself; the bubble says `Requested`
 *                   once sent, which teaches the same thing when it is true
 *
 * A GIF IS NOT TEXT THAT HAPPENS TO BE A PICTURE
 *
 * It takes its own column, it is refused on anything attached to a payment,
 * and a caption is optional beside it. So it is attached and not sent on tap —
 * picking from a grid is easy to do by accident, and a picker that sends on tap
 * has no undo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { maskTokenSymbol, type DisplayMode } from "@/lib/app/display-mode";
import type { Transfer } from "@/lib/app/hold-api";
import { tokenTicker, transferAmount } from "@/lib/app/payments";
import {
  NOTE_MAX_LENGTH,
  blockUser,
  deleteNote,
  gifUrl,
  looseMessages,
  markSeen,
  reportUser,
  searchGifs,
  sendMessage,
  useChatState,
  useThreadNotes,
  type Gif,
  type Note,
} from "@/lib/app/chat";
import type { SpotBought } from "@/lib/app/sponsor";
import { HoldApiError } from "@/lib/app/hold-api";
import {
  cancelRequest,
  describeRequestError,
  rejectRequest,
  remindRequest,
  requestAmount,
  requestTag,
  requestsWith,
  theyAsked,
  usePaymentRequests,
  webCanPay,
  type PaymentRequest,
} from "@/lib/app/payment-requests";

import { Ion } from "../ion";

/* ── The thread ───────────────────────────────────────────────────── */

/**
 * ONE list, not two.
 *
 * This screen first drew a Payments card and then a Conversation under it,
 * which is not a thread — it is two lists about the same person, and it put a
 * payment from July below a message from an hour ago. The app has never done
 * that: `PaymentsThread` renders `AnyMsg = TxMsg | RequestMsg | ChatMsg` in
 * one chronological run, because what happened between two people happened in
 * one order.
 *
 * So a payment is a BUBBLE, on its own side, with the app's own colours: an
 * outgoing one is amber at 15%, an incoming one white at 8%, and a note
 * written on a payment sits INSIDE that bubble rather than in a bubble of its
 * own — a message invites a reply and a note does not, it describes an amount.
 */
type Happened =
  | { kind: "pay"; key: string; ts: number; row: Transfer }
  | { kind: "msg"; key: string; ts: number; note: Note }
  | { kind: "req"; key: string; ts: number; request: PaymentRequest }
  | { kind: "spot"; key: string; ts: number; spot: SpotBought };
type Row = Happened | { kind: "day"; key: string; label: string };

export function Conversation({
  peerId,
  peerName,
  payments,
  mode,
  onOpenTx,
  onPayRequest,
  spots = [],
}: {
  peerId: string | null;
  peerName: string;
  payments: readonly Transfer[];
  mode: DisplayMode;
  onOpenTx: (id: string) => void;
  /** Pay one of their requests: the thread hands it up, the screen opens Quick Send with it locked. */
  onPayRequest: (request: PaymentRequest) => void;
  /** Spots bought from this creator, derived by the screen above. */
  spots?: readonly SpotBought[];
}) {
  const notes = useThreadNotes(peerId);
  const state = useChatState(peerId);
  const requests = usePaymentRequests();
  const messages = useMemo(() => looseMessages(notes.data), [notes.data]);
  const asked = useMemo(() => requestsWith(requests.data, peerId), [requests.data, peerId]);

  useMarkSeen(messages, () => void notes.mutate());

  /* Oldest first, newest at the foot, where the composer is — the app inverts
     its list to get the same order out of a phone's scroll. Day dividers are
     inserted after sorting, so one is drawn only where the day actually turns. */
  const rows = useMemo<Row[]>(() => {
    const items: Happened[] = [
      ...payments.map((t) => ({ kind: "pay" as const, key: `t:${t.id}`, ts: Date.parse(t.createdAt), row: t })),
      ...messages.map((n) => ({ kind: "msg" as const, key: `n:${n.id}`, ts: Date.parse(n.createdAt), note: n })),
      // A request is a third thing that happened between two people, so it
      // takes its place in the same run rather than sitting in a panel above.
      // Closed ones stay, their tag turned to Paid, Declined or Cancelled.
      ...asked.map((r) => ({ kind: "req" as const, key: `r:${r.id}`, ts: Date.parse(r.createdAt), request: r })),
      // A spot bought from this creator. Derived, never written: see
      // `useSpotsBoughtFrom`. A fact does not get an edit button.
      ...spots.map((s) => ({ kind: "spot" as const, key: `s:${s.orderId}`, ts: s.ts, spot: s })),
    ]
      .filter((i) => Number.isFinite(i.ts))
      .sort((a, b) => a.ts - b.ts);

    return withDays(items);
  }, [payments, messages, asked, spots]);

  const waiting = state.data?.status === "pending" && state.data.requestedByMe;

  return (
    <>
      <div className="mt-2 flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] leading-[18px] text-white/70">
            Nothing between you and {peerName} yet.
          </p>
        ) : null}

        {rows.map((r) =>
          r.kind === "day" ? (
            <p key={r.key} className="mt-2 text-center text-[11.5px] text-white/45">
              {r.label}
            </p>
          ) : r.kind === "pay" ? (
            <PaymentBubble key={r.key} row={r.row} mode={mode} onOpen={() => onOpenTx(r.row.id)} />
          ) : r.kind === "spot" ? (
            <SpotBubble key={r.key} spot={r.spot} peerName={peerName} />
          ) : r.kind === "req" ? (
            <RequestBubble
              key={r.key}
              request={r.request}
              incoming={!!peerId && theyAsked(r.request, peerId)}
              mode={mode}
              onPay={() => onPayRequest(r.request)}
              onAnswered={() => void requests.mutate()}
            />
          ) : (
            <Bubble key={r.key} note={r.note} requested={waiting && r.note.mine} onWithdrawn={() => void notes.mutate()} />
          ),
        )}

        {waiting ? <WaitingRow name={peerName} /> : null}
      </div>

      {peerId ? (
        <Composer
          peerId={peerId}
          status={state.data?.status ?? null}
          onSent={() => {
            void notes.mutate();
            void state.mutate();
          }}
        />
      ) : (
        /* A thread with an address, or with somebody who has never been on
           HOLD, has no user id anywhere in it — and a conversation needs one. */
        <p className="mt-4 px-1 text-[12px] leading-[17px] text-white/70">
          There is no HOLD account on the other side of this thread, so there is nobody to write to.
        </p>
      )}
    </>
  );
}

/**
 * A payment, as a bubble.
 *
 * The app's own shape (`PaymentsThread` styles.bubble): radius 16, the sign
 * and the figure at 16/900 with the ticker beside it, and the whole thing
 * tinted amber when it went out and white when it came in — so which way the
 * money moved is read from the side and the colour before any word is.
 */
function PaymentBubble({ row, mode, onOpen }: { row: Transfer; mode: DisplayMode; onOpen: () => void }) {
  const out = row.direction === "out";
  const amount = Math.abs(transferAmount(row));
  const ticker = maskTokenSymbol(tokenTicker(row), mode);
  const note = (row.note ?? "").trim();
  const pending = row.status && row.status.toLowerCase() !== "confirmed" && row.status.toLowerCase() !== "completed";

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <button
        type="button"
        onClick={onOpen}
        className={`max-w-[78%] rounded-[16px] border px-3.5 py-3 text-left transition-colors ${
          out ? "border-white/10 bg-[rgba(255,183,3,0.15)] hover:bg-[rgba(255,183,3,0.2)]" : "border-white/10 bg-white/[0.08] hover:bg-white/[0.11]"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[16px] font-extrabold tracking-[0.2px] text-white">{out ? "–" : "+"}</span>
          <span className="text-[16px] font-extrabold tabular-nums tracking-[0.2px] text-white">{amount.toFixed(2)}</span>
          <span className="pt-px text-[13px] font-bold text-white/90">{ticker}</span>
        </span>

        {/* The note is an ATTRIBUTE of this payment, so it is inside this
            bubble and never a bubble of its own: a message invites a reply and
            there is nothing to reply to an amount with. */}
        {note ? <span className="mt-1.5 block whitespace-pre-wrap break-words text-[13.5px] leading-[19px] text-white/85">{note}</span> : null}

        <span className="mt-1.5 flex items-center justify-end gap-2 text-[10.5px] text-white/60">
          {pending ? <span className="capitalize">{row.status}</span> : null}
          <span>{shortTime(row.createdAt)}</span>
        </span>
      </button>
    </div>
  );
}

/**
 * Oldest first, with a divider only where the day actually turns.
 *
 * Inserted AFTER sorting, never during: a divider decided while items are
 * still out of order draws "Today" in the middle of last week.
 */
function withDays(items: Happened[]): Row[] {
  const sorted = [...items].filter((i) => Number.isFinite(i.ts)).sort((a, b) => a.ts - b.ts);
  const out: Row[] = [];
  let day = "";
  for (const i of sorted) {
    const label = dayLabel(i.ts);
    if (label !== day) {
      day = label;
      out.push({ kind: "day", key: `d:${label}:${i.key}`, label });
    }
    out.push(i);
  }
  return out;
}

/**
 * THE SAME CONVERSATION, WITHOUT THE MONEY.
 *
 * Spaces needs a brand and a creator to be able to talk, and that is this
 * engine with a different front: same rows, same request gate, same GIFs, same
 * read receipts. What it is NOT is a Payments thread — there are no transfers
 * between a sponsor and a creator to interleave, and a listing's offers are
 * already a negotiation with its own history on its own card. So this renders
 * the words and nothing else.
 *
 * `intro` is what stands in for "nothing here yet", because on this front the
 * empty state is the point: it is where a creator writes the first message.
 */
export function WordsOnly({ peerId, peerName, intro }: { peerId: string; peerName: string; intro: string }) {
  const notes = useThreadNotes(peerId);
  const state = useChatState(peerId);
  const messages = useMemo(() => looseMessages(notes.data), [notes.data]);

  useMarkSeen(messages, () => void notes.mutate());

  const rows = useMemo(
    () => withDays(messages.map((n) => ({ kind: "msg" as const, key: `n:${n.id}`, ts: Date.parse(n.createdAt), note: n }))),
    [messages],
  );
  const waiting = state.data?.status === "pending" && state.data.requestedByMe;

  return (
    <>
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? <p className="px-1 py-5 text-center text-[13px] leading-[18px] text-white/70">{intro}</p> : null}
        {rows.map((r) =>
          r.kind === "day" ? (
            <p key={r.key} className="mt-2 text-center text-[11.5px] text-white/45">
              {r.label}
            </p>
          ) : r.kind === "msg" ? (
            <Bubble key={r.key} note={r.note} requested={waiting && r.note.mine} onWithdrawn={() => void notes.mutate()} />
          ) : null,
        )}
        {waiting ? <WaitingRow name={peerName} /> : null}
      </div>

      <Composer
        peerId={peerId}
        status={state.data?.status ?? null}
        onSent={() => {
          void notes.mutate();
          void state.mutate();
        }}
      />
    </>
  );
}

/**
 * A spot bought from this creator, as a bubble.
 *
 * ── WHY IT IS ON THE RIGHT AND WHY IT IS QUIET ──
 *
 * It is something the VIEWER did, so it sits on the viewer's side like their
 * own messages. And it is a receipt, not an announcement: no amber fill, no
 * icon shouting. The conversation is what is being read; this is the moment
 * the conversation turned into a deal, marked where it happened.
 *
 * `outbid` is here too, and says so. Somebody doubled the price and took the
 * spot — the brand was repaid in full, and a thread that quietly dropped the
 * row would leave a creator and a brand reading two different histories.
 */
function SpotBubble({ spot, peerName }: { spot: SpotBought; peerName: string }) {
  const outbid = spot.status === "outbid";
  const amount = Number(spot.amountUsdc);
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-[16px] border border-white/[0.12] bg-white/[0.07] px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.5px] text-white/60">
          <Ion name="megaphone-outline" size={13} />
          {outbid ? "Spot taken over" : "Spot booked"}
        </span>
        <p className="mt-1 text-[13.5px] leading-[19px] text-white/85">
          {outbid
            ? `Somebody doubled the price on this one. You were repaid in full.`
            : `You booked a spot with ${peerName}${Number.isFinite(amount) ? ` for $${amount.toFixed(2)}` : ""}.`}
        </p>
        <span className="mt-1.5 flex items-center justify-end gap-2 text-[10.5px] text-white/55">
          {spot.explorerUrl ? (
            <a href={spot.explorerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Receipt
            </a>
          ) : null}
          <span>{shortTime(new Date(spot.ts).toISOString())}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * A request, as a bubble: the SAME bubble as a payment, with a tag.
 *
 * It used to be a card of its own, amber-bordered, with "Payment request" in
 * capitals over it. That read as a notification sitting in the conversation,
 * and a request is not a notification: it is a payment that has not happened
 * yet (contract §1, "the thread"). So it takes the payment's shape — radius
 * 16, the figure at 16/900 with the ticker beside it, the note inside, the
 * time at the foot, the glass tint and no ground of its own — and says what
 * it is in a small tag: `Requested`, and later `Paid`, `Declined` or
 * `Cancelled`.
 *
 * Its side is the side of whoever ASKED, as a message's is its writer's: one
 * you asked for is on your side in your tint, one they asked of you is on
 * theirs.
 *
 * THE TWO SIDES DO NOT GET THE SAME BUTTONS
 *
 *   they asked you   Pay and Decline. Pay opens Quick Send with the person and
 *                    the amount locked in; the request is settled with the
 *                    withdrawal once the money is confirmed, never before.
 *   you asked        Remind and Cancel. Remind is once a day per request; a
 *                    second one gets the server's `retryAt`, said as a time.
 *
 * A closed request keeps its place and loses its buttons: the history must
 * not rearrange itself around something already read.
 */
const TAG_TONE: Record<ReturnType<typeof requestTag>, string> = {
  Requested: "bg-[rgba(255,183,3,0.16)] text-amber",
  Paid: "bg-[rgba(32,214,144,0.14)] text-[#20D690]",
  Declined: "bg-white/[0.08] text-white/65",
  Cancelled: "bg-white/[0.08] text-white/65",
};

/** The bubble's small strings, together. */
const RQ = {
  pay: "Pay",
  decline: "Decline",
  remind: "Remind",
  cancel: "Cancel",
  reminded: "Reminded. They got a friendly nudge.",
  inApp: (chain: string) => `This one is on ${chain}. Pay it in the HOLD app.`,
};

function RequestBubble({
  request,
  incoming,
  mode,
  onPay,
  onAnswered,
}: {
  request: PaymentRequest;
  incoming: boolean;
  mode: DisplayMode;
  onPay: () => void;
  onAnswered: () => void;
}) {
  const [busy, setBusy] = useState<"decline" | "cancel" | "remind" | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const amount = requestAmount(request);
  if (amount === null) return null;
  const ticker = maskTokenSymbol(request.tokenId.split(".")[0].toUpperCase(), mode);
  const tag = requestTag(request.status);
  const open = request.status === "requested";
  const payable = webCanPay(request);

  const act = async (which: "decline" | "cancel" | "remind", fn: () => Promise<unknown>, done?: string) => {
    setBusy(which);
    setSaid(null);
    try {
      await fn();
      if (done) setSaid(done);
      onAnswered();
    } catch (e) {
      setSaid(e instanceof HoldApiError ? describeRequestError(e) : describeRequestError({ status: -1 }));
      // A request that closed meanwhile is a fact to show, not an error to keep.
      if (e instanceof HoldApiError && (e.detail === "request_not_open" || e.code === "request_not_open")) onAnswered();
    } finally {
      setBusy(null);
    }
  };

  const plate =
    "inline-flex h-8 items-center justify-center rounded-[10px] px-3.5 text-[12.5px] transition-colors disabled:opacity-50 [-webkit-tap-highlight-color:transparent]";
  const glass = `${plate} bg-white/10 font-strong text-white/85 hover:bg-white/[0.16]`;

  return (
    <div className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[78%] min-w-0 rounded-[16px] border border-white/10 px-3.5 py-3 ${
          incoming ? "bg-white/[0.08]" : "bg-[rgba(255,183,3,0.15)]"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[16px] font-extrabold tabular-nums tracking-[0.2px] text-white">{amount.toFixed(2)}</span>
          <span className="pt-px text-[13px] font-bold text-white/90">{ticker}</span>
        </span>

        {request.note ? (
          <span className="mt-1.5 block whitespace-pre-wrap break-words text-[13.5px] leading-[19px] text-white/85">{request.note}</span>
        ) : null}

        {open ? (
          <span className="mt-2.5 flex flex-wrap items-center gap-2">
            {incoming ? (
              <>
                <button
                  type="button"
                  onClick={() => ("token" in payable ? onPay() : setSaid(RQ.inApp(payable.app)))}
                  className={`${plate} bg-amber font-bold text-text-on-amber hover:bg-amber-glow`}
                >
                  {RQ.pay}
                </button>
                <button type="button" disabled={!!busy} onClick={() => void act("decline", () => rejectRequest(request.id))} className={glass}>
                  {RQ.decline}
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={!!busy} onClick={() => void act("remind", () => remindRequest(request.id), RQ.reminded)} className={glass}>
                  {RQ.remind}
                </button>
                <button type="button" disabled={!!busy} onClick={() => void act("cancel", () => cancelRequest(request.id))} className={glass}>
                  {RQ.cancel}
                </button>
              </>
            )}
          </span>
        ) : null}

        {said ? <span className="mt-2 block text-[12px] leading-[17px] text-white/75">{said}</span> : null}

        <span className="mt-1.5 flex items-center justify-end gap-2 text-[10.5px] text-white/60">
          <span className={`inline-flex h-4 items-center rounded-[8px] px-1.5 text-[10px] font-extrabold uppercase tracking-[0.4px] ${TAG_TONE[tag]}`}>{tag}</span>
          <span>{shortTime(request.createdAt)}</span>
        </span>
      </div>
    </div>
  );
}

/** "Today", "Yesterday", else the date — the app's `dayLabelFromEpoch`. */
function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Freeze what the reader has just seen.
 *
 * Only notes addressed to the viewer, only those actually rendered, and the ids
 * are recorded BEFORE the request — a slow network would otherwise let the next
 * render queue the same ids again and call the endpoint once per re-render.
 */
function useMarkSeen(messages: Note[], onMarked: () => void) {
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ids = messages
      .filter((n) => !n.mine && !n.deleted && !n.seen && !sent.current.has(n.id))
      .map((n) => n.id);
    if (ids.length === 0) return;
    ids.forEach((id) => sent.current.add(id));
    markSeen(ids).then(onMarked, () => {
      // Non-fatal. A receipt that did not land is not worth an error over a
      // conversation somebody is reading — they will be marked on the next open.
    });
    // `onMarked` is a fresh closure every render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
}

/**
 * One message, in the app's own colours (`chatStyles`).
 *
 * Mine on the right in white at 14%; THEIRS on the left in near-white with
 * dark ink — the light bubble is the incoming one, which is the opposite of
 * what most dark UIs do and is what the app does, so the two sides of a
 * conversation are told apart by lightness and not only by side.
 *
 * Radius 18, 15/21 text (loose, because this is the surface built for emoji
 * and a tight ratio clips them), and the meta line right-aligned at 10.5.
 *
 * A withdrawn note keeps its place rather than vanishing: the reader's history
 * must not rearrange itself around something they have already read.
 */
function Bubble({ note, requested = false, onWithdrawn }: { note: Note; requested?: boolean; onWithdrawn?: () => void }) {
  const url = gifUrl(note.media);
  const mine = note.mine;
  const ink = mine ? "text-white/[0.92]" : "text-[rgba(13,24,32,0.92)]";
  const muted = mine ? "text-white/45" : "text-[rgba(13,24,32,0.45)]";
  const [withdrawing, setWithdrawing] = useState(false);

  /*
   * TAKING A MESSAGE BACK, WHILE IT IS STILL YOURS TO TAKE.
   *
   * `canEdit` is the SERVER's answer and never ours to derive: it goes false
   * the moment the reader opens the thread, because `markSeen` freezes what
   * they have read. So the control disappears exactly when the sentence stops
   * being only yours, and nothing here has to guess where that line is.
   *
   * The row keeps its place afterwards and reads "Message removed". A history
   * that rearranges itself around something somebody has already read is worse
   * than one that admits the gap.
   */
  const canWithdraw = mine && note.canEdit && !note.deleted;
  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      await deleteNote(note.id);
      onWithdrawn?.();
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      {canWithdraw ? (
        <button
          type="button"
          onClick={() => void withdraw()}
          disabled={withdrawing}
          aria-label="Take this message back"
          title="Take this message back"
          className="mr-1.5 mt-auto mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/0 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:text-white/80 group-hover:text-white/45"
        >
          <Ion name="close-circle" size={16} />
        </button>
      ) : null}
      <div
        className={`max-w-[78%] rounded-[18px] px-3.5 pb-[7px] pt-2.5 ${mine ? "bg-white/[0.14]" : "bg-[rgba(232,240,244,0.92)]"}`}
      >
        {note.deleted ? (
          <p className={`text-[15px] italic leading-[21px] ${muted}`}>Message removed</p>
        ) : (
          <>
            {/* The URL is BUILT, never received: `gifUrl` composes it from a
                fixed host and the opaque id the row carries. A URL from the
                wire in `src` would let whoever sent the message make this
                browser fetch anything — and the first message from a stranger
                is exactly what this bubble renders. */}
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={note.body || "GIF"} loading="lazy" className="max-h-[220px] w-full rounded-[12px] bg-black/15 object-cover" />
            ) : null}
            {note.body ? (
              <p className={`whitespace-pre-wrap break-words text-[15px] leading-[21px] ${ink} ${url ? "mt-1.5" : ""}`}>{note.body}</p>
            ) : null}
          </>
        )}
        <span className={`mt-[3px] flex items-center justify-end gap-2 text-[10.5px] ${muted}`}>
          <span>{shortTime(note.createdAt)}</span>
          {note.edited && !note.deleted ? <span>Edited</span> : null}
          {mine && requested ? <span>Requested</span> : mine && note.seen ? <span>Read</span> : null}
        </span>
      </div>
    </div>
  );
}

/**
 * "Waiting for them to accept", drawn in the conversation and not in the bar.
 *
 * It is a fact ABOUT the conversation, so the app moved it here — the bar is
 * already crowded and a notice there pushed the money row a line further away.
 */
function WaitingRow({ name }: { name: string }) {
  return (
    <p className="mx-auto max-w-[80%] rounded-[14px] bg-white/[0.06] px-3.5 py-2 text-center text-[12px] leading-[17px] text-white/75">
      Sent as a request. {name} has not answered yet, so nothing else you write arrives until they do.
    </p>
  );
}

/* ── Closing the door ─────────────────────────────────────────────── */

/**
 * BLOCK AND REPORT, ON BOTH FRONTS.
 *
 * `/payment-notes/blocks` and `/payment-notes/reports` have existed the whole
 * time and no screen on the web called either, which was survivable while the
 * only way into somebody's inbox was a payment. It stopped being survivable
 * the moment Spaces let a brand write to a creator: the door that was opened
 * has to come with the way to close it, on the same screen, in the same
 * session.
 *
 * THEY ARE TWO ACTS AND STAY TWO ACTS
 *
 * The server files a report WITHOUT blocking, deliberately — blocking on
 * somebody's behalf takes their decision away from them. So this offers the
 * second after the first rather than doing it quietly, and somebody who wants
 * only one gets only one.
 *
 * BLOCKING IS ABOUT THE PERSON, NOT THE THREAD
 *
 * It covers their notes on payments too, which is why the confirmation says so
 * rather than "you will stop seeing messages". Mute is the thread-sized
 * version and is not here: the server has no unmute, and a one-tap,
 * irreversible "stop this conversation" with no way back is worse on a screen
 * than not having it at all.
 */
export function SafetyMenu({ peerId, peerName, onBlocked }: { peerId: string; peerName: string; onBlocked?: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "block" | "report" | "done">("menu");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    setOpen(false);
    setMode("menu");
    setDetail("");
    setFailed(false);
  };

  const run = async (fn: () => Promise<unknown>, then: () => void) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
      then();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`More about ${peerName}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Ion name="ellipsis-horizontal" size={20} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 cursor-default" />
          <div className="relative w-full max-w-[420px] rounded-[20px] border border-white/[0.12] bg-[#0E2430] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {mode === "menu" ? (
              <>
                <p className="text-[15px] font-extrabold tracking-[-0.2px] text-white">{peerName}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("report")}
                    className="flex h-11 items-center gap-2.5 rounded-[14px] bg-white/[0.06] px-3.5 text-left text-[14px] font-strong text-white transition-colors hover:bg-white/[0.12]"
                  >
                    <Ion name="flag-outline" size={17} />
                    Report this conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("block")}
                    className="flex h-11 items-center gap-2.5 rounded-[14px] bg-white/[0.06] px-3.5 text-left text-[14px] font-strong text-white transition-colors hover:bg-white/[0.12]"
                  >
                    <Ion name="ban-outline" size={17} />
                    Block {peerName}
                  </button>
                </div>
              </>
            ) : null}

            {mode === "block" ? (
              <>
                <p className="text-[15px] font-extrabold tracking-[-0.2px] text-white">Block {peerName}?</p>
                <p className="mt-1.5 text-[13px] leading-[18px] text-white/70">
                  They can no longer write to you, here or on a payment. You can undo it from Account → Who can message
                  you.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => blockUser(peerId), () => { onBlocked?.(); close(); })}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-[12px] bg-white/[0.16] text-[14px] font-bold text-white transition-colors hover:bg-white/[0.22] disabled:opacity-60"
                  >
                    {busy ? "Blocking…" : "Block"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("menu")}
                    className="inline-flex h-10 items-center justify-center rounded-[12px] bg-white/10 px-4 text-[14px] font-strong text-white/85 transition-colors hover:bg-white/[0.16]"
                  >
                    Back
                  </button>
                </div>
              </>
            ) : null}

            {mode === "report" ? (
              <>
                <p className="text-[15px] font-extrabold tracking-[-0.2px] text-white">Report {peerName}</p>
                <p className="mt-1.5 text-[13px] leading-[18px] text-white/70">
                  Tell us what happened. This does not block them — you are asked about that next.
                </p>
                <textarea
                  autoFocus
                  rows={3}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value.slice(0, 280))}
                  placeholder="What happened?"
                  aria-label="What happened"
                  className="mt-2.5 w-full resize-none rounded-[14px] border border-white/[0.15] bg-white/[0.06] px-3 py-2.5 text-[14px] leading-[20px] text-white outline-none placeholder:text-white/50 focus:border-white/30"
                />
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => reportUser({ userId: peerId, ...(detail.trim() ? { detail: detail.trim() } : {}) }),
                        () => setMode("done"),
                      )
                    }
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-[12px] bg-amber text-[14px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:bg-white/[0.12] disabled:text-white/50"
                  >
                    {busy ? "Sending…" : "Send report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("menu")}
                    className="inline-flex h-10 items-center justify-center rounded-[12px] bg-white/10 px-4 text-[14px] font-strong text-white/85 transition-colors hover:bg-white/[0.16]"
                  >
                    Back
                  </button>
                </div>
              </>
            ) : null}

            {mode === "done" ? (
              <>
                <p className="text-[15px] font-extrabold tracking-[-0.2px] text-white">Report sent</p>
                <p className="mt-1.5 text-[13px] leading-[18px] text-white/70">
                  We will look at it. Do you also want to block {peerName}?
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => blockUser(peerId), () => { onBlocked?.(); close(); })}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-[12px] bg-white/[0.16] text-[14px] font-bold text-white transition-colors hover:bg-white/[0.22] disabled:opacity-60"
                  >
                    {busy ? "Blocking…" : "Block them too"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex h-10 items-center justify-center rounded-[12px] bg-white/10 px-4 text-[14px] font-strong text-white/85 transition-colors hover:bg-white/[0.16]"
                  >
                    No, thanks
                  </button>
                </div>
              </>
            ) : null}

            {failed ? <p className="mt-2 text-[12px] leading-[17px] text-white/75">That did not go through. Try again.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ── The bar ──────────────────────────────────────────────────────── */

function Composer({
  peerId,
  status,
  onSent,
}: {
  peerId: string;
  status: "none" | "pending" | "accepted" | "declined" | null;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [gif, setGif] = useState<Gif | null>(null);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState(false);

  const canSend = !sending && (text.trim().length > 0 || gif !== null);

  const submit = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    setRefused(false);
    try {
      await sendMessage(peerId, text.trim(), gif?.id ?? null);
      // Cleared only on success, so a refused GIF keeps its caption: losing the
      // words along with the picture is the worse of the two failures.
      setText("");
      setGif(null);
      onSent();
    } catch {
      setRefused(true);
    } finally {
      setSending(false);
    }
  }, [canSend, peerId, text, gif, onSent]);

  return (
    /*
      NO GROUND OF ITS OWN.

      This used to fade to #0A1B24 — a flat navy that exists nowhere else in
      the product. The page behind it is a gradient, so a single colour is
      wrong at every scroll position except one, and what it drew was a dark
      band with a visible edge sitting under the bar.

      A sticky bar does not need to repaint the floor; it needs the floor not
      to read through it. So the wrapper carries no background at all and the
      bar itself blurs what passes behind, which is what the top bar already
      does at the other end of the screen.
    */
    <div className="sticky bottom-0 mt-4 pb-1 pt-3">
      {refused ? (
        <p className="mb-2 px-1 text-[12px] leading-[17px] text-white/75">
          That did not go through. The GIF may have been refused — try it without one.
        </p>
      ) : null}

      {gif ? (
        <div className="mb-2 flex items-center gap-2.5 rounded-[14px] border border-white/[0.12] bg-white/[0.06] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gif.previewUrl} alt={gif.title} className="h-12 w-16 rounded-[9px] object-cover" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/80">{gif.title || "GIF"}</span>
          <button
            type="button"
            onClick={() => setGif(null)}
            aria-label="Remove GIF"
            className="shrink-0 rounded-full p-1 text-white/70 transition-colors hover:text-white"
          >
            <Ion name="close-circle" size={18} />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-[20px] border border-white/[0.12] bg-white/10 px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {/* It says GIF.

            It was a smiley, which on every keyboard anyone has used opens
            emoji — so the one control on this bar that is not typing looked
            like the one thing this bar cannot do, and the GIFs read as
            missing. The word is three characters and it is unambiguous. */}
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label="Add a GIF"
          title="Add a GIF"
          className={`flex h-9 shrink-0 items-center justify-center rounded-full px-2.5 text-[11.5px] font-extrabold tracking-[0.3px] transition-colors ${
            gif ? "bg-amber text-[#0F0F1A]" : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          GIF
        </button>
        <textarea
          id="chat-composer"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX_LENGTH * 4))}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — what every chat on a
            // keyboard does, and the reason this is a textarea and not an input.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          placeholder={status === "none" ? "Say something — it arrives as a request" : "Type a message…"}
          aria-label="Message"
          className="max-h-32 min-h-[36px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-[20px] text-white outline-none placeholder:text-white/60"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-[#0F0F1A] transition-opacity disabled:bg-white/[0.12] disabled:text-white/50"
        >
          <Ion name={sending ? "ellipsis-horizontal" : "arrow-up"} size={18} />
        </button>
      </div>

      {picking ? (
        <GifPicker
          onClose={() => setPicking(false)}
          onPick={(g) => {
            setGif(g);
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}

/* ── The GIF grid ─────────────────────────────────────────────────── */

/**
 * Searched through OUR server, never Giphy directly: a key in this bundle is a
 * key that cannot be rotated without a deploy, and the rating is enforced where
 * a query parameter cannot reach it.
 *
 * An empty list has three different causes and each gets its own sentence —
 * nothing matched (about the search), the quota is spent (about us), no key at
 * all (about the environment). Saying the first when the third is true teaches
 * somebody their search was bad.
 */
function GifPicker({ onClose, onPick }: { onClose: () => void; onPick: (g: Gif) => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [answer, setAnswer] = useState<{ available: boolean; exhausted: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 350ms: long enough that a typed word is one round trip, short enough that
    // the grid feels live. Per keystroke would be a request to us and then to
    // Giphy for every letter.
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(() => {
      searchGifs(q).then(
        (res) => {
          if (cancelled) return;
          setGifs(res.gifs);
          setAnswer({ available: res.available, exhausted: !!res.exhausted });
          setLoading(false);
        },
        () => {
          if (cancelled) return;
          setGifs([]);
          setAnswer({ available: false, exhausted: false });
          setLoading(false);
        },
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  const empty =
    !loading && gifs.length === 0
      ? answer && !answer.available
        ? "GIFs are not switched on here."
        : answer?.exhausted
          ? "GIFs are out for now. Try again later."
          : "Nothing matched that."
      : null;

  return (
    <div className="mt-2 rounded-[18px] border border-white/[0.12] bg-[#0E2430] p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/[0.1] bg-white/10 px-3">
          <Ion name="search" size={15} className="shrink-0 text-white/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search GIFs"
            aria-label="Search GIFs"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/60"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-[12px] px-2.5 py-2 text-[13px] font-strong text-white/80 transition-colors hover:text-white"
        >
          Close
        </button>
      </div>

      {empty ? (
        <p className="py-6 text-center text-[13px] text-white/70">{empty}</p>
      ) : (
        <div className="mt-2.5 grid max-h-[240px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {gifs.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g)}
              className="overflow-hidden rounded-[12px] bg-white/[0.06] transition-opacity hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.previewUrl} alt={g.title} loading="lazy" className="h-[92px] w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-right text-[10.5px] text-white/55">Powered by GIPHY</p>
    </div>
  );
}

/* ── ─────────────────────────────────────────────────────────────── */

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
