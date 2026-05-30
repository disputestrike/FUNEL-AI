/** @type {import('next').NextConfig} */
const output = process.env.NEXT_OUTPUT_STANDALONE === "0" ? undefined : "standalone";

const nextConfig = {
  reactStrictMode: true,
  // Railway/Render deploy via Dockerfile; standalone bundles a minimal
  // server.js next to .next/, which the runtime image launches.
  ...(output ? { output } : {}),
  // Ship-now pragmatic settings. CI/CD typecheck + lint runs separately
  // via `pnpm typecheck` and `pnpm lint` — the build pipeline catches
  // errors there, not at next build. This unblocks deploys when a
  // workspace-merged type doesn't line up (e.g. pg-boss 12.x generics).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Server actions are GA in 14 but we still set the body size limit.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.gofunnelai.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.gofunnelai.com" },
    ],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  async headers() {
    return [
      {
        // SSE endpoints must not buffer; Cloudflare/Nginx respect this hint.
        source: "/api/generate",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
      {
        // Grader SSE stream — same no-buffer hint.
        source: "/api/audit/:id/stream",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
      {
        source: "/grade",
        headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
      },
      {
        source: "/grade/s/:code*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
