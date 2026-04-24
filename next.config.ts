import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Silence Turbopack warning — canvas alias not needed in Turbopack (browser only)
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
