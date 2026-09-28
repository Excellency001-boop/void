// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC7579Validator, MODULE_TYPE_VALIDATOR} from "./interfaces/IERC7579Module.sol";
import {PackedUserOperation} from "./interfaces/PackedUserOperation.sol";
import {ERC4337Utils} from "./libraries/ERC4337Utils.sol";
import {ExecutionLib} from "./libraries/ExecutionLib.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title PolicyValidator
/// @notice VOID's core on-chain enforcement module. Installed as an ERC-7579 validator on a
///         per-session Kernel smart account (the "Session Vault"), it is the ONLY signer path
///         available to an AI agent's session key. Every action the agent proposes is checked,
///         in a fixed priority order, before the EntryPoint is allowed to execute it:
///
///           1. hard time expiry
///           2. cumulative spend caps (native + specified ERC-20s)
///           3. whitelist of allowed target contracts + function selectors
///           4. max transaction count
///           5. optional rate / per-recipient limits
///
///         Any violation reverts with a specific custom error. That's deliberate: it produces a
///         legible, traceable on-chain rejection — visible in a block explorer or a Foundry trace
///         — instead of a silent "not includable" response from a bundler. The one exception is
///         signature failure, which follows standard ERC-4337 convention (returns
///         SIG_VALIDATION_FAILED rather than reverting) since a bad signature is an auth failure,
///         not a policy verdict, and bundlers rely on being able to simulate that path cheaply.
///
///         The account owner is never subject to this module. They operate through their own
///         root validator (installed separately on the same Kernel account) and can move funds at
///         any time. This module only ever constrains the delegated session key — which is also
///         how "funds return to the owner" is guaranteed structurally rather than by a special
///         sweep function: ownership control never leaves the owner's root key in the first
///         place. See README for how the API layer automates the owner-signed sweep on expiry.
///
/// @dev Accounting tradeoff, stated plainly: spend/tx-count state is committed inside
///      `validateUserOp`, against the *validated intent*, not after the downstream call succeeds.
///      If the actual execution later reverts for an unrelated reason, the budget is still
///      consumed. This mirrors how ERC-4337 nonces work (burned on validation, regardless of
///      execution outcome) and keeps the module a pure validator with no execution-phase hook.
///      Outcome-based accounting via an ERC-7579 hook module is a documented future improvement,
///      not required for the policy-enforcement guarantee itself.
contract PolicyValidator is IERC7579Validator {
    using ECDSA for bytes32;

    // ── Errors ──────────────────────────────────────────────────────────────

    error AlreadyInitialized(address account);
    error NotInitialized(address account);
    error InvalidPolicyData();
    error UnauthorizedCaller(address expected, address actual);
    error NotAccountOwner();
    error SessionRevoked();
    error SessionNotYetValid();
    error SessionExpired();
    error NativeSpendCapExceeded(uint256 requested, uint256 remaining);
    error TokenNotAllowed(address token);
    error TokenSpendCapExceeded(address token, uint256 requested, uint256 remaining);
    error TargetSelectorNotAllowed(address target, bytes4 selector);
    error MaxTxCountExceeded(uint256 limit);
    error RateLimitExceeded(address recipient);

    // ── Storage ─────────────────────────────────────────────────────────────

    struct SessionPolicy {
        address owner; // funds/control belong here; never restricted by this module
        address sessionKey; // the only signer this module accepts for this account
        uint48 validAfter;
        uint48 validUntil; // hard expiry — checked first, always
        uint256 nativeSpendCap;
        uint256 nativeSpent;
        uint256 maxTxCount;
        uint256 txCount;
        bool revoked;
    }

    struct Cap {
        uint256 cap;
        uint256 spent;
    }

    mapping(address account => SessionPolicy) public sessionPolicies;
    mapping(address account => mapping(address token => Cap)) public tokenCaps;
    mapping(address account => mapping(address target => mapping(bytes4 selector => bool))) public allowedSelectors;
    mapping(address account => mapping(address recipient => Cap)) public recipientCaps;

    // ── Module lifecycle (ERC-7579) ──────────────────────────────────────────

    /// @param data abi.encode(address owner, address sessionKey, uint48 validAfter,
    ///        uint48 validUntil, uint256 nativeSpendCap, uint256 maxTxCount,
    ///        address initialTarget, bytes4 initialSelector).
    ///        Further whitelist entries, ERC-20 caps, and recipient caps are configured with
    ///        separate calls to `setAllowedSelector` / `setTokenCap` / `setRecipientCap` — by the
    ///        account itself — any time after install.
    ///
    ///        The trailing (initialTarget, initialSelector) pair exists because Kernel v3 (and
    ///        ERC-7579 "enable mode" generally) installs a non-root validator and authorizes its
    ///        first action in the SAME signed UserOp: our own onInstall runs, then this same
    ///        validator is immediately asked to validate that first action, all before any
    ///        separate owner-signed "add to whitelist" call could possibly land. Without seeding
    ///        one entry here, the first agent action would always be rejected — not because it's
    ///        against policy, but because policy configuration hadn't had a chance to happen yet.
    ///        Pass address(0) to skip seeding and configure the whitelist entirely via
    ///        `setAllowedSelector` afterward instead.
    function onInstall(bytes calldata data) external override {
        address account = msg.sender;
        if (sessionPolicies[account].sessionKey != address(0)) revert AlreadyInitialized(account);
        if (data.length != 256) revert InvalidPolicyData();

        (
            address owner,
            address sessionKey,
            uint48 validAfter,
            uint48 validUntil,
            uint256 nativeSpendCap,
            uint256 maxTxCount,
            address initialTarget,
            bytes4 initialSelector
        ) = abi.decode(data, (address, address, uint48, uint48, uint256, uint256, address, bytes4));

        if (owner == address(0) || sessionKey == address(0) || validUntil <= validAfter) {
            revert InvalidPolicyData();
        }

        if (initialTarget != address(0)) {
            allowedSelectors[account][initialTarget][initialSelector] = true;
        }

        sessionPolicies[account] = SessionPolicy({
            owner: owner,
            sessionKey: sessionKey,
            validAfter: validAfter,
            validUntil: validUntil,
            nativeSpendCap: nativeSpendCap,
            nativeSpent: 0,
            maxTxCount: maxTxCount,
            txCount: 0,
            revoked: false
        });
    }

    function onUninstall(bytes calldata) external override {
        delete sessionPolicies[msg.sender];
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function isInitialized(address smartAccount) public view override returns (bool) {
        return sessionPolicies[smartAccount].sessionKey != address(0);
    }

    // ── Owner-gated policy configuration ─────────────────────────────────────
    // Called by the account itself (msg.sender == account), i.e. routed through the owner's own
    // root validator — never reachable through the session key, since the session key can only
    // ever produce calldata this module accepts as an `execute(...)` action, not a direct call
    // into these setters.

    function setAllowedSelector(address target, bytes4 selector, bool allowed) external {
        _requireInitialized(msg.sender);
        allowedSelectors[msg.sender][target][selector] = allowed;
    }

    function setTokenCap(address token, uint256 cap) external {
        _requireInitialized(msg.sender);
        tokenCaps[msg.sender][token].cap = cap;
    }

    function setRecipientCap(address recipient, uint256 cap) external {
        _requireInitialized(msg.sender);
        recipientCaps[msg.sender][recipient].cap = cap;
    }

    /// @notice Owner-triggered kill switch. Blocks every future session-key action immediately.
    ///         Callable either through the account itself or directly by the stored owner address
    ///         — the direct path exists so a human can cut off a misbehaving agent right away,
    ///         without constructing and signing a UserOp through the very account they're worried
    ///         about. Funds are untouched; they remain under the owner's root-key control.
    function forceRevoke(address account) external {
        SessionPolicy storage policy = sessionPolicies[account];
        if (msg.sender != account && msg.sender != policy.owner) revert NotAccountOwner();
        policy.revoked = true;
    }

    // ── ERC-4337 validation entrypoint ───────────────────────────────────────

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        override
        returns (uint256 validationData)
    {
        address account = userOp.sender;
        if (msg.sender != account) revert UnauthorizedCaller(account, msg.sender);

        SessionPolicy storage policy = sessionPolicies[account];
        if (policy.sessionKey == address(0)) revert NotInitialized(account);

        address recovered = MessageHashUtils.toEthSignedMessageHash(userOpHash).recover(userOp.signature);
        if (recovered != policy.sessionKey) {
            return ERC4337Utils.SIG_VALIDATION_FAILED;
        }

        // Priority 1 — hard time expiry.
        if (policy.revoked) revert SessionRevoked();
        if (block.timestamp < policy.validAfter) revert SessionNotYetValid();
        if (block.timestamp > policy.validUntil) revert SessionExpired();

        ExecutionLib.DecodedAction memory action = ExecutionLib.decodeAction(userOp.callData);

        // Priority 2 — cumulative spend caps (native + specified ERC-20s).
        if (action.value > 0) {
            uint256 remaining = policy.nativeSpendCap - policy.nativeSpent;
            if (action.value > remaining) revert NativeSpendCapExceeded(action.value, remaining);
        }
        if (action.token != address(0) && action.tokenAmount > 0) {
            Cap storage tCap = tokenCaps[account][action.token];
            if (tCap.cap == 0) revert TokenNotAllowed(action.token);
            uint256 remaining = tCap.cap - tCap.spent;
            if (action.tokenAmount > remaining) {
                revert TokenSpendCapExceeded(action.token, action.tokenAmount, remaining);
            }
        }

        // Priority 3 — whitelist of allowed target contracts + function selectors.
        if (!allowedSelectors[account][action.target][action.selector]) {
            revert TargetSelectorNotAllowed(action.target, action.selector);
        }

        // Priority 4 — max transaction count.
        if (policy.txCount >= policy.maxTxCount) revert MaxTxCountExceeded(policy.maxTxCount);

        // Priority 5 — optional rate / per-recipient limits. Zero cap == not configured == skip.
        Cap storage rCap = recipientCaps[account][action.recipient];
        if (rCap.cap > 0) {
            uint256 spendAmount = action.tokenAmount > 0 ? action.tokenAmount : action.value;
            uint256 remaining = rCap.cap - rCap.spent;
            if (spendAmount > remaining) revert RateLimitExceeded(action.recipient);
            rCap.spent += spendAmount;
        }

        // Effects — commit usage against this validated intent (see contract-level NatSpec).
        if (action.value > 0) policy.nativeSpent += action.value;
        if (action.token != address(0) && action.tokenAmount > 0) {
            tokenCaps[account][action.token].spent += action.tokenAmount;
        }
        policy.txCount += 1;

        return ERC4337Utils.packValidationData(false, policy.validUntil, policy.validAfter);
    }

    function isValidSignatureWithSender(address, bytes32, bytes calldata) external pure override returns (bytes4) {
        // This module backs session-key UserOp validation only; it does not implement ERC-1271
        // signature validation for the account.
        return 0xffffffff;
    }

    // ── Views for the API/dashboard ──────────────────────────────────────────

    function remainingNativeBudget(address account) external view returns (uint256) {
        SessionPolicy storage p = sessionPolicies[account];
        return p.nativeSpendCap - p.nativeSpent;
    }

    function remainingTokenBudget(address account, address token) external view returns (uint256) {
        Cap storage t = tokenCaps[account][token];
        return t.cap - t.spent;
    }

    function isExpired(address account) external view returns (bool) {
        return block.timestamp > sessionPolicies[account].validUntil;
    }

    function isRevoked(address account) external view returns (bool) {
        return sessionPolicies[account].revoked;
    }

    function _requireInitialized(address account) internal view {
        if (!isInitialized(account)) revert NotInitialized(account);
    }
}
