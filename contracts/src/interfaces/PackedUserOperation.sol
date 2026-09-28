// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-4337 v0.7 packed user operation, as produced by EntryPoint 0.7 and Kernel v3.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}
