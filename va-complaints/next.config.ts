import type { NextConfig } from "next";

// Cache Components is off on purpose: every page is per user and rendered on request.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Attachments are uploaded through server actions; see lib/attachments/rules.ts for the limits.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
