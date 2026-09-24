"use client";

/**
 * The two screens that sit under Payments in the app, as panels here:
 *
 *   Scheduled   app/(drawer)/(internal)/payments/scheduled.tsx
 *   Payouts     app/(drawer)/(internal)/payments/payouts.tsx
 *
 * Both are rendered, neither is operated. The app splits a schedule's actions
 * by whether the change needs a new signature — later, less often or smaller
 * is free; sooner, more often or bigger is signed — and the web offers none of
 * them, so a live schedule says where it is cancelled instead of pretending it
 * can be. A payout's four states are the server's own words (`pending | sent |
 * settled | failed`, anything unplaceable is `pending`) and nothing here adds
 * cleverness to them: no "probably arrived", no inferring from elapsed time.
 *
 * A failed load is its own branch in both, never an empty list — telling
 * somebody with three standing orders that they have none is worse than
 * telling them the screen could not reach them.
 */

import { useT } from "@/lib/app/i18n/react";
import { usePayouts, useScheduledPayments } from "@/lib/app/money";
import type { OfframpOrder, Schedule } from "@/lib/app/hold-api";
import {
  cadenceLabel,
  formatScheduleAmount,
  newestFirst,
  payoutAmountText,
  payoutRecipientName,
  payoutState,
  payoutStatusText,
  payoutMethodLine,
  PAYOUT_STATE_ICON,
  PAYOUT_STATE_TINT,
  scheduleDate,
  scheduleStatus,
} from "@/lib/app/payments";

import { SectionTitle } from "../hold";
import { Ion, type IonName } from "../ion";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";

/* ── Scheduled payments ───────────────────────────────────────────── */

export function ScheduledPanel() {
  const t = useT();
  const schedules = useScheduledPayments();
  const rows = schedules.data?.schedules ?? [];

  return (
    <section aria-label={t("payments.scheduled.title")}>
      <SectionTitle first>{t("payments.scheduled.title")}</SectionTitle>
      {schedules.data === undefined && !schedules.error ? <Skeleton className="h-[112px]" /> : null}

      {schedules.error ? (
        <Failed
          icon="cloud-offline-outline"
          body={t("payments.scheduled.failedBody")}
          onRetry={() => void schedules.mutate()}
        />
      ) : null}

      {schedules.data && rows.length === 0 ? (
        <Quiet icon="calendar-outline" body={t("payments.scheduled.emptyBody")} />
      ) : null}

      {rows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {rows.map((s) => (
            <ScheduleCard key={s.id} schedule={s} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const t = useT();
  const status = scheduleStatus(schedule);
  const cancellable = schedule.status === "active" || schedule.status === "pending_authorization";
  return (
    <article className={`${cardClass} flex flex-col gap-1.5 p-3.5`}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[18px] font-bold tabular-nums text-white">{formatScheduleAmount(schedule)}</p>
        <span
          className={`shrink-0 rounded-[999px] px-2 py-[3px] text-[11px] font-bold text-white/80 ${
            status.live ? "bg-[rgba(56,189,143,0.18)]" : "bg-white/10"
          }`}
        >
          {status.label}
        </span>
      </div>

      <p className="truncate text-[14px] text-[#9FB7C2]">{schedule.recipientLabel ?? t("payments.scheduled.savedDestination")}</p>

      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-white/55">
        <span>{cadenceLabel(schedule.cadence)}</span>
        <span className="text-white/25">·</span>
        <span>{t("payments.scheduled.next", { date: scheduleDate(schedule.nextRunAt) })}</span>
      </div>

      {/* The honest failure state: `consecutiveFailures` counts DATES, so one
          here means one month missed, and two stops the schedule for good. */}
      {schedule.consecutiveFailures > 0 && schedule.status === "active" ? (
        <p className="mt-0.5 text-[12px] leading-[17px] text-amber">
          {schedule.consecutiveFailures === 1
            ? t("payments.scheduled.oneMissed")
            : t("payments.scheduled.stopped")}
        </p>
      ) : null}

      {/* Where the app's Cancel is. Cancelling freezes the order and leaves an
          on-chain allowance to revoke, which is a signature the web cannot
          take. */}
      {cancellable ? <p className="pt-1.5 text-[13px] font-bold text-white/55">{t("payments.scheduled.cancelInApp")}</p> : null}
    </article>
  );
}

/* ── Payouts ──────────────────────────────────────────────────────── */

export function PayoutsPanel() {
  const t = useT();
  const payouts = usePayouts();
  const orders = payouts.data ? newestFirst(payouts.data.orders ?? []) : [];

  return (
    <section aria-label={t("payments.payouts.title")}>
      <SectionTitle first>{t("payments.payouts.title")}</SectionTitle>
      {payouts.data === undefined && !payouts.error ? <Skeleton className="h-[92px]" /> : null}

      {payouts.error ? (
        <Failed
          icon="cloud-offline-outline"
          title={t("payments.payouts.failedTitle")}
          body={t("payments.payouts.failedBody")}
          onRetry={() => void payouts.mutate()}
        />
      ) : null}

      {payouts.data && orders.length === 0 ? (
        <Quiet icon="receipt-outline" title={t("payments.payouts.emptyTitle")} body={t("payments.payouts.emptyBody")} />
      ) : null}

      {orders.length > 0 ? (
        <div className={`${cardClass} flex flex-col`}>
          {orders.map((o, i) => (
            <PayoutRow key={o.id} order={o} first={i === 0} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PayoutRow({ order, first }: { order: OfframpOrder; first: boolean }) {
  useT();
  const state = payoutState(order);
  const tint = PAYOUT_STATE_TINT[state];
  const last4 = (order.beneficiary?.accountLast4 ?? "").trim();
  return (
    <div className={`flex items-center gap-3 px-3 py-3 ${first ? "" : "border-t border-white/[0.06]"}`}>
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border bg-white/[0.05]"
        style={{ borderColor: `${tint.startsWith("#") ? `${tint}44` : "rgba(255,255,255,0.18)"}` }}
      >
        <Ion name={PAYOUT_STATE_ICON[state]} size={17} color={tint} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-white">{payoutRecipientName(order)}</span>
        <span className="mt-0.5 block truncate text-[12px] font-strong text-white/55">
          {payoutMethodLine(last4)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-[15px] font-bold tabular-nums text-white">{payoutAmountText(order)}</span>
        <span className="mt-0.5 text-[12px] font-bold" style={{ color: tint }}>
          {payoutStatusText(order)}
        </span>
      </span>
    </div>
  );
}

/* ── The two states a list can be in besides having rows ──────────── */

function Failed({ icon, title, body, onRetry }: { icon: IonName; title?: string; body: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2.5 px-8 py-8 text-center">
      <Ion name={icon} size={28} className="text-white/25" />
      {title ? <p className="text-[16px] font-bold text-white">{title}</p> : null}
      <p className="text-[13px] leading-[19px] text-white/55">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1.5 rounded-[999px] bg-white/10 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.16]"
      >
        {t("common.tryAgain")}
      </button>
    </div>
  );
}

function Quiet({ icon, title, body }: { icon: IonName; title?: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-8 py-8 text-center">
      <Ion name={icon} size={28} className="text-white/25" />
      {title ? <p className="text-[16px] font-bold text-white">{title}</p> : null}
      <p className="text-[13px] leading-[19px] text-white/55">{body}</p>
    </div>
  );
}
