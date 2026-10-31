import type { NextConfig } from "next";

// Cache Components is off on purpose: every page is per user and rendered on request.
const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
