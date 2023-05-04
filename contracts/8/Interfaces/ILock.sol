// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ILock {

    function lockPosition(uint256 positionId,address receiver) external;

    function releasePosition(uint256 positionId) external;

    function increaseLock(uint256 positionId,address receiver) external;
}
