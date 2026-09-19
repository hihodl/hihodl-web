import type { ReactNode } from "react";

import { BENEFITS_GROUND } from "@/components/ad-space/ground";
import { btnPrimary, btnSecondary, card, eyebrow, pill } from "@/components/ad-space/ui";
import { SectionHairline } from "@/components/site/SectionHairline";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";

import { DressArt, PhotoArt, ProductionArt, SuitcaseArt } from "./art";

/**
 * The homepage, told from the creator's side: the hook earns the attention,
 * the attention is what a brand buys, and a spot is the door to a content deal.
 *
 * Copy rules for this file: plain, short, no hype, and no figure we cannot
 * cite. The 5% is the one number that is ours to state, and it lives in the
 * FAQ and the brands section, never next to a creator's price.
 */

/** Example tag on every drawn hook, so nobody reads one as a real creator's space. */
function ExampleTag() {
  return <span className={pill.neutral}>Example</span>;
}

/* ── 1. Hero ─────────────────────────────────────────────────────────── */

export function SpacesHero({ createHref }: { createHref: string }) {
  return (
    <section className="relative overflow-hidden" style={{ background: BENEFITS_GROUND }} aria-label="HOLD Spaces">
      <div className="container-page relative pt-12 md:pt-20 pb-20 md:pb-28">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} text-amber`}>HOLD Spaces</p>
            <h1 className="mt-6 font-display text-[44px] leading-[1.05] tracking-[-0.03em] text-text md:text-display-sm" style={{ fontWeight: 200 }}>
              Asking for brand deals gets scrolled past.
              <span className="block text-text-muted">A hook gets shared.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lead text-text-muted">
              Turn a suitcase, a dress or a photo into ad space. Set your spots and prices, post one link, and let
              brands pay you per spot, straight to your wallet.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={createHref} className={btnPrimary}>
                Create your space
              </a>
              <a href="#how" className={btnSecondary}>
                See how it works
              </a>
            </div>
            <p className="mt-8 text-small text-text-muted">Help your distribution. Reach more brands.</p>
          </div>

          <div className="lg:col-span-5">
            <div className={`${card} relative p-6 md:p-8`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-small text-text">Road to the conference</p>
                <ExampleTag />
              </div>
              <SuitcaseArt className="mx-auto mt-6 block h-[220px] w-auto md:h-[300px]" />
              <Legend className="mt-6" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-4 text-tiny text-text-muted ${className}`}>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-[3px] border border-moonlight bg-moonlight/10" aria-hidden />
        Open spot
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-[3px] bg-amber" aria-hidden />
        Sold to a brand
      </span>
    </div>
  );
}

/* ── 2. Why a hook works ─────────────────────────────────────────────── */

const LESSONS = [
  {
    n: "01",
    title: "Be early",
    body: "The first suitcase covered in ad spots at an event gets the looks. The tenth gets a scroll. Post before the timeline fills up.",
  },
  {
    n: "02",
    title: "Be out of the ordinary",
    body: "People stop for what they have not seen before. An object covered in open spots makes everyone ask the same thing: who buys one?",
  },
  {
    n: "03",
    title: "Your reach is what they buy",
    body: "The object is why people look. What a brand pays for is you: your audience, the people who see the post, and the content you make.",
  },
];

const EXAMPLES: { title: string; kind: string; body: string; art: ReactNode }[] = [
  {
    title: "Suitcase",
    kind: "Product",
    body: "Spots on every face. It travels with you through the airport, the venue and every photo.",
    art: <SuitcaseArt className="h-full w-auto" />,
  },
  {
    title: "Dress",
    kind: "Product",
    body: "Spots front and back. Worn on the day, in every photo anyone takes of you.",
    art: <DressArt className="h-full w-auto" />,
  },
  {
    title: "Photo with squares",
    kind: "Your photo",
    body: "Upload a photo and draw the squares where logos go. Anything you can shoot can be the hook.",
    art: <PhotoArt className="h-full w-auto" />,
  },
  {
    title: "Content production",
    kind: "Service",
    body: "The brand brings a brief, you shoot and deliver. Videos, interviews and recaps, made for them.",
    art: <ProductionArt className="h-full w-full" />,
  },
];

