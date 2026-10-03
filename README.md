# VOID Session Vaults

**Session keys for agents that the contract itself enforces.**

An AI agent can propose anything. The contract decides what is real.

VOID compiles a human-written spending policy into an on-chain ERC-4337 validator. The agent gets a
session key. Outside the policy, that key cannot produce a signature the contract will accept. Not a
review step, not an app-level check. The chain says no, and you can open the reverted transaction on
a block explorer to see it.

Live dashboard: https://void-sessionvault.vercel.app
Chains: Base Sepolia (84532) and Arbitrum Sepolia (421614)

## The five gates

`PolicyValidator.validateUserOp` runs these checks in a fixed priority order. The first failure wins,
and the revert reason says which one.

| # | Gate | Rejects when |
|---|------|--------------|
| 1 | Expiry | the session window has not started, has ended, or the vault is revoked |
| 2 | Spend cap | the action would push native or token spend past the cap |
| 3 | Whitelist | the target contract and function selector are not allowed |
| 4 | Tx count | the session already used its transaction budget |
| 5 | Rate limit | a per-recipient cap is exceeded |

When a session expires or is revoked, `ExpirySweepExecutor` returns whatever is left to the owner.
Anyone can trigger it, because the payout address is read from the vault's own on-chain policy and
never from the caller. A keeper in the API calls it on a timer so nobody has to remember.

## What is in this repo

```
contracts/   Solidity + Foundry. PolicyValidator, ExpirySweepExecutor, 28 tests
api/         Fastify + viem. Create vaults, simulate and execute agent actions, revoke, sweep
web/         Next.js 15 dashboard. Create a policy, watch a vault, act as the agent
demo/        Demo video and the script it was recorded from
docs/        RUNBOOK.md: how to run, deploy, and operate this
```

Built on ZeroDev Kernel v3.3 (ERC-7579 modules) and the ERC-4337 v0.7 EntryPoint. Nothing is mocked in
the integration tests. They run against the real Kernel and the real EntryPoint.

## Run it locally

```bash
# contracts
cd contracts && forge test            # 28 tests

# api (needs contracts built first, see api/README.md)
cd ../api && npm install && npm run dev

# web
cd ../web && npm install && npm run dev   # http://localhost:3000
```

The dashboard talks to one API per chain. Set `NEXT_PUBLIC_BASE_API_URL` and
`NEXT_PUBLIC_ARBITRUM_API_URL` to point it at your own instances. Defaults point at the hosted ones.

## Try it in a minute

1. Open the dashboard and press **Create a session vault**.
2. Set a spend cap, a duration, and one allowed contract and function. Press **Seal this policy on-chain**.
3. Copy the session key. It is shown once and never stored.
4. On the vault page, use the **Agent Console** to propose an action outside the policy.
   Watch it get rejected on-chain, with a transaction hash you can open on the explorer.
5. Propose one inside the policy and watch it execute.

## Honest scope

Real and verified on both testnets: policy compilation, session keys, on-chain enforcement in fixed
order, real simulate and execute, real mined-and-reverted rejections, gasless owner revoke, automatic
fund return.

Not built yet:

- A third-party bundler. VOID self-relays so rejected actions land as visible reverts. Liveness
  depends on our relayer for now.
- Agent-side signing. The API currently signs per request with the session key it just generated.
  The guarantee lives in the contract, so this does not weaken the core claim, but it is a trust
  gap and we name it.
- Persistent vault index. The list of vaults is in memory and resets on API restart. On-chain state
  and the sweep path are unaffected.
- Mainnet. Testnet only. No audit.

## Why there is no token

VOID is a safety primitive, and a safety primitive should not need you to hold a speculative asset to
trust it. The guarantee is the contract. A token would add a reason to doubt the guarantee, not a
reason to believe it.

If this becomes a product, the honest model is boring: a small fee on relayed actions, paid in the
gas token you are already using, plus a paid tier for teams that want hosted keepers, alerts, and
policy templates. The contracts stay permissionless and free to use directly.

## Docs

- [docs/RUNBOOK.md](docs/RUNBOOK.md): operations, deploys, incidents
- [contracts/README.md](contracts/README.md), [api/README.md](api/README.md), [web/README.md](web/README.md)
- [SUBMISSION.md](SUBMISSION.md): hackathon submission copy
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md): the 2 minute demo script
