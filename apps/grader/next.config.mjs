/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Railway/Render deploy via Dockerfile; standalone output bundles a minimal
  // server.js + .next/static so the runtime image stays small.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk", "@react-pdf/renderer"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "r2.gofunnelai.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    ],
  },
  // The grader is the trojan horse â€” fast TTFB matters more than fancy DX.
  productionBrowserSourceMaps: false,
  headers: async () => [
    {
      source: "/grade",
      headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
    },
    {
      source: "/grade/s/:code*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
    },
  ],
  transpilePackages: ["@funnel/shared", "@funnel/events", "@funnel/db"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
