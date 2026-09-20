"use client";

/**
 * The chat half of Payments: `/payment-notes/*`, read and written from the web.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The app's Payments list is the merge of two halves — transfers, and
 * conversations. The web shipped with only the money because a stale checkout
 * was read and the whole router was reported missing. It is not missing: it is
 * 16 routes with Giphy, chat requests, mute and blocks behind them, and every
 * one of them is `requireAuth` and nothing more.
 *
 * THE ONE THING ON THE WEB THAT WRITES
 *
 * Everything else on these screens is view only because a payment needs a key
 * and the key is on the phone. A sentence needs no key. So this is the one
 * place the web is not a lesser copy of the app: you can hold a conversation
 * here exactly as you can there.
 *
 * TWO FRONTS, ONE ENGINE
 *
 * The brand ↔ creator chat in Spaces is this same engine — same rows, same
 * request gate, same GIFs — with a different front. Nothing here is shaped for
 * Payments specifically, which is why it lives in `lib/app` and not in
 * `components/app/payments`.
 *
 * THE RULES THIS FILE OBEYS, AND WHY THEY ARE THE SERVER'S
 *
 *   - A first message to a stranger is a REQUEST. The server decides, not us.
 *   - A decline is SILENT. `POST /messages` answers the same whether the
 *     message was delivered, declined, blocked or refused by a privacy
 *     setting. We must not try to tell them apart, and we do not.
 *   - The caller's OWN pending request is the one state disclosed, because it
 *     is the caller's state and not the recipient's decision.
 *   - A GIF is sent as an ID. What gets rendered is built here from a fixed
 *     host, so no URL a sender chose ever reaches an <img> on the reader's
 *     screen.
 */

import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { read } from "./hold-api";

/* ── What the server says ─────────────────────────────────────────── */

/**
 * A row in the inbox: who you have been talking to, newest first.
 * `payment-chats.service.ts` › ConversationRow, field for field.
 */
export interface Conversation {
  peerId: string;
  aliasHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Empty when the last message was only a GIF — `lastHasMedia` says so. */
  lastBody: string;
  lastHasMedia: boolean;
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
}

/**
 * A note. Either written on a payment (an attribute of that payment) or loose
 * (`isMessage`, a bubble of its own).
 *
 * The distinction is not cosmetic, and the app's own types say why: a note is
 * one per payment and proved by the payment; a message is many, and the only
 * thing standing behind it is that the reader accepted the conversation.
 */
export interface Note {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  /** True when the viewer wrote it. */
  mine: boolean;
  /** Withdrawn by its author: `body` arrives empty and the row reads as removed. */
  deleted: boolean;
  edited: boolean;
  createdAt: string;
  /** The reader opened the thread. On your own note this is a read receipt. */
  seen: boolean;
  seenAt: string | null;
  /** Whether YOU may still change it. The server decides; we never derive it. */
  canEdit: boolean;
  isMessage: boolean;
  media?: { provider: string; id: string } | null;
}

export interface ChatState {
  /** `none` = a first message would arrive as a request. */
  status: "none" | "pending" | "accepted" | "declined";
  requestedByMe: boolean;
  chatId: string | null;
}

export interface ChatRequest {
  chatId: string;
  fromUserId: string;
  fromHandle: string | null;
  fromDisplayName: string | null;
  body: string;
  createdAt: string;
}

export interface Gif {
  id: string;
  /** The picker grid only. What is SENT is the id. */
  previewUrl: string;
  width: number | null;
  height: number | null;
  title: string;
}

export type ChatRequestsFrom = "everyone" | "paid" | "nobody";

/** Mirrors the column's CHECK. The server is the authority; this is the hint. */
export const NOTE_MAX_LENGTH = 280;

/**
 * Where a GIF is rendered from.
 *
 * A fixed host and an id we validate, never a URL the sender supplied — the
 * app's `gifUrl()`, unchanged. The `<img>` on a reader's screen must not be
 * pointable by whoever typed the message.
 */
export function gifUrl(media: { provider: string; id: string } | null | undefined): string | null {
  if (!media || media.provider !== "giphy") return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(media.id)) return null;
  return `https://media.giphy.com/media/${media.id}/200.gif`;
}

/* ── Calls ────────────────────────────────────────────────────────── */

export function listConversations(): Promise<{ conversations: Conversation[] }> {
  return read("payment-notes/conversations");
}

export function listThreadNotes(peerId: string, limit = 200): Promise<{ notes: Note[] }> {
  return read(`payment-notes/thread/${encodeURIComponent(peerId)}?limit=${limit}`);
}

export function getChatState(peerId: string): Promise<{ chat: ChatState }> {
  return read(`payment-notes/chat/${encodeURIComponent(peerId)}`);
}

/**
 * Send a loose message.
 *
 * `state` is `requested` only for the caller's own unanswered request. Every
 * other outcome — delivered, declined, blocked, refused by a setting — answers
 * `delivered`, on purpose. Do not add code that tries to distinguish them.
 */
export function sendMessage(
  peerId: string,
  body: string,
  gifId?: string | null,
): Promise<{ sent: boolean; note: { id: string; createdAt: string } | null; state: "requested" | "delivered" }> {
  return read("payment-notes/messages", {
    json: { userId: peerId, ...(body ? { body } : {}), ...(gifId ? { gifId } : {}) },
  });
}

