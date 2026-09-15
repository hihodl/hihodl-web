import Link from "next/link";
import type { ReactNode } from "react";

import { DownloadLink } from "@/components/site/DownloadLink";
import { Wordmark } from "@/components/site/Wordmark";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";
import {
  CHAIN_LABEL,
  DELIVERABLE_STATE_LABEL,
  FALLBACK_TEXT,
  VERIFIED_LABEL,
  accountAge,
  attestationText,
  calendarDate,
  compactNumber,
  deliverableText,
  relativeTime,
  usdFromCents,
} from "@/lib/ad-space/format";
import type { Creator, DeliverableState, Space } from "@/lib/ad-space/types";

import { ClosesCountdown } from "./ClosesCountdown";
import { btnSmallSecondary, card, eyebrow, pill } from "./ui";

/* ── Chrome ────────────────────────────────────────────────────────── */

/**
 * A slim header, not the site nav. Somebody arriving from a post on X came to
 * look at one board and maybe pay for a spot; five product menus above it are
 * five ways out of the page.
 */
export function SlimHeader() {
  return (
    <header className="container-page flex h-16 items-center justify-between gap-4">
      <Link href="/" className="flex items-center text-text" aria-label="Home">
        <Wordmark className="h-5 w-auto" />
      </Link>
      <DownloadLink className={btnSmallSecondary}>Get HOLD</DownloadLink>
    </header>
  );
}

