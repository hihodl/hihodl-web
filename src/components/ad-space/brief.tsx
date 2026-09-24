/**
 * The public parts of a brief: what hihodl.xyz/brief/<slug> is made of.
 *
 * This page is read by somebody who saw a post, not by somebody who has an
 * account. So it answers, in this order, the four things they came to find
 * out: what the brand wants, what they get for doing it, by when, and — if it
 * is already decided — who won.
 *
 * ── The queue is not here ──
 * An entry that was not picked is not on this page, its message is not on it
 * and its link is not on it. The API does not send them; these parts could not
 * draw them if it did. What is here of everybody else is one number: how many
 * have entered, which is the only thing about a queue that helps somebody
 * decide whether to bother.
 *
 * ── The brand is on trial too ──
 * `BrandRecordCard` is the brand's own record, counted and never scored:
 * briefs written, creators picked, briefs that ended with nobody, what was
 * paid. A creator is being asked to get on a plane on the strength of a
 * stranger's promise, and this is what the stranger's promise has been worth.
 */

import Link from "next/link";

import { instantUtc } from "@/lib/ad-space/format";
import { productUrl } from "@/lib/app/paths";
import type { BrandRecord, BriefWinner, PublicBrief } from "@/lib/ad-space/types";

import { ClosesCountdown } from "./ClosesCountdown";
import { btnPrimary, btnSecondary, card, eyebrow, pill } from "./ui";

/** "$1,000", or nothing at all when the brand pays in kind. */
export function moneyText(cents: number): string {
  const d = cents / 100;
  return `$${d.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(d) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export const FALLBACK_LINE: Record<string, string> = {
  content_anyway: "You post the content anyway and keep what you were paid.",
  creator_refund: "You refund what you were paid.",
  next_event: "It moves to the next event.",
};

/** Where this brief is, in one line. */
export function whereText(brief: PublicBrief): string {
  if (brief.event?.name) return brief.event.city ? `${brief.event.name} · ${brief.event.city}` : brief.event.name;
  return brief.city ?? "Anywhere";
}

/** The state of the call, as a word somebody scanning gets in one look. */
export function statusPill(brief: PublicBrief): { label: string; cls: string } {
  if (brief.status === "filled" || brief.pickedCount >= brief.peopleWanted) return { label: "Decided", cls: pill.done };
  if (!brief.applicationsOpen) return { label: "Entries closed", cls: pill.sold };
  return { label: "Open for entries", cls: pill.open };
}

/* ── The head ─────────────────────────────────────────────────────── */

export function BriefHead({ brief }: { brief: PublicBrief }) {
  const state = statusPill(brief);
  const brand = brief.brand.name ?? "A brand";
  return (
    <header className="container-page pt-10 md:pt-14">
      <div className="flex flex-wrap items-center gap-3">
        <p className={`${eyebrow} text-sp-amber`}>Open brief</p>
        <span className={state.cls}>{state.label}</span>
        {brief.inKindOnly ? <span className={pill.neutral}>Costs covered</span> : null}
      </div>

      <h1 className="mt-5 max-w-3xl font-display text-h3 font-light text-sp-ink md:text-h2">{brief.title}</h1>

      <p className="mt-4 text-body text-sp-ink/85">
        {brand} is asking
        {brief.brand.handle ? (
          <>
            {" "}
            (
            <a
              href={`https://x.com/${brief.brand.handle}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-sp-ink"
            >
              @{brief.brand.handle}
            </a>
            )
          </>
        ) : null}
        . {whereText(brief)}.
      </p>

      <p className="mt-6 max-w-2xl text-body text-sp-ink">{brief.description}</p>
    </header>
  );
}

/* ── What you get ─────────────────────────────────────────────────── */

export function WhatYouGet({ brief }: { brief: PublicBrief }) {
  return (
    <section className={`${card} mt-10 p-6 md:p-8`} aria-label="What you get">
      <p className={`${eyebrow} text-sp-ink/70`}>What you get</p>

      <p className="mt-3 font-display text-h4 font-light text-sp-ink md:text-h3">
        {brief.budgetCents > 0 ? moneyText(brief.budgetCents) : brief.perks}
        {brief.budgetCents > 0 && brief.perks ? <span className="text-sp-ink/85"> and {lowerFirst(brief.perks)}</span> : null}
      </p>

      {brief.budgetCents > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 text-small text-sp-ink/85">
          {brief.positions.map((p) => (
            <li key={p.label} className="flex justify-between gap-4">
              <span>{p.label}</span>
              <span className="font-mono text-sp-ink">{moneyText(p.priceCents)}</span>
            </li>
          ))}
          <li className="pt-1 text-sp-ink/70">
            Paid in USDC from the brand&rsquo;s wallet straight to yours. HOLD never holds it, and the brand pays our 5% on top, so
            what is above is what you receive.
          </li>
        </ul>
      ) : (
        <p className="mt-5 text-small text-sp-ink/85">
          No money runs through HOLD on this one. The brand arranges what it covers with whoever it picks, directly — we are where
          the call was posted and the record of who was chosen, nothing more.
        </p>
      )}
    </section>
  );
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/* ── When ─────────────────────────────────────────────────────────── */

