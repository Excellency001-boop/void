import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // wagmi/connectors barrel-exports every connector, including Coinbase's `baseAccount`, which
    // we never use (only `injected()`). That connector pulls in @coinbase/cdp-sdk, which tries a
    // dynamic import() of optional x402 peer packages we haven't installed — webpack fails to
    // resolve that at build time even though it's meant to fail gracefully at runtime. Aliasing
    // the whole cdp-sdk branch to false short-circuits it before it ever gets that far; nothing
    // we actually use touches this package.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
    };
    return config;
  },
};

export default nextConfig;
