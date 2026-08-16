import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

const SITE = "https://hihodl.xyz";
const OG_URL = `${SITE}/banner-social.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "HOLD — Earn globally, live locally",
    template: "%s | HOLD",
  },
  description:
    "One account for people who earn in one country and live in another. Get paid in minutes, earn on the balance, invest and spend — you hold the keys.",
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "HOLD",
    title: "HOLD — Earn globally, live locally",
    description:
      "One account for people who earn in one country and live in another. Get paid in minutes, earn on the balance, invest and spend — you hold the keys.",
    images: [
      {
        url: OG_URL,
        width: 1200,
        height: 630,
        alt: "HOLD — Earn globally, live locally",
        type: "image/png",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "HOLD — Earn globally, live locally",
    description:
      "One account for people who earn in one country and live in another. Get paid in minutes, earn on the balance, invest and spend — you hold the keys.",
    images: [OG_URL],
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport = { width: "device-width", initialScale: 1 };

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "HOLD",
      // The app was called HIHODL until Aug 2026 and will outrank "HOLD" for
      // months. alternateName is what tells Google the two names are one
      // organisation instead of two; without it the rename reads as a new,
      // unknown company. legalName stays the registered entity: the trading
      // name changed, the contracting party did not.
      alternateName: "HIHODL",
      legalName: "HIHODL TECHNOLOGIES OÜ",
      url: SITE,
      logo: `${SITE}/icon-512.png`,
      description:
        "Non-custodial multichain stablecoin wallet for global earners and remote workers.",
      sameAs: [
        "https://x.com/hiihodl",
        "https://www.linkedin.com/company/hihodl",
        "https://instagram.com/hihodl",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "HOLD",
      publisher: { "@id": `${SITE}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#app`,
      name: "HOLD — Stablecoin Wallet",
      operatingSystem: "iOS, Android",
      applicationCategory: "FinanceApplication",
      url: SITE,
      description:
        "Payments, Savings, Invest and Benefits in one non-custodial account for freelancers and remote workers. Virtual USD account with IBAN and SWIFT, username payments, on-chain savings, gasless swaps on Solana.",
      downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          description:
            "$500/month of gas-free swaps. 0.50% all-in network fee above the cap. 3 pockets. Self-custody.",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "9.99",
          priceCurrency: "USD",
          description:
            "$2,000/month of gas-free swaps. 0.15% all-in above the cap. Unlimited pockets. Smart EVM gas coverage. Priority HUSD access.",
        },
      ],
      featureList: [
        "Non-custodial — keys generated on your device, with encrypted cloud recovery",
        "Gasless swaps on Solana — always",
        "Smart gas detection on Polygon, Base, Ethereum",
        "Virtual USD account with IBAN/SWIFT",
        "Username payments (@username)",
        "Pockets — split balance into Travel, Rent, Savings",
        "Stealth incoming addresses",
        "AI conversational layer (coming soon)",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is HOLD?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "HOLD is a non-custodial multichain stablecoin wallet for freelancers and remote workers. You earn in stablecoins, hold the keys, and spend or move your money anywhere — Solana, Polygon, Base or Ethereum.",
          },
        },
        {
          "@type": "Question",
          name: "Is HOLD custodial?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. HOLD is non-custodial. Your wallet is generated on your own device from a recovery phrase that stays on your device, and a transaction can only be signed there, by you. We cannot move, spend or freeze your funds. So that you are not locked out if you lose your phone, we also keep an encrypted backup of your recovery phrase that you can restore by signing in — Section 5.1 of our Terms explains exactly how that works and how to have it deleted.",
          },
        },
        {
          "@type": "Question",
          name: "How much does HOLD cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Free plan: $0/month with up to $500/month of gas-free swaps; 0.50% all-in network fee above the cap. Pro plan: $9.99/month with $2,000/month of gas-free swaps and 0.15% above the cap. Solana swaps are gasless on both plans. $2 minimum swap.",
          },
        },
        {
          "@type": "Question",
          name: "What chains does HOLD support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "HOLD supports Solana, Polygon, Base and Ethereum. Solana swaps are always gasless. EVM chains use smart gas detection on Pro.",
          },
        },
        {
          "@type": "Question",
          name: "How do gasless swaps work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "On Solana, HOLD pays the network fee on your behalf via a relayer. On EVM chains (Polygon, Base, Ethereum), HOLD covers gas when your Main native balance minus pockets and staked balance is below the threshold. You never need to hold SOL, MATIC or ETH for gas.",
          },
        },
        {
          "@type": "Question",
          name: "Does HOLD require KYC?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No KYC for basic wallet use. KYC is only required for the optional virtual USD account (IBAN/SWIFT) when receiving fiat from employers or clients.",
          },
        },
        {
          "@type": "Question",
          name: "Can I receive my salary in HOLD?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Income Rails gives you a virtual USD account with IBAN and SWIFT details. Your employer or client wires USD; it lands in your wallet as stablecoins, ready to spend, swap or save.",
          },
        },
        {
          "@type": "Question",
          name: "What is HUSD?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "HUSD is HOLD's native stablecoin, designed for people who earn in one country and live in another. Launching in 2027. Newsletter subscribers and Pro users get priority access.",
          },
        },
        {
          "@type": "Question",
          name: "Does HOLD have an AI assistant?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "An AI conversational layer is coming soon. Users will be able to ask in plain language — \"send 200 USDC to Lucía,\" \"split my paycheck 60/30/10,\" \"move savings to the highest yield\" — and HOLD will execute. The AI proposes, the user signs every transaction. Self-custody is preserved.",
          },
        },
        {
          "@type": "Question",
          name: "How is HOLD different from Revolut, Wise or Coinbase?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Revolut and Wise are custodial fintechs — they hold your money and can freeze your account. Coinbase is a custodial exchange. HOLD is non-custodial: you hold the keys, no country lockouts, no frozen accounts, and your money moves on stablecoin rails 24/7.",
          },
        },
        {
          "@type": "Question",
          name: "Is HOLD available worldwide?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. HOLD is non-custodial and works in 80+ countries. Early traction is strongest in LATAM, SEA, Africa and Eastern Europe — anywhere the remote-income-to-local-spend gap is painful.",
          },
        },
        {
          "@type": "Question",
          name: "Is HOLD on Android?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. HOLD is live on both the App Store and Google Play. Set up takes about 30 seconds on either platform.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-abyss text-text antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=Source+Serif+4:ital,opsz,wght@1,8..60,300&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-abyss text-text min-h-dvh">{children}</body>
    </html>
  );
}
