import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // canvas is an optional native dependency of pdfjs-dist that we don't need in the browser.
    // Turbopack cannot resolve `false` directly, so we alias it to an empty module.
    resolveAlias: {
      canvas: {
        browser: './lib/empty.ts',
      },
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
