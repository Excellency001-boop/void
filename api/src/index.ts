import { buildServer } from "./server.js";
import { config } from "./config.js";

const app = buildServer();

app
  .listen({ port: config.PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`VOID agent API listening on :${config.PORT} (chain ${config.CHAIN_ID})`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
