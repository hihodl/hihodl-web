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
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/founders/checkout", "/invite/", "/thank-you", "/statements/verify"],
    },
    sitemap: "https://hihodl.xyz/sitemap.xml",
  };
}
