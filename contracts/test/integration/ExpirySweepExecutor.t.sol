// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyValidator} from "../../src/PolicyValidator.sol";
import {ExpirySweepExecutor} from "../../src/ExpirySweepExecutor.sol";

import {Kernel} from "kernel/Kernel.sol";
import {KernelFactory} from "kernel/factory/KernelFactory.sol";
import {ECDSAValidator} from "kernel/validator/ECDSAValidator.sol";
import {IHook, IValidator} from "kernel/interfaces/IERC7579Modules.sol";
import {IEntryPoint as KernelIEntryPoint} from "kernel/interfaces/IEntryPoint.sol";
import {ValidatorLib, ValidationId} from "kernel/utils/ValidationTypeLib.sol";

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";

/// @notice Proves the "funds return to the owner automatically on expiry or force-revoke"
///         guarantee against the real Kernel v3.3 + real EntryPoint stack, the same way
///         PolicyValidatorKernelIntegration.t.sol proves policy enforcement: a genuine Session
///         Vault, created the way production creates one (ExpirySweepExecutor installed alongside
///         PolicyValidator in the same atomic `initConfig`), with sweeps triggered by a plain
///         EOA that is neither the owner nor the session key — proving the mechanism is really
///         permissionless, not just callable by a privileged relayer.
contract ExpirySweepExecutorTest is Test {
    EntryPoint entrypoint;
    KernelFactory factory;
    ECDSAValidator ecdsaValidator;
    PolicyValidator policyValidator;
    ExpirySweepExecutor sweepExecutor;

    address owner;
    uint256 ownerPk = 0xA11CE;
    address sessionKey;
    uint256 sessionKeyPk = 0xB0B5E551;
    address keeper = address(0xBEEF01); // an arbitrary, unprivileged caller

    uint48 validAfter;
    uint48 validUntil;
    uint256 constant NATIVE_CAP = 1 ether;
    uint256 constant MAX_TX = 5;
    uint256 constant VAULT_BALANCE = 3 ether;

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
        sweepExecutor = new ExpirySweepExecutor(address(policyValidator));

        ValidationId rootVId = ValidatorLib.validatorToIdentifier(IValidator(address(ecdsaValidator)));

        bytes memory policyInitData = abi.encode(
            owner, sessionKey, validAfter, validUntil, NATIVE_CAP, MAX_TX, address(0), bytes4(0)
        );

        // installModule(MODULE_TYPE_VALIDATOR=1, policyValidator, ...) — same shape as the
        // sibling integration test.
        bytes memory installPolicyCalldata = abi.encodeWithSelector(
            Kernel.installModule.selector,
            uint256(1),
            address(policyValidator),
            abi.encodePacked(
                address(1), // hook sentinel: none required
                abi.encode(policyInitData, bytes(""), abi.encodePacked(Kernel.execute.selector))
            )
        );

        // installModule(MODULE_TYPE_EXECUTOR=2, sweepExecutor, hookAddr(20B) ++
        // abi.encode(executorData, hookData)) — see Kernel.installModule's MODULE_TYPE_EXECUTOR
        // branch and InstallExecutorDataFormat in kernel/types/Structs.sol. Nothing to configure
        // per-account, so both inner fields are empty.
        bytes memory installSweepCalldata = abi.encodeWithSelector(
            Kernel.installModule.selector,
            uint256(2),
            address(sweepExecutor),
            abi.encodePacked(address(1), abi.encode(bytes(""), bytes("")))
        );

        bytes[] memory initConfig = new bytes[](2);
        initConfig[0] = installPolicyCalldata;
        initConfig[1] = installSweepCalldata;

        bytes memory initData = abi.encodeWithSelector(
            Kernel.initialize.selector,
            rootVId,
            IHook(address(1)),
            abi.encodePacked(owner),
            bytes(""),
            initConfig
        );

        kernelAddr = factory.createAccount(initData, bytes32(0));
        vm.deal(kernelAddr, VAULT_BALANCE);
    }

    function test_Sweep_RevertsBeforeExpiryOrRevoke() public {
        (bool eligible, uint256 amount) = sweepExecutor.sweepable(kernelAddr);
        assertFalse(eligible);
        assertEq(amount, 0);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(ExpirySweepExecutor.NotEligible.selector, kernelAddr));
        sweepExecutor.sweep(kernelAddr);

        assertEq(kernelAddr.balance, VAULT_BALANCE);
    }

    function test_Sweep_AfterExpiry_ReturnsFullBalanceToOwner_CallableByAnyone() public {
        vm.warp(uint256(validUntil) + 1);

        (bool eligible, uint256 amount) = sweepExecutor.sweepable(kernelAddr);
        assertTrue(eligible);
        assertEq(amount, VAULT_BALANCE);

        uint256 ownerBalanceBefore = owner.balance;

        // `keeper` is neither the vault owner nor the session key — anyone can trigger the sweep.
        vm.expectEmit(true, true, true, true, address(sweepExecutor));
        emit ExpirySweepExecutor.Swept(kernelAddr, owner, VAULT_BALANCE, keeper);
        vm.prank(keeper);
        uint256 swept = sweepExecutor.sweep(kernelAddr);

        assertEq(swept, VAULT_BALANCE);
        assertEq(kernelAddr.balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + VAULT_BALANCE);
    }

    function test_Sweep_AfterForceRevoke_WorksImmediately_EvenBeforeExpiry() public {
        // Still well before validUntil — only the revoke makes this eligible.
        vm.prank(owner);
        policyValidator.forceRevoke(kernelAddr);

        (bool eligible,) = sweepExecutor.sweepable(kernelAddr);
        assertTrue(eligible);

        uint256 ownerBalanceBefore = owner.balance;
        vm.prank(keeper);
        sweepExecutor.sweep(kernelAddr);

        assertEq(kernelAddr.balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + VAULT_BALANCE);
    }

    function test_Sweep_RevertsWhenNothingLeftToSweep() public {
        vm.warp(uint256(validUntil) + 1);
        vm.prank(keeper);
        sweepExecutor.sweep(kernelAddr);

        vm.expectRevert(abi.encodeWithSelector(ExpirySweepExecutor.NothingToSweep.selector, kernelAddr));
        sweepExecutor.sweep(kernelAddr);
    }

    function test_Sweep_CannotRedirectFunds_AlwaysGoesToStoredOwner() public {
        // Proves the permissionless call can't be abused to steal funds: the destination is read
        // from PolicyValidator's storage, not caller-supplied, so there is no parameter a
        // malicious keeper could pass to redirect the payout.
        vm.warp(uint256(validUntil) + 1);
        address attacker = address(0xDEAD);
        uint256 attackerBalanceBefore = attacker.balance;

        vm.prank(attacker);
        sweepExecutor.sweep(kernelAddr);

        assertEq(attacker.balance, attackerBalanceBefore); // attacker gained nothing
        assertEq(owner.balance, VAULT_BALANCE); // owner received everything
    }
}
