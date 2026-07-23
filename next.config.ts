import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from any origin (for base64 data URLs used by image upload)
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    remotePatterns: [],
  },
  // Silence the "punycode" deprecation warning from mongodb driver
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, punycode: false };
    return config;
  },
};

export default nextConfig;
