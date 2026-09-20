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
  gifUrl,
  looseMessages,
  markSeen,
  searchGifs,
  sendMessage,
  useChatState,
  useThreadNotes,
  type Gif,
  type Note,
} from "@/lib/app/chat";

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
  | { kind: "msg"; key: string; ts: number; note: Note };
type Row = Happened | { kind: "day"; key: string; label: string };

export function Conversation({
  peerId,
  peerName,
  payments,
  mode,
  onOpenTx,
}: {
  peerId: string | null;
  peerName: string;
  payments: readonly Transfer[];
  mode: DisplayMode;
  onOpenTx: (id: string) => void;
}) {
  const notes = useThreadNotes(peerId);
  const state = useChatState(peerId);
  const messages = useMemo(() => looseMessages(notes.data), [notes.data]);

  useMarkSeen(messages, () => void notes.mutate());

  /* Oldest first, newest at the foot, where the composer is — the app inverts
     its list to get the same order out of a phone's scroll. Day dividers are
     inserted after sorting, so one is drawn only where the day actually turns. */
  const rows = useMemo<Row[]>(() => {
    const items: Happened[] = [
      ...payments.map((t) => ({ kind: "pay" as const, key: `t:${t.id}`, ts: Date.parse(t.createdAt), row: t })),
      ...messages.map((n) => ({ kind: "msg" as const, key: `n:${n.id}`, ts: Date.parse(n.createdAt), note: n })),
    ]
      .filter((i) => Number.isFinite(i.ts))
      .sort((a, b) => a.ts - b.ts);

    const out: Row[] = [];
    let day = "";
    for (const i of items) {
      const label = dayLabel(i.ts);
      if (label !== day) {
        day = label;
        out.push({ kind: "day", key: `d:${label}:${i.key}`, label });
      }
      out.push(i);
    }
    return out;
  }, [payments, messages]);

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
          ) : (
            <Bubble key={r.key} note={r.note} requested={waiting && r.note.mine} />
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
function Bubble({ note, requested = false }: { note: Note; requested?: boolean }) {
  const url = gifUrl(note.media);
  const mine = note.mine;
  const ink = mine ? "text-white/[0.92]" : "text-[rgba(13,24,32,0.92)]";
  const muted = mine ? "text-white/45" : "text-[rgba(13,24,32,0.45)]";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
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
    <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-[#0A1B24] via-[#0A1B24] to-transparent pb-1 pt-3">
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

      <div className="flex items-end gap-2 rounded-[20px] border border-white/[0.12] bg-white/10 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label="Add a GIF"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Ion name="happy-outline" size={20} />
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
