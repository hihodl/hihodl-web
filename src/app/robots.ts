import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Open by default — everything here is meant to be read. The two disallowed
 * prefixes are the ones that carry an order reference or a one-time code in the
 * URL: indexing those puts somebody's checkout or invite link in a search
 * result, which is a privacy problem long before it is an SEO one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/founders/checkout", "/invite/", "/thank-you"],
    },
    sitemap: "https://hihodl.xyz/sitemap.xml",
  };
}
