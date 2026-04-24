import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    // pdfjs-dist optionally requires 'canvas' (a Node.js native addon).
    // We stub it out with an empty module so Turbopack can resolve the require.
    resolveAlias: {
      canvas: path.resolve('./lib/empty.ts'),
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