export function When({ brief }: { brief: PublicBrief }) {
  return (
    <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="When">
      <Fact label="Entries">
        {brief.applicationsCloseAt ? (
          <ClosesCountdown closesAt={brief.applicationsCloseAt} closed={!brief.applicationsOpen} />
        ) : (
          <span className="text-sp-ink">Open until it is filled</span>
        )}
      </Fact>
      <Fact label={brief.decidedAt ? "Decided" : "Decides by"}>
        <span className="text-sp-ink">
          {brief.decidedAt ? instantUtc(brief.decidedAt) : brief.decideBy ? instantUtc(brief.decideBy) : "When it is filled"}
        </span>
      </Fact>
      <Fact label="How many">
        <span className="text-sp-ink">
          {brief.peopleWanted === 1 ? "One creator" : `${brief.peopleWanted} creators`}
          {brief.pickedCount > 0 ? ` · ${brief.pickedCount} picked` : ""}
        </span>
      </Fact>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${card} p-5`}>
      <p className={`${eyebrow} text-sp-ink/70`}>{label}</p>
      <p className="mt-2 text-small">{children}</p>
    </div>
  );
}

/* ── If the venue says no ─────────────────────────────────────────── */

export function IfTheVenueSaysNo({ brief }: { brief: PublicBrief }) {
  return (
    <section className={`${card} mt-4 p-5`} aria-label="If the venue says no">
      <p className={`${eyebrow} text-sp-ink/70`}>If the venue says no</p>
      <p className="mt-2 text-small text-sp-ink">
        {FALLBACK_LINE[brief.fallback] ?? brief.fallback}
        {brief.fallbackNote ? ` ${brief.fallbackNote}` : ""}
      </p>
      <p className="mt-2 text-tiny text-sp-ink/70">
        Every brief answers this before anybody applies. It is the brand&rsquo;s answer, not ours.
      </p>
    </section>
  );
}

/* ── The announcement ─────────────────────────────────────────────── */

export function Winners({ brief }: { brief: PublicBrief }) {
  if (brief.winners.length === 0) return null;
  return (
    <section className="mt-10" aria-label="Who was picked">
      <p className={`${eyebrow} text-sp-amber`}>{brief.winners.length === 1 ? "Picked" : "Picked so far"}</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {brief.winners.map((w, i) => (
          <li key={`${w.handle ?? "creator"}-${i}`} className={`${card} flex items-center gap-4 p-5`}>
            {w.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.avatarUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="h-12 w-12 shrink-0 rounded-full bg-sp-ink/10" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-medium text-sp-ink">{w.name ?? (w.handle ? `@${w.handle}` : "A creator")}</p>
              {w.handle ? (
                <a
                  href={`https://x.com/${w.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-tiny text-sp-ink/70 underline underline-offset-4 hover:text-sp-ink"
                >
                  @{w.handle}
                </a>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-3 text-tiny">
                {w.link ? (
                  <a href={w.link} target="_blank" rel="noreferrer" className="text-sp-ink underline underline-offset-4">
                    The entry that won
                  </a>
                ) : null}
                {w.space ? (
                  <Link href={`/s/${w.handle ?? ""}/${w.space.slug}`} className="text-sp-ink underline underline-offset-4">
                    Their listing
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── The brand's record ───────────────────────────────────────────── */

export function BrandRecordCard({ record, brand }: { record: BrandRecord; brand: string }) {
  if (record.briefsPosted === 0) return null;
  return (
    <section className={`${card} mt-4 p-5`} aria-label="This brand's record">
      <p className={`${eyebrow} text-sp-ink/70`}>{brand}&rsquo;s record</p>
      <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Count label="Briefs" value={record.briefsPosted} />
        <Count label="Creators picked" value={record.creatorsPicked} />
        <Count label="Ended with nobody" value={record.endedWithNobody} />
        <Count label="Paid through HOLD" value={moneyText(record.paidCents)} />
      </dl>
      <p className="mt-3 text-tiny text-sp-ink/70">
        Counted, not scored. Creators carry a public record on every listing they sell; a brief asks somebody to travel on a
        promise, so the brand carries one too.
      </p>
    </section>
  );
}

function Count({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-tiny text-sp-ink/70">{label}</dt>
      <dd className="mt-1 font-mono text-small text-sp-ink">{value}</dd>
    </div>
  );
}

/* ── The one thing to do ──────────────────────────────────────────── */

export function ApplyCta({ brief }: { brief: PublicBrief }) {
  const open = brief.applicationsOpen && brief.pickedCount < brief.peopleWanted;
  const applyHref = productUrl(`/spaces/briefs?brief=${encodeURIComponent(brief.id)}`);
  return (
    <section className="mt-10 mb-16" aria-label="Apply">
      <div className={`${card} flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8`}>
        <div className="max-w-xl">
          <p className="font-display text-h4 font-light text-sp-ink">
            {open ? "Apply with the thing you would post." : "Entries are closed."}
          </p>
          <p className="mt-2 text-small text-sp-ink/85">
            {open
              ? "You apply inside HOLD, with a link to your video and a line about why you. The brand reads it; nobody else does, and nothing you send appears on this page unless you are picked."
              : "This call is not taking anybody new. Open briefs are inside HOLD, and creators there get them the day they are posted."}
          </p>
          {open && brief.applicantCount > 0 ? (
            <p className="mt-2 text-tiny text-sp-ink/70">
              {brief.applicantCount} {brief.applicantCount === 1 ? "creator has" : "creators have"} entered so far.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <a href={applyHref} className={btnPrimary}>
            {open ? "Apply in HOLD" : "See open briefs"}
          </a>
          <Link href="/how-it-works" className={btnSecondary}>
            What is HOLD?
          </Link>
        </div>
      </div>
    </section>
  );
}
