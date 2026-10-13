"use client";

/**
 * Every payout: the month it closes, who it was paid to, the amount, where it
 * stands, the transfer on Basescan and the statement PDF an accountant books.
 * Received money is counted here from the payouts themselves, never from a
 * balance, so moving it out of Savings changes nothing on this page.
 */

import { useState } from "react";

import { dayLabel, downloadFile, monthLabel, partnerErrorText, queryOf, usd, usePaged, type BillingState, type Payout, type Scope } from "@/lib/app/partners";

import { Notice } from "../hold";
import { Ion } from "../ion";
import { DeskPanel, ExportButton, FilterBar, Muted, PagedTable, SelectFilter, smallBtn, type Column, type Section } from "./desk";
import { useFilters } from "./CommissionsSection";
import { Pill, type PillTone } from "./kit";

const STATUS: Record<Payout["status"], { label: string; tone: PillTone }> = {
  claimed: { label: "Preparing", tone: "blue" },
  submitted: { label: "Sending", tone: "blue" },
  sent: { label: "Sent", tone: "green" },
  failed: { label: "Moves to next payout", tone: "amber" },
};

const FAILURE: Record<NonNullable<Payout["failureReason"]>, string> = {
  no_savings_address: "Open HOLD once so your Savings has an address on Base",
  billing_not_verified: "Waiting for your billing details",
  retrying_next_month: "Retried with the next payout",
};

function Statement({ id, period }: { id: string; period: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className={smallBtn}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadFile(`partners/me/payouts/${encodeURIComponent(id)}/statement`, `hold-partners-statement-${period}.pdf`);
          } catch (e) {
            setError(partnerErrorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Ion name="document-text-outline" size={15} />
        {busy ? "Preparing" : "PDF"}
      </button>
      {error ? <span className="text-[12px] text-amber">{error}</span> : null}
    </span>
  );
}

function columns(scope: Scope): Column<Payout>[] {
  const cols: Column<Payout>[] = [
    { key: "period", title: "Month", render: (p) => <span className="font-bold text-white">{monthLabel(p.period)}</span> },
    { key: "payee", title: "Paid to", render: (p) => (p.payee === "me" ? "You" : p.payee) },
    { key: "amount", title: "Amount", align: "right", render: (p) => <span className="font-extrabold text-white">{usd(p.amountUsdc)}</span> },
    {
      key: "status",
      title: "Status",
      render: (p) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <Pill tone={STATUS[p.status]?.tone ?? "quiet"}>{STATUS[p.status]?.label ?? p.status}</Pill>
          {p.failureReason ? <span className="text-[11.5px] text-white/45">{FAILURE[p.failureReason]}</span> : null}
        </span>
      ),
    },
    { key: "sent", title: "Sent", hideBelow: "md", render: (p) => (p.sentAt ? dayLabel(p.sentAt) : <Muted>Not yet</Muted>) },
    { key: "rows", title: "Commissions", align: "right", hideBelow: "lg", render: (p) => `${p.commissions}${p.clawbacks ? `, ${p.clawbacks} back` : ""}` },
    {
      key: "tx",
      title: "Transfer",
      hideBelow: "sm",
      render: (p) =>
        p.txHash && p.status === "sent" ? (
          <a href={`https://basescan.org/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[#8ECAE6] hover:text-white">
            Basescan
            <Ion name="open-outline" size={13} />
          </a>
        ) : (
          <Muted>None</Muted>
        ),
    },
    { key: "pdf", title: "Statement", align: "right", render: (p) => (p.statement ? <Statement id={p.id} period={p.period} /> : <Muted>After sending</Muted>) },
  ];
  return scope === "team" ? cols : cols.filter((c) => c.key !== "payee");
}

/**
 * `billing` and `payoutsEnabled` are undefined until the dashboard is read: no
 * notice is shown on a guess. `paid`: this person is paid at all (the owner,
 * or anyone in split mode); nobody else is asked for billing details.
 */
export function PayoutsSection({
  scope,
  billing,
  payoutsEnabled,
  paid,
  go,
}: {
  scope: Scope;
  billing: BillingState | undefined;
  payoutsEnabled: boolean | undefined;
  paid: boolean;
  go: (s: Section) => void;
}) {
  const { f, set, clear, active } = useFilters();
  const page = usePaged<Payout>("partners/me/payouts", { scope, ...f });
  const qs = queryOf({ scope, ...f });
  return (
    <div className="flex flex-col gap-4">
      {paid && billing && billing !== "verified" ? (
        <Notice icon="shield-checkmark-outline">
          {billing === "missing" ? (
            <>
              Payouts need your billing details, checked once by HOLD.{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => go("settings")}>
                Add them in Settings
              </button>
              .
            </>
          ) : (
            "Your billing details are with HOLD for a quick check. Payouts start once they are confirmed."
          )}
        </Notice>
      ) : null}
      {payoutsEnabled === false ? <Notice tone="calm">Payouts start soon. Everything you earn until then is kept and paid with the first one.</Notice> : null}
      <DeskPanel
        flush
        title="Payouts"
        meta={page.total ? `${usd(page.total.sentUsdc ?? 0)} sent in ${(page.total.count ?? 0).toLocaleString("en-US")} ${page.total.count === 1 ? "payout" : "payouts"}` : "Monthly, in USDC, to HOLD Savings"}
        actions={<ExportButton path={`partners/me/export/payouts?${qs}`} name="hold-partners-payouts.csv" />}
      >
        <div className="px-4 sm:px-5">
          <FilterBar active={active} onClear={clear}>
            <SelectFilter
              label="Status"
              value={f.status ?? ""}
              onChange={(v) => set("status", v)}
              options={[
                { value: "sent", label: "Sent" },
                { value: "failed", label: "Moved to next" },
                { value: "submitted", label: "Sending" },
              ]}
            />
          </FilterBar>
        </div>
        <PagedTable
          page={page}
          columns={columns(scope)}
          rowKey={(p) => p.id}
          failedTitle="Could not load payouts"
          empty="No payouts yet. The first one goes out at the start of the month after a commission becomes payable."
        />
      </DeskPanel>
    </div>
  );
}
