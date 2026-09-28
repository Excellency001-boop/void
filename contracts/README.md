# VOID contracts

`PolicyValidator` is an ERC-7579 validator module: installed on a per-session Kernel v3 smart
account (the "Session Vault"), it is the only signer path available to an AI agent's session key,
and it enforces the owner's policy on every proposed action in a fixed priority order:

1. hard time expiry
2. cumulative spend caps (native + specified ERC-20s)
3. whitelist of allowed target contracts + function selectors
4. max transaction count
5. optional rate / per-recipient limits

Any violation reverts `validateUserOp` with a specific custom error — a legible, traceable
on-chain rejection, not a silent bundler drop. See the NatSpec on `src/PolicyValidator.sol` for the
accounting/signature-failure design tradeoffs, and `src/libraries/ExecutionLib.sol` for the v1
scope limit (single-call executions only; batched/delegatecall executions are rejected outright).

## Setup

Dependencies aren't committed (see root `.gitignore`); restore them with:

```bash
forge install foundry-rs/forge-std --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-git --no-commit
```

## Commands

```bash
forge build
forge test -vv
forge test --match-test PriorityOrder -vvvv   # the on-chain-rejection proof
forge coverage
```

## Layout

```
src/
  interfaces/       PackedUserOperation, ERC-7579 module interfaces
  libraries/         ExecutionLib (calldata decode), ERC4337Utils (validationData packing)
  PolicyValidator.sol
test/
  mocks/             MockSessionAccount (ERC-7579 test harness), MockERC20
  PolicyValidator.t.sol
```

## What's next (Day 4-6)

Swap `MockSessionAccount` for a real ZeroDev Kernel v3 deployment on Base Sepolia, install
`PolicyValidator` as its validator, and wire the agent-facing API (`../api`) to build, sign, and
submit real UserOps through a bundler. The module code above does not change for that step — only
what's calling it.
