// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';

contract CollateralConfig is Ownable {

    struct Config {
        string collateralName;
        uint256 multipier; // 10^5 133334
        bool acceptCollateral;
    }

    mapping (address => Config) public collaterals;

    /// @dev Set configurations. Must be called by owner.
    function setConfigs(address[] calldata addrs, Config[] calldata configs) external onlyOwner {
        uint256 len = addrs.length;
        require(configs.length == len, "bad len");
        for (uint256 idx = 0; idx < len; idx++) {
            collaterals[addrs[idx]] = Config({
                collateralName: configs[idx].collateralName,
                multipier: configs[idx].multipier,
                acceptCollateral: configs[idx].acceptCollateral
            });
        }
    }

    function getAccepCollateral(address collateral) external view returns(bool) {
        return collaterals[collateral].acceptCollateral;
    }

    function getMultipier(address collateral) external view returns (uint256) {
        return collaterals[collateral].multipier;
    }

   
}
