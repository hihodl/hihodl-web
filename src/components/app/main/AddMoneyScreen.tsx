"use client";

/**
 * Add money, as the HOLD app has it
 * (app/(drawer)/(internal)/add-money/index.tsx): the tile grid, in the app's
 * order and with the app's words — Bank Transfer, Add Cash, Receive Crypto,
 * Request Link.
 *
 * Receiving is the one money thing the web can genuinely do, so those two
 * tiles open the real screens: the app's Receive (its token list, its QR, its
 * address chip) and the app's hi.me link. The other two are drawn and then say
 * where they happen — an on-ramp is a card charge and a virtual account is a
 * KYC'd rail, and neither is started from here.
 *
 * ONLY NETWORKS WE CAN BE PAID ON
 *
 * The token list and the network picker are built from `GET /me/addresses` and
 * the web wallet's own Solana address. A chain we have no address for is never
 * offered, because the promise of a receive screen is that money sent to what
 * it shows arrives.
 *
 * The app's Pay link tile is not here yet. `/pay-links` is mounted and the
 * public half already serves /pay/[code] in this same repo; listing a person's
 * own links is simply unbuilt.
 */

import Link from "next/link";
import { useState } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import { useAliases, useRailAccounts } from "@/lib/app/money";
import { useMe, useMyAddresses } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { BackHeader, Column } from "../hold";
import { Ion, type IonName } from "../ion";
import { Skeleton } from "../ui";
import { UserAvatar } from "../account/UserAvatar";
import { GREEN, SUB } from "../wallet/app-kit";
import { Receive, type ReceiveAddresses } from "../wallet/Receive";
import { StoreButtons } from "./products";

type Screen = "grid" | "receive" | "link" | "bank" | "cash";

export function AddMoneyScreen() {
  const [screen, setScreen] = useState<Screen>("grid");
  const back = () => setScreen("grid");

  if (screen === "receive") return <ReceiveMoney onBack={back} />;
  if (screen === "link") return <RequestLink onBack={back} />;
  if (screen === "bank")
    return (
      <InTheApp
        onBack={back}
        icon="business-outline"
        title="Bank transfer"
        sub="Wire or ACH to your account"
        about="An account number of your own, in your name. What arrives in it lands in your HOLD balance. Opening one asks for your identity documents, which is a flow the app carries."
      />
    );
  if (screen === "cash")
    return (
      <InTheApp
        onBack={back}
        icon="wallet-outline"
        title="Add cash"
        sub="Debit or credit card"
        about="Buying with a card goes through our on-ramp provider and its checkout. That flow lives in the app; the web never starts a card charge."
      />
    );

  return <Grid onOpen={setScreen} />;
}

/* ── The grid ─────────────────────────────────────────────────────── */

function Grid({ onOpen }: { onOpen: (s: Screen) => void }) {
  const rails = useRailAccounts();
  const hasVA = (rails.data?.accounts?.length ?? 0) > 0;

  return (
    <Column>
      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        <Tile
          icon="business-outline"
          title="Bank Transfer"
          sub={rails.data === undefined ? "Wire, ACH or SEPA" : hasVA ? "Wire or ACH to your account" : "Get a personal bank account"}
          badge={rails.data !== undefined && !hasVA ? "SETUP" : undefined}
          onClick={() => onOpen("bank")}
        />
        <Tile icon="wallet-outline" title="Add Cash" sub="Debit or credit card" onClick={() => onOpen("cash")} />
        <Tile icon="qr-code-outline" title="Receive Crypto" sub="QR & wallet addresses" onClick={() => onOpen("receive")} />
        <Tile icon="link-outline" title="Request Link" sub="Share your hi.me link" onClick={() => onOpen("link")} />
      </div>
    </Column>
  );
}

/** PremiumTile: radius 22, the amber glyph in a 44pt glass squircle, 16/800 over a 13/17 line. */
function Tile({ icon, title, sub, badge, onClick }: { icon: IonName; title: string; sub: string; badge?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-start overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.05] px-[18px] pb-[18px] pt-5 text-left backdrop-blur-xl transition-colors hover:bg-white/[0.09]"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.12]" />
      {badge ? (
        <span className="absolute right-3.5 top-3.5 rounded-[6px] border border-[rgba(255,183,3,0.22)] bg-[rgba(255,183,3,0.12)] px-[7px] py-[3px] text-[9px] font-extrabold uppercase tracking-[0.5px] text-amber">
          {badge}
        </span>
      ) : null}
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.18] bg-white/10">
        <Ion name={icon} size={22} color="#FFB703" />
      </span>
      <span className="block text-[16px] font-extrabold tracking-[-0.3px] text-white">{title}</span>
      <span className="mt-1 block text-[13px] font-medium leading-[17px] text-white/55">{sub}</span>
    </button>
  );
}

/* ── Receive crypto ───────────────────────────────────────────────── */

/**
 * The app's Receive, over every address this person actually has: the web
 * wallet's Solana one, and whatever the app registered for them on the other
 * chains.
 */
