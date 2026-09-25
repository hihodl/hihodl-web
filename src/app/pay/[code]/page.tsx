import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SlimHeader } from "@/components/ad-space/sections";
import { card, eyebrow } from "@/components/ad-space/ui";
import { PayLinkPay } from "@/components/pay-links/PayLinkPay";
import { ReportLink } from "@/components/pay-links/ReportLink";
import { Wordmark } from "@/components/site/Wordmark";
import { CHAIN_LABEL, usdFromCents } from "@/lib/ad-space/format";
import { ownerHandleLine, ownerName } from "@/lib/pay-links/client";
import { payPageMetadata } from "@/lib/pay-links/metadata";
import { getPayLink, getPersonalPayLink } from "@/lib/pay-links/server";
import type { PayLinkPublic, PayLinkStatus, ShownPayLink } from "@/lib/pay-links/types";

/**
 * /pay/<code> — somebody asks to be paid, and the payer has no HOLD account
 * (pay-links-v0.md).
 *
 * `/pay/@handle` is the same page for a person's personal link (the QR in
 * their app): anyone pays them any amount, whether or not they have HOLD.
 *
 * Not a marketplace page: no profile, no track record, not in the sitemap,
 * `noindex`, and a link card that says nothing the link's owner wrote. Read on
 * every request (`no-store`) so a single-use link that has just been paid never
 * shows a pay button.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = payPageMetadata("Pay link");

const GONE: Record<Exclude<PayLinkStatus, "active" | "disabled">, { title: string; body: string }> = {
  paid: { title: "This link has been paid.", body: "It took one payment, and that payment has arrived." },
  closed: { title: "This link is closed.", body: "Its owner closed it, so it takes no more payments." },
  expired: { title: "This link has expired.", body: "It takes no more payments. Ask whoever sent it for a new one." },
};

export default async function PayLinkPage({ params }: { params: { code: string } }) {
  // `/pay/@dana` arrives as `%40dana`.
  const raw = decodeURIComponent(params.code);
  const found = raw.startsWith("@") ? await getPersonalPayLink(raw.slice(1), headers()) : await getPayLink(raw, headers());
  if (found.kind === "missing") notFound();

  return (
    <>
      <SlimHeader />
      <main className="container-page max-w-2xl py-10 md:py-16">
        {found.kind === "unreachable" ? (
          <Unavailable />
        ) : !isShown(found.value) ? (
          // Nothing the owner wrote is shown on a link we took down.
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-amber`}>Pay link</p>
            <h1 className="mt-5 font-display text-h3 font-light text-text md:text-h2">
              This link is no longer available.
            </h1>
            <p className="mt-5 max-w-xl text-body text-text-muted">Don&rsquo;t send money to whoever shared it.</p>
          </div>
        ) : (
          <PayLinkBody link={found.value} />
        )}
      </main>
      <footer className="hairline">
        <div className="container-page flex max-w-2xl flex-col gap-3 py-10">
          <Wordmark className="h-5 w-auto self-start text-text" />
          <p className="text-small text-text-muted">
            HOLD is a wallet. A pay link sends USDC straight to the wallet of the person who made it. HOLD charges
            nothing for it and never holds the money.
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-small" aria-label="Legal">
            <Link href="/terms" className="text-text-muted hover:text-text">
              Terms
            </Link>
            <Link href="/privacy" className="text-text-muted hover:text-text">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

/** A disabled link, or one that comes back without its title or amount, shows nothing the owner wrote. */
function isShown(link: PayLinkPublic): link is ShownPayLink {
  return link.status !== "disabled" && link.title !== null && link.amount !== null;
}

