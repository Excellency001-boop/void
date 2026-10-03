# VOID agent API

The layer external agents actually talk to: create a Session Vault, hand its session key to an
agent, and let the agent propose actions, simulated first, executed for real second, with
PolicyValidator as the only thing that decides whether they land.

## Setup

```bash
npm install
cd ../contracts && forge build && cd ../api   # artifacts must exist before deploy/start
anvil &                                        # or point RPC_URL/CHAIN_ID at a real testnet
npm run deploy:local                           # writes ../contracts/deployments/<chainId>.json
npm run dev
```

`deploy:local` is a small viem script, not `forge script`, this environment's `forge script`
hits an RPC incompatibility during its balance pre-flight against this Anvil build (an
`eth_getBalance` call with a block hash where Anvil expects a block tag). It's a tooling bug in
this specific Foundry build, not a project constraint; viem's client talks to the same RPC
directly and doesn't hit it. The deploy script is easy to swap for a real `forge script` later if
that combination gets fixed upstream, or to point at a chain where someone else already deployed
the shared infra.

## Self-contained by design

ABIs are vendored as plain JSON under `src/abi/generated/` (extraction command below) and the
active deployment record is copied into `deployments/<chainId>.json`, both committed, the API
never reads from `contracts/out/` or `contracts/deployments/` at runtime, only as a local-dev
fallback. That's what makes it deployable on its own (see Railway below) without the rest of the
monorepo, or a Foundry toolchain, present at all.

```bash
# Regenerate after a real contract change (from contracts/):
python3 -c "
import json, os
files = [('out/PolicyValidator.sol/PolicyValidator.json', 'policyValidator.json'),
          ('out/Kernel.sol/Kernel.json', 'kernel.json'),
          ('out/KernelFactory.sol/KernelFactory.json', 'kernelFactory.json'),
          ('out/ECDSAValidator.sol/ECDSAValidator.json', 'ecdsaValidator.json'),
          ('out/EntryPoint.sol/EntryPoint.json', 'entryPoint.json')]
for src, dst in files:
    json.dump(json.load(open(src))['abi'], open(f'../api/src/abi/generated/{dst}', 'w'))
"
```

## Deployed

Live on Railway: https://void-api-production-fc5e.up.railway.app (check `/health`). Deployed via
`railway up`, with `RPC_URL` / `CHAIN_ID` / `RELAYER_PRIVATE_KEY` set as service variables, no
`.env` file involved in production. Railway injects its own `PORT`; the app already binds to
whatever `config.PORT` resolves to on `0.0.0.0`, so nothing app-side needs to change between local
and hosted. If re-deploying to a fresh service, remember to set the domain's target port to match
whatever Railway actually assigned (`railway domain update <domain> --port <port>`), the
auto-generated domain doesn't infer this automatically and a mismatch reads as a generic 502.

## Why self-relay instead of a bundler

VOID's own relayer submits every UserOp directly to `EntryPoint.handleOps`, rather than going
through Pimlico/ZeroDev/Alchemy's bundler infra. Two reasons, both load-bearing for the demo:

1. **A real bundler estimates gas before including anything.** An action that violates policy
   fails that estimation and is silently dropped, no transaction, nothing to point at, no way to
   show "the contract said no."
2. **`/agent/execute` needs to prove the rejection, not avoid it.** It signs its own transaction
   and submits raw bytes with a fixed gas limit specifically so a would-revert action still lands
   on-chain as a real, inspectable, mined-but-failed transaction.

Swapping in a real bundler for production (so the owner isn't trusting VOID's own relayer for
liveness) is real, scoped follow-up work, the contract-level guarantee doesn't change either way;
only who pays gas and submits the transaction does.

## Trust model, stated plainly