export function listRequests(): Promise<{ requests: ChatRequest[] }> {
  return read("payment-notes/requests");
}

export function answerRequest(chatId: string, accept: boolean): Promise<{ accepted: boolean }> {
  return read(`payment-notes/requests/${encodeURIComponent(chatId)}`, { json: { accept } });
}

export function muteChat(peerId: string): Promise<{ muted: boolean }> {
  return read(`payment-notes/chat/${encodeURIComponent(peerId)}/mute`, { json: {} });
}

/**
 * Freeze what the reader has just read. From this moment the author can no
 * longer edit or withdraw those notes — which is why it takes the ids that were
 * actually put on a screen, and never "the whole conversation".
 */
export function markSeen(noteIds: string[]): Promise<{ marked: number }> {
  return read("payment-notes/seen", { json: { noteIds } });
}

export function deleteNote(noteId: string): Promise<{ deleted: boolean }> {
  return read(`payment-notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
}

/**
 * Search GIFs through our own server.
 *
 * The Giphy key never reaches this bundle: a key in a bundle cannot be rotated
 * without a release, and this codebase has already burned one that way. The
 * rating is enforced server-side too, where a query parameter cannot reach it.
 */
export function searchGifs(q: string, limit = 24): Promise<{ gifs: Gif[]; available: boolean; exhausted?: boolean }> {
  const query = q.trim();
  return read(`payment-notes/gifs?limit=${limit}${query ? `&q=${encodeURIComponent(query)}` : ""}`);
}

export function getChatSettings(): Promise<{ chatRequestsFrom: ChatRequestsFrom }> {
  return read("payment-notes/settings");
}

export function setChatSettings(chatRequestsFrom: ChatRequestsFrom): Promise<unknown> {
  return read("payment-notes/settings", { json: { chatRequestsFrom }, method: "PUT" });
}

/* ── Hooks ────────────────────────────────────────────────────────── */

/**
 * Keyed by the person, like every other money hook, so signing out cannot
 * leave one person's inbox in another person's cache.
 */
function useChatRead<T>(
  name: string | null,
  fetcher: () => Promise<T>,
  extra?: string,
  refreshInterval = 0,
) {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<T>(uid && name ? ["chat", uid, name, extra ?? ""] : null, fetcher, {
    revalidateOnFocus: true,
    focusThrottleInterval: 15_000,
    shouldRetryOnError: false,
    refreshInterval,
  });
}

/**
 * How often a conversation looks for something new, in milliseconds.
 *
 * Chat is the one thing on these screens that arrives without the reader doing
 * anything, so unlike the money hooks it cannot wait for a focus event. Fifteen
 * seconds sits well inside the endpoint's own budget — sixty calls a minute per
 * person for conversations, and no limit at all on a thread read.
 *
 * There is no socket here on purpose: the backend has no realtime channel for
 * notes, so a poll is the honest shape rather than a stopgap.
 */
export const CHAT_POLL_MS = 15_000;

/** The inbox: who you have been talking to, newest first. */
export function useConversations() {
  return useChatRead<Conversation[]>(
    "conversations",
    async () => (await listConversations()).conversations,
    "",
    CHAT_POLL_MS,
  );
}

export function useThreadNotes(peerId: string | null) {
  return useChatRead<Note[]>(
    peerId ? "thread" : null,
    async () => (await listThreadNotes(peerId!)).notes,
    peerId ?? "",
    CHAT_POLL_MS,
  );
}

export function useChatState(peerId: string | null) {
  return useChatRead<ChatState>(
    peerId ? "state" : null,
    async () => (await getChatState(peerId!)).chat,
    peerId ?? "",
  );
}

export function useChatRequests() {
  return useChatRead<ChatRequest[]>("requests", async () => (await listRequests()).requests);
}

/* ── Reading the rows ─────────────────────────────────────────────── */

/** What the inbox row says under the name. "You: " is the app's own prefix. */
export function conversationLine(c: Conversation): string {
  const body = c.lastHasMedia && !c.lastBody ? "GIF" : c.lastBody;
  return c.lastFromMe ? `You: ${body}` : body;
}

/** The name to show, in the order the app resolves it. */
export function conversationName(c: Conversation): string {
  return c.displayName?.trim() || (c.aliasHandle ? `@${c.aliasHandle}` : "Someone on HOLD");
}

/**
 * The other person's id, from the only source that cannot be wrong.
 *
 * Every note carries both user ids, so the one that is not yours is theirs. The
 * app needs a search round trip for this because its threads are keyed on a
 * handle; the web's inbox is keyed on the peer id already, so this only has to
 * cover threads opened from the money side.
 */
export function peerFromNotes(notes: Note[] | undefined): string | null {
  for (const n of notes ?? []) {
    const peer = n.mine ? n.toUserId : n.fromUserId;
    if (peer) return peer;
  }
  return null;
}

/**
 * The notes that belong in their own bubble.
 *
 * Notes WITH a payment behind them are dropped: they arrive attached to their
 * transfer row, and drawing them here as well would double every note.
 */
export function looseMessages(notes: Note[] | undefined): Note[] {
  return (notes ?? []).filter((n) => n.isMessage);
}
