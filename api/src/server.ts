import Fastify from "fastify";
import { registerVaultRoutes } from "./routes/vaults.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { config } from "./config.js";
import { relayerAccount, chain } from "./chain.js";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({
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