export function SpaceFooter({ space }: { space: Space }) {
  const report = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Report Ad Space ${space.id}`)}`;
  return (
    <footer className="hairline">
      <div className="container-page flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <Wordmark className="h-5 w-auto self-start text-text" />
          <p className="text-small text-text-muted">
            Powered by HOLD. Sponsors pay creators directly in USDC, and HOLD never holds the money.
          </p>
          <p className="text-small text-text-faint">Have an audience? Sell your own Ad Space from the HOLD app.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-small" aria-label="Ad Space">
          <DownloadLink className="text-text-muted transition-colors duration-180 hover:text-text">Get HOLD</DownloadLink>
          <a href={report} className="text-text-muted transition-colors duration-180 hover:text-text">
            Report this Ad Space
          </a>
          <Link href="/terms" className="text-text-muted transition-colors duration-180 hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="text-text-muted transition-colors duration-180 hover:text-text">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────── */

export function SpaceHero({ space }: { space: Space }) {
  const { totals } = space;
  const soldOut = totals.positions > 0 && totals.sold >= totals.positions;
  const noun = space.kind === "service" ? "slots" : "spots";
  const what =
    space.kind === "service"
      ? `Sponsored ${space.template.name.toLowerCase()}`
      : `Ad Space on a ${space.template.name.toLowerCase()}`;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #1B2638 0%, #243246 60%, #141F2E 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 70% at 20% 10%, rgba(255,183,3,0.10), transparent 70%)" }}
        aria-hidden
      />
      <div className="container-page relative pb-14 pt-8 md:pb-20 md:pt-14">
        <p className={`${eyebrow} text-amber`}>
          {[space.eventName, what].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-5 max-w-4xl font-display text-[40px] font-light leading-[1.05] text-text md:text-h1">
          {space.title}
        </h1>
        {space.reason && <p className="mt-5 max-w-2xl text-body text-text-muted md:text-lead">{space.reason}</p>}

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CreatorCard creator={space.creator} />

          <div className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="text-text">
                {soldOut ? (
                  <span className="font-display text-h3 font-light text-amber">Sold out</span>
                ) : (
                  <>
                    <span className="font-display text-h3 font-light">{totals.sold}</span>
                    <span className="text-body text-text-muted">
                      {" "}
                      of {totals.positions} {noun} sold
                    </span>
                  </>
                )}
              </p>
              <p className="text-small">
                <span className="font-mono text-text">{usdFromCents(totals.committedCents)}</span>
                <span className="text-text-faint"> committed of {usdFromCents(totals.totalCents)}</span>
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-[4px] bg-white/[0.06]"
              role="progressbar"
              aria-label={`${totals.sold} of ${totals.positions} ${noun} sold`}
              aria-valuemin={0}
              aria-valuemax={totals.positions}
              aria-valuenow={totals.sold}
            >
              <div
                className="h-full rounded-[4px] bg-amber"
                style={{ width: `${totals.positions ? Math.min(100, (totals.sold / totals.positions) * 100) : 0}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-small">
              <ClosesCountdown closesAt={space.closesAt} closed={space.status !== "live"} />
              <span className="text-text-faint">
                Paid in USDC on {space.chains.map((c) => CHAIN_LABEL[c]).join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorCard({ creator: c }: { creator: Creator }) {
  const age = accountAge(c.xAccountCreatedAt);
  const { delivered, missed } = c.trackRecord;
  return (
    <div className={`${card} flex items-start gap-4 p-5 md:p-6`}>
      <Avatar creator={c} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-text">{c.xName}</p>
        <a
          href={`https://x.com/i/user/${encodeURIComponent(c.xUserId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small text-text-muted transition-colors duration-180 hover:text-amber"
        >
          @{c.xHandle}
        </a>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.xVerifiedType ? (
            <span className={pill.neutral}>{VERIFIED_LABEL[c.xVerifiedType]}</span>
          ) : (
            <span className={pill.neutral}>No X checkmark</span>
          )}
          {c.xIdentityVerified && <span className={pill.done}>ID verified by X</span>}
        </div>
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-small">
          <Fact label="Followers" value={compactNumber(c.xFollowers)} />
          {age && <Fact label="On X" value={age.replace(/ on X$/, "")} />}
          <Fact
            label="Track record"
            value={
              delivered + missed === 0
                ? "First Ad Space"
                : `${delivered} delivered${missed ? `, ${missed} missed` : ", none missed"}`
            }
            tone={missed > 0 ? "attention" : undefined}
          />
        </dl>
      </div>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "attention" }) {
  return (
    <>
      <dt className="whitespace-nowrap text-text-faint">{label}</dt>
      <dd className={tone === "attention" ? "text-amber" : "text-text"}>{value}</dd>
    </>
  );
}

function Avatar({ creator: c }: { creator: Creator }) {
  if (c.xAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
      <img
        src={c.xAvatarUrl}
        alt=""
        width={56}
        height={56}
        referrerPolicy="no-referrer"
        className="h-14 w-14 shrink-0 rounded-full border border-[color:var(--color-hairline-strong)] object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-blue-deep text-h4 font-light text-text"
      aria-hidden
    >
      {(c.xName || c.xHandle).slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ── Promises ──────────────────────────────────────────────────────── */

const STATE_PILL: Record<DeliverableState, string> = {
  upcoming: pill.neutral,
  overdue: pill.attention,
  delivered: pill.done,
  missed: pill.attention,
};

export function SpacePromises({ space }: { space: Space }) {
  const hasDeliverables = space.deliverables.length > 0;
  const declares = space.attestations.map(attestationText);
  return (
    <section className="relative bg-night">
      <div className="container-page py-16 md:py-24">
        <p className={`${eyebrow} text-moonlight`}>Before you pay</p>
        <h2 className="mt-4 font-display text-h3 font-light text-text md:text-h2">What the creator promises</h2>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Block title={space.kind === "service" ? "Delivery" : "Deliverables"}>
            {space.kind === "service" && space.deliverBy && (
              <p className="text-small text-text-muted">
                Every sold slot is delivered by{" "}
                <span className="text-text">{calendarDate(space.deliverBy)}</span>, each with its own public link on
                this page.
              </p>
            )}
            {hasDeliverables ? (
              <ul className="flex flex-col divide-y divide-[color:var(--color-hairline)]">
                {space.deliverables.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-small text-text">{deliverableText(d.kind, d.platform, d.count)}</p>
                      <p className="text-tiny text-text-faint">
                        Due {calendarDate(d.dueDate)}
                        {d.deliveredUrl && (
                          <>
                            {" · "}
                            <a
                              href={d.deliveredUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-success hover:underline"
                            >
                              See it
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <span className={STATE_PILL[d.state]}>{DELIVERABLE_STATE_LABEL[d.state]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              space.kind !== "service" && (
                <p className="text-small text-text-muted">The creator hasn&rsquo;t listed deliverables.</p>
              )
            )}
          </Block>

          <Block title="Key dates">
            <ul className="flex flex-col gap-3">
              {space.keyDates.map((k, i) => (
                <li key={`${k.date}-${i}`} className="flex items-baseline justify-between gap-4 text-small">
                  <span className="text-text">{k.label}</span>
                  <span className="shrink-0 font-mono text-text-muted">{calendarDate(k.date)}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 text-small">
                <span className="text-text">Sponsorship closes</span>
                <span className="shrink-0 font-mono text-text-muted">{calendarDate(space.closesAt)}</span>
              </li>
            </ul>
          </Block>

          <Block title="If a venue says no">
            <p className="text-small text-text-muted">{FALLBACK_TEXT[space.fallback]}</p>
            {space.fallbackNote && (
              <p className="border-l-2 border-amber/40 pl-3 text-small text-text">
                <span className="sr-only">The creator adds: </span>
                {space.fallbackNote}
              </p>
            )}
          </Block>

          <Block title="How the money moves">
            <p className="text-small text-text-muted">
              You pay the creator directly in USDC, from your own wallet. HOLD&rsquo;s fee is{" "}
              {space.feeBps / 100}%, paid by the {space.feePayer}, and it moves in the same transaction. HOLD never
              holds your money, and paid spots can&rsquo;t be refunded by HOLD.
            </p>
            {declares.length > 0 && (
              <p className="text-small text-text-muted">
                The creator declares that they {joinWords(declares)}.
              </p>
            )}
          </Block>
        </div>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <h3 className={`${eyebrow} text-text-faint`}>{title}</h3>
      {children}
    </div>
  );
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* ── Updates ───────────────────────────────────────────────────────── */

export function SpaceUpdates({ space }: { space: Space }) {
  if (space.updates.length === 0) return null;
  const labelOf = new Map(space.positions.map((p) => [p.id, p.label]));
  const updates = [...space.updates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const now = Date.now();

  return (
    <section className="container-page py-16 md:py-24">
      <p className={`${eyebrow} text-amber`}>From @{space.creator.xHandle}</p>
      <h2 className="mt-4 font-display text-h3 font-light text-text md:text-h2">Updates</h2>
      <ol className="mt-10 flex max-w-2xl flex-col gap-5">
        {updates.map((u) => (
          <li key={u.id} className={`${card} overflow-hidden`}>
            {u.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- creator photo from our own bucket
              <img src={u.imageUrl} alt="" loading="lazy" className="max-h-[420px] w-full object-cover" />
            )}
            <div className="flex flex-col gap-2 p-5">
              {u.body && <p className="whitespace-pre-line text-body text-text">{u.body}</p>}
              <p className="text-tiny text-text-faint">
                <time dateTime={u.createdAt}>{relativeTime(u.createdAt, now)}</time>
                {u.positionId && labelOf.get(u.positionId) ? ` · Proof for ${labelOf.get(u.positionId)}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── When the API is down ──────────────────────────────────────────── */

export function SpaceUnavailable() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col justify-center py-20">
      <p className={`${eyebrow} text-amber`}>Ad Space</p>
      <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
        We couldn&rsquo;t load this board just now.
      </h1>
      <p className="mt-5 max-w-xl text-body text-text-muted">
        This is on our side, not the link. Give it a moment and refresh the page.
      </p>
    </section>
  );
}
