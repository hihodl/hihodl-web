import { DownloadLink } from "@/components/site/DownloadLink";
import { SectionHairline } from "@/components/site/SectionHairline";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import { usd } from "@/lib/esim/countries";
import type { EsimPlan } from "@/lib/esim/prices";

/**
 * The pieces /esim and /esim/<country> share. Same cards and type as /savings
 * and /travel: night and abyss grounds, a hairline at each seam.
 */

export const PRIMARY_CTA =
  "inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]";

export const SECONDARY_CTA =
  "inline-flex items-center justify-center px-7 py-4 rounded-pill border border-[color:var(--color-hairline-strong)] text-text font-medium text-body hover:bg-white/5 transition-colors duration-180";

export function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-card p-6 md:p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <span className="font-mono text-small text-moonlight">0{n}</span>
      <h3 className="mt-6 md:mt-8 font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </li>
  );
}

export function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card p-6 md:p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

/** "1 GB", "Unlimited", or the size the API sent. */
export function planSize(p: Pick<EsimPlan, "dataLabel" | "isUnlimited">): string {
  if (p.isUnlimited) return "Unlimited";
  return p.dataLabel ?? "Data";
}

export function PlanCard({ plan }: { plan: EsimPlan }) {
  return (
    <li className="rounded-card p-6 border border-[color:var(--color-hairline)] bg-white/[0.03] flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-h3 font-light text-text leading-none">{planSize(plan)}</p>
        <p className="mt-3 text-small text-text-muted">
          {plan.days} {plan.days === 1 ? "day" : "days"}
        </p>
      </div>
      <p className="font-display text-h4 font-light text-amber whitespace-nowrap">{usd(plan.price)}</p>
    </li>
  );
}

/** The question and its answer, open on click, readable with no JavaScript. */
export function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] px-6 py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lead font-light text-text">
        {q}
        <span className="text-text-faint transition-transform duration-180 group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{a}</p>
    </details>
  );
}

/** Buying happens in the app: every page ends here. */
export function GetTheApp({ title, body }: { title: string; body: string }) {
  return (
    <section className="relative overflow-hidden bg-night">
      <SectionHairline tone="amber" />
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: "radial-gradient(60% 60% at 50% 100%, rgba(255,183,3,0.10), transparent 70%)" }}
        aria-hidden
      />
      <div className="container-page section relative text-center">
        <p className="text-tiny uppercase tracking-wider text-amber">Get the app</p>
        <h2 className="mt-6 font-display text-h3 md:text-h2 font-light text-text max-w-2xl mx-auto">{title}</h2>
        <p className="mt-6 text-lead text-text-muted max-w-xl mx-auto">{body}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <DownloadLink className={PRIMARY_CTA}>Get HOLD</DownloadLink>
        </div>
        <p className="mt-6 text-small text-text-faint">
          <a href={APP_STORE_URL} className="hover:text-text underline underline-offset-4">
            App Store
          </a>
          <span className="mx-3" aria-hidden>
            ·
          </span>
          <a href={PLAY_STORE_URL} className="hover:text-text underline underline-offset-4">
            Google Play
          </a>
        </p>
      </div>
    </section>
  );
}

/** Structured data, with `<` escaped so a value can never close the tag. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
