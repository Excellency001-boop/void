// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-4337 validationData packing helpers and well-known return constants.
library ERC4337Utils {
    uint256 internal constant SIG_VALIDATION_SUCCESS = 0;
    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    /// @dev Packs (sigFailed, validUntil, validAfter) into the uint256 layout EntryPoint expects:
    ///      bit 0            = authorizer/sigFailed flag
    ///      bits [160,208)   = validUntil
    ///      bits [208,256)   = validAfter
    function packValidationData(bool sigFailed, uint48 validUntil, uint48 validAfter)
        internal
        pure
        returns (uint256)
    {
        return (sigFailed ? 1 : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }
}
