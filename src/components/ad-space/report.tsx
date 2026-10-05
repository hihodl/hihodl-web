import { CHAIN_LABEL, calendarDate, eventDates, instantUtc, usdFromUsdc } from "@/lib/ad-space/format";
import type { ReportItem, ReportScans, ReportSeller, SponsorReport } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";

import { VerifiedHostPill } from "./organiser";
import { PrintButton } from "./PrintButton";
import { card, eyebrow, pill } from "./ui";

/**
 * A sponsor's report after the event (a-sponsor-gets-its-report-contract.md):
 * what they bought, the proof posted, the QR scans per day, where each
 * delivery stands and the invoice. Server components only; the one client
 * island is the print button.
 *
 * It states facts. A QR scan is a redirect served minus known bots and is
 * never called a person, a visitor or reach.
 */

const STATE_PILL = {
  delivered: pill.done,
  partly: pill.attention,
  pending: pill.neutral,
  disputed: pill.attention,
} as const;

function sellerName(s: ReportSeller): string {
  return s.businessName?.trim() || s.name?.trim() || (s.handle ? `@${s.handle}` : "HOLD");
}

function itemName(item: ReportItem): string {
  return item.listing.productName?.trim() || item.listing.title;
}

function spotLabel(item: ReportItem): string | null {
  if (item.spot.title) return item.spot.title;
  if (item.spot.whole) return t("publicPages.report.spot.whole");
  if (item.spot.zoneLabel) return item.spot.zoneLabel;
  if (item.spot.slot !== null) return t("publicPages.report.spot.slot", { n: item.spot.slot });
  return null;
}

function day(iso: string | null): string {
  return iso ? calendarDate(iso.slice(0, 10)) : "";
}

export function ReportHeader({ report, now }: { report: SponsorReport; now: number }) {
  const { event } = report;
  const final = report.status === "final";
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className={`${eyebrow} text-sp-amber`}>{t("publicPages.report.eyebrow")}</p>
        <span className={final ? pill.done : pill.attention}>
          {final ? t("publicPages.report.final") : t("publicPages.report.inProgress")}
        </span>
      </div>
      <h1 className="break-words font-display text-h3 font-light leading-tight text-sp-ink [overflow-wrap:anywhere] md:text-h2">
        {event.name}
      </h1>
      <p className="text-body text-sp-ink/85">
        {[event.city, eventDates(event.startsOn, event.endsOn)].filter(Boolean).join(" · ")}
      </p>
      {event.organiser && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-sp-ink/85">
            {t("publicPages.sponsor.hostedBy", { name: event.organiser.businessName?.trim() || event.organiser.name })}
          </span>
          <VerifiedHostPill organiser={event.organiser} />
        </div>
      )}
      {report.sponsor.name && <p className="text-small text-sp-ink/85">{t("publicPages.report.for", { name: report.sponsor.name })}</p>}
      {!final && report.finalAt && (
        <p className="text-small text-sp-ink/80">{t("publicPages.report.inProgressNote", { date: day(report.finalAt) })}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <PrintButton label={t("publicPages.report.download")} />
        <span className="text-tiny text-sp-ink/70">
          {t("publicPages.report.generated", { date: instantUtc(new Date(now).toISOString()) })}
        </span>
      </div>
    </section>
  );
}