function ReceiveMoney({ onBack }: { onBack: () => void }) {
  const wallet = useHoldWallet();
  const addrs = useMyAddresses();
  const a = addrs.data ?? {};
  const addresses: ReceiveAddresses = {};
  const solana = wallet.solana ?? a.solana ?? null;
  if (solana) addresses.solana = solana;
  for (const net of ["base", "polygon", "ethereum", "bitcoin"] as const) {
    const value = a[net];
    if (value) addresses[net] = value;
  }

  if (wallet.loading || (addrs.data === undefined && !addrs.error)) {
    return (
      <Column>
        <BackHeader title="Receive" onBack={onBack} />
        <Skeleton className="mx-auto h-[420px] w-full max-w-[460px]" />
      </Column>
    );
  }

  if (Object.keys(addresses).length === 0) {
    return (
      <Column>
        <BackHeader title="Receive" onBack={onBack} />
        <p className="px-1 pt-2 text-[13.5px] leading-[19px] text-[#9FB7C2]">
          {addrs.error
            ? "We could not read your addresses just now. Nothing has changed — try again in a moment."
            : "There is no address to be paid on yet. Make your wallet and it appears here."}
        </p>
      </Column>
    );
  }

  return (
    <Column>
      <Receive addresses={addresses} onBack={onBack} />
    </Column>
  );
}

/* ── Request link ─────────────────────────────────────────────────── */

/**
 * The app's request-link screen: the card with the person, their hi.me link
 * and Copy, then Share.
 *
 * The app falls back to the email prefix and then to a hardcoded name when
 * `GET /alias` answers nothing. This does not: a link nobody can be paid on is
 * worse than no link, so an empty read says so and points at Account, where a
 * username is chosen.
 */
function RequestLink({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const aliases = useAliases();
  const href = useProductHref();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const fromAlias = aliases.data?.[0]?.alias?.replace(/^@/, "") ?? null;
  const name = fromAlias || chosenUsername(me.data);
  const link = name ? `https://hi.me/${name}` : null;
  const displayName = me.data?.profile.displayName?.trim() || (name ? `@${name}` : "You");
  const loading = aliases.data === undefined && !aliases.error;

  const copy = () => {
    if (!link) return;
    const p = navigator.clipboard?.writeText(link);
    if (!p) return;
    void p.then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false),
    );
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: link });
      } catch {
        /* dismissed */
      }
      return;
    }
    copy();
    setShared(true);
    setTimeout(() => setShared(false), 1800);
  };

  return (
    <Column>
      <BackHeader title="Request via link" onBack={onBack} />
      <section className="rounded-[18px] border border-white/10 bg-white/[0.06] p-6 text-center">
        <div className="flex justify-center">
          <UserAvatar size={80} fallbackName={displayName} />
        </div>
        <p className="mt-4 text-[22px] font-bold text-white">{displayName}</p>
        <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-5 text-[#9FB7C2]">
          Share your Hi.me link so anyone can pay you
        </p>

        {loading ? (
          <Skeleton className="mt-5 h-[50px] rounded-[12px]" />
        ) : link ? (
          <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-white/[0.08] bg-black/[0.28] px-4 py-3.5">
            <span className="min-w-0 flex-1 truncate text-left text-[14px] font-strong text-[#89D7FF]">{link}</span>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy link"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] transition-colors hover:bg-white/[0.14]"
            >
              <Ion name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? GREEN : "#89D7FF"} />
            </button>
          </div>
        ) : (
          <p className="mt-5 text-[13px] leading-[18px] text-white/55">
            You have no username yet, so there is no link to share.{" "}
            <Link href={href("/account")} className="underline decoration-white/30 underline-offset-2 hover:text-white">
              Choose one in Account
            </Link>
            .
          </p>
        )}
      </section>

      {link ? (
        <button
          type="button"
          onClick={() => void share()}
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#F1F5F9] text-[15px] font-strong text-[#0A1420] transition-opacity hover:opacity-90"
        >
          <Ion name="share-outline" size={18} color="#0A1420" />
          {shared ? "Copied" : "Share link"}
        </button>
      ) : null}

      <p className="mt-3 px-1 text-[12px] leading-[17px] text-white/55">
        Asking for a specific amount, and the QR that carries it, happen in the HOLD app.
      </p>
    </Column>
  );
}

/* ── The two doors ────────────────────────────────────────────────── */

/**
 * The honest treatment (main/InTheAppScreen): what it is, that it happens in
 * the app for now, and the way to the app. No pretend form, no rate we did
 * not quote.
 */
function InTheApp({ onBack, icon, title, sub, about }: { onBack: () => void; icon: IonName; title: string; sub: string; about: string }) {
  return (
    <Column>
      <BackHeader title={title} onBack={onBack} />
      <section className="flex flex-col gap-5 rounded-[18px] border border-white/10 bg-white/[0.06] p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] border border-white/[0.18] bg-white/10">
            <Ion name={icon} size={26} color="#FFB703" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[22px] font-medium leading-tight text-white">{title}</h2>
            <p className="mt-1 text-[13px] text-[#9FB7C2]">{sub}</p>
          </div>
        </div>
        <p className="text-[14px] leading-relaxed text-[#CFE3EC]">{about}</p>
        <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-[13px] font-medium text-white">Available in the HOLD app for now</p>
          <p className="mt-0.5 text-[12px] text-[#9FB7C2]">Sign in there with the same account. It comes to the web next.</p>
        </div>
        <StoreButtons />
        <p className="flex items-center gap-2 text-[12px] leading-[17px] text-white/55">
          <Ion name="qr-code-outline" size={14} color={SUB} />
          Receiving crypto and your hi.me link work here, on the screen before this one.
        </p>
      </section>
    </Column>
  );
}
