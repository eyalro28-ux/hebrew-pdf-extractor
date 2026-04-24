import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdfjs-dist is loaded from CDN at runtime — not bundled, no canvas alias needed
};

export default nextConfig;
