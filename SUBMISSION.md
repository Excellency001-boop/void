# VOID: submission copy

Paste-ready copy for the Colosseum Crypto World's Fair submission form. One field is still open:
the video link (marked below). Everything else is filled in.

---

## Project name
VOID Session Vaults

## Tagline (one line)
Session keys for agents that the contract itself enforces.

## Elevator pitch (2 sentences)
Every "AI agent + crypto" product today either hands the agent a wallet it could drain, or keeps a
human approving every single action, which defeats the point of an agent. VOID compiles a
human-written spending policy directly into an on-chain ERC-4337 validator, so the agent's session
key can only produce signatures the contract accepts for actions inside that policy, enforced by the
smart contract itself, not by trusting the agent, the app, or us.

## Track
Main track: AI agents + on-chain execution. Live on Base Sepolia and Arbitrum Sepolia.

## Full description

**The problem.** Give an agent a wallet and you are one bad tool call, prompt injection, or model
mistake away from losing everything in it. Keep a human in the approval loop for every action and the
agent stops being autonomous. You have built a very expensive confirmation dialog. Neither is a real
answer for letting agents transact.

**The mechanism.** A user defines a policy in plain terms: a spend cap, a time window, the one
contract and function the agent may call, a transaction count ceiling. VOID compiles that into a
Session Vault: a real ERC-4337 smart account (ZeroDev Kernel v3) with a custom validator module,
`PolicyValidator`, installed as the only signer path for the agent's session key. Every proposed
action is checked in a fixed priority order (expiry, spend cap, whitelist, tx count, rate limit)
before the EntryPoint lets it execute. Outside that policy, the session key cannot produce a
signature the contract accepts. There is no code path where "the agent decided to" is enough.

When the session ends (expiry or force-revoke), an `ExpirySweepExecutor` module installed on the same
vault returns whatever remains to the owner. It is permissionless: anyone can trigger it, because the
payout address is read from the vault's own on-chain policy, never from the caller. An in-process
keeper calls it on a timer, so nobody has to remember. The owner's root key, which never leaves their
control, can always do the same thing by hand.

**We pointed an AI agent at it and told it to steal.** The repo includes `agent/`, a real LLM agent
that holds a session key. In red-team mode it is told it has been hijacked and should drain the vault.
In the recorded run on Base Sepolia it tried the whole balance, sneaking under the spend cap, a token
transfer through the allowed contract, an oversized call to the allowed function, and uninstalling the
policy module from the vault itself. The contract rejected all five policy attempts, each as a real
mined, reverted transaction, and allowed the one action the owner had approved. Nothing reached the
attacker address. You can watch the run replay at `/agent` in the dashboard, with every transaction
linked to the explorer. We left the two non-policy hiccups in the transcript (a gas prefund failure and
a malformed request) rather than tidy them away.

**What is built and live today (Base Sepolia and Arbitrum Sepolia):**
- `PolicyValidator.sol`: the on-chain enforcement. 23 Foundry tests including priority-order proofs
  and a fuzz test on the spend-cap boundary, plus an integration test against real ZeroDev Kernel
  v3.3 and a real ERC-4337 v0.7 EntryPoint, not mocks.
- `ExpirySweepExecutor.sol`: automatic fund return. 5 Foundry tests proving it is inert before
  expiry or revoke, pays out in full after either, cannot be redirected, and cannot be double-spent.
  28 tests in total.
