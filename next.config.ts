import type { NextConfig } from "next";

/**
 * Restricts `next/image` remote hosts to the exact Supabase project used by
 * this deployment. No wildcards: an image proxy that accepts any host can be
 * abused for bandwidth and privacy leaks.
 */
function supabaseImagePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) return [];

  try {
    const url = new URL(rawUrl);
    return [
      {
        protocol: url.protocol === "http:" ? "http" : "https",
        hostname: url.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: supabaseImagePatterns(),
  },
};

export default nextConfig;
