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
    ];
  },
};

module.exports = nextConfig;