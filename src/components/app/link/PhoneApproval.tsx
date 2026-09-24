"use client";

/**
 * "Approve on your phone" for a spot or a stay: Withdraw.tsx's on-phone
 * state, part for part, over what the server says is being paid.
 *
 *   the status line   amber, pulsing while the phone decides
 *   the summary       the server's own words (title, dates, amount); the web
 *                     never writes these, so they match the phone's screen
 *   Open HOLD         on a phone: the app's approval screen, as an intent on
 *                     Android and as the site's universal link on an iPhone,
 *                     in a NEW tab so this page keeps following the approval
 *   Cancel            the server's cancel, so the phone cannot approve after
 *   the foot          the inbox hint and the countdown to `expiresAt`
 *
 * documentation/one-wallet-every-device.md, "Payments built by the server,
 * approved on the phone".
 */

import type { MessageKey } from "@/lib/app/i18n";
import { Rich, useT } from "@/lib/app/i18n/react";
import { openOnPhone } from "@/lib/link/intent";
import { useDefaultPhone } from "@/lib/link/default-phone";
import { approveOnDefaultPhone, type PaymentApproval } from "@/lib/link/payment-approval-core";

import { FooterNote, StatusLine, useCountdown, WarningNote } from "../wallet/app-kit";
import { Ion } from "../ion";
import { usePhone } from "./in-app";

const ON_PHONE: Partial<Record<PaymentApproval["status"], MessageKey>> = {
  approved: "link.approval.approved",
  submitted: "link.approval.submitted",
};

export function PhoneApproval({
  approval,
  cancelling = false,
  notice = null,
  onCancel,
}: {
  approval: PaymentApproval;
  cancelling?: boolean;
  notice?: string | null;
  onCancel: () => void;
}) {
  const t = useT();
  const here = usePhone();
  const defaultPhone = useDefaultPhone();
  const pending = approval.status === "pending";
  const left = useCountdown(pending ? approval.expiresAt || null : null);
  const s = approval.summary;
  const open = openOnPhone(`payments/approve/${encodeURIComponent(approval.id)}`, here);

  return (
    <div className="flex flex-col gap-3">
      <StatusLine>{pending || !ON_PHONE[approval.status] ? approveOnDefaultPhone(defaultPhone) : t(ON_PHONE[approval.status]!)}</StatusLine>
      <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.05] px-4 py-3">
        {s.title ? <p className="text-[15px] font-strong tracking-[-0.2px] text-white">{s.title}</p> : null}
        {s.subtitle ? <p className="mt-0.5 text-[12.5px] text-white/60">{s.subtitle}</p> : null}
        <div className="mt-2.5 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-2.5">
          <span className="text-[13.5px] text-white/60">{approval.kind === "stay" ? t("link.approval.toPay") : t("link.approval.youPay")}</span>
          <span className="text-right text-[13.5px] font-strong tabular-nums text-white">
            {s.amount} {s.token}
          </span>
        </div>
        {s.spend ? (
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-[13.5px] text-white/60">{t("link.approval.leavesWallet")}</span>
            <span className="text-right text-[13.5px] font-strong tabular-nums text-white">
              {s.spend} {s.token}
            </span>
          </div>
        ) : null}
      </div>
      {notice ? <WarningNote>{notice}</WarningNote> : null}
      {pending ? (
        <div className="flex flex-col gap-2 pt-2">
          {open ? (
            // A new tab: this page keeps following the approval while the app opens on it.
            <a
              href={open}
              target="_blank"
              rel="noopener"
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#FFB703] px-5 text-[15px] font-strong text-[#0A0F14] transition-opacity hover:opacity-90"
            >
              <Ion name="open-outline" size={18} color="#0A0F14" />
              {t("link.approval.openHold")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] px-5 py-3.5 text-[15px] font-strong text-white transition-colors hover:bg-white/[0.12] disabled:opacity-60"
          >
            {cancelling ? t("link.approval.cancelling") : t("common.cancel")}
          </button>
        </div>
      ) : null}
      <FooterNote icon="phone-portrait-outline">
        {t("link.approval.footer")}
        {pending && left ? (
          <>
            {" "}
            <Rich k="link.approval.expiresIn" vars={{ left }} tags={{ n: (c) => <span className="tabular-nums">{c}</span> }} />
          </>
        ) : null}
      </FooterNote>
    </div>
  );
}
