/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.tally.so" },
      { protocol: "https", hostname: "res.cloudinary.com" }
    ]
  }
};

module.exports = nextConfig;