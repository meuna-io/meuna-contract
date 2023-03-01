// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAssetConfig {

    function getAccepAsset(address asset) external view returns (bool);

    function getMinCollateralRatio(address asset) external view returns (uint256);

    function getAuction(address asset) external view returns (uint256);

}
