// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import '@openzeppelin/contracts/access/Ownable.sol';
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract PriceOracleSyncPyth is Ownable {
    using SafeMath for uint256;
    
    struct PriceData {
        uint256 price;
        uint256 lastUpdate;
    }

    struct PriceId {
        bytes32 priceId;
        bool reverse;
    }

    IPyth pyth;
    
    mapping (address => PriceId) public priceIds;
    mapping (address => PriceData) public store;

    event PriceUpdate(address indexed token, uint256 price);
    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function addPrice(address _asset,bytes32 _priceId,bool _reverse) external onlyOwner {
        priceIds[_asset] = PriceId({
                priceId: _priceId,
                reverse: _reverse
            });
    }

    function update(
        bytes[] calldata priceUpdateData,
        address[] calldata assets
    ) public payable onlyOwner {
        // Update the prices to be set to the latest values
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{ value: fee }(priceUpdateData);
        for (uint256 i = 0; i < assets.length; i++) {
            PythStructs.Price memory price = pyth.getPrice(priceIds[assets[i]].priceId);
            uint64 _price = uint64(price.price);
            uint32 _expo = uint32(18+price.expo);
            uint256 p = _price * 10**_expo;
            if(priceIds[assets[i]].reverse){
                p = uint256(10**36).div(p);
            }
            store[assets[i]] = PriceData({
                price: p,
                lastUpdate: uint256(block.timestamp)
            });
            emit PriceUpdate(assets[i],p);
        }
        
    }

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
