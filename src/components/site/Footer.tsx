import Link from "next/link";
import { CtaLink } from "@/components/site/DownloadLink";
import { DOWNLOAD_ANCHOR } from "@/lib/appLinks";
import { Wordmark } from "@/components/site/Wordmark";

// The nav's four words first, then the second level under them.
//
// Every product link goes to a page that states what we keep on THAT product,
// in context. There is deliberately no "Fees" entry: an aggregate schedule
// serves competitors better than customers. See the rule at the top of
// rates.config.ts — which is also why Savings and Smart Account are two
// entries and not one. They are two prices.
const PRODUCT = [
  { href: "/#payments",     label: "Payments" },
  { href: "/savings",       label: "Savings" },
  { href: "/invest",        label: "Invest" },
  { href: "/#benefits",     label: "Benefits" },
  { href: "/#income",       label: "Income Rails" },
  { href: "/smart-account", label: "Smart Account" },
  { href: "/hipoints",      label: "HiPoints" },
  { href: "/travel",        label: "Stays" },
  { href: "/esim",          label: "eSIM" },
  { href: "/#ai",           label: "AI (soon)" },
  { href: "/#husd",         label: "HUSD" },
];

// "Founder Pass" belongs here and is deliberately absent until /founders is
// published. That page is a live Stripe checkout, not an explainer: it needs the
// founder_orders table and the payment keys in place first, and a footer link to
// a checkout that 500s is worse than no link at all.
const COMPANY = [
  { href: "/#how",      label: "How it works" },
  { href: "/#security", label: "Security" },
  { href: DOWNLOAD_ANCHOR, label: "Download" },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms",   label: "Terms" },
  { href: "/e-sign",  label: "E-Sign Consent" },
];

const SOCIAL = [
  { href: "https://x.com/hiihodl", label: "X" },
  { href: "https://www.linkedin.com/company/hihodl", label: "LinkedIn" },
  { href: "https://instagram.com/hihodl", label: "Instagram" },
];

export function Footer() {
  return (
    <footer className="hairline bg-abyss">
      <div className="container-page py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 md:gap-8">
          {/* Brand block */}
          <div className="col-span-2 md:col-span-2 flex flex-col gap-6">
            <Link href="/" className="inline-flex items-center text-text" aria-label="HOLD home">
              <Wordmark className="h-8 w-auto" />
            </Link>
            <p className="font-editorial text-h4 text-text-muted max-w-sm">
              Earn globally, live locally.
            </p>
            <p className="text-small text-text-faint max-w-sm">
              One account for people who earn in one country and live in another.
              Payments, Savings, Invest and Benefits — and you hold the keys.
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT} />
          <FooterColumn title="Company" links={COMPANY} />
          <FooterColumn title="Legal" links={LEGAL} extra={<SocialBlock />} />
        </div>

        <div className="mt-20 pt-8 hairline flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-tiny text-text-faint">
            © {new Date().getFullYear()} HOLD. Non-custodial. You hold the keys.
          </p>
          <p className="text-tiny text-text-faint font-mono">
            Built for the 100M+ remote workers worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  extra,
}: {
  title: string;
  links: { href: string; label: string }[];
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-tiny uppercase tracking-wider text-text-faint">{title}</h4>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <CtaLink
              href={l.href}
              className="text-small text-text-muted hover:text-text transition-colors duration-180"
            >
              {l.label}
            </CtaLink>
          </li>
        ))}
      </ul>
      {extra}
    </div>
  );
}

function SocialBlock() {
  return (
    <div className="mt-8 flex flex-col gap-4">
      <h4 className="text-tiny uppercase tracking-wider text-text-faint">Social</h4>
      <ul className="flex flex-col gap-2.5">
        {SOCIAL.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-small text-text-muted hover:text-amber transition-colors duration-180"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
