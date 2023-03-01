// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import "./libraries/Math.sol";
import './Interfaces/IPriceOracle.sol';
import './Interfaces/IAssetConfig.sol';
import './Interfaces/ICollateralConfig.sol';
import './Interfaces/ILock.sol';
import './Interfaces/IPancakeRouter02.sol';
import './Interfaces/IPancakeFactory.sol';
import './Interfaces/IPancakePair.sol';
import './mocks/ERC20Mock.sol';

contract MintSyn is Ownable {
    /// @notice Libraries
    using SafeMath for uint256;
    address public collector;
    uint256 public feeRate; //100 = 1% 
    uint256 one = 1e18;
    IPriceOracle public twap;
    IAssetConfig public assetConfig;
    ICollateralConfig public collateralConfig;

    struct Position {
        address asset;
        address collateral;
        address owner;
        uint256 collateralAmount;
        uint256 mintAmount;
        bool closePosition;
    }

    mapping (address => uint256) public countPosition;
    mapping (address => uint256[]) public userPositions;
    mapping (uint256 => uint256) public mapIndex;
    mapping (uint256 => Position) public positions;
    uint256 public nextPositionID = 1;

    constructor(address _twap,address _assetConfig,address _collateralConfig,uint256 _fee,address _collector) {
        twap = IPriceOracle(_twap);
        assetConfig = IAssetConfig(_assetConfig);
        collateralConfig = ICollateralConfig(_collateralConfig);
        feeRate = _fee;
        collector = _collector;
    }

    function collateralPriceInA(address c,address a) view internal returns(uint256) {
        (uint256 colleteralPrice,)= twap.getPrice(c);
        (uint256 assetPrice, ) = twap.getPrice(a);
        return assetPrice.mul(1e18).div(colleteralPrice);
    }

    function removePosition(address user,uint256 positionId) internal {
        uint256 positionIndex = mapIndex[positionId];
        uint256 lastPositionId = userPositions[user][countPosition[user] - 1];   
        userPositions[user][positionIndex] = lastPositionId;
        userPositions[user].pop();
        mapIndex[lastPositionId] = positionIndex;
        countPosition[user] = countPosition[user] - 1;
        mapIndex[positionId] = 0;
    }

    function positionBySize(
        address user,
        uint256 cursor,
        uint256 size
    ) external view returns (uint256[] memory, uint256) {
        uint256 length = size;
        if (length > countPosition[user] - cursor) {
            length = countPosition[user] - cursor;
        }

        uint256[] memory values = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            values[i] = userPositions[user][cursor + i];  
        }
        return (values, cursor + length);
    }   
    
    function getHealth(uint256 positionId) public view returns(uint256 assetValueInCollateral,uint256 colleteralAmount,uint256 minRatio) {
        Position memory pos = positions[positionId];
        (uint256 colleteralPrice,)= twap.getPrice(pos.collateral);
        (uint256 assetPrice,) = twap.getPrice(pos.asset);
        uint256 collateralPriceInAsset = (assetPrice.mul(1e18)).div(colleteralPrice);
        assetValueInCollateral = (pos.mintAmount.mul(collateralPriceInAsset)).div(1e18);
        colleteralAmount = pos.collateralAmount;
        minRatio = assetConfig.getMinCollateralRatio(pos.asset);
    }
    
    function openPosition(uint256 amount, address asset,address collateral, uint256 collateralRatio) external
    {   
        require(amount > 0,"Wrong Amount");
        require(assetConfig.getAccepAsset(asset),"this asset not allowed");
        require(collateralConfig.getAccepCollateral(collateral),"this collateral not allowed");
        require(assetConfig.getMinCollateralRatio(asset).mul(collateralConfig.getMultipier(collateral)).div(1e5) <= collateralRatio,"low collateral ratio than minimum");
        IERC20(collateral).transferFrom(msg.sender, address(this), amount);
        (uint256 colleteralPrice,)= twap.getPrice(collateral);
        (uint256 assetPrice, ) = twap.getPrice(asset);
        uint256 collateralPriceInAsset = (colleteralPrice.mul(1e18)).div(assetPrice);
        uint256 mintAmount = ((amount.mul(collateralPriceInAsset)).mul(100).div(collateralRatio));
        if (mintAmount == 0) {
            revert("collateral is too small");
        }
        positions[nextPositionID].asset = asset;
        positions[nextPositionID].collateral = collateral;
        positions[nextPositionID].owner = msg.sender;
        positions[nextPositionID].collateralAmount = amount;
        positions[nextPositionID].mintAmount = mintAmount; 
        ERC20Mock(asset).mint(msg.sender,mintAmount);
        userPositions[msg.sender].push(nextPositionID);
        countPosition[msg.sender] = countPosition[msg.sender] + 1;
        mapIndex[nextPositionID] = countPosition[msg.sender] - 1;
        nextPositionID++;
    }

    function closePosition(uint256 positionId) external {
        burnAsset(positionId,positions[positionId].mintAmount);
         console.log(
        "Transferring from %s to %s %s tokens",
        positions[positionId].collateralAmount
    );
        withdraw(positionId,positions[positionId].collateralAmount);
        
    }

    function deposit(uint256 positionId,uint256 amount) public {
        Position storage pos = positions[positionId];
        require(!pos.closePosition,"position was closed");
        require(msg.sender == pos.owner ,"not owner");
        IERC20(pos.collateral).transferFrom(msg.sender, address(this), amount);
        pos.collateralAmount = pos.collateralAmount.add(amount);
    }

    function withdraw(uint256 positionId,uint256 withdrawAmount) public {
        Position storage pos = positions[positionId];
        require(!pos.closePosition,"position was closed");
        require(msg.sender == pos.owner ,"not owner");
        require(pos.collateralAmount >= withdrawAmount,"Cannot withdraw more than you provide");
        (uint256 colleteralPrice,)= twap.getPrice(pos.collateral);
        (uint256 assetPrice, ) = twap.getPrice(pos.asset);
        uint256 collateralAmount = pos.collateralAmount;
        uint256 assetAmount = pos.mintAmount;
        uint256 collateralAmountAfterSub = collateralAmount.sub(withdrawAmount);
        uint256 assetValueInCollateral = assetAmount.mul(assetPrice).div(colleteralPrice);
        uint256 mulipier = collateralConfig.getMultipier(pos.collateral);
        if((assetValueInCollateral.mul(mulipier).mul(assetConfig.getMinCollateralRatio(pos.asset))).div(1e25) > collateralAmountAfterSub){
            revert("Cannot withdraw collateral over than minimum collateral ratio");
        }
        pos.collateralAmount = collateralAmountAfterSub;
        IERC20(pos.collateral).transfer(msg.sender, withdrawAmount);
        if(pos.collateralAmount == 0 && pos.mintAmount ==0){
            pos.closePosition = true;
            removePosition(msg.sender,positionId);
        }
    }

    function mintAsset(uint256 positionId,uint256 mintAmount) public {
        Position storage pos = positions[positionId];
        require(!pos.closePosition,"position was closed");
        require(msg.sender == pos.owner ,"not owner");
        require(mintAmount > 0,"zero mint");
        uint256 assetAmount = pos.mintAmount;
        (uint256 colleteralPrice,)= twap.getPrice(pos.collateral);
        (uint256 assetPrice, ) = twap.getPrice(pos.asset);
        uint256 collateralAmount = pos.collateralAmount;
        uint256 newAssetAmount = assetAmount.add(mintAmount);
        uint256 assetValueInCollateral = newAssetAmount.mul(assetPrice).div(colleteralPrice);
        uint256 mulipier = collateralConfig.getMultipier(pos.collateral);
        if((assetValueInCollateral.mul(mulipier).mul(assetConfig.getMinCollateralRatio(pos.asset))).div(1e25) > collateralAmount){
            revert("Cannot mint asset over than min collateral ratio");
        }
        pos.mintAmount = newAssetAmount;
        ERC20Mock(pos.asset).mint(msg.sender,mintAmount);
    }

    function burnAsset(uint256 positionId,uint256 burnAmount) public {
        Position storage pos = positions[positionId];
        require(!pos.closePosition,"position was closed");
        require(msg.sender == pos.owner ,"not owner");
        require(pos.mintAmount >= burnAmount,"Cannot burn asset more than you mint");
        pos.mintAmount = pos.mintAmount.sub(burnAmount);
        (uint256 colleteralPrice,)= twap.getPrice(pos.collateral);
        (uint256 assetPrice, ) = twap.getPrice(pos.asset);
        uint256 collateralPriceInAsset = (assetPrice.mul(1e18)).div(colleteralPrice);
        uint256 fee = burnAmount.mul(collateralPriceInAsset).mul(feeRate).div(1e22);
        if (fee > 0){
            IERC20(pos.collateral).transfer(collector,fee);
            pos.collateralAmount = pos.collateralAmount.sub(fee);
        }
        ERC20Mock(pos.asset).transferFrom(msg.sender,address(this),burnAmount);
        ERC20Mock(pos.asset).burn(burnAmount);
    }

    function auction(uint256 positionId,uint256 burnAmount)  public {
        Position storage pos = positions[positionId];
        require(pos.mintAmount >= burnAmount ,"Cannot liquidate more than the position amount");
        uint256 collateralPriceInAsset = collateralPriceInA(pos.collateral,pos.asset); 
        uint256 assetValueInCollateral = (pos.mintAmount.mul(collateralPriceInAsset)).div(1e18);
        if(assetValueInCollateral.mul(collateralConfig.getMultipier(pos.collateral)).mul(assetConfig.getMinCollateralRatio(pos.asset)).div(1e25) <  pos.collateralAmount){
            revert("Cannot liquidate a safely collateralized position");
        }
        IERC20(pos.asset).transferFrom(msg.sender, address(this), burnAmount);
        uint256 auctionDiscount = Math.min(assetConfig.getAuction(pos.asset).div(100),assetConfig.getMinCollateralRatio(pos.asset).div(100).sub(one));
        uint256 discountPrice = collateralPriceInAsset.mul(1e18).div(((one).sub(auctionDiscount)));
        
        uint256 assetValueInCollateralDiscount = burnAmount.mul(discountPrice).div(1e18);
        uint256 returnCollateralAmount;
        uint256 refundAssetAmount;
        if(assetValueInCollateralDiscount > pos.collateralAmount) {
            refundAssetAmount =  ((assetValueInCollateralDiscount.sub(pos.collateralAmount)).mul(1e18)).div(discountPrice);
            returnCollateralAmount = pos.collateralAmount;
            if(refundAssetAmount > 0){
                IERC20(pos.asset).transfer(msg.sender, refundAssetAmount);
            }
        } else {
            returnCollateralAmount = assetValueInCollateralDiscount;
            refundAssetAmount = 0;
        }
        uint256 liquidatedAmount = burnAmount.sub(refundAssetAmount);
      
        uint256 leftAssetAmount = pos.mintAmount.sub(liquidatedAmount);
        uint256 leftCollateralAmount = pos.collateralAmount.sub(returnCollateralAmount);
        if(leftCollateralAmount == 0){
            pos.collateralAmount = 0;
            pos.mintAmount = 0;
            pos.closePosition = true;
            removePosition(pos.owner,positionId);
        } else if (leftAssetAmount == 0){
            pos.collateralAmount = 0;
            pos.mintAmount = 0;
            pos.closePosition = true;
            IERC20(pos.collateral).transfer(pos.owner, leftCollateralAmount);
            removePosition(pos.owner,positionId);
        }else {
            pos.collateralAmount = leftCollateralAmount;
            pos.mintAmount = leftAssetAmount;
        }
        ERC20Mock(pos.asset).burn(liquidatedAmount);
        uint256 fee = liquidatedAmount.mul(collateralPriceInAsset).mul(feeRate).div(1e22);
        if (fee > 0){
            IERC20(pos.collateral).transfer(collector,fee);
            returnCollateralAmount = returnCollateralAmount.sub(fee);
        }
        IERC20(pos.collateral).transfer(msg.sender, returnCollateralAmount);
    }

    function setAssetConfig(address _config) external onlyOwner {
        assetConfig = IAssetConfig(_config);
    }

    function setCollateralConfig(address _config) external onlyOwner {
        collateralConfig = ICollateralConfig(_config);
    }

    function setCollector(address _collector) external onlyOwner{
        collector = _collector;
    }

    function setFee(uint256 _fee) external onlyOwner {
        feeRate = _fee;
    }

}