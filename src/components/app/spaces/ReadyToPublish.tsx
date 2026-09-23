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
 * `compact` is the strip Listings shows while something is missing (and never
 * once everything is done). It belongs where publishing happens: the Overview
 * carried it too and read as a banner about nothing, so it was taken off there.
 */

import Link from "next/link";

import { MIN_X_ACCOUNT_AGE_DAYS, type XAccountStatus } from "@/lib/creator/types";
import { useHoldWallet, useUsdcAccount } from "@/lib/app/hold-wallet";
import { usePayout } from "@/lib/app/spaces-data";
import { crossesKeyPage } from "@/lib/wallet/csp";

import { useProductHref } from "../base";
import { CopyButton } from "../front/kit";
import { MoreChainsLine } from "../MoreChains";
import { Ion, type IonName } from "../ion";
import { useShell } from "../Shell";
import { Card, SectionLabel, Tag } from "./kit";

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

/** Each state as the app's XAccountPanel `Fact` draws it: an Ionicon, green when done, amber while it waits on you. */
const MARK: Record<State, { icon: IonName; cls: string; word: string }> = {
  done: { icon: "checkmark-circle", cls: "text-[#2FBE8A]", word: "Done" },
  todo: { icon: "alert-circle-outline", cls: "text-amber", word: "To do" },
  wait: { icon: "time-outline", cls: "text-amber", word: "Waiting" },
  unknown: { icon: "ellipse-outline", cls: "text-white/55", word: "Not yet" },
};

function Mark({ state }: { state: State }) {
  const m = MARK[state];
  return (
    <span role="img" aria-label={m.word} className={`flex shrink-0 ${m.cls}`}>
      <Ion name={m.icon} size={18} />
    </span>
  );
}

/** The app's Chip, as a button: 34 high, radius half of it. */
const actionCls =
  "inline-flex h-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white transition-colors hover:bg-white/10";

function ActionButton({ action }: { action: Action }) {
  if (action.copy) return <CopyButton value={action.copy} label={action.label} className={actionCls} />;
  // Into the Wallet: a full load, so its strict CSP is the response's (lib/wallet/csp).
  if (action.href && crossesKeyPage(action.href)) {
    return (
      <a href={action.href} className={actionCls}>
        {action.label}
      </a>
    );
  }
  return (
    <Link href={action.href ?? "#"} className={actionCls}>
      {action.label}
    </Link>
  );
}

function Row({ item }: { item: Item }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 py-2.5">
      <Mark state={item.state} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14.5px] font-bold text-white">{item.label}</span>
        <span className={`truncate text-[12.5px] ${item.state === "todo" || item.state === "wait" ? "text-amber" : "text-white/55"}`}>{item.sub}</span>
      </span>
      {item.action && item.state !== "done" ? <ActionButton action={item.action} /> : null}
    </li>
  );
}

export function ReadyToPublish({ compact = false }: { compact?: boolean }) {
  const { role } = useShell();
  const items = useItems();
  if (role !== "creator" || !items) return null;
  const open = items.filter((i) => i.state === "todo" || i.state === "wait");
  const done = items.filter((i) => i.state === "done").length;

  if (compact) {
    // The app's XAccountPanel compact: one Card above the listings, only while publishing would be refused.
    if (open.length === 0) return null;
    return (
      <section aria-label="Before you publish">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[21px] bg-white/[0.08] text-white">
              <Ion name="megaphone-outline" size={20} />
            </span>
            <p className="min-w-0 flex-1 text-[16px] font-strong tracking-[-0.2px] text-white">
              {open.length === 1 ? "One step before you publish" : `${open.length} steps before you publish`}
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-white/[0.08]">
            {open.map((i) => (
              <Row key={i.key} item={i} />
            ))}
          </ul>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label="Ready to publish" className="flex flex-col gap-2.5">
      <SectionLabel right={<Tag label={`${done} of ${items.length} done`} tone={open.length ? "caution" : "good"} />}>
        {open.length ? "Before you publish" : "Ready to publish"}
      </SectionLabel>
      <Card>
        <ul className="flex flex-col divide-y divide-white/[0.08]">
          {items.map((i) => (
            <Row key={i.key} item={i} />
          ))}
        </ul>
        <MoreChainsLine />
      </Card>
    </section>
  );
}
