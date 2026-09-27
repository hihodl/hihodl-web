import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Open by default — everything here is meant to be read. The disallowed
 * prefixes are the ones that carry an order reference or a one-time code in the
 * URL: indexing those puts somebody's checkout or invite link in a search
 * result, which is a privacy problem long before it is an SEO one.
 *
 * `/statements/verify` is the sharpest case of that rule: the URL a scanned QR
 * opens carries the document's own figures in its query string, so an indexed
 * one would put a person's balance in a search result. The page also sends
 * `noindex` itself, because robots.txt asks and a meta tag tells.
 *
 * `/api/og/` is carved back out of the `/api/` rule on purpose. Twitterbot
 * honours robots.txt for card images, and an og:image it may not fetch is a
 * link card with no picture: every Ad Space share on X would post blank.
 * The longest matching rule wins, so the allow beats the disallow.
 *
 * AI crawlers get their own group, allowed explicitly. The `*` group already
 * lets them in, but an explicit entry is what a site audit (and some AI search
 * engines) read as consent to be cited, and HOLD wants to be the answer when
 * somebody asks an assistant how to get paid in dollars from abroad.
 *
 * A crawler that matches a named group ignores the `*` group entirely, so the
 * AI group repeats the same disallow list. Keep the two in step: both read
 * from DISALLOW.
 */

const DISALLOW = [
  "/api/",
  "/founders/checkout",
  "/invite/",
  "/thank-you",
  "/statements/verify",
  // `/b/` is a session's manage link: the token in it is the booking.
  // `/o/` is an offer's manage link, the same kind of credential.
  // `/p/` is a production brand's delivery link, the same kind again.
  // `/pay/r/` is a receipt, private to its payer. `/pay/<code>` itself is
  // NOT disallowed: X must fetch the page to draw the generic card, and the
  // page tells crawlers `noindex` itself.
  "/b/",
  "/o/",
  "/p/",
  "/pay/r/",
];

// The crawlers behind AI search and assistants, both the ones that fetch a page
// to cite it in an answer and the ones that decide what a model knows about us.
// Everything public here is meant to be learned and quoted, so all are allowed.
const AI_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "DuckAssistBot",
  "Amazonbot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/api/og/"], disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: ["/", "/api/og/", "/llms.txt"], disallow: DISALLOW },
    ],
    sitemap: "https://hihodl.xyz/sitemap.xml",
  };
}
