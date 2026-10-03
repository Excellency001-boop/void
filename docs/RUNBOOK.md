# VOID runbook

How to run, deploy, and keep VOID healthy. Written so someone who did not build it can operate it.

## Moving parts

| Part | Where it runs | Per chain? |
|------|---------------|-----------|
| Contracts (PolicyValidator, ExpirySweepExecutor, Kernel infra) | On-chain | yes |
| API (Fastify, relayer, expiry keeper) | Railway, one service per chain | yes |
| Dashboard (Next.js) | Vercel, one deployment | no |

The dashboard picks an API from `web/lib/networks.ts`. One API process serves exactly one chain. This
was a deliberate choice: duplicating a proven single-chain service is safer than generalizing it.

## Environment

API, per service:

| Variable | Meaning |
|----------|---------|
| `CHAIN_ID` | 84532 or 421614 |
| `RPC_URL` | RPC for that chain. Public RPCs lag on reads, see Known quirks |
| `RELAYER_PRIVATE_KEY` | Funded key that pays gas and submits UserOps. Never commit it. The API refuses to start on a real chain with the public Anvil key |
| `PORT` | Injected by Railway |

Web, in Vercel: `NEXT_PUBLIC_BASE_API_URL`, `NEXT_PUBLIC_ARBITRUM_API_URL`.

Deployment records live in `api/deployments/<chainId>.json` and are committed. The API reads those,
not `contracts/out`, so it deploys without Foundry.

## Health checks

```bash
curl -s https://void-api-production-fc5e.up.railway.app/health
curl -s https://void-api-arbitrum-production.up.railway.app/health
```

Each should return the chain id, the relayer address, and the deployed contract addresses. If one
returns 502, check the Railway domain target port matches the port Railway assigned.

## Relayer balance

The relayer pays gas for every deploy, execute, revoke, and sweep. If it runs dry, vault creation
and agent actions fail with an insufficient funds error. On-chain policy and owner control are not
affected.

- Check the balance of the address from `/health` on the chain's explorer.
- Keep at least 0.02 test ETH per chain. A full demo run costs about 0.005.
- Top up from a faucet. Never move real funds through the relayer.

## Deploying

### Contracts to a new chain

1. Fund the deployer key on that chain.
2. From `api/`, run the deploy script with `RPC_URL`, `CHAIN_ID`, and the key set. It is
   incrementally idempotent: it reuses what exists and deploys only what is missing.
3. Commit the new `api/deployments/<chainId>.json`.
4. Add the chain to `web/lib/networks.ts` and a new API service with its own env.

### API

`railway up` from `api/`. Set the variables above on the service. Confirm `/health`.

### Dashboard

Push to the connected branch, or `vercel --prod` from `web/`. Confirm the alias loads and the
network switcher shows both chains.

## Incidents

**Vault not found, but I just created it.** Public RPC read replicas lag. The success screen retries
empty reads for about 15 seconds. If it still fails, the deploy really failed and nothing was sealed.
Check the deployment transaction on the explorer.

**Vault list is empty after an API restart.** The index is in memory. Vaults still exist on chain.
Open any vault by address. Known gap, listed in the README.

**A vault expired and funds are still inside.** The keeper sweeps every 5 minutes for vaults it knows
about. Anyone can also call `ExpirySweepExecutor.sweep(vault)`, or press Sweep on the vault page.
Funds can only go to the owner address stored in the vault policy.

**Agent action rejected unexpectedly.** The revert reason names the gate. Match it to the five gates
in the README. The order is fixed, so an earlier gate can mask a later one.

**Suspected session key leak.** Owner presses Force Revoke on the vault page. It is gasless for the
owner and takes effect on the next block. Then sweep.

## Security posture

- Testnet only. No audit. Do not put real value in a vault.
- Session keys are generated server-side, returned once, never stored, and handed to the vault page
  through one-time `sessionStorage`, never a URL.
- The relayer key is the only server secret. Rotate it by setting a new `RELAYER_PRIVATE_KEY`, funding
  it, and redeploying the API. Vault policies are unaffected.
- Secret scan before any public release: search the repo and history for `PRIVATE_KEY`, `.env`, and
  64-hex strings.

## Why there is no token

There is no token and no plan for one. The product is a guarantee, and the guarantee is the contract.
Revenue, if this becomes a product, comes from hosted keepers and alerts for teams, and a small fee on
relayed actions. The contracts stay permissionless.
