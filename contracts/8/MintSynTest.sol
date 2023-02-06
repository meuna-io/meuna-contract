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


contract MintSynTest is Ownable {
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

    constructor(address _twap,address _config,address _collateralToken) {
        twap = IPriceOracle(_twap);
        config = IAssetConfig(_config);
        collateralToken = _collateralToken;
    }


    function openPosition(uint256 amount, address asset, uint256 collateralRatio) external
    {
        require(config.getMinCollateralRatio(asset) <= collateralRatio,"low collateral ratio than minimum");
        IERC20(collateralToken).transferFrom(msg.sender, address(this), amount);
        (uint256 colleteralPrice,)= twap.getPrice(collateralToken);
        (uint256 assetPrice, ) = twap.getPrice(asset);
        uint256 colleteralPriceInAsset = (colleteralPrice.mul(1e18)).div(assetPrice);
        uint256 mintAmount = (amount.mul(colleteralPriceInAsset)).mul(100).div(collateralRatio);
        positions[nextPositionID].asset = asset;
        positions[nextPositionID].owner = msg.sender;
        positions[nextPositionID].collateralAmount = amount;
        positions[nextPositionID].mintAmount = mintAmount; 
        ERC20Mock(asset).mint(msg.sender,mintAmount);
        nextPositionID++;
    }

    function deposit(uint256 positionId,uint256 amount) external {
        require(msg.sender != positions[positionId].owner ,"not owner");
        IERC20(collateralToken).transferFrom(msg.sender, address(this), amount);
        positions[positionId].collateralAmount = positions[positionId].collateralAmount.add(amount);
    }

    function withdraw(uint256 positionId,uint256 withdrawAmount) external {
        require(msg.sender != positions[positionId].owner ,"not owner");
        (uint256 colleteralPrice,)= twap.getPrice(collateralToken);
        (uint256 assetPrice, ) = twap.getPrice(positions[positionId].asset);
        uint256 collateralAmount = positions[positionId].collateralAmount;
        uint256 assetAmount = positions[positionId].mintAmount;
        uint256 collateralAmountAfterSub = collateralAmount.sub(withdrawAmount);
        uint256 assetValueInCollateral = assetAmount.mul(assetPrice).div(colleteralPrice);
        if(assetValueInCollateral.mul(config.getMinCollateralRatio(positions[positionId].asset).div(1e20)) > collateralAmountAfterSub){
            revert("Cannot withdraw collateral over than minimum collateral ratio");
        }
        positions[positionId].collateralAmount = collateralAmountAfterSub;
        IERC20(collateralToken).transfer(msg.sender, withdrawAmount);
    }

    function mint(uint256 positionId,uint256 mintAmount) external {
        require(msg.sender != positions[positionId].owner ,"not owner");
        uint256 assetAmount = positions[positionId].mintAmount;
        (uint256 colleteralPrice,)= twap.getPrice(collateralToken);
        (uint256 assetPrice, ) = twap.getPrice(positions[positionId].asset);
        uint256 collateralAmount = positions[positionId].collateralAmount;
        uint256 newAssetAmount = assetAmount.add(mintAmount);
        uint256 assetValueInCollateral = newAssetAmount.mul(assetPrice).div(colleteralPrice);
        if(assetValueInCollateral.mul(config.getMinCollateralRatio(positions[positionId].asset).div(1e20)) > collateralAmount){
            revert("Cannot mint asset over than min collateral ratio");
        }
        positions[positionId].mintAmount = newAssetAmount;
    }
}