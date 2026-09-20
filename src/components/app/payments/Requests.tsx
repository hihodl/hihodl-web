"use client";

/**
 * "Somebody wants to talk to you" — the chat requests waiting to be answered.
 *
 * WHY THE TEXT IS SHOWN HERE AND NOT IN THE PUSH
 *
 * You cannot judge whether a conversation is worth having without seeing what
 * was said. But the push that announced the request deliberately carried none:
 * a lock screen is the one delivery nobody can decline in advance. So the words
 * wait here, behind a screen somebody chose to open.
 *
 * WHY A DECLINE SAYS NOTHING
 *
 * It tells the sender nothing, now or later, and their own message is not
 * deleted — deleting it would change what THEY see on their screen, and that
 * change is exactly the signal a silent decline exists to avoid. From outside,
 * a decline and an unanswered request look the same: silence.
 *
 * Ported from the app's requests surface behind `/payment-notes/requests`.
 */

import { useState } from "react";

import { answerRequest, useChatRequests, type ChatRequest } from "@/lib/app/chat";

import { Ion } from "../ion";
import { cardClass } from "../wallet/app-kit";

export function ChatRequests({ onAnswered }: { onAnswered?: () => void }) {
  const requests = useChatRequests();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  const shown = (requests.data ?? []).filter((r) => !gone.has(r.chatId));
  if (shown.length === 0) return null;

  async function answer(r: ChatRequest, accept: boolean) {
    setBusy(r.chatId);
    try {
      await answerRequest(r.chatId, accept);
      // Removed here rather than by a refetch, so the row does not sit there
      // for a poll's worth of seconds after somebody has answered it.
      setGone((g) => new Set(g).add(r.chatId));
      void requests.mutate();
      onAnswered?.();
    } catch {
      // Left in place. An answer that did not land must not look like one that did.
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-4 flex flex-col gap-2.5">
      <h2 className="px-1 text-[12px] font-extrabold uppercase tracking-[0.6px] text-white/70">
        {shown.length === 1 ? "Message request" : `${shown.length} message requests`}
      </h2>
      {shown.map((r) => (
        <div key={r.chatId} className={`${cardClass} flex flex-col gap-2.5 px-3.5 py-3`}>
          <div className="flex items-start gap-3">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
              <Ion name="person-outline" size={16} className="text-white/75" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-extrabold tracking-[-0.2px] text-white">
                {r.fromDisplayName?.trim() || (r.fromHandle ? `@${r.fromHandle}` : "Someone on HOLD")}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-[19px] text-white/85">
                {r.body}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy === r.chatId}
              onClick={() => void answer(r, true)}
              className="h-9 flex-1 rounded-[12px] bg-amber text-[13.5px] font-extrabold text-[#0F0F1A] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy === r.chatId}
              onClick={() => void answer(r, false)}
              className="h-9 flex-1 rounded-[12px] border border-white/[0.22] bg-white/10 text-[13.5px] font-bold text-white transition-colors hover:bg-white/[0.16] disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
