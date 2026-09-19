"use client";

/**
 * Ready to publish: the publish gate's checks (`publishRefusal` on the
 * backend), in its order, so it never says "ready" about a listing the server
 * would refuse. Like the app's X banner, every line has a state you can read
 * at a glance and, when it is not done, ONE thing to do about it.
 *
 *   1. X account     verified, and at least 90 days old
 *   2. Solana wallet an address sponsors pay (the HOLD wallet, else one proved)
 *   3. USDC account  that address can already hold USDC, read from the chain
 *                    the way the gate reads it (lib/wallet/api usdcAccountState)
 *
 * On the web a listing is paid on Solana only. Base and Polygon come with the
 * HOLD app's wallet, so the checklist ends on one line pointing there.
 *
 * `compact` is the strip the Overview shows while something is missing (and
 * never once everything is done).
 */

import Link from "next/link";

import { MIN_X_ACCOUNT_AGE_DAYS, type XAccountStatus } from "@/lib/creator/types";
import { useHoldWallet, useUsdcAccount } from "@/lib/app/hold-wallet";
import { usePayout } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { CopyButton } from "../front/kit";
import { MoreChainsLine } from "../MoreChains";
import { useShell } from "../Shell";
import { glass } from "../ui";

type State = "done" | "todo" | "wait" | "unknown";

interface Action {
  label: string;
  href?: string;
  /** A value to copy instead of a place to go. */
  copy?: string;
}

interface Item {
  key: string;
  state: State;
  label: string;
  sub: string;
  action?: Action;
}