export function WhyAHookWorks() {
  return (
    <section id="creators" className="relative scroll-mt-20 overflow-hidden bg-night">
      <SectionHairline tone="amber" />
      <div className="container-page section relative">
        <div className="max-w-2xl">
          <p className={`${eyebrow} text-amber`}>Why a hook works</p>
          <h2 className="mt-6 font-display text-h3 font-light text-text md:text-h2">
            The object gets the attention. The attention gets the brands.
          </h2>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {LESSONS.map((l) => (
            <li key={l.n} className={`${card} p-7 md:p-8`}>
              <span className="font-mono text-small text-amber">{l.n}</span>
              <h3 className="mt-6 font-display text-h4 font-light text-text">{l.title}</h3>
              <p className="mt-3 text-body text-text-muted">{l.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-20 flex flex-wrap items-end justify-between gap-4">
          <h3 className="font-display text-h4 font-light text-text">Pick your hook</h3>
          <p className="text-small text-text-muted">Laptops, blazers and more in the catalog.</p>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((e) => (
            <li key={e.title} className={`${card} flex flex-col p-6`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`${eyebrow} text-text-faint`}>{e.kind}</span>
                <ExampleTag />
              </div>
              <div className="mt-6 flex h-[220px] items-center justify-center">{e.art}</div>
              <h4 className="mt-6 text-body font-medium text-text">{e.title}</h4>
              <p className="mt-2 text-small text-text-muted">{e.body}</p>
            </li>
          ))}
        </ul>
        <Legend className="mt-6" />
      </div>
    </section>
  );
}

/* ── 3. From a spot to a content deal ────────────────────────────────── */

const PATH = [
  {
    step: "Hook",
    title: "Pick what you will sell",
    body: "A product from the catalog, a photo with squares, or a service: a short video, an interview, a recap or content production. Set your spots and your prices.",
  },
  {
    step: "Post",
    title: "Post one link",
    body: "Your space has one link. Post it where your audience already is. The hook does the work of getting it seen.",
  },
  {
    step: "Spot",
    title: "A brand buys a spot",
    body: "They pick a spot and pay in USDC on Solana, Base or Polygon, straight to your wallet. Their logo goes on your hook.",
  },
  {
    step: "Content",
    title: "The brand books content",
    body: "A spot is the first time a brand works with you. The next ask is content made for them, and your space already sells it.",
  },
];

export function SpotToContentDeal() {
  return (
    <section
      id="how"
      className="relative scroll-mt-20 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #2A1F18 0%, #1F1A14 40%, #1F2535 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 50% 30%, rgba(255,183,3,0.08), transparent 70%)" }}
        aria-hidden
      />
      <SectionHairline tone="amber" />
      <div className="container-page section relative">
        <div className="max-w-2xl">
          <p className={`${eyebrow} text-amber`}>How it works</p>
          <h2 className="mt-6 font-display text-h3 font-light text-text md:text-h2">From a spot to a content deal.</h2>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PATH.map((p, i) => (
            <li key={p.step} className={`${card} relative p-7`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-small text-amber">0{i + 1}</span>
                <span className={pill.neutral}>{p.step}</span>
              </div>
              <h3 className="mt-6 font-display text-h4 font-light text-text">{p.title}</h3>
              <p className="mt-3 text-small text-text-muted">{p.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${card} p-7 md:p-8`}>
            <p className={`${eyebrow} text-text-faint`}>Content production</p>
            <h3 className="mt-4 font-display text-h4 font-light text-text">A brief in, a delivery out</h3>
            <ul className="mt-5 flex flex-col gap-3 text-small text-text-muted">
              <Line>The brand writes its brief at checkout.</Line>
              <Line>You shoot and deliver on a private link with a checklist, in 24 to 72 hours.</Line>
              <Line>The brand accepts it or asks for one revision.</Line>
            </ul>
          </div>
          <div className={`${card} p-7 md:p-8`}>
            <p className={`${eyebrow} text-text-faint`}>Insights</p>
            <h3 className="mt-4 font-display text-h4 font-light text-text">Know what to charge, and who to ask</h3>
            <ul className="mt-5 flex flex-col gap-3 text-small text-text-muted">
              <Line>What sells at your event, and at which prices.</Line>
              <Line>When spots sell, and which brands are buying.</Line>
              <Line>A &ldquo;Pitch a brand&rdquo; message written from your own numbers.</Line>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[3px] bg-amber" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/* ── 4. For brands ───────────────────────────────────────────────────── */

const BRIEF_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("A brief for HOLD Spaces")}&body=${encodeURIComponent(
  "What we want made or carried:\nThe event or place:\nWhen:\nBudget in USDC:\nWhat happens if the venue says no:\n",
)}`;

export function ForBrands() {
  return (
    <section
      id="brands"
      className="relative scroll-mt-20 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #2C4566 0%, #4F7090 50%, #2C4566 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 70% at 30% 30%, rgba(114,149,181,0.30), transparent 70%), radial-gradient(70% 70% at 80% 80%, rgba(44,69,102,0.35), transparent 70%)",
        }}
        aria-hidden
      />
      <SectionHairline tone="moonlight" />
      <div className="container-page section relative">
        <div className="max-w-3xl">
          <p className={`${eyebrow} text-amber`}>For brands</p>
          <h2 className="mt-6 font-display text-h3 font-light text-text md:text-h2">
            You are buying the creator.
            <span className="block text-text-muted">The object is why people look.</span>
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="glass rounded-card p-7 md:p-8">
            <h3 className="font-display text-h4 font-light text-text">What you get</h3>
            <ul className="mt-5 flex flex-col gap-3 text-small text-text">
              <Line>Their reach: the audience that follows them and everyone who stops to look at the hook.</Line>
              <Line>Their content: your brand in the posts, videos and recaps they make.</Line>
              <Line>A first deal with a creator you can book again for content made for you.</Line>
            </ul>
          </div>
          <div className="glass rounded-card p-7 md:p-8">
            <h3 className="font-display text-h4 font-light text-text">How paying works</h3>
            <ul className="mt-5 flex flex-col gap-3 text-small text-text">
              <Line>Pick a spot on the creator&rsquo;s page and pay in USDC on Solana, Base or Polygon.</Line>
              <Line>The money goes straight to the creator&rsquo;s wallet. HOLD never holds it.</Line>
              <Line>HOLD takes 5%, shown at checkout before you pay.</Line>
              <Line>Every space says up front what happens if the event or the venue says no.</Line>
            </ul>
          </div>
          <div className="glass flex flex-col rounded-card p-7 md:p-8">
            <h3 className="font-display text-h4 font-light text-text">Post a brief</h3>
            <p className="mt-5 text-small text-text">
              Know what you want before anyone has listed it? Tell us what you want made or carried, where, and your
              budget. Creators apply and you pick who goes.
            </p>
            <div className="mt-auto pt-8">
              <a href={BRIEF_MAILTO} className={btnSecondary}>
                Post a brief
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 6. FAQ ──────────────────────────────────────────────────────────── */

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "What does HOLD charge?",
    a: "5% of each sale, shown to the brand at checkout before it pays.",
  },
  {
    q: "Which chains can a brand pay on?",
    a: "USDC on Solana, Base or Polygon, whichever of them you accept. The payment goes straight to your wallet on that chain.",
  },
  {
    q: "What does the brand get?",
    a: "The spot it bought on your hook, and with it your reach: your audience and the people who see your posts. With a service or content production, it also gets the content you make for it.",
  },
  {
    q: "What if the event or the venue says no?",
    a: "Every space states its fallback before anyone pays: you deliver the content anyway, you refund the price from your own wallet, or the spot moves to another event within 90 days. HOLD never holds the money, so a refund comes from the creator.",
  },
  {
    q: "How does content production work?",
    a: "The brand writes a brief at checkout. You deliver on a private link with a checklist in 24 to 72 hours, and the brand accepts it or asks for one revision.",
  },
  {
    q: "Why do I need a verified X account?",
    a: "To open a space you need a verified X account that is at least 90 days old. Brands are paying for a real person with a real audience, and this is how we check.",
  },
];

export function SpacesFaq() {
  return (
    <section id="faq" className="relative scroll-mt-20 overflow-hidden bg-night">
      <SectionHairline tone="blue" />
      <div className="container-page section relative">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className={`${eyebrow} text-amber`}>Questions</p>
            <h2 className="mt-6 font-display text-h3 font-light text-text md:text-h2">Before you post the link.</h2>
          </div>
          <div className="lg:col-span-8">
            <ul className="flex flex-col border-t border-[color:var(--color-hairline)]">
              {FAQ.map((f) => (
                <li key={f.q} className="border-b border-[color:var(--color-hairline)]">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-body text-text [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <svg
                        width="12"
                        height="8"
                        viewBox="0 0 10 6"
                        fill="none"
                        aria-hidden
                        className="shrink-0 text-text-muted transition-transform duration-180 group-open:rotate-180"
                      >
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <p className="max-w-2xl pb-6 text-small text-text-muted">{f.a}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 7. Closing CTA ──────────────────────────────────────────────────── */

export function SpacesClose({ createHref }: { createHref: string }) {
  return (
    <section className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #2A1F18 0%, #1F1810 100%)" }}>
      <SectionHairline tone="amber" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 80% at 50% 70%, rgba(255,183,3,0.18), transparent 70%)" }}
        aria-hidden
      />
      <div className="container-page relative py-20 text-center md:py-28">
        <p className={`${eyebrow} text-amber`}>Be early</p>
        <h2 className="mx-auto mt-5 max-w-3xl font-display text-h3 font-light leading-tight text-text md:text-h1">
          Your next post could be the hook.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lead text-text-muted">Pick it, price it, post one link.</p>
        <div className="mt-10 flex justify-center">
          <a href={createHref} className={btnPrimary}>
            Create your space
          </a>
        </div>
      </div>
    </section>
  );
}
