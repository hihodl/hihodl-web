"use client";

/**
 * Dashboard: HOLD's home on the web, where signing in lands.
 *
 * One screen, no scroll: the wallet first (balance, the address to receive
 * on, the way into Wallet), the person beside it, and Benefits' products
 * under both. Every card is a door to the screen that explains it.
 *
 * The balance is read from the public address (no unlock), the same read the
 * Wallet page makes. A wallet made in the app is summarised here too; it is
 * opened in the app.
 */

import Link from "next/link";

import { chosenUsername } from "@/lib/app/me";
import { useBalances, useHoldWallet } from "@/lib/app/hold-wallet";
import { useMe, useOffers } from "@/lib/app/spaces-data";
import { waitingOnYou } from "@/lib/app/spaces-model";

import { useProductHref } from "../base";
import { UserAvatar } from "../account/UserAvatar";
import { CopyButton, shortAddress } from "../front/kit";
import { IconChevronRight, IconWallet } from "../icons";
import { useShell } from "../Shell";
import { glass, Skeleton } from "../ui";
import { DoorRow, PRODUCTS, StoreButtons } from "./products";

const cta =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-amber px-4 text-small font-medium text-text-on-amber transition-colors hover:bg-amber-glow";

export function DashboardScreen() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-stretch">
      <WalletCard />
      <YouCard />
      <BenefitsCard />
    </div>
  );
}

function money(n: number, digits = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function WalletCard() {
  const w = useHoldWallet();
  const href = useProductHref();
  const balances = useBalances(w.solana);
  // The Wallet page carries a strict CSP that only a full page load can set.
  const openWallet = (
    <a href={href("/wallet")} className={cta}>
      Open Wallet
    </a>
  );

  let body;
  if (w.loading) {
    body = <Skeleton className="h-[136px]" />;
  } else if (w.kind === "none") {
    body = w.canCreate ? (
      <div className="flex flex-col gap-4">
        <p className="text-[26px] font-medium leading-tight text-text">Make your HOLD wallet</p>
        <p className="max-w-[520px] text-small text-[#9FB7C2]">
          A Solana wallet for USDC, made in this browser and locked by your passkey. Sponsors pay your listings into it.
        </p>
        <div>
          <a href={href("/wallet")} className={cta}>
            Create wallet
          </a>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        <p className="text-[26px] font-medium leading-tight text-text">Your wallet lives in the HOLD app</p>
        <p className="max-w-[520px] text-small text-[#9FB7C2]">Make it in the app with this same account and it shows here.</p>
        <StoreButtons />
      </div>
    );
  } else {
    const usdc = balances.data ? money(balances.data.usdc) : balances.error ? "–" : "…";
    body = (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-tiny text-[#9FB7C2]">USDC on Solana</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[44px] font-medium leading-none tracking-tight tabular-nums text-text">{usdc}</span>
            <span className="text-small text-[#9FB7C2]">USDC</span>
          </p>
          <p className="mt-2 text-tiny text-[#B4BEC9]">
            {balances.data ? `${money(balances.data.sol, 4)} SOL for network fees` : balances.error ? "Balance unavailable right now" : " "}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {w.solana ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] pl-3 pr-1">
              <span className="font-mono text-small text-text">{shortAddress(w.solana)}</span>
              <CopyButton value={w.solana} label="Copy address" />
            </span>
          ) : w.unregistered ? (
            <span className="text-small text-[#9FB7C2]">Open your wallet once to finish setting it up.</span>
          ) : null}
          {w.kind === "web" && w.walletPage ? openWallet : null}
          {w.kind === "app" ? <span className="text-tiny text-[#9FB7C2]">Made in the HOLD app. Send and swap there.</span> : null}
        </div>
      </div>
    );
  }

  return (
    <section className={`${glass} flex min-w-0 flex-col gap-5 p-5 sm:p-6`} aria-label="Wallet">
      <header className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-small font-medium text-text">
          <span className="text-amber">
            <IconWallet />
          </span>
          Wallet
        </span>
        {w.kind === "web" && w.walletPage ? (
          <a href={href("/wallet")} className="flex items-center gap-1 text-tiny text-[#9FB7C2] hover:text-text">
            Receive, passkeys, 12 words <IconChevronRight />
          </a>
        ) : null}
      </header>
      {body}
    </section>
  );
}

function YouCard() {
  const me = useMe();
  const { session } = useShell();
  const href = useProductHref();
  const username = chosenUsername(me.data);
  const name = me.data?.profile.displayName?.trim() || (username ? `@${username}` : session.user.email ?? "You");
  return (
    <Link href={href("/account")} className={`${glass} flex min-w-0 flex-col justify-between gap-5 p-5 transition-colors hover:bg-white/[0.06] sm:p-6`}>
      <span className="text-small font-medium text-text">Account</span>
      <span className="flex min-w-0 items-center gap-4">
        <UserAvatar size={56} fallbackName={name} />
        <span className="min-w-0">
          <span className="block truncate text-body font-medium text-text">{name}</span>
          <span className="mt-0.5 block truncate text-tiny text-[#9FB7C2]">{username ? `@${username}` : session.user.email}</span>
        </span>
      </span>
      <span className="flex items-center gap-1 text-tiny text-[#9FB7C2]">
        Profile, X account, where you get paid <IconChevronRight />
      </span>
    </Link>
  );
}

function BenefitsCard() {
  const href = useProductHref();
  const { role } = useShell();
  const offers = useOffers(role === "creator");
  const waiting = offers.data ? waitingOnYou(offers.data).length : 0;
  return (
    <section className={`${glass} flex min-w-0 flex-col gap-3 p-5 sm:p-6 lg:col-span-2`} aria-label="Benefits">
      <header className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-text">Benefits</span>
        <Link href={href("/benefits")} className="text-tiny text-[#9FB7C2] hover:text-text">
          All products
        </Link>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-3">
        {PRODUCTS.map((p) => (
          <Link
            key={p.key}
            href={href(p.path)}
            className="flex min-w-0 items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition-colors hover:bg-white/[0.07]"
          >
            <DoorRow
              product={p}
              right={
                p.key === "spaces" && waiting ? (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[10px] bg-amber px-1.5 text-[11px] font-medium text-text-on-amber">
                    {waiting > 9 ? "9+" : waiting}
                  </span>
                ) : null
              }
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

