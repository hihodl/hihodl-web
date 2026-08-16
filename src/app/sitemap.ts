import type { MetadataRoute } from "next";

/**
 * The sitemap.
 *
 * Every product page was reachable only from the footer, which means a crawler
 * finds them by following links from the home page and nothing tells it which
 * ones matter. Product pages are the reason someone searching "hold smart
 * account" lands on us rather than on a thread about us.
 *
 * RULES FOR THIS LIST
 *
 * 1. Only pages that are LIVE. A URL in a sitemap is a claim that the page
 *    exists and is worth indexing; a 404 in here is a crawl-budget leak and a
 *    quality signal against the whole domain.
 * 2. Nothing transactional. Checkouts and order confirmations carry a reference
 *    in the URL and have nothing to offer a search engine — /founders/checkout
 *    already sets robots noindex for the same reason.
 * 3. Legal pages stay, at low priority. People do search for them, and a
 *    company whose terms are hard to find looks like it wants them to be.
 *
 * /founders is deliberately absent: it is a live Stripe checkout that needs its
 * table and its keys before it is published at all.
 */

// The apex, not www. Measured 07-aug-2026: www 307s to the apex, so anything
// written against www names a URL that redirects — a wasted hop for a crawler
// and a split signal on the page people search for by name.
const SITE = "https://hihodl.xyz";

type Entry = { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] };

const PAGES: Entry[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  // The product pages. Rates move, so they are the ones worth recrawling.
  { path: "/savings", priority: 0.9, changeFrequency: "weekly" },
  { path: "/smart-account", priority: 0.8, changeFrequency: "weekly" },
  { path: "/invest", priority: 0.9, changeFrequency: "weekly" },
  { path: "/hipoints", priority: 0.8, changeFrequency: "weekly" },
  // One entry per product, never a combined one. "esim japan" and "hotel
  // cashback" are different searches by different people a month apart, and a
  // page that answers both ranks for neither.
  { path: "/esim", priority: 0.8, changeFrequency: "monthly" },
  { path: "/travel", priority: 0.7, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  // The technical section. Lower priority than a product page because nobody
  // searches for these by name — but they are what a suspicious reader finds
  // when they search "is HOLD safe" or "hold non custodial", and losing that
  // search to somebody else's forum thread is worse than not ranking at all.
  { path: "/how-it-works", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-it-works/self-custody", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-it-works/security", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-it-works/networks", priority: 0.5, changeFrequency: "monthly" },
  { path: "/how-it-works/fees", priority: 0.5, changeFrequency: "monthly" },
  { path: "/how-it-works/modes", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  // Linked from the eSIM checkout in the app, so it is read far more often than
  // a legal page normally is — and it is the page that says who the seller is.
  { path: "/legal/esim", priority: 0.3, changeFrequency: "yearly" },
  // Referenced from both legal pages and quoted to counterparties in compliance
  // reviews, so it is checked far more often than a yearly page. It also changes
  // whenever an integration does, which is the whole reason it exists.
  { path: "/legal/providers", priority: 0.3, changeFrequency: "monthly" },
  { path: "/legal/referral-terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/e-sign", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // One timestamp for the whole file rather than a per-page date we do not
  // track. A lastModified that is really "whenever this deployed" is honest at
  // the file level and a lie at the page level.
  const lastModified = new Date();
  return PAGES.map((p) => ({
    url: `${SITE}${p.path === "/" ? "" : p.path}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
