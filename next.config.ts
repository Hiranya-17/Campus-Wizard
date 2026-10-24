import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes read the scraped JSON from /data at runtime
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
};

export default nextConfig;
