// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IShort {
    function openShort(uint256 positionId,address asset,address colleteral,uint256 amount,address user) external;

    function increaseShort(uint256 positionId,address asset,address colleteral,uint256 amount,address user) external;
    
    function unlock(uint256 positionId) external;

    function decreaseShortToken(address asset,uint256 amount,address user) external;

    function afterAuction(uint256 positionId,address asset,uint256 amount,address user) external;
}
