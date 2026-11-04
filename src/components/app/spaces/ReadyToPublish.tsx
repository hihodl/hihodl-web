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
import { t, type MessageKey } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

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
  const label = t("creator.publish.xAccount");
  if (!x || !x.linked) {
    return {
      key: "x",
      state: "todo",
      label,
      sub: t("creator.publish.xVerifiedAndOld", { days: MIN_X_ACCOUNT_AGE_DAYS }),
      action: { label: t("creator.publish.connectX"), href: go },
    };
  }
  const who = `@${x.handle}`;
  if (x.canPublish) return { key: "x", state: "done", label, sub: t("creator.publish.xVerified", { who }) };
  switch (x.refusal) {
    case "x_not_verified":
      return { key: "x", state: "todo", label, sub: t("creator.publish.xNoCheck", { who }), action: { label: t("creator.publish.changeAccount"), href: go } };
    case "x_account_too_new": {
      const created = x.accountCreatedAt ? Date.parse(x.accountCreatedAt) : NaN;
      const on = Number.isFinite(created)
        ? fmtDate(created + MIN_X_ACCOUNT_AGE_DAYS * 86_400_000, { day: "numeric", month: "short" })
        : null;
      return {
        key: "x",
        state: "wait",
        label,
        sub: on
          ? t("creator.publish.xTurnsOld", { who, days: MIN_X_ACCOUNT_AGE_DAYS, on })
          : t("creator.publish.xMustBeOld", { who, days: MIN_X_ACCOUNT_AGE_DAYS }),
        action: { label: t("creator.publish.seeX"), href: go },
      };
    }
    default:
      return { key: "x", state: "todo", label, sub: t("creator.publish.xConfirmAgain", { who }), action: { label: t("creator.publish.connectAgain"), href: go } };
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
  const usdcLabel = t("creator.publish.usdcAccount");

  if (address) {
    items.push({
      key: "wallet",
      state: "done",
      label: t("creator.publish.solanaWallet"),
      sub: payout.data?.solana.source === "hold" ? t("creator.publish.yourHoldWallet") : t("creator.publish.anotherWallet"),
    });
  } else {
    const action: Action =
      w.kind === "none"
        ? // No wallet: it is made in the HOLD app. Where you get paid shows the stores.
          { label: t("creator.publish.getApp"), href: href("/account?view=payout") }
        : { label: t("creator.publish.setUp"), href: href("/account?view=payout") };
    items.push({ key: "wallet", state: "todo", label: t("creator.publish.solanaWallet"), sub: t("creator.publish.wherePaid"), action });
  }

  if (!address) {
    items.push({ key: "usdc", state: "unknown", label: usdcLabel, sub: t("creator.publish.usdcCheckedLater") });
  } else if (usdc.data === "ready") {
    items.push({ key: "usdc", state: "done", label: usdcLabel, sub: t("creator.publish.usdcOpen") });
  } else if (usdc.data === "missing") {
    items.push({
      key: "usdc",
      state: "todo",
      label: usdcLabel,
      sub: t("creator.publish.usdcReceiveOnce"),
      action: { label: t("creator.publish.copyAddress"), copy: address },
    });
  } else if (usdc.data) {
    items.push({
      key: "usdc",
      state: "todo",
      label: usdcLabel,
      sub: usdc.data === "frozen" ? t("creator.publish.usdcFrozen") : t("creator.publish.usdcUnusable"),
      action: { label: t("creator.publish.useAnotherWallet"), href: href("/account?view=other-wallet") },
    });
  } else {
    items.push({ key: "usdc", state: "unknown", label: usdcLabel, sub: usdc.error ? t("creator.publish.usdcCheckedOnPublish") : t("creator.publish.checking") });
  }
  return items;
}

/** Each state as the app's XAccountPanel `Fact` draws it: an Ionicon, green when done, amber while it waits on you. */
const MARK: Record<State, { icon: IonName; cls: string; word: MessageKey }> = {
  done: { icon: "checkmark-circle", cls: "text-[#2FBE8A]", word: "common.done" },
  todo: { icon: "alert-circle-outline", cls: "text-amber", word: "creator.publish.stateTodo" },
  wait: { icon: "time-outline", cls: "text-amber", word: "creator.publish.stateWaiting" },
  unknown: { icon: "ellipse-outline", cls: "text-white/55", word: "creator.publish.stateNotYet" },
};

function Mark({ state }: { state: State }) {
  const t = useT();
  const m = MARK[state];
  return (
    <span role="img" aria-label={t(m.word)} className={`flex shrink-0 ${m.cls}`}>
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
  const t = useT();
  const { role } = useShell();
  const items = useItems();
  if (role !== "creator" || !items) return null;
  const open = items.filter((i) => i.state === "todo" || i.state === "wait");
  const done = items.filter((i) => i.state === "done").length;

  if (compact) {
    // The app's XAccountPanel compact: one Card above the listings, only while publishing would be refused.
    if (open.length === 0) return null;
    return (
      <section aria-label={t("creator.publish.before")}>
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[21px] bg-white/[0.08] text-white">
              <Ion name="megaphone-outline" size={20} />
            </span>
            <p className="min-w-0 flex-1 text-[16px] font-strong tracking-[-0.2px] text-white">
              {t("creator.publish.stepsBefore", { count: open.length })}
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
    <section aria-label={t("creator.publish.ready")} className="flex flex-col gap-2.5">
      <SectionLabel right={<Tag label={t("creator.publish.doneOf", { done, total: items.length })} tone={open.length ? "caution" : "good"} />}>
        {open.length ? t("creator.publish.before") : t("creator.publish.ready")}
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
