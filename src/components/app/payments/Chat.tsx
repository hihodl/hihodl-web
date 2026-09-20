"use client";

/**
 * The conversation, ported from the app's `src/payments/ThreadComposer.tsx`,
 * `GifPickerSheet.tsx` and the chat half of `PaymentsThread.tsx`.
 *
 * WHERE THE COMPOSER SITS, AND WHY
 *
 * Below the payments, not above them. The thread is a money screen: what
 * somebody opened it to see is the history, and a composer that pushed that
 * down would make this look like a chat that happens to move money rather than
 * the other way round. The app lands on the same order for the same reason.
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

/* ── The conversation ─────────────────────────────────────────────── */

export function Conversation({ peerId, peerName }: { peerId: string | null; peerName: string }) {
  const notes = useThreadNotes(peerId);
  const state = useChatState(peerId);
  const messages = useMemo(() => looseMessages(notes.data), [notes.data]);

  useMarkSeen(messages, () => void notes.mutate());

  if (!peerId) {
    // State 1. A thread with an address, or with somebody who has never been
    // on HOLD, has no user id anywhere in it — and a conversation needs one.
    return (
      <p className="mt-3 px-1 text-[12px] leading-[17px] text-white/70">
        There is no HOLD account on the other side of this thread, so there is nobody to write to.
      </p>
    );
  }

  return (
    <>
      <div className="mt-5 flex flex-col gap-2">
        {messages.length === 0 && notes.data !== undefined ? (
          <p className="px-1 text-[13px] leading-[18px] text-white/70">
            No messages yet. Say something to {peerName}.
          </p>
        ) : null}
        {messages.map((n) => (
          <Bubble key={n.id} note={n} />
        ))}
        {state.data?.status === "pending" && state.data.requestedByMe ? <WaitingRow name={peerName} /> : null}
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
 * One message.
 *
 * Mine right and light, theirs left and dark — the app's own arrangement. A
 * withdrawn note keeps its place rather than vanishing: the reader's history
 * must not rearrange itself around something they have already read.
 */
function Bubble({ note }: { note: Note }) {
  const url = gifUrl(note.media);
  const mine = note.mine;

  if (note.deleted) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <p className="rounded-[16px] border border-dashed border-white/[0.18] px-3.5 py-2 text-[13px] italic text-white/60">
          Message withdrawn
        </p>
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[78%] flex-col gap-1.5 rounded-[18px] px-3.5 py-2.5 ${
          mine ? "bg-white/[0.16] text-white" : "bg-[#15313D] text-white"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={note.body || "GIF"}
            loading="lazy"
            className="max-h-[220px] w-full rounded-[12px] object-cover"
          />
        ) : null}
        {note.body ? (
          <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[20px]">{note.body}</p>
        ) : null}
        <span className="flex items-center gap-1.5 self-end text-[11px] text-white/70">
          {note.edited ? <span>edited</span> : null}
          <span>{shortTime(note.createdAt)}</span>
          {mine && note.seen ? <Ion name="checkmark-done" size={13} className="text-white/80" /> : null}
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