export function ReportSummary({ report }: { report: SponsorReport }) {
  const { totals } = report;
  const stats: { label: string; value: string; sub?: string }[] = [
    { label: t("publicPages.report.summary.paid"), value: usdFromUsdc(totals.paidUsdc), sub: "USDC" },
    { label: t("publicPages.report.summary.items"), value: fmtNumber(totals.items) },
    {
      label: t("publicPages.report.summary.delivered"),
      value: t("publicPages.report.summary.deliveredOf", { done: fmtNumber(totals.delivered), total: fmtNumber(totals.items) }),
    },
  ];
  if (totals.withQr > 0) {
    stats.push({
      label: t("publicPages.report.summary.scans"),
      value: fmtNumber(totals.scans),
      sub: t("publicPages.report.summary.scansDuring", { count: fmtNumber(totals.scansDuringEvent) }),
    });
  }
  return (
    <section className="flex flex-col gap-3 break-inside-avoid">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${card} flex flex-col gap-1 p-4`}>
            <dt className={`${eyebrow} text-sp-ink/75`}>{s.label}</dt>
            <dd className="font-display text-h4 font-light tabular-nums text-sp-ink">{s.value}</dd>
            {s.sub && <dd className="text-tiny text-sp-ink/75">{s.sub}</dd>}
          </div>
        ))}
      </dl>
      {totals.withQr > 0 && <p className="text-tiny text-sp-ink/75">{t("publicPages.report.scansNote")}</p>}
    </section>
  );
}

export function ReportSellers({ sellers }: { sellers: ReportSeller[] }) {
  if (sellers.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 break-inside-avoid">
      <h2 className={`${eyebrow} text-sp-ink/80`}>{t("publicPages.report.sellers")}</h2>
      <ul className="flex flex-col gap-2">
        {sellers.map((s) => (
          <li key={s.key} className="flex min-w-0 flex-wrap items-center gap-2">
            {s.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the seller's avatar, from our own bucket or X
              <img src={s.avatarUrl} alt="" width={28} height={28} referrerPolicy="no-referrer" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : null}
            <span className="min-w-0 truncate text-small text-sp-ink">{sellerName(s)}</span>
            {s.handle && <span className="text-small text-sp-ink/70">@{s.handle}</span>}
            <span className={pill.neutral}>
              {s.role === "organiser" ? t("publicPages.report.role.organiser") : t("publicPages.report.role.creator")}
            </span>
            {s.verifiedHost && <VerifiedHostPill organiser={{ name: sellerName(s), avatarUrl: s.avatarUrl, verified: true, businessName: s.businessName }} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One bar per day with a count, oldest on the left. A drawing of the numbers listed beside it, nothing more. */
function ScanBars({ scans, event }: { scans: ReportScans; event: { startsOn: string; endsOn: string } }) {
  const days = scans.byDay;
  const max = Math.max(1, ...days.map((d) => d.scans));
  const w = 8;
  const gap = 4;
  const h = 56;
  const width = Math.max(days.length * (w + gap) - gap, 1);
  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      width={Math.min(width, 560)}
      height={h}
      className="max-w-full"
      role="img"
      aria-label={t("publicPages.report.scans")}
    >
      {days.map((d, i) => {
        const bh = Math.max(2, Math.round((d.scans / max) * (h - 2)));
        const during = d.day >= event.startsOn && d.day <= event.endsOn;
        return (
          <rect
            key={d.day}
            x={i * (w + gap)}
            y={h - bh}
            width={w}
            height={bh}
            rx={2}
            className={during ? "fill-sp-cool" : "fill-sp-ink/35"}
          >
            <title>{`${calendarDate(d.day)}: ${fmtNumber(d.scans)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function ScansBlock({ scans, event }: { scans: ReportScans; event: { startsOn: string; endsOn: string } }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className={`${eyebrow} text-sp-ink/75`}>{t("publicPages.report.scans")}</h4>
      {scans.total === 0 ? (
        <p className="text-small text-sp-ink/80">{t("publicPages.report.scansNone")}</p>
      ) : (
        <>
          <p className="text-small text-sp-ink">
            {t("publicPages.report.scansTotal", { count: scans.total })} ·{" "}
            {t("publicPages.report.summary.scansDuring", { count: fmtNumber(scans.duringEvent) })}
          </p>
          <ScanBars scans={scans} event={event} />
          <table className="w-full max-w-sm text-tiny text-sp-ink/85">
            <tbody>
              {scans.byDay.map((d) => (
                <tr key={d.day} className="border-t border-[color:var(--color-hairline)]">
                  <td className="py-1 pr-4">{calendarDate(d.day)}</td>
                  <td className="py-1 text-right tabular-nums">{fmtNumber(d.scans)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function DeliveryLine({ item }: { item: ReportItem }) {
  const d = item.delivery;
  let note: string | null = null;
  if (d.state === "disputed") note = t("publicPages.report.disputedNote");
  else if (d.settledBy === "buyer") note = t("publicPages.report.settled.buyer", { date: day(d.at) });
  else if (d.settledBy === "accepted") note = t("publicPages.report.settled.accepted", { date: day(d.at) });
  else if (d.settledBy === "silence") note = t("publicPages.report.settled.silence");
  else if (d.settledBy === "links") note = t("publicPages.report.settled.links");
  else if (d.confirmBy) note = t("publicPages.report.confirmBy", { date: day(d.confirmBy) });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={STATE_PILL[d.state]}>{t(`publicPages.report.state.${d.state}`)}</span>
      {note && <span className="text-small text-sp-ink/85">{note}</span>}
    </div>
  );
}

function ProofList({ item }: { item: ReportItem }) {
  if (item.proof.length === 0) return <p className="text-small text-sp-ink/80">{t("publicPages.report.proofNone")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {item.proof.map((p, i) => (
        <li key={`${p.url}-${i}`} className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-small">
            <span className={pill.neutral}>{t(`publicPages.report.proofSource.${p.source}`)}</span>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sp-ink underline decoration-sp-ink/30 underline-offset-2">
              {p.host}
            </a>
            {p.postedAt && <span className="text-tiny text-sp-ink/70">{day(p.postedAt)}</span>}
          </div>
          {p.note && <p className="text-tiny text-sp-ink/80">{p.note}</p>}
          {p.isImage && (
            // eslint-disable-next-line @next/next/no-img-element -- a proof photo the seller linked; drawn as linked
            <img src={p.url} alt="" referrerPolicy="no-referrer" loading="lazy" className="max-h-56 w-auto max-w-full rounded-card object-contain" />
          )}
          {/* The full link, for the printed page, where a tap does nothing. */}
          <span className="hidden break-all text-tiny text-sp-ink/70 print:block">{p.url}</span>
        </li>
      ))}
    </ul>
  );
}

function ContentBlock({ content }: { content: NonNullable<ReportItem["content"]> }) {
  const status = content.status;
  const label =
    status === "approved"
      ? t("publicPages.report.content.approved")
      : status === "pending"
        ? t("publicPages.report.content.pending")
        : status === "rejected"
          ? t("publicPages.report.content.rejected")
          : t("publicPages.report.content.none");
  return (
    <div className="flex flex-col gap-2">
      <h4 className={`${eyebrow} text-sp-ink/75`}>{t("publicPages.report.content")}</h4>
      <div className="flex flex-wrap items-center gap-2">
        <span className={status === "approved" ? pill.done : status === "rejected" ? pill.attention : pill.neutral}>{label}</span>
        {content.sponsorName && <span className="text-small text-sp-ink">{content.sponsorName}</span>}
      </div>
      {content.text && <p className="text-small text-sp-ink/85">{content.text}</p>}
      {content.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- the sponsor's own approved artwork, from our bucket
        <img src={content.imageUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-auto max-w-[200px] rounded-md object-contain" />
      )}
    </div>
  );
}

function InvoiceLine({ invoice }: { invoice: ReportItem["invoice"] }) {
  let body;
  if (invoice.status === "issued") {
    body = invoice.pdfUrl ? (
      <a href={invoice.pdfUrl} className="text-small text-sp-ink underline decoration-sp-ink/30 underline-offset-2">
        {t("publicPages.report.invoice.download", { number: invoice.number })}
      </a>
    ) : (
      <span className="text-small text-sp-ink">{invoice.number}</span>
    );
  } else if (invoice.status === "pending") {
    body = (
      <span className="text-small text-sp-ink/85">
        {invoice.issuesAt && Date.parse(invoice.issuesAt) > Date.now()
          ? t("publicPages.report.invoice.pending", { date: day(invoice.issuesAt) })
          : t("publicPages.report.invoice.pendingNow")}
      </span>
    );
  } else {
    body = <span className="text-small text-sp-ink/80">{t("publicPages.report.invoice.none")}</span>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`${eyebrow} text-sp-ink/75`}>{t("publicPages.report.invoice")}</span>
      {body}
    </div>
  );
}

function ItemCard({ item, seller, event }: { item: ReportItem; seller: ReportSeller | undefined; event: SponsorReport["event"] }) {
  const spot = spotLabel(item);
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("publicPages.report.price"), value: usdFromUsdc(item.priceUsdc) },
    { label: t("publicPages.report.youPaid"), value: `${usdFromUsdc(item.paidUsdc)} USDC` },
    { label: t("publicPages.report.network"), value: CHAIN_LABEL[item.chain] ?? item.chain },
  ];
  if (item.paidAt) facts.push({ label: t("publicPages.report.paidOn"), value: day(item.paidAt) });
  return (
    <article className={`${card} flex flex-col gap-5 p-5 md:p-6 print:break-inside-avoid`}>
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={pill.neutral}>{t(`publicPages.report.kind.${item.kind}`)}</span>
          {seller?.verifiedHost && <span className="text-tiny text-sp-ink/75">{t("publicPages.sponsor.verifiedHost")}</span>}
        </div>
        <h3 className="break-words text-body font-medium text-sp-ink [overflow-wrap:anywhere]">
          {itemName(item)}
          {spot ? <span className="text-sp-ink/75"> · {spot}</span> : null}
        </h3>
        {item.listing.title !== itemName(item) && <p className="text-small text-sp-ink/80">{item.listing.title}</p>}
        {seller && <p className="text-small text-sp-ink/80">{sellerName(seller)}</p>}
        {item.spot.perks.length > 0 && (
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-small text-sp-ink/85">
            {item.spot.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col">
            <dt className="text-tiny text-sp-ink/70">{f.label}</dt>
            <dd className="text-small tabular-nums text-sp-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      {item.explorerUrl && (
        <p className="text-small">
          <a href={item.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-sp-ink underline decoration-sp-ink/30 underline-offset-2">
            {t("publicPages.report.viewTx")}
          </a>
          <span className="hidden break-all text-tiny text-sp-ink/70 print:block">{item.txSignature}</span>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h4 className={`${eyebrow} text-sp-ink/75`}>{t("publicPages.report.delivery")}</h4>
        <DeliveryLine item={item} />
      </div>

      <div className="flex flex-col gap-2">
        <h4 className={`${eyebrow} text-sp-ink/75`}>{t("publicPages.report.proof")}</h4>
        <ProofList item={item} />
      </div>

      {item.content && (item.content.kind || item.content.status) && <ContentBlock content={item.content} />}
      {item.scans && <ScansBlock scans={item.scans} event={event} />}
      <InvoiceLine invoice={item.invoice} />
      {item.listing.path && (
        <a href={item.listing.path} className="text-small text-sp-ink/85 underline decoration-sp-ink/30 underline-offset-2 print:hidden">
          {t("publicPages.report.seeListing")}
        </a>
      )}
    </article>
  );
}

export function ReportItems({ report }: { report: SponsorReport }) {
  const sellers = new Map(report.sellers.map((s) => [s.key, s]));
  return (
    <section className="flex flex-col gap-4">
      <h2 className={`${eyebrow} text-sp-ink/80`}>{t("publicPages.report.items")}</h2>
      {report.items.length === 0 ? (
        <p className="text-body text-sp-ink/85">{t("publicPages.report.empty")}</p>
      ) : (
        report.items.map((item) => <ItemCard key={item.orderId} item={item} seller={sellers.get(item.sellerKey)} event={report.event} />)
      )}
    </section>
  );
}
