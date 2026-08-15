import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 writes AGENTS.md / CLAUDE.md on every `next dev` unless this is off.
  agentRules: false,
};

export default nextConfig;
