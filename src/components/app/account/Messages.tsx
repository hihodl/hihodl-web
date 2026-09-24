"use client";

/**
 * Who can put something in your inbox.
 *
 * `GET/PUT /payment-notes/settings` has answered this the whole time and no
 * screen asked it, so the setting existed and could only be changed from the
 * app. It matters more now than it did: Spaces opens a second door into the
 * same inbox, and a creator with a listing on a busy event is exactly the
 * person a stranger has a reason to write to.
 *
 * THE THREE ANSWERS ARE THE SERVER'S, AND SO IS WHAT THEY MEAN
 *
 *   everyone   a first message from a stranger arrives as a request, which
 *              you accept or decline. Not "anyone can reach you" — the gate
 *              is still there; this is who may knock.
 *   paid       only people you have already paid or been paid by. A request
 *              from anybody else is refused, silently, on their side.
 *   nobody     no new conversations at all. The ones you already have carry
 *              on: this closes the door, it does not empty the room.
 *
 * A DECLINE IS SILENT, AND THAT IS WHY THIS PAGE SAYS SO
 *
 * `POST /messages` answers the same whether the message was delivered,
 * declined, blocked or refused by this setting — on purpose, so nobody can
 * probe who has shut them out. Which means the only place this setting is ever
 * explained is here, on the screen of the person who set it.
 */

import { useEffect, useState } from "react";

import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { getChatSettings, listBlocked, setChatSettings, unblockUser, type ChatRequestsFrom } from "@/lib/app/chat";

import { BackHeader, Column, HoldCard, SectionTitle } from "../hold";
import { Ion } from "../ion";

const CHOICES: { key: ChatRequestsFrom; label: MessageKey; body: MessageKey }[] = [
  { key: "everyone", label: "account.messages.everyone", body: "account.messages.everyoneBody" },
  { key: "paid", label: "account.messages.paid", body: "account.messages.paidBody" },
  { key: "nobody", label: "account.messages.nobody", body: "account.messages.nobodyBody" },
];

export function MessagesSettings({ onBack }: { onBack: () => void }) {
  const [value, setValue] = useState<ChatRequestsFrom | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<ChatRequestsFrom | null>(null);
  const t = useT();

  useEffect(() => {
    let alive = true;
    getChatSettings().then(
      (s) => alive && setValue(s.chatRequestsFrom),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  /*
   * The choice moves as soon as it is tapped and goes back if the save fails.
   * A radio that waits for a round trip before it fills reads as broken, and
   * a radio that stays put after a failure lies about what the server holds.
   */
  const choose = async (next: ChatRequestsFrom) => {
    if (next === value || saving) return;
    const before = value;
    setValue(next);
    setSaving(next);
    setFailed(false);
    try {
      await setChatSettings(next);
    } catch {
      setValue(before);
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Column>
      <BackHeader title={t("account.home.whoCanMessage")} onBack={onBack} />

      <HoldCard>
        {CHOICES.map((c) => {
          const on = value === c.key;
          return (
            <button
              key={c.key}
              type="button"
              disabled={value === null}
              onClick={() => void choose(c.key)}
              aria-pressed={on}
              className="flex w-full items-start gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-60"
            >
              <span
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-amber bg-[rgba(255,183,3,0.18)]" : "border-white/25"
                }`}
              >
                {on ? <Ion name="checkmark" size={12} color="#FFB703" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-strong text-white">{t(c.label)}</span>
                <span className="mt-0.5 block text-[12.5px] leading-[17px] text-white/[0.62]">{t(c.body)}</span>
              </span>
            </button>
          );
        })}
      </HoldCard>

      {failed ? (
        <p className="mt-3 px-1 text-[12.5px] leading-[17px] text-white/70">
          {t("account.messages.saveFailed")}
        </p>
      ) : null}

      <p className="mt-3 px-1 text-[12.5px] leading-[17px] text-white/[0.55]">
        {t("account.messages.silent")}
      </p>

      <Blocked />
    </Column>
  );
}

/**
 * Who you have blocked, and the way back.
 *
 * This list is the reason the block confirmation can promise an undo. A
 * product that lets somebody be shut out with one tap and gives no screen
 * where that can be seen or reversed has made a decision permanent that was
 * never meant to be.
 *
 * It draws nothing when the list is empty: a "Blocked (0)" heading on an
 * account that has never blocked anybody is a suggestion.
 */
function Blocked() {
  const [rows, setRows] = useState<{ userId: string; aliasHandle: string | null; displayName: string | null }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    let alive = true;
    listBlocked().then(
      (r) => alive && setRows(r.blocked ?? []),
      () => alive && setRows([]),
    );
    return () => {
      alive = false;
    };
  }, []);

  const undo = async (userId: string) => {
    setBusy(userId);
    try {
      await unblockUser(userId);
      setRows((prev) => (prev ?? []).filter((b) => b.userId !== userId));
    } finally {
      setBusy(null);
    }
  };

  if (!rows || rows.length === 0) return null;

  return (
    <>
      <SectionTitle>{t("account.messages.blocked")}</SectionTitle>
      <HoldCard>
        {rows.map((b) => (
          <div key={b.userId} className="flex items-center gap-3 px-3.5 py-3">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-strong text-white">
              {b.displayName?.trim() || (b.aliasHandle ? `@${b.aliasHandle}` : t("account.messages.someone"))}
            </span>
            <button
              type="button"
              disabled={busy === b.userId}
              onClick={() => void undo(b.userId)}
              className="shrink-0 rounded-[10px] bg-white/10 px-3 py-1.5 text-[12.5px] font-strong text-white/85 transition-colors hover:bg-white/[0.16] disabled:opacity-50"
            >
              {busy === b.userId ? "…" : t("account.messages.unblock")}
            </button>
          </div>
        ))}
      </HoldCard>
    </>
  );
}
