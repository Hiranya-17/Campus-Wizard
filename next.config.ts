import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes read the scraped JSON from /data at runtime
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera for receipt photos and microphone for voice input, on this site only
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