function xItem(x: XAccountStatus | null, href: (p: string) => string): Item {
  const go = href("/account?view=x");
  const label = "X account";
  if (!x || !x.linked) {
    return { key: "x", state: "todo", label, sub: `Verified and ${MIN_X_ACCOUNT_AGE_DAYS}+ days old`, action: { label: "Connect X", href: go } };
  }
  const who = `@${x.handle}`;
  if (x.canPublish) return { key: "x", state: "done", label, sub: `${who}, verified` };
  switch (x.refusal) {
    case "x_not_verified":
      return { key: "x", state: "todo", label, sub: `${who} has no check mark on X`, action: { label: "Change account", href: go } };
    case "x_account_too_new": {
      const created = x.accountCreatedAt ? Date.parse(x.accountCreatedAt) : NaN;
      const on = Number.isFinite(created)
        ? new Date(created + MIN_X_ACCOUNT_AGE_DAYS * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : null;
      return {
        key: "x",
        state: "wait",
        label,
        sub: on ? `${who} turns ${MIN_X_ACCOUNT_AGE_DAYS} days old on ${on}` : `${who} must be ${MIN_X_ACCOUNT_AGE_DAYS}+ days old`,
        action: { label: "See X account", href: go },
      };
    }
    default:
      return { key: "x", state: "todo", label, sub: `X needs to confirm ${who} again`, action: { label: "Connect again", href: go } };
  }
}

function useItems(): Item[] | null {
  const { x } = useShell();
  const payout = usePayout();
  const w = useHoldWallet();
  const href = useProductHref();
  const address = payout.data?.solana.address ?? null;
  const usdc = useUsdcAccount(address);
  if (!payout.data && !payout.error) return null;

  const items: Item[] = [xItem(x, href)];

  if (address) {
    items.push({
      key: "wallet",
      state: "done",
      label: "Solana wallet",
      sub: payout.data?.solana.source === "hold" ? "Your HOLD wallet" : "Another wallet, proved by signature",
    });
  } else {
    const action: Action =
      w.kind === "web" && w.unregistered
        ? { label: "Unlock wallet", href: href("/wallet") }
        : w.canCreate
          ? { label: "Make wallet", href: href("/wallet") }
          : { label: "Set up", href: href("/account?view=payout") };
    items.push({ key: "wallet", state: "todo", label: "Solana wallet", sub: "Where sponsors pay you, in USDC", action });
  }

  if (!address) {
    items.push({ key: "usdc", state: "unknown", label: "USDC account", sub: "Checked once you have a wallet" });
  } else if (usdc.data === "ready") {
    items.push({ key: "usdc", state: "done", label: "USDC account", sub: "Open, sponsors can pay you" });
  } else if (usdc.data === "missing") {
    items.push({
      key: "usdc",
      state: "todo",
      label: "USDC account",
      sub: "Receive any amount of USDC once to open it",
      action: { label: "Copy address", copy: address },
    });
  } else if (usdc.data) {
    items.push({
      key: "usdc",
      state: "todo",
      label: "USDC account",
      sub: usdc.data === "frozen" ? "Frozen on this wallet" : "Not usable on this wallet",
      action: { label: "Use another wallet", href: href("/account?view=other-wallet") },
    });
  } else {
    items.push({ key: "usdc", state: "unknown", label: "USDC account", sub: usdc.error ? "Checked again when you publish" : "Checking…" });
  }
  return items;
}

const MARK: Record<State, { cls: string; glyph: string; word: string }> = {
  done: { cls: "bg-success/20 text-success", glyph: "✓", word: "Done" },
  todo: { cls: "bg-amber/20 text-amber", glyph: "!", word: "To do" },
  wait: { cls: "bg-amber/20 text-amber", glyph: "…", word: "Waiting" },
  unknown: { cls: "bg-white/10 text-[#9FB7C2]", glyph: "·", word: "Not yet" },
};

function Mark({ state }: { state: State }) {
  const m = MARK[state];
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-semibold ${m.cls}`} aria-label={m.word} role="img">
      {m.glyph}
    </span>
  );
}

const actionCls =
  "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-[9px] border border-amber/40 bg-amber/10 px-3 text-tiny font-medium text-amber transition-colors hover:bg-amber/20";

function ActionButton({ action }: { action: Action }) {
  if (action.copy) return <CopyButton value={action.copy} label={action.label} className={actionCls} />;
  return (
    <Link href={action.href ?? "#"} className={actionCls}>
      {action.label}
    </Link>
  );
}

export function ReadyToPublish({ compact = false }: { compact?: boolean }) {
  const { role } = useShell();
  const items = useItems();
  if (role !== "creator" || !items) return null;
  const open = items.filter((i) => i.state === "todo" || i.state === "wait");
  const done = items.filter((i) => i.state === "done").length;

  if (compact) {
    if (open.length === 0) return null;
    return (
      <section aria-label="Before you publish" className={`${glass} flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:px-5`}>
        <span className="text-tiny font-medium text-text">
          {open.length === 1 ? "One step before you publish" : `${open.length} steps before you publish`}
        </span>
        {open.map((i) => (
          <span key={i.key} className="flex min-w-0 items-center gap-2">
            <Mark state={i.state} />
            <span className="min-w-0 truncate text-tiny text-[#CFE3EC]">{i.sub}</span>
            {i.action ? <ActionButton action={i.action} /> : null}
          </span>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="Ready to publish" className={`${glass} flex flex-col gap-3 p-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-medium text-text">{open.length ? "Before you publish" : "Ready to publish"}</p>
        <span className={`text-tiny ${open.length ? "text-amber" : "text-success"}`}>
          {done} of {items.length} done
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-white/[0.06] rounded-[12px] border border-white/[0.08] bg-white/[0.02]">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 px-3 py-2.5">
            <Mark state={i.state} />
            <span className="min-w-0 flex-1">
              <span className="block text-small text-text">{i.label}</span>
              <span className="block truncate text-tiny text-[#9FB7C2]">{i.sub}</span>
            </span>
            {i.action && i.state !== "done" ? <ActionButton action={i.action} /> : null}
          </li>
        ))}
      </ul>
      <MoreChainsLine />
    </section>
  );
}
