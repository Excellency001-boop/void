import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerVaultRoutes } from "./routes/vaults.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { config, mainnetLimits } from "./config.js";
import { rateLimitHook } from "./rateLimit.js";
import { relayerAccount, chain } from "./chain.js";

export function buildServer() {
  const app = Fastify({ logger: true, trustProxy: true });

  // The dashboard is a separate origin (Next.js dev server / deployed site). Wide open by
  // default since this API has no session/cookie auth to protect against CSRF in the first
  // place — every write already requires either a session private key or an owner signature
  // baked into the request body, not ambient browser credentials.
  app.register(cors, { origin: true });

  // Real-money chains only: testnets keep the open, faucet-friendly behavior the demo needs.
  if (config.isMainnet) app.addHook("onRequest", rateLimitHook);

  app.get("/health", async () => ({
    mode: config.isMainnet ? "mainnet" : "testnet",
    limits: config.isMainnet
      ? {
          maxNativeSpendCapWei: mainnetLimits.maxNativeSpendCapWei.toString(),
          maxSessionSeconds: mainnetLimits.maxSessionSeconds,
          maxTxCount: mainnetLimits.maxTxCount.toString(),
        }
      : null,
    status: "ok",
    chainId: config.CHAIN_ID,
    chainName: chain.name,
    relayer: relayerAccount.address,
    contracts: config.deployment,
  }));

  registerVaultRoutes(app);
  registerAgentRoutes(app);

  return app;
}
