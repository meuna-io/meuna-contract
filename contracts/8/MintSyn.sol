// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import './Interfaces/IPriceOracle.sol';
import './Interfaces/IAssetConfig.sol';
import './Interfaces/ILock.sol';
import './Interfaces/IPancakeRouter02.sol';
import './Interfaces/IPancakeFactory.sol';
import './Interfaces/IPancakePair.sol';
import './mocks/ERC20Mock.sol';


contract MintSyn is Ownable {
    /// @notice Libraries
    using SafeMath for uint256;
    address public collateralToken; // Stablecoin hay

    IPriceOracle public twap;
    IAssetConfig public config;
    ILock public lock;
    IPancakeRouter02  public router;
    IPancakeFactory public factory;

    struct Position {
        address asset;
        address owner;
        uint256 collateralAmount;
        uint256 mintAmount;
    }

    mapping (uint256 => Position) public positions;
    uint256 public nextPositionID = 1;

    constructor(address _twap,address _config,address _lock,address _router) {
        twap = IPriceOracle(_twap);
        config = IAssetConfig(_config);
        lock = ILock(_lock);
        router =  IPancakeRouter02(_router);
    }


    function openPosition(uint256 amount, address asset, uint256 collateralRatio, bool isShort) external
    {
        require(config.getMinCollateralRatio(asset) <= collateralRatio,"low collateral ratio than minimum");
        IERC20(collateralToken).transferFrom(msg.sender, address(this), amount);
        (uint256 colleteralPrice,)= twap.getPrice(collateralToken);
        (uint256 assetPrice, ) = twap.getPrice(asset);
        uint256 colleteralPriceInAsset = colleteralPrice.div(assetPrice);
        uint256 mintAmount = (amount.mul(colleteralPriceInAsset)).mul(100e18).div(collateralRatio);
        positions[nextPositionID].asset = asset;
        positions[nextPositionID].owner = msg.sender;
        positions[nextPositionID].collateralAmount = amount;
        positions[nextPositionID].mintAmount = mintAmount; 

        if(isShort) {
            ERC20Mock(asset).mint(address(this),mintAmount);
            address[] memory path = new address[](2);
            (path[0],path[1]) = (asset,collateralToken);
            router.swapExactTokensForTokens(mintAmount, 0, path, address(lock), block.timestamp);
            lock.lockPosition(nextPositionID, msg.sender);
        }   
        else {
            ERC20Mock(asset).mint(msg.sender,mintAmount);
        }
        nextPositionID++;
    }

    function deposit(uint256 positonId,uint256 amount) external {
        require(msg.sender != positions[positonId].owner ,"not owner");
        IERC20(collateralToken).transferFrom(msg.sender, address(this), amount);
        positions[positonId].collateralAmount = positions[positonId].collateralAmount.add(amount);
    }
}