// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyValidator} from "../src/PolicyValidator.sol";
import {ExecutionLib} from "../src/libraries/ExecutionLib.sol";
import {ERC4337Utils} from "../src/libraries/ERC4337Utils.sol";
import {PackedUserOperation} from "../src/interfaces/PackedUserOperation.sol";
import {MockSessionAccount} from "./mocks/MockSessionAccount.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Proves the one claim VOID actually stands on: an agent's session key cannot produce a
///         valid UserOp for anything outside the policy the owner configured. Every violation
///         path below asserts a revert with a *specific* custom error — not a generic failure —
///         because the priority-order requirement (expiry > spend cap > whitelist > tx count >
///         rate limit) can only be proven by checking exactly which rule fired when several are
///         violated at once. See `test_PriorityOrder_ExpiryWinsOverWhitelist`.
contract PolicyValidatorTest is Test {
    PolicyValidator internal validator;
    MockSessionAccount internal account;
    MockERC20 internal token;

    address internal owner = makeAddr("owner");
    uint256 internal sessionKeyPk = 0xA11CE;
    address internal sessionKey;
    address internal target = makeAddr("dapp");
    address internal recipient = makeAddr("recipient");

    uint48 internal validAfter;
    uint48 internal validUntil;
    uint256 internal constant NATIVE_CAP = 1 ether;
    uint256 internal constant TOKEN_CAP = 100e18;
    uint256 internal constant MAX_TX = 3;

    bytes4 internal constant ALLOWED_SELECTOR = bytes4(keccak256("doThing()"));

    function setUp() public {
        sessionKey = vm.addr(sessionKeyPk);
        validator = new PolicyValidator();
        account = new MockSessionAccount(address(validator));
        token = new MockERC20();

        validAfter = uint48(block.timestamp);
        validUntil = uint48(block.timestamp + 1 days);

        account.install(abi.encode(owner, sessionKey, validAfter, validUntil, NATIVE_CAP, MAX_TX));

        account.configure(
            abi.encodeWithSelector(PolicyValidator.setAllowedSelector.selector, target, ALLOWED_SELECTOR, true)
        );
        account.configure(abi.encodeWithSelector(PolicyValidator.setTokenCap.selector, address(token), TOKEN_CAP));
        account.configure(
            abi.encodeWithSelector(
                PolicyValidator.setAllowedSelector.selector, address(token), IERC20.transfer.selector, true
            )
        );
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _sign(uint256 pk, bytes32 userOpHash) internal pure returns (bytes memory) {
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _buildUserOp(address _target, uint256 value, bytes memory innerCallData)
        internal
        view
        returns (PackedUserOperation memory)
    {
        bytes memory executionCalldata = abi.encodePacked(_target, value, innerCallData);
        bytes memory callData = abi.encodeWithSelector(ExecutionLib.EXECUTE_SELECTOR, bytes32(0), executionCalldata);

        return PackedUserOperation({
            sender: address(account),
            nonce: 0,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _signed(address _target, uint256 value, bytes memory innerCallData, bytes32 hash)
        internal
        view
        returns (PackedUserOperation memory userOp)
    {
        userOp = _buildUserOp(_target, value, innerCallData);
        userOp.signature = _sign(sessionKeyPk, hash);
    }

    // ── happy path ────────────────────────────────────────────────────────────

    function test_AllowedAction_SucceedsAndUpdatesState() public {
        bytes32 hash = keccak256("op-1");
        PackedUserOperation memory userOp =
            _signed(target, 0.1 ether, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        uint256 validationData = account.validateUserOp(userOp, hash);
        assertEq(validationData & 1, 0, "sig should be valid");

        assertEq(validator.remainingNativeBudget(address(account)), NATIVE_CAP - 0.1 ether);
        (,,,,,,, uint256 txCount,) = validator.sessionPolicies(address(account));
        assertEq(txCount, 1);
    }

    function test_AllowedErc20Transfer_SucceedsAndDecrementsTokenCap() public {
        bytes memory transferCall = abi.encodeWithSelector(IERC20.transfer.selector, recipient, 40e18);
        bytes32 hash = keccak256("op-erc20");
        PackedUserOperation memory userOp = _signed(address(token), 0, transferCall, hash);

        account.validateUserOp(userOp, hash);

        assertEq(validator.remainingTokenBudget(address(account), address(token)), TOKEN_CAP - 40e18);
    }

    // ── priority 1: hard time expiry ─────────────────────────────────────────

    function test_RevertWhen_Expired() public {
        vm.warp(uint256(validUntil) + 1);
        bytes32 hash = keccak256("op-expired");
        PackedUserOperation memory userOp = _signed(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(PolicyValidator.SessionExpired.selector);
        account.validateUserOp(userOp, hash);
    }

    function test_RevertWhen_NotYetValid() public {
        // Fresh account/policy with a validAfter in the future, to exercise this branch in
        // isolation from the (already-active) `account` used by every other test.
        MockSessionAccount freshAccount = new MockSessionAccount(address(validator));
        uint48 futureStart = uint48(block.timestamp + 1 hours);
        freshAccount.install(abi.encode(owner, sessionKey, futureStart, futureStart + 1 days, NATIVE_CAP, MAX_TX));
        freshAccount.configure(
            abi.encodeWithSelector(PolicyValidator.setAllowedSelector.selector, target, ALLOWED_SELECTOR, true)
        );

        bytes32 hash = keccak256("op-not-yet-valid");
        PackedUserOperation memory userOp = _buildUserOp(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR));
        userOp.sender = address(freshAccount);
        userOp.signature = _sign(sessionKeyPk, hash);

        vm.expectRevert(PolicyValidator.SessionNotYetValid.selector);
        freshAccount.validateUserOp(userOp, hash);
    }

    // ── priority 2: cumulative spend caps ────────────────────────────────────

    function test_RevertWhen_NativeCapExceeded() public {
        bytes32 hash = keccak256("op-nativecap");
        PackedUserOperation memory userOp = _signed(target, 2 ether, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(
            abi.encodeWithSelector(PolicyValidator.NativeSpendCapExceeded.selector, 2 ether, NATIVE_CAP)
        );
        account.validateUserOp(userOp, hash);
    }

    function test_RevertWhen_TokenCapExceeded() public {
        bytes memory transferCall = abi.encodeWithSelector(IERC20.transfer.selector, recipient, 200e18);
        bytes32 hash = keccak256("op-tokencap");
        PackedUserOperation memory userOp = _signed(address(token), 0, transferCall, hash);

        vm.expectRevert(
            abi.encodeWithSelector(PolicyValidator.TokenSpendCapExceeded.selector, address(token), 200e18, TOKEN_CAP)
        );
        account.validateUserOp(userOp, hash);
    }

    function test_RevertWhen_TokenNotConfigured() public {
        MockERC20 otherToken = new MockERC20();
        account.configure(
            abi.encodeWithSelector(
                PolicyValidator.setAllowedSelector.selector, address(otherToken), IERC20.transfer.selector, true
            )
        );

        bytes memory transferCall = abi.encodeWithSelector(IERC20.transfer.selector, recipient, 1e18);
        bytes32 hash = keccak256("op-unconfigured-token");
        PackedUserOperation memory userOp = _signed(address(otherToken), 0, transferCall, hash);

        vm.expectRevert(abi.encodeWithSelector(PolicyValidator.TokenNotAllowed.selector, address(otherToken)));
        account.validateUserOp(userOp, hash);
    }

    // ── priority 3: target + selector whitelist ──────────────────────────────

    function test_RevertWhen_TargetNotWhitelisted() public {
        address randomTarget = makeAddr("random-target");
        bytes32 hash = keccak256("op-badtarget");
        PackedUserOperation memory userOp = _signed(randomTarget, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(
            abi.encodeWithSelector(PolicyValidator.TargetSelectorNotAllowed.selector, randomTarget, ALLOWED_SELECTOR)
        );
        account.validateUserOp(userOp, hash);
    }

    function test_RevertWhen_SelectorNotWhitelisted() public {
        bytes4 badSelector = bytes4(keccak256("evil()"));
        bytes32 hash = keccak256("op-badselector");
        PackedUserOperation memory userOp = _signed(target, 0, abi.encodeWithSelector(badSelector), hash);

        vm.expectRevert(abi.encodeWithSelector(PolicyValidator.TargetSelectorNotAllowed.selector, target, badSelector));
        account.validateUserOp(userOp, hash);
    }

    // ── priority 4: max transaction count ────────────────────────────────────

    function test_RevertWhen_MaxTxCountExceeded() public {
        for (uint256 i = 0; i < MAX_TX; i++) {
            bytes32 hash = keccak256(abi.encode("op-count", i));
            PackedUserOperation memory userOp = _signed(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);
            account.validateUserOp(userOp, hash);
        }

        bytes32 hashOver = keccak256("op-over-limit");
        PackedUserOperation memory userOpOver =
            _signed(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hashOver);

        vm.expectRevert(abi.encodeWithSelector(PolicyValidator.MaxTxCountExceeded.selector, MAX_TX));
        account.validateUserOp(userOpOver, hashOver);
    }

    // ── priority 5: optional rate / per-recipient limits ─────────────────────

    function test_RevertWhen_RecipientCapExceeded() public {
        account.configure(abi.encodeWithSelector(PolicyValidator.setRecipientCap.selector, target, 0.05 ether));

        bytes32 hash = keccak256("op-ratelimit");
        PackedUserOperation memory userOp = _signed(target, 0.1 ether, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(abi.encodeWithSelector(PolicyValidator.RateLimitExceeded.selector, target));
        account.validateUserOp(userOp, hash);
    }

    // ── priority ordering proof ───────────────────────────────────────────────

    function test_PriorityOrder_ExpiryWinsOverWhitelist() public {
        vm.warp(uint256(validUntil) + 1);
        address randomTarget = makeAddr("random-priority-target");
        bytes32 hash = keccak256("op-priority-expiry-vs-whitelist");
        // This op violates BOTH expiry (session is over) AND the whitelist (target was never
        // allowed). Expiry must be reported, proving it's checked first.
        PackedUserOperation memory userOp =
            _signed(randomTarget, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(PolicyValidator.SessionExpired.selector);
        account.validateUserOp(userOp, hash);
    }

    function test_PriorityOrder_SpendCapWinsOverWhitelist() public {
        address randomTarget = makeAddr("random-priority-target-2");
        bytes32 hash = keccak256("op-priority-spend-vs-whitelist");
        // Violates BOTH the native spend cap AND the whitelist (target never allowed).
        // Spend cap (priority 2) must fire before whitelist (priority 3).
        PackedUserOperation memory userOp =
            _signed(randomTarget, 2 ether, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(
            abi.encodeWithSelector(PolicyValidator.NativeSpendCapExceeded.selector, 2 ether, NATIVE_CAP)
        );
        account.validateUserOp(userOp, hash);
    }

    // ── revocation ────────────────────────────────────────────────────────────

    function test_RevertWhen_RevokedByOwnerDirectly() public {
        vm.prank(owner);
        validator.forceRevoke(address(account));

        bytes32 hash = keccak256("op-revoked");
        PackedUserOperation memory userOp = _signed(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(PolicyValidator.SessionRevoked.selector);
        account.validateUserOp(userOp, hash);
    }

    function test_RevertWhen_NonOwnerTriesToRevoke() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(PolicyValidator.NotAccountOwner.selector);
        validator.forceRevoke(address(account));
    }

    // ── signature handling ────────────────────────────────────────────────────

    function test_WrongSigner_ReturnsFailedNotRevert() public {
        uint256 wrongPk = 0xBEEF;
        bytes32 hash = keccak256("op-badsig");
        PackedUserOperation memory userOp = _buildUserOp(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR));
        userOp.signature = _sign(wrongPk, hash);

        uint256 validationData = account.validateUserOp(userOp, hash);
        assertEq(validationData, ERC4337Utils.SIG_VALIDATION_FAILED);
    }

    // ── caller authorization ──────────────────────────────────────────────────

    function test_RevertWhen_CalledDirectlyNotThroughAccount() public {
        bytes32 hash = keccak256("op-unauthorized-caller");
        PackedUserOperation memory userOp = _signed(target, 0, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        vm.expectRevert(
            abi.encodeWithSelector(PolicyValidator.UnauthorizedCaller.selector, address(account), address(this))
        );
        validator.validateUserOp(userOp, hash);
    }

    // ── fuzzing the spend-cap boundary ────────────────────────────────────────

    function testFuzz_NativeSpendCapBoundary(uint96 amount) public {
        vm.assume(amount > 0);
        bytes32 hash = keccak256(abi.encode("op-fuzz", amount));
        PackedUserOperation memory userOp = _signed(target, amount, abi.encodeWithSelector(ALLOWED_SELECTOR), hash);

        if (amount > NATIVE_CAP) {
            vm.expectRevert(
                abi.encodeWithSelector(PolicyValidator.NativeSpendCapExceeded.selector, amount, NATIVE_CAP)
            );
            account.validateUserOp(userOp, hash);
        } else {
            account.validateUserOp(userOp, hash);
            assertEq(validator.remainingNativeBudget(address(account)), NATIVE_CAP - amount);
        }
    }
}
