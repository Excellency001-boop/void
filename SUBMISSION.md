# VOID — submission copy

Paste-ready copy for the Colosseum Crypto World's Fair submission form. Fill the bracketed fields
before submitting.

---

## Project name
VOID

## Tagline (one line)
Give an AI agent real money and real on-chain power, with a mathematical guarantee it can never rug you.

## Elevator pitch (2 sentences)
Every "AI agent + crypto" product today either hands the agent a wallet it could drain, or keeps a
human approving every single action — which defeats the point of an agent. VOID compiles a
human-defined spending policy directly into an on-chain ERC-4337 validator, so the agent's session
key can *only* produce valid signatures for actions inside that policy — enforced by the smart
contract itself, not by trusting the agent, the app, or us.

## Track
Main track — AI agents + on-chain execution. Targeting Base and Arbitrum as primary chains, Solana
as a stretch goal (see registration).

## Full description

**The problem.** Give an agent a wallet and you're one bad tool-call, prompt injection, or model
mistake away from losing everything in it. Keep a human in the approval loop for every action and
the agent stops being autonomous — you've built a very expensive confirmation dialog. Neither is a
real answer for letting agents transact.

**The mechanism.** A user defines a policy in plain terms — spend caps, allowed chains, allowed
contracts and functions, a time window, a transaction count ceiling. VOID compiles that into a
Session Vault: a real ERC-4337 smart account (ZeroDev Kernel v3) with a custom validator module —
`PolicyValidator` — installed as the *only* signer path for the agent's session key. Every proposed
action is checked, in a fixed priority order (expiry → spend caps → whitelist → tx count → rate
limits), before the EntryPoint will let it execute. Outside that policy, the session key cannot
produce a signature the contract accepts — there's no code path where "the agent decided to" is
sufficient. When the session ends — expiry or force-revoke — an `ExpirySweepExecutor` module
installed on the same vault returns whatever remains to the owner automatically: it's permissionless
(anyone can trigger it, since the payout address is read from the vault's own on-chain policy, never
caller-supplied) and an in-process keeper calls it on a timer, so no one has to remember to. The
owner's root key, which never left their control, could always do the same thing manually too; the
sweep just means they don't have to.

**What's built and live on Base Sepolia and Arbitrum Sepolia today:**
- `PolicyValidator.sol` — the on-chain enforcement, 23 Foundry tests including two priority-order
  proofs and a fuzz test on the spend-cap boundary, plus an integration test against real ZeroDev
  Kernel v3.3 + a real ERC-4337 v0.7 EntryPoint (not mocks).
- An agent-facing API (Fastify) — create a vault, get live status/history, simulate an action
  (replays the contract's own `validateUserOp` via `eth_call`, not a reimplementation), execute for
  real, gasless owner revoke.
- A dashboard — create a policy, switch between Base Sepolia and Arbitrum Sepolia, watch a vault's
  live budget/tx-count/history, and an **Agent Console** that lets you act as the agent yourself:
  simulate or execute an action and watch it get accepted or genuinely rejected on-chain in real
  time.
- `ExpirySweepExecutor.sol` — the automatic fund-return module, 5 Foundry tests proving it's
  inert before expiry/revoke, pays out in full after either, can't be made to redirect funds, and
  can't be double-spent.

**Why the rejection has to be real, not simulated.** A real ERC-4337 bundler estimates gas before
including anything, so a policy-violating action would normally just be silently dropped — no
transaction, nothing to verify. VOID's relayer submits with a fixed gas limit specifically so a
rejected action still lands as a real, mined, reverted transaction with a real hash on a real block
explorer. The guarantee isn't a UI message; it's inspectable.

## How it works (tech)

- **Contracts:** Solidity, Foundry. `PolicyValidator` is an ERC-7579 validator module installed on
  a ZeroDev Kernel v3.3 smart account (real, unmodified — deployed via the account's own
  `KernelFactory`). A custom `ExecutionLib` decodes ERC-7579 single-call execution calldata to
  extract target/value/selector/token-amount for policy checks.
- **Account abstraction:** ERC-4337 v0.7 (`eth-infinitism/account-abstraction`), self-relayed —
  our own backend submits `EntryPoint.handleOps` directly rather than depending on a third-party
  bundler, which matters specifically so illegal actions produce visible on-chain rejections
  instead of being silently filtered pre-submission.
- **API:** Node/TypeScript, Fastify, viem. Session keys are generated server-side and returned
  exactly once — never stored. A named, undisguised trust-model gap: this MVP signs on the agent's
  behalf per-request rather than having the agent sign client-side; the enforcement guarantee lives
  entirely in the contract, not in API custody, so this gap doesn't weaken the core claim.
- **Dashboard:** Next.js 15, wagmi/viem, deliberately styled as a technical console rather than a
  consumer app.
- **Chain:** Base Sepolia (84532) and Arbitrum Sepolia (421614), both live, each with its own
  deployed API instance and a network switcher in the dashboard. Base and Arbitrum mainnet are the
  deploy targets once hardened past hackathon scope.

## What's real vs. what's next

Real and verified on-chain today: policy compilation, session-key issuance, on-chain enforcement
in fixed priority order, real simulate/execute against real Kernel v3 + real EntryPoint, real
mined-and-reverted rejections, gasless owner revoke, and automatic fund return on expiry or revoke
(both the permissionless contract call and the unattended keeper that triggers it) — all exercised
through the actual dashboard UI against live Base Sepolia and Arbitrum Sepolia, not just scripts.

Not yet built: a production bundler integration (so the owner isn't trusting VOID's own relayer for
liveness), agent-side signing (so the API never sees a session key at all), persistent storage for
the vault index (currently in-memory, resets on API restart — on-chain state, and the automatic
sweep, are unaffected either way), and the Solana leg.

## Try it in under a minute
Open the dashboard, click **+ New Session Vault**, set a spend cap and one allowed
contract+function, deploy. Copy the session key into the **Agent Console** on the vault's page, try
an action *outside* the policy — watch it get rejected with a real transaction hash you can check
on Basescan — then try one *inside* the policy and watch it succeed.

## Team
[your name / handle]

## Links
- Live dashboard: https://void-sessionvault.vercel.app
- Live API: https://void-api-production-fc5e.up.railway.app/health
- GitHub: [PASTE REPO URL]
- Video: [PASTE VIDEO URL — see DEMO_SCRIPT.md]
- PolicyValidator on Basescan: https://sepolia.basescan.org/address/0x0383157dd47002e2d5ebe621cd84dfd3a418f422
