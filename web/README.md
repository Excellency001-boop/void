# VOID dashboard

The owner-facing surface: create a Session Vault, watch its budget and history, force-revoke it,
and — via the built-in Agent Console — act as the agent yourself to see the enforcement live.

## Setup

```bash
npm install
cp .env.local.example .env.local   # point at your running api/ instance
npm run dev
```

## Deployed

Live on Vercel: https://void-sessionvault.vercel.app, pointed at the live Railway API via
`NEXT_PUBLIC_API_URL` set as a **production** environment variable (Next.js bakes `NEXT_PUBLIC_*`
vars in at build time — set them before deploying, or trigger a rebuild after). Deployed with
`vercel --prod`.

One thing worth knowing if re-aliasing on a fresh project: by default this account's projects ship
with `ssoProtection: { deploymentType: "all_except_custom_domains" }`, which gates every
`*.vercel.app` alias (including ones made with `vercel alias set` — Vercel doesn't count those as
"custom domains", only externally-owned ones do) behind a Vercel login redirect. Confirmed by
testing, not assumed — `void-vault.vercel.app`-style aliases 404'd into an SSO page until this was
turned off. Fix: `PATCH https://api.vercel.com/v9/projects/<id>?teamId=<id>` with
`{"ssoProtection": null}` (no CLI command for this as of writing), then alias as normal.

Requires `api/` running and reachable at `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:4000`), which in turn requires `contracts/deployments/<chainId>.json` to exist
— see the root README and `api/README.md` for the full chain of setup.

## Pages

- `/` — vault list (a convenience index from the API's memory) plus a "view by address" box, since
  every vault's real state always lives on-chain regardless of what this dashboard remembers.
- `/create` — policy form. Duration, native spend cap, max tx count, and one optional initial
  permission (contract + function signature — the selector is computed client-side via
  `viem.toFunctionSelector` so you never have to know it). Deploys for real; the session private
  key is shown exactly once, with a clear warning, and never sent anywhere else.
- `/vaults/[address]` — live status (budget bar, tx-count bar, expiry countdown), action history
  read from `ActionValidated` logs with Basescan links, a force-revoke flow (wallet `personal_sign`
  or a manual private-key path for demo convenience), a deposit convenience button, and the Agent
  Console.

## Agent Console

The demo centerpiece: paste a session private key, a target contract, value, and calldata, then
**Simulate** (replays `PolicyValidator.validateUserOp` via `eth_call` — the contract's real logic,
not a client-side guess) or **Execute for real** (submits the actual UserOp; a rejection comes back
as a genuine mined-and-reverted transaction, not a silent drop). Every attempt appends to a log
showing the risk score, any risk factors, and the decoded revert reason on failure.

## Wallet connection

`injected()` only (MetaMask, OKX Wallet, Rabby, any EIP-1193 injected provider) via wagmi, targeting
Base Sepolia. Deliberately not using `wagmi/connectors`'s WalletConnect/Coinbase connectors —
pulling in the full barrel export drags in `@coinbase/cdp-sdk`, which tries a dynamic `import()` of
optional `@x402` packages that aren't installed and aren't needed for a plain injected-wallet flow.
`next.config.ts` aliases `@coinbase/cdp-sdk` to `false` so webpack doesn't choke on it. Wallet
connection is optional everywhere except signing the revoke message — every other flow (create,
view, simulate, execute) works with a manually-typed address.

## Verified end-to-end (Base Sepolia, via actual browser interaction, not just curl)

- Viewed a real, previously-revoked vault: correct `REVOKED` badge, correct budget/tx-count,
  correct history entry with a working Basescan link.
- Ran the Agent Console's Simulate against that same vault: got back `SessionRevoked`, matching the
  contract's real state.
- Created a brand-new vault through the `/create` form: real deployment transaction, real vault and
  session-key addresses, one-time key reveal panel. Landed on the new vault's page showing
  `ACTIVE`, correct fresh budget, and an empty history — before executing anything against it.
