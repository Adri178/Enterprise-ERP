import type { NextConfig } from "next";
import { normalizeBasePath } from "@erp/shared";
const nextConfig: NextConfig = {
  basePath: normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
  devIndicators: false,
  transpilePackages: ["@erp/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://127.0.0.1:4010"}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
