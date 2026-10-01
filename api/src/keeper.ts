import type { FastifyBaseLogger } from "fastify";
import { config } from "./config.js";
import { listVaults } from "./store.js";
import { getSweepStatus, sweepVault } from "./vaults.js";

/// Makes "funds return to the owner automatically on expiry or revoke" actually automatic, not
/// just "automatable via a button someone has to remember to press." A plain `setInterval` inside
/// this same long-lived process is enough — Railway (and any other always-on host) keeps this
/// process running continuously, so no separate cron infra is needed. The on-chain mechanism
/// (ExpirySweepExecutor.sweep) is what makes this safe to run unattended: it's permissionless and
/// can only ever pay out to the address PolicyValidator already has on record as the owner, so a
/// bug here can at worst fail to sweep, never misdirect funds.
///
/// Known limitation, shared with `listVaults()` generally (see store.ts): this only sweeps vaults
/// this same process instance created and still has in memory, so a Railway restart loses track
/// of older vaults until someone looks them up again (e.g. by visiting them in the dashboard,
/// which re-registers nothing currently — a real deployment would back this with a database keyed
/// off deployment logs, not process memory). On-chain funds are never at risk either way; this
/// only affects how promptly an eligible vault gets noticed.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function startExpiryKeeper(log: FastifyBaseLogger): void {
  if (!config.deployment.expirySweepExecutor) {
    log.info("Expiry keeper disabled: no ExpirySweepExecutor on record for this chain's deployment");
    return;
  }

  async function tick() {
    const vaults = listVaults();
    for (const vault of vaults) {
      try {
        const status = await getSweepStatus(vault.vaultAddress);
        if (!status.eligible || status.amountWei === "0") continue;

        log.info(
          { vault: vault.vaultAddress, amountWei: status.amountWei },
          "Expiry keeper: sweeping eligible vault"
        );
        const { txHash } = await sweepVault(vault.vaultAddress);
        log.info({ vault: vault.vaultAddress, txHash }, "Expiry keeper: swept vault");
      } catch (err) {
        log.warn({ vault: vault.vaultAddress, err: String(err) }, "Expiry keeper: sweep attempt failed");
      }
    }
  }

  log.info(`Expiry keeper started, polling every ${POLL_INTERVAL_MS / 1000}s`);
  setInterval(() => {
    tick().catch((err) => log.error({ err: String(err) }, "Expiry keeper: tick crashed"));
  }, POLL_INTERVAL_MS);
}
