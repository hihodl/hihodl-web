import type { MetadataRoute } from "next";

/**
 * The sitemap.
 *
 * Every product page was reachable only from the footer, which means a crawler
 * finds them by following links from the home page and nothing tells it which
 * ones matter. Product pages are the reason someone searching "hihodl smart
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

const SITE = "https://www.hihodl.xyz";

type Entry = { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] };

const PAGES: Entry[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  // The product pages. Rates move, so they are the ones worth recrawling.
  { path: "/smart-account", priority: 0.9, changeFrequency: "weekly" },
  { path: "/rewards", priority: 0.8, changeFrequency: "weekly" },
  { path: "/travel", priority: 0.7, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
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