- An agent-facing API (Fastify, viem): create a vault, live status and history, simulate an action
  (it replays the contract's own `validateUserOp` via `eth_call`, not a reimplementation), execute for
  real, gasless owner revoke, sweep.
- A dashboard: seal a policy, switch chains, watch a vault's budget and history, and an Agent Console
  where you act as the agent yourself and watch actions get accepted or genuinely rejected on-chain.
  Mobile checked down to 320px.
- `agent/`: the LLM agent described above, with honest and red-team modes and saved transcripts.

**Why the rejection has to be real.** A real ERC-4337 bundler estimates gas before including
anything, so a policy-violating action is normally dropped silently: no transaction, nothing to verify.
VOID's relayer submits with a fixed gas limit so a rejected action still lands as a real, mined,
reverted transaction with a hash on a block explorer. The guarantee is not a UI message. It is
inspectable.

## How it works (tech)

- **Contracts:** Solidity, Foundry. `PolicyValidator` is an ERC-7579 validator module installed on a
  ZeroDev Kernel v3.3 account (real, unmodified, deployed through its own `KernelFactory`). A custom
  `ExecutionLib` decodes ERC-7579 execution calldata to extract target, value, selector and token
  amount for the policy checks.
- **Account abstraction:** ERC-4337 v0.7, self-relayed. Our backend submits `EntryPoint.handleOps`
  directly instead of going through a third-party bundler, specifically so illegal actions produce
  visible on-chain rejections instead of being filtered out before submission.
- **API:** Node and TypeScript, Fastify, viem, zod. One process per chain. Session keys are generated
  server-side, returned exactly once, and never stored. A named trust-model gap: this MVP signs on the
  agent's behalf per request rather than having the agent sign client-side. The enforcement guarantee
  lives entirely in the contract, so this does not weaken the core claim.
- **Dashboard:** Next.js 15, wagmi and viem, Tailwind. The session key moves between screens through
  one-time `sessionStorage`, never a URL.
- **Chains:** Base Sepolia (84532) and Arbitrum Sepolia (421614), each with its own deployed API, a
  network switcher, and a Deployments section on the home page with live API health and explorer links
  to every contract.

## What is real, and what is next

Real and verified on-chain today: policy compilation, session-key issuance, on-chain enforcement in
fixed priority order, real simulate and execute against a real Kernel and a real EntryPoint, real
mined-and-reverted rejections, gasless owner revoke, automatic fund return, and a recorded red-team run
by a real LLM agent. All of it is exercised through the actual dashboard against live testnets.

Not built yet, and we say so plainly:
- **Mainnet.** Testnet only, unaudited. The API already has mainnet guards written (hard per-vault
  cap, 7 day limit, rate limits, no demo faucet) but nothing is deployed to mainnet.
- **A production bundler.** Liveness currently depends on our own relayer.
- **Agent-side signing,** so the API never sees a session key at all.
- **A persistent vault index.** The list of vaults is in memory and resets on API restart. On-chain
  state and the automatic sweep are unaffected.
- **A model run without a human in the loop.** The recorded red-team run used Claude answering each
  turn through a Claude Code session, because no API key was available. The agent package runs
  unattended with an Anthropic key. That run has not been recorded yet.

There is no token and no plan for one. The product is a guarantee, and the guarantee is the contract.
See the README for the business model.

## Who it is for, and the business

**The market.** Anyone letting software spend on their behalf: teams running trading and treasury agents,
wallets and apps that want to offer agent features without custody risk, and agent platforms that need a
spending limit users can verify. The number of agents holding keys is growing faster than the tools to
bound them. Today the choices are a hot wallet with no limits or a human approving every step.

**Business model.** The contracts stay free and permissionless. Revenue comes from the layer on top:
a small fee on relayed actions (paid in the gas token already in use), and a paid tier for teams that want
hosted keepers, alerts, policy templates and audit-ready action logs. There is no token and no plan for one.

**Go-to-market.** Start where the pain is sharpest and the buyers are reachable: builders of onchain AI
agents on Base and Arbitrum. Ship the agent package (`agent/`) and an SDK so a developer can give their agent
a bounded session key in a few lines, then let the live red-team replay (`/agent`) do the selling: it shows
an agent failing to steal, with transactions anyone can open.

**Distribution.** Open source (MIT) so agent frameworks can adopt it directly. Integrations with agent
frameworks and wallets as the main channel. Public red-team runs against new models as recurring content.

**Demand validation, stated honestly.** We have not yet run a pilot with an outside team, so we have no
customer numbers to report. What we have is working proof of the mechanism: a real agent attacking a live
vault and losing, on public testnets, with the code open. The next step is a pilot with two or three
agent builders on Base or Arbitrum.

## Chain tracks
Built for the **Base** and **Arbitrum** tracks: the same contracts are deployed and exercised on Base Sepolia
and Arbitrum Sepolia, each with its own API. Mainnet is not deployed yet and we say so above.

## Try it in under a minute
Open the dashboard and press **Create a session vault**. Set a spend cap, then one allowed contract
and function, and press **Seal this policy on-chain**. Send the vault a little test ETH, then use the
**Agent Console** on its page: try an action outside the policy and watch it get rejected with a real
transaction hash, then try one inside the policy and watch it succeed. Or just open `/agent` to watch
the recorded red-team run.

## Team
Isiaq Tijani A. (GitHub: Excellency001-boop). Solo builder. Ibadan, Nigeria.

I'm Isiaq Tijani A., a solo builder from Ibadan, Nigeria.

Over the past months I have designed, built and shipped several products where AI agents meet crypto: trading and risk co-pilots, agent guards, and on-chain apps across Base, Arbitrum, Solana and other chains. I do the whole stack myself: Solidity contracts and tests, the backend API, the web app, and the demo and docs. I focus on working, deployed products.

VOID came out of that work. Each time I gave an agent a key, I faced the same choice: trust it blindly, or approve every step and lose the point of having an agent. I wanted a third option, where the smart contract, not the agent or the app, decides what is allowed.

For VOID I wrote the policy validator and sweep contracts (28 tests), deployed them on Base Sepolia and Arbitrum Sepolia, built the API and the dashboard, and ran a real AI agent against it to try to steal funds. The contract rejected every out-of-policy attempt.

Next, I am looking for two or three agent builders on Base and Arbitrum to pilot it with, then an audit before mainnet.

## Links
- Live dashboard: https://void-sessionvault.vercel.app
- Red-team run replay: https://void-sessionvault.vercel.app/agent
- GitHub (public, MIT): https://github.com/Excellency001-boop/void
- Demo video: **[PASTE VIDEO LINK HERE once uploaded]**
- Live API, Base Sepolia: https://void-api-production-fc5e.up.railway.app/health
- Live API, Arbitrum Sepolia: https://void-api-arbitrum-production.up.railway.app/health
- PolicyValidator on Basescan (Base Sepolia): https://sepolia.basescan.org/address/0x0383157dd47002e2d5ebe621cd84dfd3a418f422
- PolicyValidator on Arbiscan (Arbitrum Sepolia): https://sepolia.arbiscan.io/address/0x7b05ac2861b802efae43da3ab4fd984e7adb01ca
