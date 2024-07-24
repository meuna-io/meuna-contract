// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AssetConfig is Ownable {

    struct Config {
        string assetName;
        uint256 auctionDiscount;
        uint256 minCollateralRatio;
        bool acceptAsset;
    }

    mapping (address => Config) public assets;

    /// @dev Set configurations. Must be called by owner.
    function setConfigs(address[] calldata addrs, Config[] calldata configs) external onlyOwner {
        uint256 len = addrs.length;
        require(configs.length == len, "bad len");
        for (uint256 idx = 0; idx < len; idx++) {
            require(ERC20(addrs[idx]).decimals() == 18,"decimals not 18");
            assets[addrs[idx]] = Config({
                assetName: configs[idx].assetName,
                auctionDiscount: configs[idx].auctionDiscount,
                minCollateralRatio: configs[idx].minCollateralRatio,
                acceptAsset : configs[idx].acceptAsset
            });
        }
    }

    function getAccepAsset(address asset) external view returns(bool) {
        return assets[asset].acceptAsset;
    }

    function getMinCollateralRatio(address asset) external view returns (uint256) {
        return assets[asset].minCollateralRatio;
    }

    function getAuction(address asset) external view returns (uint256) {
        return assets[asset].auctionDiscount;
    }

   
}
