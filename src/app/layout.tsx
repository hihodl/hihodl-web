import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = "https://www.hihodl.xyz";
const OG_URL = `${SITE}/banner-social.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "HIHODL — Earn globally, live locally",
    template: "%s | HIHODL",
  },
  description:
    "The non-custodial wallet for remote workers. Get paid in stablecoins, spend in your city, keep custody — always.",
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "HIHODL",
    title: "HIHODL — Earn globally, live locally",
    description:
      "The non-custodial wallet for remote workers. Get paid in stablecoins, spend in your city, keep custody — always.",
    images: [
      {
        url: OG_URL,
        width: 1200,
        height: 630,
        alt: "HIHODL — Earn globally, live locally",
        type: "image/png",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "HIHODL — Earn globally, live locally",
    description:
      "The non-custodial wallet for remote workers. Get paid in stablecoins, spend in your city, keep custody — always.",
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
      name: "HIHODL",
      url: SITE,
      logo: `${SITE}/logo-amber.png`,
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
      name: "HIHODL",
      publisher: { "@id": `${SITE}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#app`,
      name: "HIHODL — Stablecoin Wallet",
      operatingSystem: "iOS",
      applicationCategory: "FinanceApplication",
      url: SITE,
      description:
        "Non-custodial stablecoin wallet for freelancers and remote workers. Gasless swaps on Solana, virtual USD account, username payments. AI layer coming soon.",
      downloadUrl:
        "https://apps.apple.com/nl/app/hihodl-stablecoin-wallet/id6755203065",
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
        "Self-custodial (MPC, no seed phrase to write down)",
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
          name: "What is HIHODL?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "HIHODL is a non-custodial multichain stablecoin wallet for freelancers and remote workers. You earn in stablecoins, hold the keys, and spend or move your money anywhere — Solana, Polygon, Base or Ethereum.",
          },
        },
        {
          "@type": "Question",
          name: "Is HIHODL custodial?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. HIHODL is fully self-custodial. Your private key is split via MPC: half on your device, half held by HIHODL. The key is reassembled only inside your device, only to sign your transactions. We cannot move your funds.",
          },
        },
        {
          "@type": "Question",
          name: "How much does HIHODL cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Free plan: $0/month with up to $500/month of gas-free swaps; 0.50% all-in network fee above the cap. Pro plan: $9.99/month with $2,000/month of gas-free swaps and 0.15% above the cap. Solana swaps are gasless on both plans. $2 minimum swap.",
          },
        },
        {
          "@type": "Question",
          name: "What chains does HIHODL support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "HIHODL supports Solana, Polygon, Base and Ethereum. Solana swaps are always gasless. EVM chains use smart gas detection on Pro.",
          },
        },
        {
          "@type": "Question",
          name: "How do gasless swaps work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "On Solana, HIHODL pays the network fee on your behalf via a relayer. On EVM chains (Polygon, Base, Ethereum), HIHODL covers gas when your Main native balance minus pockets and staked balance is below the threshold. You never need to hold SOL, MATIC or ETH for gas.",
          },
        },
        {
          "@type": "Question",
          name: "Does HIHODL require KYC?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No KYC for basic wallet use. KYC is only required for the optional virtual USD account (IBAN/SWIFT) when receiving fiat from employers or clients.",
          },
        },
        {
          "@type": "Question",
          name: "Can I receive my salary in HIHODL?",
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
            text: "HUSD is HIHODL's native stablecoin, designed for people who earn in one country and live in another. Launching in 2027. Newsletter subscribers and Pro users get priority access.",
          },
        },
        {
          "@type": "Question",
          name: "Does HIHODL have an AI assistant?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "An AI conversational layer is coming soon. Users will be able to ask in plain language — \"send 200 USDC to Lucía,\" \"split my paycheck 60/30/10,\" \"move savings to the highest yield\" — and HIHODL will execute. The AI proposes, the user signs every transaction. Self-custody is preserved.",
          },
        },
        {
          "@type": "Question",
          name: "How is HIHODL different from Revolut, Wise or Coinbase?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Revolut and Wise are custodial fintechs — they hold your money and can freeze your account. Coinbase is a custodial exchange. HIHODL is non-custodial: you hold the keys, no country lockouts, no frozen accounts, and your money moves on stablecoin rails 24/7.",
          },
        },
        {
          "@type": "Question",
          name: "Is HIHODL available worldwide?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. HIHODL is non-custodial and works in 80+ countries. Early traction is strongest in LATAM, SEA, Africa and Eastern Europe — anywhere the remote-income-to-local-spend gap is painful.",
          },
        },
        {
          "@type": "Question",
          name: "Is HIHODL on Android?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "iOS is live on the App Store. Android is in active development and will launch on Google Play soon.",
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
