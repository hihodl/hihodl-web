import Link from "next/link";

/**
 * Shared furniture for /how-it-works/*.
 *
 * These pages have a different job from the product pages. A product page
 * exists to make someone want the thing; these exist to satisfy the person who
 * already wants it and now needs to know whether it is safe, and the person who
 * is suspicious and is looking for the sentence we did not write.
 *
 * Which is why the rule for this whole section is: state the limit. Every page
 * here names at least one thing HOLD cannot do, or one case where the nice
 * property stops holding. A technology page with no limits in it reads as
 * marketing and gets believed less, not more — and the reader who is checking
 * will find the limit anyway, just not from us.
 */

export const DOC_PAGES = [
  {
    href: "/how-it-works/self-custody",
    label: "Who holds your money",
    blurb:
      "What it means that the money is in your name, what we can never do to it, and the one case where that stops being the whole story.",
  },
  {
    href: "/how-it-works/security",
    label: "How your account is protected",
    blurb:
      "Passkeys, your PIN, two-factor, recovery codes and the list of devices signed in. What each one actually stops.",
  },
  {
    href: "/how-it-works/networks",
    label: "Networks and dollars",
    blurb:
      "The four networks we settle on, the dollars we support, and why you are never asked to choose between them.",
  },
  {
    href: "/how-it-works/fees",
    label: "Who pays the network fee",
    blurb:
      "Moving money on these networks costs something. Most of the time we pay it. Here is exactly when we stop.",
  },
  {
    href: "/how-it-works/modes",
    label: "Three ways to see one account",
    blurb:
      "The same balance shown as plain dollars, as the dollars you actually hold, or with every network in view. You pick.",
  },
] as const;

export function DocHeader({
  eyebrow,
  title,
  sub,
  lead,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  lead: string;
}) {
  return (
    <section className="relative overflow-hidden bg-night">
      <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
      <div className="container-page section relative">
        <div className="max-w-3xl">
          <Link
            href="/how-it-works"
            className="text-tiny uppercase tracking-wider text-moonlight hover:text-text transition-colors duration-180"
          >
            {eyebrow}
          </Link>
          <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
            {title}
            {sub ? (
              <>
                <br />
                <span className="text-text-muted">{sub}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-8 text-lead text-text-muted">{lead}</p>
        </div>
      </div>
    </section>
  );
}

export function DocCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

/**
 * A numbered step. Used where order is the point — a key being derived, a
 * transaction being signed — and nowhere else, because a numbered list implies
 * a sequence and readers trust it to be one.
 */
export function DocStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-6">
      <span className="shrink-0 font-mono tabular-nums text-small text-moonlight pt-1">
        {String(n).padStart(2, "0")}
      </span>
      <div>
        <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
        <p className="mt-3 text-body text-text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/**
 * The limit. Every page in this section carries at least one — see the file
 * docblock. Deliberately not styled as a warning: it is not a warning, it is
 * the part of the truth that a marketing page would have left out.
 */
export function DocLimit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-[color:var(--color-hairline-strong)] bg-white/[0.02] p-8">
      <p className="text-tiny uppercase tracking-wider text-amber">The limit</p>
      <h3 className="mt-4 font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <div className="mt-4 space-y-4 text-body text-text-muted leading-relaxed">{children}</div>
    </div>
  );
}

export function DocAnswer({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-6 open:bg-white/[0.05] transition-colors">
      <summary className="cursor-pointer list-none flex items-start justify-between gap-6">
        <h3 className="font-display text-h4 font-light text-text leading-snug">{q}</h3>
        <span
          className="mt-1 shrink-0 text-text-faint group-open:rotate-45 transition-transform duration-180"
          aria-hidden
        >
          +
        </span>
      </summary>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{a}</p>
    </details>
  );
}

/**
 * Footer of every doc page: the other four. A reader who got to the bottom of
 * one of these is the most likely person on the whole site to read a second,
 * and making them go back to the footer to find it wastes that.
 */
export function DocNext({ current }: { current: string }) {
  const rest = DOC_PAGES.filter((p) => p.href !== current);
  return (
    <section className="relative overflow-hidden bg-abyss">
      <div className="container-page section relative">
        <h2 className="font-display text-h2 font-light text-text">Keep reading</h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
          {rest.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.06] transition-colors duration-180"
            >
              <h3 className="font-display text-h4 font-light text-text leading-snug">{p.label}</h3>
              <p className="mt-3 text-body text-text-muted leading-relaxed">{p.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
