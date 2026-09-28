// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PackedUserOperation} from "../../src/interfaces/PackedUserOperation.sol";
import {IERC7579Validator} from "../../src/interfaces/IERC7579Module.sol";

/// @notice Minimal ERC-7579-shaped test harness — just enough surface for Foundry to drive
///         PolicyValidator exactly the way a real Kernel v3 account would: `onInstall` / config
///         calls made as the account itself, and `validateUserOp` routed through the account so
///         `msg.sender` inside the module is the account address, matching production behavior.
///
///         This is NOT a real ERC-4337 account — no EntryPoint, no real `execute`, no other
///         validators. Day 4-6 of the build swaps this out for a real Kernel v3 deployment; the
///         module code under test does not change, only what's calling it.
contract MockSessionAccount {
    address public immutable validator;

    constructor(address _validator) {
        validator = _validator;
    }

    function install(bytes calldata data) external {
        (bool ok, bytes memory ret) = validator.call(abi.encodeWithSignature("onInstall(bytes)", data));
        if (!ok) _bubbleRevert(ret);
    }

    /// @dev Generic relay for the owner-gated setters (setAllowedSelector / setTokenCap /
    ///      setRecipientCap / onUninstall) — callData is pre-encoded by the caller.
    function configure(bytes calldata callData) external {
        (bool ok, bytes memory ret) = validator.call(callData);
        if (!ok) _bubbleRevert(ret);
    }

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external returns (uint256) {
        return IERC7579Validator(validator).validateUserOp(userOp, userOpHash);
    }

    function _bubbleRevert(bytes memory ret) private pure {
        assembly {
            revert(add(ret, 32), mload(ret))
        }
    }
}
