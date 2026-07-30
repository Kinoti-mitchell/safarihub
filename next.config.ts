import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for a reliable Node server on Render (binds HOSTNAME/PORT correctly)
  output: "standalone",
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
