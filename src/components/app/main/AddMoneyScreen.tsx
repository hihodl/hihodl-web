"use client";

/**
 * Add money, as the HOLD app has it
 * (app/(drawer)/(internal)/add-money/index.tsx): the tile grid, in the app's
 * order and with the app's words — Bank Transfer, Add Cash, Receive Crypto,
 * Request Link.
 *
 * Receiving is the one money thing the web can genuinely do, so those two
 * tiles open the real screens: the app's Receive (its token list, its QR, its
 * address chip) and the app's hi.me link.
 *
 * BANK TRANSFER IS TWO SCREENS, NOT A DEAD END
 *
 * Somebody who already has a virtual account SEES IT here — the deposit
 * details are a plain read, and a bank account you cannot look up on the
 * machine you are sitting at is half an account. Somebody who has none is sent
 * to the app, and told why: opening one starts with an identity check that
 * reads a document and matches it to a face, and that scanner is native. It is
 * the one piece of this flow a browser genuinely cannot do; everything else
 * about a virtual account is an ordinary authenticated call.
 *
 * Add Cash still points at the app, and that one IS a choice rather than a
 * limit — the on-ramp's checkout is itself a web widget.
 *
 * ONLY NETWORKS WE CAN BE PAID ON
 *
 * The token list and the network picker are built from `GET /me/addresses` and
 * the wallet's registered Solana address. A chain we have no address for is never
 * offered, because the promise of a receive screen is that money sent to what
 * it shows arrives.
 *
 * THE FIFTH TILE
 *
 * Pay link is the app's own fifth tile (its row 3: "Pay link / Get paid from
 * any wallet"), and it opens the person's own links at /pay-links. That whole
 * screen is a read of `/api/v1/pay-links`, which is mounted and needs nothing
 * but the bearer this page holds — a token-less GET answers 401 on production,
 * checked 2026-09-20. Making a new link still happens in the app; the screen
 * says so.
 */

import Link from "next/link";
import { useState } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import type { RailAccount } from "@/lib/app/hold-api";
import { useAliases, useRailAccounts } from "@/lib/app/money";
import { useMe, useMyAddresses } from "@/lib/app/spaces-data";
import { Rich, useT } from "@/lib/app/i18n/react";

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
  const t = useT();
  const [screen, setScreen] = useState<Screen>("grid");
  const back = () => setScreen("grid");

  if (screen === "receive") return <ReceiveMoney onBack={back} />;
  if (screen === "link") return <RequestLink onBack={back} />;
  if (screen === "bank") return <BankTransfer onBack={back} />;
  if (screen === "cash")
    return (
      <InTheApp
        onBack={back}
        icon="wallet-outline"
        title={t("home.add.cash.title")}
        sub={t("home.add.tile.cashSub")}
        about={t("home.add.cash.about")}
      />
    );

  return <Grid onOpen={setScreen} />;
}

/* ── The grid ─────────────────────────────────────────────────────── */

function Grid({ onOpen }: { onOpen: (s: Screen) => void }) {
  const t = useT();
  const rails = useRailAccounts();
  const href = useProductHref();
  const hasVA = (rails.data?.accounts?.length ?? 0) > 0;

  return (
    <Column>
      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        <Tile
          icon="business-outline"
          title={t("home.add.tile.bank")}
          sub={
            rails.data === undefined
              ? t("home.add.tile.bankSubLoading")
              : hasVA
                ? t("home.add.tile.bankSubHas")
                : t("home.add.tile.bankSubNone")
          }
          badge={rails.data !== undefined && !hasVA ? t("home.add.tile.setup") : undefined}
          onClick={() => onOpen("bank")}
        />
        <Tile icon="wallet-outline" title={t("home.add.tile.cash")} sub={t("home.add.tile.cashSub")} onClick={() => onOpen("cash")} />
        <Tile icon="qr-code-outline" title={t("home.add.tile.receive")} sub={t("home.add.tile.receiveSub")} onClick={() => onOpen("receive")} />
        <Tile icon="link-outline" title={t("home.add.tile.request")} sub={t("home.add.tile.requestSub")} onClick={() => onOpen("link")} />
        {/* The app's row 3: a way to be paid by somebody with no HOLD account,
            from any wallet, free. A page of its own rather than a panel here,
            because a link is opened again and again after it is made. */}
        <Tile icon="card-outline" title={t("home.add.tile.payLink")} sub={t("home.add.tile.payLinkSub")} href={href("/pay-links")} />
      </div>
    </Column>
  );
}

