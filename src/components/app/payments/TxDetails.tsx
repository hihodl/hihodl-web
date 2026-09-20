"use client";

/**
 * One transaction, as the app's details sheet draws it
 * (src/components/tx/TransactionDetailsSheet.tsx): the token with its
 * direction badge, the signed amount at 34/900, then two blocks of label and
 * value — Date and Status, then who, the network and the hash.
 *
 * The row it was opened from carries the symbol, the amount and the
 * counterparty; `GET /transfers/:id/details` carries what the chain did — the
 * hash, the status, the confirmations, the wallet it left. A read that fails
 * renders "—" and a quiet line: nothing here is guessed.
 *
 * The app's sheet ends in a Repeat action (send again, swap again). The web
 * has no such button: paying is the app's.
 */

import { useState, type ReactNode } from "react";

import type { Transfer } from "@/lib/app/hold-api";
import { useTransferDetails } from "@/lib/app/money";
import {
  actionTitle,
  chainLabel,
  explorerFor,
  statusWord,
  transferAmount,
  tokenTicker,
  truncMid,
  whenLine,
} from "@/lib/app/payments";

import { BackHeader } from "../hold";
import { Ion } from "../ion";
import { GREEN, SUB, TokenIcon } from "../wallet/app-kit";

export function TxDetails({ id, row, onBack }: { id: string; row: Transfer | null; onBack: () => void }) {
  const details = useTransferDetails(id);
  const d = details.data ?? null;
  const failed = !!details.error;

  const direction = row?.direction ?? "out";
  const inbound = direction === "in";
  const symbol = row ? tokenTicker(row) : "";
  const amount = row ? transferAmount(row) : null;
  const chain = row?.chain ?? d?.chain ?? null;
  const hash = d?.txHash ?? row?.txHash ?? null;
  const status = statusWord(d?.status ?? row?.status);
  const when = d?.createdAt ?? row?.createdAt ?? null;
  const peer = row ? (inbound ? row.fromAlias || row.fromAddress : row.toAlias || row.toAddress) : null;
  const explorer = explorerFor(chain, hash);

  const amountText =
    amount === null
      ? "—"
      : amount === 0
        ? "Processing…"
        : `${inbound ? "+" : "-"}${Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: Math.abs(amount) >= 1 ? 2 : 6 })} ${symbol}`;

  return (
    <>
      <BackHeader title={actionTitle(direction)} onBack={onBack} />

      <div className="flex flex-col items-center gap-2 pb-2 pt-1">
        <div className="relative flex h-[132px] w-[132px] items-center justify-center">
          <TokenIcon symbol={symbol || "USDC"} size={100} />
          <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/[0.18] bg-[rgba(10,26,36,0.92)]">
            <Ion name={inbound ? "arrow-down" : "arrow-up"} size={16} color={inbound ? "#20D690" : "#FFB703"} />
          </span>
        </div>
        <p
          className={`text-[34px] font-black tracking-[-0.3px] tabular-nums ${
            amountText === "Processing…" ? "text-[22px] italic text-[#9FB7C2]" : inbound ? "text-[#20D690]" : "text-white"
          }`}
        >
          {amountText}
        </p>
      </div>

      <Block>
        <KV label="Date" value={when ? whenLine(when) : "—"} />
        <KV label="Status" value={status} valueClass={status === "Succeeded" ? "text-[#20d690]" : status === "Canceled" ? "text-[#9FB7C2]" : "text-[#CFE3EC]"} />
      </Block>

      <Block className="mt-3">
        <KV label={inbound ? "From" : "To"} value={peer ? (peer.startsWith("@") ? peer : truncMid(peer)) : "—"} />
        <KV label="Network" value={chainLabel(chain)} />
        {d?.inbound?.confirmations ? <KV label="Confirmations" value={String(d.inbound.confirmations)} /> : null}
        {hash ? <KVCopy label="Transaction Hash" value={truncMid(hash)} raw={hash} /> : null}
      </Block>

      {row?.note ? (
        <Block className="mt-3">
          <p className="text-[14px] font-extrabold text-white/75">Note</p>
          <p className="mt-1.5 text-[15px] font-medium leading-[21px] text-[#E6F0F5]">{row.note}</p>
        </Block>
      ) : null}

      {d?.error ? (
        <Block className="mt-3">
          <p className="text-[13px] leading-[18px] text-amber">{d.error}</p>
        </Block>
      ) : null}

      {explorer ? (
        <a
          href={explorer.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 self-center text-[13px] text-[#9FB7C2] underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
        >
          View on {explorer.name} <Ion name="open-outline" size={13} color={SUB} />
        </a>
      ) : null}

      {failed ? (
        <p className="mt-4 px-1 text-center text-[12px] leading-[17px] text-white/55">
          We could not reach the rest of this transaction. What is here comes from your history and is unchanged.
        </p>
      ) : null}
    </>
  );
}

/** The sheet's block: radius 16, a hairline, its rows 12 apart. */
function Block({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 ${className}`}>{children}</div>;
}

function KV({ label, value, valueClass = "text-[#CFE3EC]" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[14px] font-extrabold text-white/75">{label}</span>
      <span className={`min-w-0 truncate text-right text-[14px] font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

function KVCopy({ label, value, raw }: { label: string; value: string; raw: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const p = navigator.clipboard?.writeText(raw);
    if (!p) return;
    void p.then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false),
    );
  };
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span className="text-[14px] font-extrabold text-white/75">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[14px] font-bold text-[#CFE3EC]">{value}</span>
        <Ion name={copied ? "checkmark" : "copy-outline"} size={15} color={copied ? GREEN : SUB} />
      </span>
    </button>
  );
}
