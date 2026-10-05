"use client";

/**
 * Pieces every tab of the business console shares: a refusal in words, the
 * "Approve in the HOLD app" card, short addresses and explorer links.
 */

import { useEffect, useState, type ReactNode } from "react";

import { errorKey } from "@/lib/app/business-rules";
import { HoldApiError } from "@/lib/app/hold-api";
import { t } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { openInAppUrl } from "@/lib/link/intent";

import { Notice } from "../hold";
import { Ion } from "../ion";
import { inAppHref, usePhone } from "../link/in-app";
import { HQR } from "../wallet/app-kit";
import { btnWhite, Card } from "../spaces/kit";

/** A refusal from any business call, as a sentence. `403 role_not_allowed` says whose call it is, never "failed". */
export function businessErrorText(e: unknown): string {
  if (e instanceof HoldApiError) return t(errorKey(e.code, e.status));
  return t("common.somethingWentWrong");
}

export function ErrorNote({ error }: { error: unknown }) {
  useT();
  if (!error) return null;
  const role = error instanceof HoldApiError && (error.code === "role_not_allowed" || error.code === "enquiry_read_only");
  return (
    <Notice icon={role ? "lock-closed-outline" : "cloud-offline-outline"} tone={role ? "calm" : "caution"}>
      {businessErrorText(error)}
    </Notice>
  );
}

export function shortAddress(a: string | null | undefined): string {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export const solscanTx = (sig: string) => `https://solscan.io/tx/${encodeURIComponent(sig)}`;
export const solscanAccount = (address: string) => `https://solscan.io/account/${encodeURIComponent(address)}`;

/** An address, shortened, with a copy button and a link to the explorer. */
export function AddressLine({ address }: { address: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <a href={solscanAccount(address)} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-[13px] text-white/[0.82] underline-offset-2 hover:underline">
        {shortAddress(address)}
      </a>
      <button
        type="button"
        aria-label={t("business.copyAddress")}
        title={t("business.copyAddress")}
        className="flex h-7 w-7 items-center justify-center rounded-[14px] text-white/55 hover:bg-white/10 hover:text-white"
        onClick={() => {
          void navigator.clipboard?.writeText(address).then(() => setCopied(true), () => undefined);
        }}
      >
        <Ion name={copied ? "checkmark-circle-outline" : "copy-outline"} size={14} />
      </button>
    </span>
  );
}

/**
 * What the web cannot sign, sent to the app.
 *
 * A treasury change needs a fresh signature by the person's HOLD Solana key,
 * which never leaves the phone, and the web has no way to ask the phone to
 * sign words. So the card says so, and opens the app's treasury screen: on a
 * phone with a link straight into it, on a computer with a QR the phone's
 * camera opens (the site's opener, which the app claims as a universal link).
 */
export function ApproveInApp({ title, body, path, children }: { title: string; body: ReactNode; path: string; children?: ReactNode }) {
  const t = useT();
  const phone = usePhone();
  const direct = inAppHref(path, phone);
  return (
    <Card className="gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] bg-white/[0.08] text-white">
          <Ion name="phone-portrait-outline" size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[15px] font-bold text-white">{title}</p>
          <p className="text-[13.5px] leading-5 text-white/[0.82]">{body}</p>
        </div>
      </div>
      {children}
      {direct ? (
        <a href={direct} target="_blank" rel="noopener" className={`${btnWhite} self-start`}>
          <Ion name="open-outline" size={16} />
          {t("business.approve.openHold")}
        </a>
      ) : phone === null ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <HQR value={openInAppUrl(path)} size={168} title={t("business.approve.qrTitle")} />
          <p className="text-center text-[12.5px] text-white/55">{t("business.approve.scan")}</p>
        </div>
      ) : null}
    </Card>
  );
}
