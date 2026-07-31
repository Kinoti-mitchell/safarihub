import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for Render/Docker only — Vercel uses its own Next runtime.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
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
