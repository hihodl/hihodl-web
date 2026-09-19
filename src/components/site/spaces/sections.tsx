import type { ReactNode } from "react";

import { btnPrimary, btnSecondary, eyebrow } from "@/components/ad-space/ui";
import { QuestionItem, QuestionList } from "@/components/site/Questions";
import { SectionHairline } from "@/components/site/SectionHairline";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";

/**
 * Everything on the homepage after the story. Short on purpose: the story in
 * images does the selling, and these sections only answer "how do I start".
 *
 * How HOLD makes money is NOT a section. It is one question among the others
 * in the FAQ, closed by default, for whoever wants to open it. No figure goes
 * on this page unless we can cite it.
 */

/* ── How it works: three lines ───────────────────────────────────────── */

const STEPS = [
  { title: "Pick your hook", body: "An object, your own photo, or what you make." },
  { title: "Post one link", body: "Set your spots and prices. Share it where your audience is." },
  { title: "Get paid per spot", body: "Brands pay you directly, then book your content." },
];

export function HowItWorks({ createHref }: { createHref: string }) {
  return (
    <section id="how" className="relative scroll-mt-20 overflow-hidden bg-night">
      <SectionHairline tone="amber" />
      <div className="container-page relative py-20 md:py-28">
        <p className={`${eyebrow} text-amber`}>How it works</p>
        <ol className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="font-mono text-small text-amber">0{i + 1}</span>
              <h3 className="mt-4 font-display text-h3 font-light text-text">{s.title}</h3>
              <p className="mt-3 text-body text-text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14">
          <a href={createHref} className={btnPrimary}>
            Create your space
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── For brands ──────────────────────────────────────────────────────── */

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
      <SectionHairline tone="moonlight" />
      <div className="container-page relative py-20 md:py-28">
        <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} text-amber`}>For brands</p>
            <h2 className="mt-6 font-display text-h3 font-light text-text md:text-h2">
              You are buying the creator.
              <span className="block text-text-muted">The object is why people look.</span>
            </h2>
            <p className="mt-6 max-w-xl text-lead text-text">
              Their reach and the content they make, with your brand in it. A spot is where it starts.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <a href="#events" className={btnPrimary}>
              Find creators at an event
            </a>
            <a href={BRIEF_MAILTO} className={btnSecondary}>
              Post a brief
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ: small, closed, everything a careful reader asks ───────────── */

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "What can I turn into a hook?",
    a: "A product from the catalog (suitcase, laptop, dress, blazer and more), your own photo with squares where logos go, or a service: short videos, interviews, recaps or content production.",
  },
  {
    q: "How do brands find my space?",
    a: "You post your link. Your space also shows on the page of the event you are going to, where brands look for creators.",
  },
  {
    q: "What does a brand get?",
    a: "The spot on your hook, and with it your reach: your audience and everyone who sees your posts. With a service, it also gets the content you make for it.",
  },
  {
    q: "How do I get paid?",
    a: "Brands pay in USDC on Solana, Base or Polygon, whichever you accept, straight to your wallet. HOLD never holds the money.",
  },
  {
    q: "How does content production work?",
    a: "The brand writes a brief at checkout. You deliver on a private link with a checklist in 24 to 72 hours, and the brand accepts it or asks for one revision.",
  },
  {
    q: "How does HOLD make money?",
    a: "We take 5% of each sale. The brand sees it at checkout, before paying.",
  },
  {
    q: "What if the event or the venue says no?",
    a: "Every space says what happens before anyone pays: the content is delivered anyway, you refund the price from your own wallet, or the spot moves to another event within 90 days.",
  },
  {
    q: "What do Insights show me?",
    a: "What sells at your event and at which prices, when spots sell, which brands are buying, and a message to pitch a brand written from your own numbers.",
  },
  {
    q: "Can a brand ask first?",
    a: "Yes. A brand can post a brief with what it wants, where and its budget. Creators apply and the brand picks.",
  },
  {
    q: "Why do I need a verified X account?",
    a: "To open a space you need a verified X account that is at least 90 days old. Brands pay for a real person with a real audience, and this is how we check.",
  },
];

export function SpacesFaq() {
  return (
    <section id="faq" className="relative scroll-mt-20 overflow-hidden bg-night">
      <SectionHairline tone="blue" />
      <div className="container-page relative py-16 md:py-20">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <h2 className="font-display text-h4 font-light text-text lg:col-span-4">Questions</h2>
          <QuestionList className="lg:col-span-8">
            {FAQ.map((f) => (
              <QuestionItem key={f.q} q={f.q}>
                {f.a}
              </QuestionItem>
            ))}
          </QuestionList>
        </div>
      </div>
    </section>
  );
}

/* ── Closing CTA ─────────────────────────────────────────────────────── */

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
        <h2 className="mx-auto max-w-3xl font-display text-h3 font-light leading-tight text-text md:text-h1">
          Your hook is waiting.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lead text-text-muted">Be early. Be the one people stop for.</p>
        <div className="mt-10 flex justify-center">
          <a href={createHref} className={btnPrimary}>
            Create your space
          </a>
        </div>
      </div>
    </section>
  );
}