/** PremiumTile: radius 22, the amber glyph in a 44pt glass squircle, 16/800 over a 13/17 line. */
function Tile({
  icon,
  title,
  sub,
  badge,
  onClick,
  href,
}: {
  icon: IonName;
  title: string;
  sub: string;
  badge?: string;
  onClick?: () => void;
  /** A tile that opens a page of its own instead of a panel on this screen. */
  href?: string;
}) {
  const cls =
    "relative flex flex-col items-start overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.05] px-[18px] pb-[18px] pt-5 text-left backdrop-blur-xl transition-colors hover:bg-white/[0.09]";
  const inner = (
    <>
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
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ── Receive crypto ───────────────────────────────────────────────── */

/**
 * The app's Receive, over every address this person actually has: the
 * wallet's Solana one, and whatever the app registered for them on the other
 * chains.
 */
function ReceiveMoney({ onBack }: { onBack: () => void }) {
  const t = useT();
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
        <BackHeader title={t("common.receive")} onBack={onBack} />
        <Skeleton className="mx-auto h-[420px] w-full max-w-[460px]" />
      </Column>
    );
  }

  if (Object.keys(addresses).length === 0) {
    return (
      <Column>
        <BackHeader title={t("common.receive")} onBack={onBack} />
        <p className="px-1 pt-2 text-[13.5px] leading-[19px] text-[#9FB7C2]">
          {addrs.error
            ? t("home.add.receive.readFailed")
            : t("home.add.receive.noneGetApp")}
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
  const t = useT();
  const me = useMe();
  const aliases = useAliases();
  const href = useProductHref();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const fromAlias = aliases.data?.[0]?.alias?.replace(/^@/, "") ?? null;
  const name = fromAlias || chosenUsername(me.data);
  const link = name ? `https://hi.me/${name}` : null;
  const displayName = me.data?.profile.displayName?.trim() || (name ? `@${name}` : t("common.you"));
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
      <BackHeader title={t("home.add.request.title")} onBack={onBack} />
      <section className="rounded-[18px] border border-white/10 bg-white/[0.06] p-6 text-center">
        <div className="flex justify-center">
          <UserAvatar size={80} fallbackName={displayName} />
        </div>
        <p className="mt-4 text-[22px] font-bold text-white">{displayName}</p>
        <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-5 text-[#9FB7C2]">
          {t("home.add.request.lead")}
        </p>

        {loading ? (
          <Skeleton className="mt-5 h-[50px] rounded-[12px]" />
        ) : link ? (
          <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-white/[0.08] bg-black/[0.28] px-4 py-3.5">
            <span className="min-w-0 flex-1 truncate text-left text-[14px] font-strong text-[#89D7FF]">{link}</span>
            <button
              type="button"
              onClick={copy}
              aria-label={t("home.add.request.copyLink")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] transition-colors hover:bg-white/[0.14]"
            >
              <Ion name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? GREEN : "#89D7FF"} />
            </button>
          </div>
        ) : (
          <p className="mt-5 text-[13px] leading-[18px] text-white/55">
            <Rich
              k="home.add.request.noUsername"
              tags={{
                link: (c) => (
                  <Link href={href("/account")} className="underline decoration-white/30 underline-offset-2 hover:text-white">
                    {c}
                  </Link>
                ),
              }}
            />
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
          {shared ? t("common.copied") : t("home.add.request.share")}
        </button>
      ) : null}

      <p className="mt-3 px-1 text-[12px] leading-[17px] text-white/55">
        {t("home.add.request.amountInApp")}
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
/* ── Bank transfer ────────────────────────────────────────────────── */

/**
 * Two different screens behind one tile, and the difference is whether this
 * person already has a virtual account.
 *
 * HAS ONE: show it. The account is a READ — `/rails/accounts` returns the
 * deposit details and the rail's own words for them — and a bank account you
 * cannot look up on the machine you are sitting at is half an account. The web
 * showed nobody their own IBAN until now.
 *
 * HAS NONE: the app, and say why rather than just where. Opening one means an
 * identity check, and ours runs through a native scanner that reads a document
 * and matches it to a face. That module exists only in the app — it is not a
 * rule we chose, it is the one piece of this flow a browser genuinely cannot
 * do. Everything else about a virtual account is an ordinary authenticated
 * call.
 */
function BankTransfer({ onBack }: { onBack: () => void }) {
  const t = useT();
  const rails = useRailAccounts();
  const accounts = rails.data?.accounts ?? [];

  if (rails.data === undefined && !rails.error) {
    return (
      <Column>
        <BackHeader title={t("home.add.bank.title")} onBack={onBack} />
        <Skeleton className="h-[220px] rounded-[18px]" />
      </Column>
    );
  }

  if (accounts.length === 0) {
    return (
      <InTheApp
        onBack={onBack}
        icon="business-outline"
        title={t("home.add.bank.title")}
        sub={t("home.add.tile.bankSubNone")}
        about={t("home.add.bank.about")}
      />
    );
  }

  return (
    <Column>
      <BackHeader title={t("home.add.bank.title")} onBack={onBack} />
      <p className="mb-4 px-1 text-[13px] leading-[19px] text-[#9FB7C2]">
        {t("home.add.bank.lead", { count: accounts.length })}
      </p>
      <div className="flex flex-col gap-3">
        {accounts.map((a, i) => (
          <RailAccountCard key={a.id ?? i} account={a} />
        ))}
      </div>
      <p className="mt-4 px-1 text-[12px] leading-[17px] text-white/70">
        {t("home.add.bank.anotherCurrency")}
      </p>
    </Column>
  );
}

/**
 * One virtual account.
 *
 * Every field takes its name from `fieldLabels` when the rail supplies one, so
 * the same row reads "Account number" on ACH and "CLABE" in Mexico. Only the
 * fields that carry a value are drawn — a rail with an IBAN has no routing
 * number, and an empty labelled row reads as something broken.
 */
function RailAccountCard({ account }: { account: RailAccount }) {
  const t = useT();
  const labels = account.fieldLabels ?? {};
  const name = (key: string, fallback: string) => labels[key] ?? fallback;
  const fields: { label: string; value: string }[] = [];
  const push = (key: string, fallback: string, value: string | null | undefined) => {
    if (value) fields.push({ label: name(key, fallback), value });
  };
  // The rail's own words win; ours are the fallback. IBAN and BIC are codes, the same everywhere.
  push("accountHolderName", t("home.add.bank.field.accountHolder"), account.accountHolderName);
  push("iban", "IBAN", account.iban);
  push("bic", "BIC", account.bic);
  push("accountNumber", t("home.add.bank.field.accountNumber"), account.accountNumber);
  push("routingNumber", t("home.add.bank.field.routingNumber"), account.routingNumber);
  push("sortCode", t("home.add.bank.field.sortCode"), account.sortCode);
  push("paymentCode", t("home.add.bank.field.paymentCode"), account.paymentCode);
  push("reference", t("home.add.bank.field.reference"), account.reference);
  push("bankName", t("home.add.bank.field.bank"), account.bankName);

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-white/[0.18] bg-white/10">
          <Ion name="business-outline" size={19} color="#FFB703" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-strong text-white">
            {(account.currency ?? "").toUpperCase()} {account.railType ? `· ${account.railType.toUpperCase()}` : ""}
          </h2>
          {account.bankCountry ? <p className="text-[12.5px] text-[#9FB7C2]">{account.bankCountry}</p> : null}
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-[13px] leading-[18px] text-[#CFE3EC]">
          {t("home.add.bank.pendingDetails")}
        </p>
      ) : (
        <dl className="flex flex-col">
          {fields.map((f, i) => (
            <div key={f.label} className={`flex items-start justify-between gap-4 py-2.5 ${i ? "border-t border-white/[0.07]" : ""}`}>
              <dt className="shrink-0 text-[12.5px] text-[#9FB7C2]">{f.label}</dt>
              <dd className="min-w-0 break-all text-right text-[13.5px] font-strong tabular-nums text-white">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function InTheApp({ onBack, icon, title, sub, about }: { onBack: () => void; icon: IonName; title: string; sub: string; about: string }) {
  const t = useT();
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
          <p className="text-[13px] font-medium text-white">{t("home.add.inApp.title")}</p>
          <p className="mt-0.5 text-[12px] text-[#9FB7C2]">{t("home.add.inApp.body")}</p>
        </div>
        <StoreButtons />
        <p className="flex items-center gap-2 text-[12px] leading-[17px] text-white/55">
          <Ion name="qr-code-outline" size={14} color={SUB} />
          {t("home.add.inApp.receiveHere")}
        </p>
      </section>
    </Column>
  );
}
