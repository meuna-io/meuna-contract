// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import '@openzeppelin/contracts/access/Ownable.sol';

contract PriceOracle is Ownable {
    event PriceUpdate(address indexed token, uint256 price);

    struct PriceData {
        uint256 price;
        uint256 lastUpdate;
    }

    /// @notice Public price data mapping storage.
    mapping (address => PriceData) public store;

    /// @dev Set the prices of the token token pairs. Must be called by the owner.
    function setPrices(
        address[] calldata tokens,
        uint256[] calldata prices
    )
        external
        onlyOwner
    {
        uint256 len = prices.length;
        require(tokens.length == len, "bad token length");
        for (uint256 idx = 0; idx < len; idx++) {
            address token = tokens[idx];
            uint256 price = prices[idx];
            store[token] = PriceData({
                price: uint256(price),
                lastUpdate: uint256(block.timestamp)
            });
            emit PriceUpdate(token,price);
        }
    }

    /// @dev Return the wad price of token0/token1, multiplied by 1e18
    /// NOTE: (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token) external view
        returns (uint256 price, uint256 lastUpdate)
    {
        PriceData memory data = store[token];
        price = uint256(data.price);
        lastUpdate = uint256(data.lastUpdate);
        require(price != 0 && lastUpdate != 0, "bad price data");
        return (price, lastUpdate);
    }
}