Session keys are generated server-side at vault creation and returned exactly once in the
`POST /vaults` response, this API does not store them. `/agent/simulate` and `/agent/execute` both
take the session private key as a per-request parameter and sign with it in-process; a production
version would have the agent hold its own key and sign UserOps client-side, submitting only the
signature. That's a real gap, named on purpose rather than glossed over: the thing actually
guaranteeing an agent can't overstep is PolicyValidator's on-chain enforcement, not this API's
custody story, and that guarantee holds regardless of which side does the signing.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/vaults` | Deploy a Session Vault: root key = owner, PolicyValidator installed with the given policy, one initial (target, selector) permission seeded. Returns the session key **once**. |
| GET | `/vaults` | List vaults this API instance has created (in-memory index, see `src/store.ts`). |
| GET | `/vaults/:address` | Live on-chain status: budget, spend, tx count, expiry, revoked. |
| GET | `/vaults/:address/history` | Every validated action, read from `ActionValidated` logs. |
| POST | `/vaults/:address/deposit` | Dev convenience: relayer sends ETH to the vault. In production the owner funds their own vault directly, it's a plain address. |
| GET | `/vaults/:address/revoke-message` | The exact pre-image the owner signs (via `personal_sign`) to authorize a gasless revoke. |
| POST | `/vaults/:address/revoke` | Submits `forceRevokeWithSig` with the owner's signature. Any relayer can carry this, no gas needed from the owner. |
| POST | `/agent/simulate` | Builds the real UserOp, signs it, replays `PolicyValidator.validateUserOp` via `eth_call` with `account` spoofed to the vault. Returns `allowed`, the decoded revert if not, and a transparent risk score. |
| POST | `/agent/execute` | Same UserOp, submitted for real. Returns `success`, the real `txHash` either way, and the decoded revert (unwrapped from EntryPoint's `FailedOpWithRevert`) on rejection. |

## Verified end-to-end: local Anvil, then real Base Sepolia

Every route above has been exercised against a live chain, not just typechecked: vault creation,
funding, a legal `mint()` action simulated then executed (real tx, `ActionValidated` in history,
`txCount` incremented), an illegal action on a never-whitelisted target both simulated (`allowed:
false`, decoded `TargetSelectorNotAllowed`) and executed (real mined-and-reverted transaction,
`txCount` unchanged), a gasless owner-signed revoke, and confirmation that a previously-legal
action is rejected (`SessionRevoked`) immediately afterward. First proven on local Anvil, then
repeated in full on live Base Sepolia (chain 84532), see `contracts/deployments/84532.json` for
the deployed addresses and the transactions below on [Basescan](https://sepolia.basescan.org):

| Step | Tx |
|---|---|
| Legal `mint()` action | [`0xa49dca09...b0f2de7`](https://sepolia.basescan.org/tx/0xa49dca097daa01dabe7dd6fcea206a4277ab176f16c9402d707a9eb15b0f2de7), succeeded |
| Illegal action (never-whitelisted target) | [`0x9d1a7b2e...be06993d`](https://sepolia.basescan.org/tx/0x9d1a7b2eb23e72e910bb4a2c30b50dd42c2838436395b9c69bbc9d93be06993d), real mined-and-reverted transaction, `TargetSelectorNotAllowed` |
| Gasless owner-signed revoke | [`0x4970f530...80e7afeb`](https://sepolia.basescan.org/tx/0x4970f530e05c1ba4c30ffeeedd6f58a2142847729d93dfde8e6f2ddffd6dfd7a) |

Deploying to Base Sepolia surfaced three real bugs, all fixed (see git history for
`scripts/deploy.ts`, `src/vaults.ts`, `src/agentActions.ts`):

- **`scripts/deploy.ts` hardcoded the local Anvil chain object** regardless of `RPC_URL`/`CHAIN_ID`:
  transactions were signed with the wrong chain ID baked in, so Base Sepolia (correctly)
  rejected them as `invalid chain ID`. Fixed by resolving the live chain from `eth_chainId` before
  building any client.
- **Public RPC replica inconsistency** on back-to-back writes: automatic gas estimation and
  automatic nonce lookup would occasionally land on a load-balanced replica that hadn't caught up
  on the immediately-preceding transaction, surfacing as a spurious constructor revert once and
  `"replacement transaction underpriced"` another time. Fixed by tracking nonces locally instead of
  re-querying per call, and using explicit gas limits instead of `eth_estimateGas`. The same class
  of staleness showed up a third time as `"block not found"` when re-simulating a failed
  transaction pinned to its exact block number, fixed by using `"latest"` instead, since nothing
  relevant changes between a failed (non-state-mutating) call and now.
- **`getVaultHistory` scanned from block 0**: fine on a brand-new local Anvil chain, but exceeds
  this RPC's 50,000-block `eth_getLogs` range limit on a real, long-lived testnet. Fixed by
  recording each vault's actual deployment block at creation time and scanning from there.

None of these were contract bugs: `PolicyValidator`'s logic behaved identically on both chains.
They were all in the deployment/RPC-interaction layer, which is exactly the kind of thing that
only surfaces once you leave a clean local Anvil instance for a real network.

## What's next

- Swap the in-memory vault index (`src/store.ts`) for persistent storage once the dashboard needs
  to list vaults across API restarts: on-chain state stays authoritative either way.
- Real bundler integration for production chains (see above).
- Agent-side signing, so this API never sees a session private key at all.
