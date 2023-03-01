// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ICollateralConfig {

    function getAccepCollateral(address collateral) external view returns (bool);

    function getMultipier(address collateral) external view returns (uint256);


}
