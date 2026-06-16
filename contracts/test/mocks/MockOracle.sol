// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITransferVerifier} from "../../src/AevumAgenticID.sol";

/// @title MockOracle
/// @notice Test double for the TEE oracle. Returns whatever the test sets.
contract MockOracle is ITransferVerifier {
    bool public shouldVerify = true;
    bool public cloneShouldVerify = true;

    function setShouldVerify(bool v) external {
        shouldVerify = v;
    }

    function setCloneShouldVerify(bool v) external {
        cloneShouldVerify = v;
    }

    function verifyTransfer(
        address,
        address,
        uint256,
        bytes calldata,
        bytes calldata
    ) external view override returns (bool) {
        return shouldVerify;
    }

    function verifyClone(
        address,
        uint256,
        bytes calldata,
        bytes calldata
    ) external view override returns (bool) {
        return cloneShouldVerify;
    }
}
