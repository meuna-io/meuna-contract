// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IPriceOracle {
    /// @dev Return the wad price of token0/token1, multiplied by 1e18
    /// NOTE: (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token) external view
        returns (uint256 price, uint256 lastUpdate);
}
