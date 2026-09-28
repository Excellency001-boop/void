// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyValidator} from "../../src/PolicyValidator.sol";

import {Kernel} from "kernel/Kernel.sol";
import {KernelFactory} from "kernel/factory/KernelFactory.sol";
import {ECDSAValidator} from "kernel/validator/ECDSAValidator.sol";
import {IHook, IValidator} from "kernel/interfaces/IERC7579Modules.sol";
import {IEntryPoint as KernelIEntryPoint} from "kernel/interfaces/IEntryPoint.sol";
import {ValidatorLib, ValidationId} from "kernel/utils/ValidationTypeLib.sol";

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockCallee {
    uint256 public value;

    function setValue(uint256 v) external {
        value = v;
    }
}

/// @notice Proves VOID's core claim against the REAL artifacts, not mocks: a genuine ZeroDev
///         Kernel v3.3 smart account, a genuine ERC-4337 v0.7 EntryPoint, and our own
///         PolicyValidator installed exactly the way production would install it.
///
///         Setup (owner deploying a pre-configured Session Vault) happens through
///         `KernelFactory.createAccount` directly — realistic, since that's the owner's own
///         transaction, not something an agent could reach. Everything the AGENT does from that
///         point on goes through `entrypoint.handleOps`, the actual ERC-4337 execution path: a
///         legal action lands on-chain, an illegal one is rejected by `PolicyValidator.
///         validateUserOp` before the EntryPoint will let it execute, and the batch reverts with
///         the target's state provably unchanged.
contract PolicyValidatorKernelIntegrationTest is Test {
    EntryPoint entrypoint;
    KernelFactory factory;
    ECDSAValidator ecdsaValidator;
    PolicyValidator policyValidator;

    MockCallee callee;
    MockCallee otherCallee;

    address owner;
    uint256 ownerPk = 0xA11CE;
    address sessionKey;
    uint256 sessionKeyPk = 0xB0B5E551;

    uint48 validAfter;
    uint48 validUntil;
    uint256 constant NATIVE_CAP = 1 ether;
    uint256 constant MAX_TX = 5;

    address kernelAddr;

    function setUp() public {
        owner = vm.addr(ownerPk);
        sessionKey = vm.addr(sessionKeyPk);
        validAfter = uint48(block.timestamp);
        validUntil = uint48(block.timestamp + 1 days);

        entrypoint = new EntryPoint();
        Kernel kernelImpl = new Kernel(KernelIEntryPoint(address(entrypoint)));
        factory = new KernelFactory(address(kernelImpl));
        ecdsaValidator = new ECDSAValidator();
        policyValidator = new PolicyValidator();
        callee = new MockCallee();
        otherCallee = new MockCallee();

        ValidationId rootVId = ValidatorLib.validatorToIdentifier(IValidator(address(ecdsaValidator)));

        // Owner seeds one initial permission (callee.setValue) atomically with install — see the
        // NatSpec on PolicyValidator.onInstall for why that's necessary under Kernel's module model.
        bytes memory policyInitData = abi.encode(
            owner, sessionKey, validAfter, validUntil, NATIVE_CAP, MAX_TX, address(callee), MockCallee.setValue.selector
        );

        // installModule(MODULE_TYPE_VALIDATOR=1, module, initData) where
        // initData = hookAddr(20 bytes) ++ abi.encode(validatorData, hookData, selectorData).
        // A 4-byte selectorData grants that top-level selector access on Kernel's own gate in the
        // same call — see Kernel.installModule's MODULE_TYPE_VALIDATOR branch.
        bytes memory installPolicyCalldata = abi.encodeWithSelector(
            Kernel.installModule.selector,
            uint256(1),
            address(policyValidator),
            abi.encodePacked(
                address(1), // hook sentinel: none required
                abi.encode(policyInitData, bytes(""), abi.encodePacked(Kernel.execute.selector))
            )
        );

        bytes[] memory initConfig = new bytes[](1);
        initConfig[0] = installPolicyCalldata;

        bytes memory initData = abi.encodeWithSelector(
            Kernel.initialize.selector,
            rootVId,
            IHook(address(1)), // no hook on the root validator
            abi.encodePacked(owner), // ECDSAValidator.onInstall data
            bytes(""),
            initConfig
        );

        kernelAddr = factory.createAccount(initData, bytes32(0));
        vm.deal(kernelAddr, 10 ether);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _policyNonce() internal view returns (uint256) {
        uint192 key = ValidatorLib.encodeAsNonceKey(0x00, 0x01, bytes20(address(policyValidator)), 0);
        return entrypoint.getNonce(kernelAddr, key);
    }

    function _execSingle(address target, uint256 value, bytes memory innerCallData)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory executionCalldata = abi.encodePacked(target, value, innerCallData);
        return abi.encodeWithSelector(Kernel.execute.selector, bytes32(0), executionCalldata);
    }

    function _buildOp(uint256 nonce, bytes memory callData) internal view returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: kernelAddr,
            nonce: nonce,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(abi.encodePacked(uint128(2_000_000), uint128(2_000_000))),
            preVerificationGas: 200_000,
            gasFees: bytes32(abi.encodePacked(uint128(1 gwei), uint128(1 gwei))),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _signWithSessionKey(PackedUserOperation memory op) internal view returns (bytes memory) {
        bytes32 userOpHash = entrypoint.getUserOpHash(op);
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ── the two claims that matter ───────────────────────────────────────────

    function test_LegalAgentAction_ExecutesViaRealKernelAndEntryPoint() public {
        bytes memory callData =
            _execSingle(address(callee), 0, abi.encodeWithSelector(MockCallee.setValue.selector, 42));
        PackedUserOperation memory op = _buildOp(_policyNonce(), callData);
        op.signature = _signWithSessionKey(op);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        entrypoint.handleOps(ops, payable(address(0xdeadbeef)));

        assertEq(callee.value(), 42);
    }

    function test_IllegalAgentAction_RejectedOnChain() public {
        // otherCallee was never whitelisted — only (callee, setValue) was seeded at install time.
        bytes memory callData =
            _execSingle(address(otherCallee), 0, abi.encodeWithSelector(MockCallee.setValue.selector, 999));
        PackedUserOperation memory op = _buildOp(_policyNonce(), callData);
        op.signature = _signWithSessionKey(op);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        // PolicyValidator.validateUserOp reverts with TargetSelectorNotAllowed; EntryPoint has no
        // try/catch around the validation phase, so the whole batch reverts — the agent gets
        // nothing, not even a partial state change.
        vm.expectRevert();
        entrypoint.handleOps(ops, payable(address(0xdeadbeef)));

        assertEq(otherCallee.value(), 0);
    }
}
