import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config so Next 16 doesn't conflict with optional webpack plugins later
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
