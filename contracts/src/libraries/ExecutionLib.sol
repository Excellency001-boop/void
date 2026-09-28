// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Decodes the ERC-7579 single-call `execute(bytes32 mode, bytes executionCalldata)`
///         shape that Kernel v3 (and every other ERC-7579 account) produces for a plain agent
///         action, and extracts the fields PolicyValidator needs to enforce policy: the target
///         contract, native value, function selector, and — for the two ERC-20 methods VOID
///         meters in v1 (`transfer`, `approve`) — the token, counterparty, and amount.
///
/// @dev v1 scope, deliberately: only CALLTYPE_SINGLE / EXECTYPE_DEFAULT is supported. Batched
///      and delegatecall executions are rejected outright — supporting them safely means
///      policy-checking every sub-call in the batch, which is real scope, not a hackathon-week
///      corner to cut silently. It's the first thing to add once the single-call path is
///      demo-proven.
///
///      All decoding here works on `bytes calldata` slices end-to-end (no `abi.decode` into
///      `bytes memory` for the outer structure) so there are zero unnecessary copies and no need
///      for hand-rolled assembly memory slicing.
library ExecutionLib {
    bytes1 internal constant CALLTYPE_SINGLE = 0x00;
    bytes1 internal constant EXECTYPE_DEFAULT = 0x00;

    bytes4 internal constant EXECUTE_SELECTOR = bytes4(keccak256("execute(bytes32,bytes)"));
    bytes4 internal constant ERC20_TRANSFER_SELECTOR = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 internal constant ERC20_APPROVE_SELECTOR = bytes4(keccak256("approve(address,uint256)"));

    error UnsupportedCallType(bytes1 callType);
    error UnsupportedExecType(bytes1 execType);
    error MalformedExecutionCalldata();

    struct DecodedAction {
        address target;
        uint256 value;
        bytes4 selector;
        address token; // non-zero only for the metered ERC-20 methods below
        address recipient; // "to" for transfer, "spender" for approve, else == target
        uint256 tokenAmount; // decoded transfer/approve amount, else 0
    }

    function decodeAction(bytes calldata accountCallData) internal pure returns (DecodedAction memory action) {
        if (accountCallData.length < 4 || bytes4(accountCallData[0:4]) != EXECUTE_SELECTOR) {
            revert MalformedExecutionCalldata();
        }

        bytes calldata args = accountCallData[4:];
        if (args.length < 64) revert MalformedExecutionCalldata();

        bytes32 mode = bytes32(args[0:32]);
        uint256 dataOffset = uint256(bytes32(args[32:64]));
        if (dataOffset + 32 > args.length) revert MalformedExecutionCalldata();

        uint256 execLen = uint256(bytes32(args[dataOffset:dataOffset + 32]));
        uint256 execStart = dataOffset + 32;
        if (execStart + execLen > args.length) revert MalformedExecutionCalldata();

        bytes calldata executionCalldata = args[execStart:execStart + execLen];

        bytes1 callType = bytes1(mode);
        bytes1 execType = mode[1];
        if (callType != CALLTYPE_SINGLE) revert UnsupportedCallType(callType);
        if (execType != EXECTYPE_DEFAULT) revert UnsupportedExecType(execType);

        // ERC-7579 single-call encoding is packed, not ABI-encoded: target(20) ++ value(32) ++ callData(rest).
        if (executionCalldata.length < 52) revert MalformedExecutionCalldata();

        address target = address(bytes20(executionCalldata[0:20]));
        uint256 value = uint256(bytes32(executionCalldata[20:52]));
        bytes calldata innerCallData = executionCalldata[52:];

        bytes4 selector = innerCallData.length >= 4 ? bytes4(innerCallData[0:4]) : bytes4(0);

        address token;
        address recipient = target;
        uint256 tokenAmount;

        if (selector == ERC20_TRANSFER_SELECTOR && innerCallData.length >= 68) {
            (address to, uint256 amount) = abi.decode(innerCallData[4:], (address, uint256));
            token = target;
            recipient = to;
            tokenAmount = amount;
        } else if (selector == ERC20_APPROVE_SELECTOR && innerCallData.length >= 68) {
            (address spender, uint256 amount) = abi.decode(innerCallData[4:], (address, uint256));
            token = target;
            recipient = spender;
            tokenAmount = amount;
        }

        action = DecodedAction({
            target: target,
            value: value,
            selector: selector,
            token: token,
            recipient: recipient,
            tokenAmount: tokenAmount
        });
    }
}
