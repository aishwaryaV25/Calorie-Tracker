import type { NextConfig } from "next";

function apiUpstream(): string | null {
  const raw = (process.env.API_UPSTREAM ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  if (!raw || /localhost|127\.0\.0\.1/.test(raw)) {
    return null;
  }

  const origin = raw.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  return /^https?:\/\//.test(origin) ? origin : null;
}

const nextConfig: NextConfig = {
  // Next 16 writes AGENTS.md on every `next dev` unless this is off.
  agentRules: false,
  async rewrites() {
    const upstream = apiUpstream();
    if (!upstream) {
      return [];
    }

    return [{ source: '/api/:path*', destination: `${upstream}/api/:path*` }];
  },
};

export default nextConfig;
