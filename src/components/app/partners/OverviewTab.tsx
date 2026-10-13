"use client";

/**
 * A partner's numbers: who came through the link, what they booked, what it
 * earned and when it is paid. Every figure is the server's
 * (GET /partners/me/dashboard); nothing here is estimated.
 */

import { dayLabel, monthLabel, usd, type Commission, type CommissionStatus, type PartnerDashboard, type PartnerMe, type Payout } from "@/lib/app/partners";

import { HoldCard } from "../hold";
import { Ion } from "../ion";
import { KpiTile } from "../ui";
import { LinkCard } from "./LinkCard";
import { KIND, Pill, type PillTone } from "./kit";

const STATUS: Record<CommissionStatus, { label: string; tone: PillTone }> = {
  pending: { label: "Pending", tone: "blue" },
  payable: { label: "Payable", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  void: { label: "Cancelled", tone: "quiet" },
};

const PAYOUT: Record<Payout["status"], { label: string; tone: PillTone }> = {
  claimed: { label: "Preparing", tone: "blue" },
  submitted: { label: "Sending", tone: "blue" },
  sent: { label: "Sent", tone: "green" },
  failed: { label: "Moves to next payout", tone: "amber" },
};

export function OverviewTab({ data, onLinkSaved }: { data: PartnerDashboard; onLinkSaved: (me: PartnerMe) => void }) {
  const { totals } = data;
  const earned = totals.pendingUsdc + totals.payableUsdc + totals.paidUsdc;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Signups" value={totals.signups.toLocaleString("en-US")} note="Through your link" />
        <KpiTile label="Travellers who booked" value={totals.travellers.toLocaleString("en-US")} />
        <KpiTile label="Bookings" value={totals.bookings.toLocaleString("en-US")} note="Stays, flights and eSIMs" />
        <KpiTile label="Earned" value={usd(earned)} note={`${usd(totals.paidUsdc)} paid`} />
      </div>

      <HoldCard className="p-5">
        <div className="grid grid-cols-3 gap-3">
          <Split label="Pending" value={totals.pendingUsdc} dot="#8ECAE6" />
          <Split label="Payable" value={totals.payableUsdc} dot="#FFB703" />
          <Split label="Paid" value={totals.paidUsdc} dot="#4ADE80" />
        </div>
        <p className="mt-4 text-[12.5px] leading-[18px] text-white/55">
          Pending means booked but the trip has not happened yet, and a cancellation removes it. Payable is earned and goes
          out with the next payout. Paid is in your HOLD Savings.
        </p>
        <p className="mt-3 flex items-center gap-2 text-[13.5px] font-bold text-white">
          <Ion name="calendar-outline" size={16} className="text-amber" />
          {data.payoutsEnabled
            ? `Next payout on ${dayLabel(data.nextPayoutOn.slice(0, 10))}, minimum ${usd(data.payoutMinUsdc).replace(/\.00$/, "")}`
            : "Payouts start soon"}
        </p>
      </HoldCard>

      <LinkCard partner={data.partner} link={data.link} onSaved={onLinkSaved} />

      <Months months={data.months} />

      <Commissions rows={data.commissions} />

      <Payouts rows={data.payouts} />
    </div>
  );
}

function Split({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12px] text-white/55">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] font-extrabold tabular-nums text-white">{usd(value)}</p>
    </div>
  );
}

/* ── Last six months ──────────────────────────────────────────────── */

function Months({ months }: { months: PartnerDashboard["months"] }) {
  if (!months.length) return null;
  return (
    <HoldCard className="p-5">
      <h2 className="text-[16px] font-bold text-white">Last 6 months</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <Bars title="Signups" values={months.map((m) => m.signups)} labels={months.map((m) => monthLabel(m.month, true))} format={(n) => n.toLocaleString("en-US")} color="#8ECAE6" />
        <Bars title="Commission" values={months.map((m) => m.commissionUsdc)} labels={months.map((m) => monthLabel(m.month, true))} format={(n) => usd(n)} color="#FFB703" />
      </div>
    </HoldCard>
  );
}

function Bars({ title, values, labels, format, color }: { title: string; values: number[]; labels: string[]; format: (n: number) => string; color: string }) {
  const max = Math.max(0, ...values);
  const last = values[values.length - 1] ?? 0;
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-strong text-[#9FB7C2]">{title}</span>
        <span className="text-[13px] font-bold tabular-nums text-white">{format(last)} this month</span>
      </figcaption>
      <div className="mt-3 flex h-[96px] items-end gap-2" role="img" aria-label={`${title}: ${values.map((v, i) => `${labels[i]} ${format(v)}`).join(", ")}`}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${labels[i]}: ${format(v)}`}>
            <div
              className="w-full rounded-t-[4px]"
              style={{ height: max > 0 ? `${Math.max(v > 0 ? 4 : 2, (v / max) * 100)}%` : "2px", background: v > 0 ? color : "rgba(255,255,255,0.12)" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {labels.map((l, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center text-[11px] text-white/45">
            {l}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* ── Commissions ──────────────────────────────────────────────────── */

function Commissions({ rows }: { rows: Commission[] }) {
  return (
    <HoldCard className="p-5">
      <h2 className="text-[16px] font-bold text-white">Commissions</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13.5px] leading-[20px] text-white/55">
          Nothing yet. When a traveller you brought books a stay, a flight or an eSIM, it shows up here.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {rows.map((c) => {
            const k = KIND[c.kind] ?? KIND.stay;
            const s = STATUS[c.status] ?? STATUS.pending;
            return (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/80">
                  <Ion name={k.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-white">
                    {k.label} <span className="font-normal text-white/55">by {c.traveller}</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-white/50">
                    {dayLabel(c.bookedAt)}
                    {c.status === "pending" && c.payableAfter ? `, payable after ${dayLabel(c.payableAfter)}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`text-[14px] font-extrabold tabular-nums ${c.status === "void" ? "text-white/40 line-through" : "text-white"}`}>
                    {usd(c.commissionUsdc)}
                  </span>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </HoldCard>
  );
}

/* ── Payouts ──────────────────────────────────────────────────────── */

function Payouts({ rows }: { rows: Payout[] }) {
  return (
    <HoldCard className="p-5">
      <h2 className="text-[16px] font-bold text-white">Payouts</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13.5px] leading-[20px] text-white/55">
          Your first payout lands in your HOLD Savings, in USDC, at the start of the month after a commission becomes payable.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {rows.map((p) => {
            const s = PAYOUT[p.status] ?? PAYOUT.claimed;
            return (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-white">{monthLabel(p.period)}</span>
                  <span className="block truncate text-[12.5px] text-white/50">
                    {p.sentAt ? `Sent ${dayLabel(p.sentAt)}` : "To your HOLD Savings"}
                    {p.status === "sent" && p.txHash ? (
                      <>
                        {" "}
                        <a
                          href={`https://basescan.org/tx/${p.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#8ECAE6] underline underline-offset-2 hover:text-white"
                        >
                          View on Basescan
                        </a>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[14px] font-extrabold tabular-nums text-white">{usd(p.amountUsdc)}</span>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </HoldCard>
  );
}
