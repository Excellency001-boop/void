// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC7579Module, MODULE_TYPE_EXECUTOR} from "./interfaces/IERC7579Module.sol";
import {PolicyValidator} from "./PolicyValidator.sol";

/// @notice Minimal slice of ERC-7579's account interface this module needs: the one entry point
///         an installed executor module is allowed to call directly, without any UserOp signature
///         at all. `mode` is Kernel's `ExecMode` — a user-defined `bytes32` wrapper — so the raw
///         `bytes32` type here produces the identical selector.
interface IERC7579AccountExecutor {
    function executeFromExecutor(bytes32 mode, bytes calldata executionCalldata)
        external
        payable
        returns (bytes[] memory returnData);
}

/// @title ExpirySweepExecutor
/// @notice Fulfills the "funds return to the owner automatically on expiry or force-revoke"
///         requirement with an actual on-chain mechanism, not just a manual path the owner
///         remembers to use. Installed as an ERC-7579 executor module alongside PolicyValidator
///         on every Session Vault, it exposes one permissionless function: `sweep`. Anyone —
///         a keeper bot, the dashboard, the owner themselves — can call it once a session is
///         expired or revoked, and it moves the vault's full native balance to the owner.
///
/// @dev Why permissionless is safe here, not a vulnerability: the destination address is never
///      caller-supplied. It's read directly from PolicyValidator's own storage for that account
///      (`sessionPolicies[account].owner`), the same owner the session was created with and the
///      same owner PolicyValidator itself already treats as the account's ultimate authority. A
///      caller can trigger the sweep, but can never redirect it — this only ever moves funds to
///      the address that already owns them, earlier than the owner might otherwise get around to
///      it themselves.
///
///      Scope, deliberately: native ETH only, matching the native-only spend-cap accounting
///      PolicyValidator already does in v1. ERC-20 balances left in an expired vault are not
///      swept by this module — the owner's own root key can always move those directly, since
///      (per PolicyValidator's NatSpec) the owner is never restricted by this system in the first
///      place.
contract ExpirySweepExecutor is IERC7579Module {
    PolicyValidator public immutable policyValidator;

    event Swept(address indexed account, address indexed owner, uint256 amount, address indexed caller);

    error NotEligible(address account);
    error NothingToSweep(address account);

    constructor(address _policyValidator) {
        policyValidator = PolicyValidator(_policyValidator);
    }

    // ── Module lifecycle (ERC-7579) ──────────────────────────────────────────
    // Nothing to configure per-account: eligibility is read live from PolicyValidator's own
    // storage on every call, so there's no separate state for this module to initialize.

    function onInstall(bytes calldata) external override {}

    function onUninstall(bytes calldata) external override {}

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address) external pure override returns (bool) {
        return true;
    }

    // ── The sweep ─────────────────────────────────────────────────────────────

    /// @notice Returns whether `account`'s session is currently sweepable and, if so, how much.
    ///         Read-only — exists so the API/dashboard/a keeper can check before spending gas on a
    ///         call that would revert.
    function sweepable(address account) public view returns (bool eligible, uint256 amount) {
        (address owner,,, uint48 validUntil,,,,, bool revoked) = policyValidator.sessionPolicies(account);
        eligible = owner != address(0) && (revoked || block.timestamp > validUntil);
        amount = eligible ? account.balance : 0;
    }

    /// @notice Sweeps `account`'s full native balance to its policy owner. Permissionless — see
    ///         contract-level NatSpec for why that's safe. Reverts if the session is still active
    ///         (not expired, not revoked) or if there's nothing to move.
    function sweep(address account) external returns (uint256 amount) {
        (address owner,,, uint48 validUntil,,,,, bool revoked) = policyValidator.sessionPolicies(account);
        if (owner == address(0) || (!revoked && block.timestamp <= validUntil)) revert NotEligible(account);

        amount = account.balance;
        if (amount == 0) revert NothingToSweep(account);

        bytes memory executionCalldata = abi.encodePacked(owner, amount, bytes(""));
        IERC7579AccountExecutor(account).executeFromExecutor(bytes32(0), executionCalldata);

        emit Swept(account, owner, amount, msg.sender);
    }
}