function PayLinkBody({ link }: { link: ShownPayLink }) {
  if (link.personal) return <PersonalBody link={link} />;
  const handleLine = ownerHandleLine(link.owner);
  const active = link.status === "active";
  const gone = link.status === "active" || link.status === "disabled" ? null : GONE[link.status];
  return (
    <div className="flex flex-col gap-6">
      <section className={`${card} flex flex-col gap-5 p-5 md:p-6`} aria-label="What you are paying">
        <div className="min-w-0">
          <p className={`${eyebrow} text-text-faint`}>Pay link</p>
          <h1 className="mt-2 break-words font-display text-h4 font-light text-text [overflow-wrap:anywhere] md:text-h3">
            {link.title}
          </h1>
          {link.note && (
            <p className="mt-2 whitespace-pre-line break-words text-small text-text-muted [overflow-wrap:anywhere]">
              {link.note}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-[color:var(--color-hairline)] pt-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-tiny text-text-faint">Amount</dt>
            <dd className="mt-1 text-body text-text">
              {link.amount.mode === "fixed" ? (
                <span className="font-mono">{usdFromCents(link.amount.cents)} USDC</span>
              ) : link.amount.maxCents !== null ? (
                <>You choose, up to <span className="font-mono">{usdFromCents(link.amount.maxCents)}</span></>
              ) : (
                "You choose"
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-tiny text-text-faint">To</dt>
            <dd className="mt-1 break-words text-body text-text [overflow-wrap:anywhere]">
              {ownerName(link.owner)}
              {handleLine && <span className="text-small text-text-muted"> {handleLine}</span>}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-tiny text-text-faint">Networks</dt>
            <dd className="mt-1 text-small text-text-muted">USDC on {link.chains.map((c) => CHAIN_LABEL[c]).join(", ")}</dd>
          </div>
        </dl>
      </section>

      {active && (
        <p className="rounded-card border border-amber/40 bg-amber/[0.06] px-4 py-3 text-small text-text" role="note">
          Only pay people you know. HOLD does not check what this payment is for and cannot reverse it.
        </p>
      )}

      {gone && (
        <section className={`${card} flex flex-col gap-2 p-5 md:p-6`}>
          <h2 className="font-display text-h4 font-light text-text">{gone.title}</h2>
          <p className="text-small text-text-muted">{gone.body}</p>
        </section>
      )}

      {/* Always mounted: on a paid link it still shows this browser its own payment and receipt. */}
      <section className={active ? `${card} p-5 md:p-6` : ""} aria-label="Pay">
        <PayLinkPay link={link} />
      </section>

      <ReportLink code={link.code} />
    </div>
  );
}

/**
 * A person's own link: no title of theirs to show, so the page is who you are
 * paying and the amount you choose. The same warning, checkout and report.
 */
function PersonalBody({ link }: { link: ShownPayLink }) {
  const active = link.status === "active";
  const name = link.owner?.displayName?.trim();
  const handle = ownerName(link.owner);
  return (
    <div className="flex flex-col gap-6">
      <section className={`${card} flex flex-col gap-5 p-5 md:p-6`} aria-label="Who you are paying">
        <div className="min-w-0">
          <p className={`${eyebrow} text-text-faint`}>Pay</p>
          <h1 className="mt-2 break-words font-display text-h4 font-light text-text [overflow-wrap:anywhere] md:text-h3">
            {handle}
          </h1>
          {name && name !== handle && <p className="mt-2 break-words text-small text-text-muted">{name}</p>}
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-[color:var(--color-hairline)] pt-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-tiny text-text-faint">Amount</dt>
            <dd className="mt-1 text-body text-text">You choose</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-tiny text-text-faint">Networks</dt>
            <dd className="mt-1 text-small text-text-muted">USDC on {link.chains.map((c) => CHAIN_LABEL[c]).join(", ")}</dd>
          </div>
        </dl>
      </section>

      {active ? (
        <p className="rounded-card border border-amber/40 bg-amber/[0.06] px-4 py-3 text-small text-text" role="note">
          Only pay people you know. HOLD does not check what this payment is for and cannot reverse it.
        </p>
      ) : (
        <section className={`${card} flex flex-col gap-2 p-5 md:p-6`}>
          <h2 className="font-display text-h4 font-light text-text">This link takes no more payments.</h2>
          <p className="text-small text-text-muted">Ask {handle} for their new one.</p>
        </section>
      )}

      <section className={active ? `${card} p-5 md:p-6` : ""} aria-label="Pay">
        <PayLinkPay link={link} />
      </section>

      <ReportLink code={link.code} />
    </div>
  );
}

function Unavailable() {
  return (
    <div className="flex min-h-[50vh] flex-col justify-center">
      <p className={`${eyebrow} text-amber`}>Pay link</p>
      <h1 className="mt-5 font-display text-h3 font-light text-text md:text-h2">We couldn&rsquo;t load this link just now.</h1>
      <p className="mt-5 max-w-xl text-body text-text-muted">
        This is on our side. Give it a moment and refresh the page. Nothing has been paid.
      </p>
    </div>
  );
}
