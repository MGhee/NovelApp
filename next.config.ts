import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [
      'puppeteer',
      'puppeteer-real-browser',
      'puppeteer-core',
      'xvfb',
      'sleep',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async headers() {
    // If ALLOWED_ORIGIN is set, use it; otherwise fall back to '*'.
    // For production, set ALLOWED_ORIGIN to a single origin (e.g. https://novelapp.viktorbarzin.me)
    // You can include the browser extension origin to allow extension requests:
    // e.g. ALLOWED_ORIGIN=https://novelapp.viktorbarzin.me,chrome-extension://iimkcdnbmfdfcpmhdiioboijpofgjifo
    const origin = process.env.ALLOWED_ORIGIN || '*'
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: origin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
};

export default nextConfig;
