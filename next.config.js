/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "storage.tally.so" },
      { protocol: "https", hostname: "res.cloudinary.com" }
    ]
  },
  // /rewards is the HiPoints page. Two names for one thing was costing us the
  // only word customers actually use in the app. Permanent because the old URL
  // is in the sitemap and in the footer of every page we have shipped.
  //
  // /smart-account is NOT redirected. It briefly pointed at /savings on
  // 16-aug-2026, which was wrong: Smart Account is the Main balance earning by
  // itself and Savings is money you moved on purpose. Different products,
  // different prices, one page each.
  async redirects() {
    return [
      { source: "/rewards", destination: "/hipoints", permanent: true },
    ];
  },

  // Standard hardening — Vercel adds Strict-Transport-Security automatically
  // so we set the rest. CSP is intentionally NOT set here yet because the
  // page uses inline JSON-LD blobs and Tailwind's just-in-time inline styles;
  // a tight CSP would require nonces or hashes per build. That's a v1.1
  // hardening pass once we have time to wire next-safe to inject nonces.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" }
        ]
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
