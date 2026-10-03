# VOID contracts

`PolicyValidator` is an ERC-7579 validator module: installed on a per-session Kernel v3 smart
account (the "Session Vault"), it is the only signer path available to an AI agent's session key,
and it enforces the owner's policy on every proposed action in a fixed priority order:

1. hard time expiry
2. cumulative spend caps (native + specified ERC-20s)
3. whitelist of allowed target contracts + function selectors
4. max transaction count
5. optional rate / per-recipient limits

Any violation reverts `validateUserOp` with a specific custom error, a legible, traceable
on-chain rejection, not a silent bundler drop. See the NatSpec on `src/PolicyValidator.sol` for the
accounting/signature-failure design tradeoffs, and `src/libraries/ExecutionLib.sol` for the v1
scope limit (single-call executions only; batched/delegatecall executions are rejected outright).

## Setup

Dependencies aren't committed (see root `.gitignore`); restore them with:

```bash
forge install foundry-rs/forge-std --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-git --no-commit
git clone --recurse-submodules --branch v3.3 https://github.com/zerodevapp/kernel.git lib/kernel
git clone --recurse-submodules --branch v0.7.0 https://github.com/eth-infinitism/account-abstraction.git lib/account-abstraction
find lib/kernel lib/account-abstraction -maxdepth 2 -name ".git" -exec rm -rf {} +
```

Kernel and account-abstraction are plain `git clone`s (not `forge install`) because Kernel's
`main` branch has moved to soldeer-based dependency management that doesn't resolve cleanly with
`--no-git`; the pinned `v3.3` tag still uses classic `lib/` submodules and matches what's actually
deployed. Both are cloned with `--recurse-submodules` for their own vendored deps (solady,
ExcessivelySafeCall), then stripped of nested `.git` dirs so they sit as plain vendored code
alongside everything else under `lib/`.

## Commands

```bash
forge build
forge test -vv
forge test --match-test PriorityOrder -vvvv     # the priority-order proof (unit)
forge test --match-path "*Kernel*" -vvvv        # the on-chain-rejection proof, real Kernel + EntryPoint
forge coverage
```

## Layout

```
src/
  interfaces/        PackedUserOperation, ERC-7579 module interfaces
  libraries/          ExecutionLib (calldata decode), ERC4337Utils (validationData packing)
  PolicyValidator.sol
test/
  mocks/              MockSessionAccount (isolated ERC-7579 harness), MockERC20
  integration/        PolicyValidatorKernelIntegration.t.sol, real Kernel v3.3 + real EntryPoint v0.7
  PolicyValidator.t.sol
```

## What's proven so far

`test/integration/PolicyValidatorKernelIntegration.t.sol` deploys a genuine ZeroDev Kernel v3.3
smart account (via `KernelFactory`), a genuine ERC-4337 v0.7 `EntryPoint`, and a genuine
`ECDSAValidator` as the owner's root validator, no mocks anywhere in the account layer. It proves,
through real `entrypoint.handleOps()` calls:

- a session-key-signed UserOp for a whitelisted action executes end-to-end (`Kernel.execute` →
  the target contract), and
- a session-key-signed UserOp for a non-whitelisted action is rejected by `PolicyValidator.
  validateUserOp` during validation, which EntryPoint surfaces as `FailedOpWithRevert`, the whole
  batch reverts and the target contract's state is provably unchanged.

Setup (installing `PolicyValidator` with the owner's policy, seeding one initial whitelist entry,
and granting Kernel's own selector gate) happens atomically inside `KernelFactory.createAccount`,
via Kernel's `initConfig` mechanism, this is the owner's own deployment transaction, not something
an agent could reach, so it's realistic to do outside the UserOp/EntryPoint path.

## What's next (Day 6-9)

Wire the agent-facing API (`../api`) to do for real, against a live bundler on Base Sepolia, what
this test does directly against `EntryPoint.handleOps`: build the same `installModule`-bearing
`initData`, deploy through the real `KernelFactory`, and construct/sign/submit real UserOps for the
session key. The module and account-wiring logic proven here does not change for that step, only
the transport (a bundler RPC instead of a direct `handleOps` call in a test).
