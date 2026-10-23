import Image from "next/image";
import type { ReactNode } from "react";
import { AmberCta, APP, GLASS, H2, PHOTO_GLASS, Section } from "./ui";
import { Icon, type IconName } from "./Icon";

/**
 * The page under the hero, in Persona's order: how it works in three steps,
 * who it is for, privacy, what changes, questions, what is inside, and one
 * dark banner to close.
 *
 * Copy rule: every claim is a line the app itself says (release/ios-build-13,
 * src/i18n/resources/en) or a constant on backend main. The figures inside
 * the photo cards are examples of the app's own screens, never rates, prices
 * or customer numbers.
 */

/* ── How it works ─────────────────────────────────────────── */

export function HowItWorks() {
  return (
    <Section id="how">
      <H2>
        See how <b>HOLD</b> works
      </H2>
      <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-3 md:gap-6">
        <Step
          n={1}
          photo="/home/designer.jpg"
          pos="52% 35%"
          alt="A man leaning back from his desk in a sunny apartment"
          title="Get paid in."
          body="Open your account and share your own USD or EUR details. Incoming transfers land in your balance."
        >
          <div className={`rounded-[18px] p-3.5 ${PHOTO_GLASS}`}>
            <Row left="Client payment" sub="USD account · Friday" right="+$1,800.00" />
          </div>
        </Step>
        <Step
          n={2}
          photo="/home/tokyo.jpg"
          pos="55% 35%"
          alt="A woman arriving in a quiet Tokyo street at dusk"
          title="Say what you need."
          body="Hi, your money assistant, handles payments, hotels, events and friends in one chat."
        >
          <div className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-[16px] rounded-br-[5px] bg-white/90 px-3.5 py-2 text-[14px] font-semibold text-[#0F0F1A]">
              A quiet room in Tokyo, 3 nights
            </div>
            <div className={`w-fit max-w-[85%] rounded-[16px] rounded-bl-[5px] px-3.5 py-2 text-[14px] text-white ${PHOTO_GLASS}`}>
              Found one near the station. Pay from your balance?
            </div>
          </div>
        </Step>
        <Step
          n={3}
          photo="/home/key.jpg"
          pos="55% 50%"
          alt="One hand passing an old brass key to another in front of a blue door"
          title="It's done."
          body="The room is paid from your balance, and a slice comes back to you in USDC."
        >
          <div className={`rounded-[18px] p-3.5 ${PHOTO_GLASS}`}>
            <Row left="Room booked" sub="Paid from balance" right="Done" accent />
          </div>
        </Step>
      </div>
    </Section>
  );
}

function Step({
  n,
  photo,
  pos,
  alt,
  title,
  body,
  children,
}: {
  n: number;
  photo: string;
  pos: string;
  alt: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="relative aspect-[4/4.4] overflow-hidden rounded-[28px]">
        <Image src={photo} alt={alt} fill quality={90} sizes="(min-width: 768px) 360px, 100vw" className="object-cover" style={{ objectPosition: pos }} />
        <div className="absolute inset-x-3 bottom-3">{children}</div>
      </div>
      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.16em] text-[#9FB7C2]">Step {n}</p>
      <h3 className="mt-2 text-[24px] font-extrabold tracking-[-0.01em] text-white">{title}</h3>
      <p className="mt-2 text-[17px] leading-[1.5] text-[#C8D0D9]">{body}</p>
    </div>
  );
}

function Row({ left, sub, right, accent }: { left: string; sub: string; right: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[15px] font-bold text-white">{left}</p>
        <p className="text-[13px] text-white/75">{sub}</p>
      </div>
      <p className="text-[15px] font-extrabold" style={{ color: accent ? APP.cyanGlow : "#FFFFFF" }}>
        {right}
      </p>
    </div>
  );
}

/* ── Who it is for ────────────────────────────────────────── */

const PEOPLE = [
  { photo: "/home/designer.jpg", pos: "52% 40%", tag: "For freelancers", line: "A client abroad pays your USD details. It lands as dollars.", alt: "A designer leaning back from his desk" },
  { photo: "/home/lisbon.jpg", pos: "28% 50%", tag: "For remote workers", line: "Paid in dollars, living in euros. One account for both.", alt: "A woman with coffee on a Lisbon balcony" },
  { photo: "/home/crew.jpg", pos: "50% 50%", tag: "For friend groups", line: "One chat for the trip. Everyone settles up before they leave.", alt: "Three friends on white steps against a blue wall" },
  { photo: "/home/train.jpg", pos: "62% 40%", tag: "For travellers", line: "Data on before you land. Nothing to type, nothing to scan.", alt: "A man by a train window on the Italian coast" },
  { photo: "/home/towel.jpg", pos: "40% 45%", tag: "For savers", line: "Savings that earns while you sleep.", alt: "A woman in the sun on a striped towel" },
  { photo: "/home/linen.jpg", pos: "45% 35%", tag: "For nights out", line: "Split it in the chat, settle in a tap.", alt: "A man in a linen shirt by a blue door" },
];

export function People() {
  return (
    <section id="people" className="scroll-mt-16 py-20 md:py-28">
      <div className="px-4">
        <H2>
          Made for the way
          <br />
          you <em>live</em>
        </H2>
      </div>
      <ul
        aria-label="Who HOLD is for"
        className="mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:gap-5 md:px-[max(32px,calc((100vw-1120px)/2))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PEOPLE.map((p) => (
          <li key={p.tag} className="relative aspect-[3/4] w-[80vw] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-[28px] md:snap-start">
            <Image src={p.photo} alt={p.alt} fill quality={90} sizes="(min-width: 768px) 340px, 80vw" className="object-cover" style={{ objectPosition: p.pos }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-5 bottom-5">
              <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold text-white ${PHOTO_GLASS}`}>{p.tag}</span>
              <p className="mt-3 text-[18px] font-bold leading-[1.3] text-white">{p.line}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex justify-center px-4">
        <AmberCta />
      </div>
    </section>
  );
}

/* ── Privacy ──────────────────────────────────────────────── */

const PRIVATE: { icon: IconName; title: string; sub: string; more: string }[] = [
  {
    icon: "key",
    title: "Your keys, your money.",
    sub: "Only you can take it out.",
    more: "Your account lives on your phone. We will never ask for your keys, and nobody else can move what is yours.",
  },
  {
    icon: "eye",
    title: "Private payments.",
    sub: "Nobody can see it came from you.",
    more: "Shield keeps a payment private. It works on USDC on Base today; Solana and Polygon are not private yet.",
  },
  {
    icon: "face",
    title: "Face ID, every time it matters.",
    sub: "Your PIN always works as a fallback.",
    more: "Unlocking HOLD and approving sensitive actions both ask for your face or your PIN.",
  },
  {
    icon: "lifebuoy",
    title: "Never locked out.",
    sub: "Recovery set up in under a minute.",
    more: "Add a couple of ways to get back in, so a lost or stolen phone never locks you out of your money.",
  },
  {
    icon: "phoneOff",
    title: "We never call you.",
    sub: "Not about your money, not for a code.",
    more: "If someone calls saying they are HOLD, it is not us. Never share a code, your passcode or your recovery phrase.",
  },
];

export function Private() {
  return (
    <Section id="private">
      <div className="md:grid md:grid-cols-[1fr_1.1fr] md:items-start md:gap-16">
        <h2 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:sticky md:top-28 md:text-[52px]">
          The most personal money is the most <em className="font-black italic">private</em>.
        </h2>
        <ul className="mt-10 divide-y divide-white/10 md:mt-0">
          {PRIVATE.map((p) => (
            <li key={p.title}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <Icon name={p.icon} size={22} className="mt-0.5 shrink-0 text-white" />
                  <span className="flex-1">
                    <span className="block text-[18px] font-extrabold text-white">{p.title}</span>
                    <span className="block text-[15px] text-[#C8D0D9]">{p.sub}</span>
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 transition-transform duration-180 group-open:rotate-45">
                    <Icon name="plus" size={15} className="text-white" />
                  </span>
                </summary>
                <p className="-mt-1 pb-5 pl-[38px] pr-10 text-[15px] leading-[1.5] text-[#9FB7C2]">{p.more}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ── What changes ─────────────────────────────────────────── */

const CHANGES = [
  { photo: "/home/coffee.jpg", pos: "50% 50%", title: "Your pay, as dollars", sub: "Incoming transfers land as dollars in your wallet.", alt: "Hands around a coffee cup on a sunny table" },
  { photo: "/home/key.jpg", pos: "60% 50%", title: "Stays that pay you back", sub: "Nearly two million hotels, and a slice comes back in USDC.", alt: "A brass key passed between two hands" },
  { photo: "/home/hands.jpg", pos: "50% 45%", title: "One chat for your money", sub: "Payments, hotels, events and friends, with Hi.", alt: "One hand gently holding another's wrist" },
];

export function Changes() {
  return (
    <Section id="changes">
      <H2>
        Feel the <b>difference</b>
      </H2>
      <div className={`mt-12 grid gap-8 p-4 md:grid-cols-3 md:gap-5 md:p-5 ${GLASS}`}>
        {CHANGES.map((c) => (
          <div key={c.title} className="text-center">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[20px]">
              <Image src={c.photo} alt={c.alt} fill quality={90} sizes="(min-width: 768px) 340px, 90vw" className="object-cover" style={{ objectPosition: c.pos }} />
            </div>
            <p className="mt-5 text-[22px] font-extrabold tracking-[-0.01em] text-white">{c.title}</p>
            <p className="mx-auto mt-1 max-w-[300px] pb-2 text-[15px] text-[#C8D0D9]">{c.sub}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Questions ────────────────────────────────────────────── */

const FAQ = [
  {
    q: "What is HOLD?",
    a: "A money app built on stablecoins. You get your own USD and EUR account details, send to a @username, split with friends, save and invest, and Hi, your money assistant, books stays and more from your balance.",
  },
  {
    q: "Who holds my money?",
    a: "You do. Only you can take your money out, and we will never ask for your keys. Not your keys, not your money.",
  },
  {
    q: "What if I lose my phone?",
    a: "Set up a couple of ways to get back in. It takes less than a minute, and a lost or stolen phone never locks you out.",
  },
  {
    q: "How do I get paid into HOLD?",
    a: "Open your account in the app to get your own USD or EUR details. Our banking partner verifies who you are once, and incoming transfers land as dollars in your wallet.",
  },
  {
    q: "What is Hi?",
    a: "Hi is your money assistant inside HOLD. Payments, hotels, events and friends in one chat. It pays from your balance when you confirm.",
  },
  {
    q: "Can I split with friends?",
    a: "Yes. Make a group, add each expense with +, and settle up in a tap. Anyone who scans the group's code joins in one tap.",
  },
  {
    q: "Does my Savings earn?",
    a: "Yes. Move dollars into Savings and it earns while you sleep. Rates change and are not guaranteed.",
  },
  {
    q: "Can I invest?",
    a: "Turn your dollars into Bitcoin, Solana and more, right from your balance. Everything you buy shows what you paid and what it is worth today.",
  },
  {
    q: "Is there a card?",
    a: "A Visa card to spend your dollars anywhere is on its way. Join the waitlist in the app to be first.",
  },
  {
    q: "Is HOLD on Android?",
    a: "Yes. HOLD is on the App Store and Google Play.",
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <H2>
        Questions? We&rsquo;ve
        <br />
        got <b>answers</b>.
      </H2>
      <div className="mx-auto mt-12 max-w-[760px] space-y-3">
        {FAQ.map((f, i) => (
          <details key={f.q} open={i === 0} className={`group px-5 ${GLASS}`}>
            <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-[17px] font-bold text-white [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{f.q}</span>
              <Icon name="chevron" size={18} className="text-white/70 transition-transform duration-180 group-open:rotate-180" />
            </summary>
            <p className="-mt-1 pb-5 text-[16px] leading-[1.55] text-[#C8D0D9]">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ── What is inside ───────────────────────────────────────── */

const INSIDE: { icon: IconName; big: string; sub: string; wide?: boolean }[] = [
  { icon: "bank", big: "USD + EUR", sub: "Your own account details" },
  { icon: "at", big: "@username", sub: "No address to copy" },
  { icon: "spark", big: "Hi", sub: "Your money assistant", wide: true },
  { icon: "leaf", big: "Savings", sub: "Earns while you sleep" },
  { icon: "chart", big: "Invest", sub: "Bitcoin, Solana and more" },
  { icon: "bed", big: "2M hotels", sub: "With USDC back" },
  { icon: "signal", big: "eSIM", sub: "Nothing to scan" },
  { icon: "network", big: "4 networks", sub: "Solana, Polygon, Base, Ethereum", wide: true },
  { icon: "users", big: "Groups", sub: "Settle up in a tap" },
  { icon: "face", big: "Face ID", sub: "Your PIN as a fallback" },
];

export function Inside() {
  return (
    <Section id="inside">
      <H2>
        What&rsquo;s inside <b>HOLD</b>
      </H2>
      <div className="mx-auto mt-12 grid max-w-[880px] grid-cols-2 gap-3 md:grid-cols-4">
        {INSIDE.map((t) => (
          <div
            key={t.big}
            className={`flex flex-col items-center justify-center px-3 py-7 text-center ${GLASS} ${t.wide ? "col-span-2" : ""}`}
          >
            <Icon name={t.icon} size={26} className="text-[#00C2FF]" />
            <p className="mt-3 text-[22px] font-extrabold tracking-[-0.01em] text-white">{t.big}</p>
            <p className="mt-1 text-[14px] text-[#C8D0D9]">{t.sub}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Ready ────────────────────────────────────────────────── */

export function Ready() {
  return (
    <section id="download" className="scroll-mt-16 px-4 pb-20 md:px-8 md:pb-28">
      <div className="relative mx-auto flex min-h-[640px] max-w-[1240px] flex-col justify-end overflow-hidden rounded-[32px] bg-black md:min-h-[560px] md:justify-center">
        <Image
          src="/home/beach.jpg"
          alt="Four friends walking barefoot along a beach at golden hour, two holding hands"
          fill
          quality={90}
          sizes="(min-width: 1240px) 1240px, 100vw"
          className="object-cover [object-position:62%_50%] md:[object-position:70%_50%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/35 md:to-transparent" />
        <div className="relative p-7 md:max-w-[520px] md:p-14">
          <p className="text-[15px] font-extrabold tracking-[0.02em] text-white">HOLD</p>
          <h2 className="mt-3 text-[44px] font-extrabold leading-[1.02] tracking-[-0.02em] text-white md:text-[60px]">
            Ready when
            <br />
            you are.
          </h2>
          <div className="mt-6 border-t border-white/20 pt-6">
            <AmberCta />
          </div>
        </div>
      </div>
    </section>
  );
}
