// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import './Interfaces/ILock.sol';
import './Interfaces/IPancakeRouter02.sol';
import './Interfaces/IPancakeFactory.sol';
import './Interfaces/IStaking.sol';

contract ShortContractUpgrade is  Initializable,OwnableUpgradeable {
    /// @notice Libraries
    using SafeMath for uint256;
    IPancakeFactory public factory;
    IPancakeRouter02 public router;
    ILock public locker;
    IStaking public staking;
    address public mintContract;
    mapping (address => uint256) public assetPools;

    function initialize(IPancakeFactory _factory,IPancakeRouter02 _router,ILock _locker,IStaking _staking) public initializer {
        OwnableUpgradeable.__Ownable_init();
        factory = _factory;
        router = _router;
        locker = _locker;
        staking = _staking;
    }

    function swap(address asset,address colleteral,uint256 amount) internal {
        address[] memory path = new address[](2);
        path[0] = asset;
        path[1] = colleteral;
        IERC20(asset).approve(address(router), 0);
        IERC20(asset).approve(address(router), amount);
        router.swapExactTokensForTokens(amount,0,path, address(locker), block.timestamp);
    }

    function openShort(uint256 positionId,address asset,address colleteral,uint256 amount,address user) public onlyMintContract
    {
        require(assetPools[asset] > 0,"this asset not allow to short");
        swap(asset,colleteral,amount);
        locker.lockPosition(positionId,user);
        staking.increaseShort(assetPools[asset], amount, user);
    }

    function increaseShort(uint256 positionId,address asset,address colleteral,uint256 amount,address user) public onlyMintContract
    {
        require(assetPools[asset] > 0,"this asset not allow to short");
        swap(asset,colleteral,amount);
        locker.increaseLock(positionId,user);
        staking.increaseShort(assetPools[asset], amount, user);
    }

    function afterAuction(uint256 positionId,address asset,uint256 amount,address user) public onlyMintContract{
        require(assetPools[asset] > 0,"this asset not allow to short");
        staking.decreaseShort(assetPools[asset], amount, user);
        locker.releasePosition(positionId);
    }

    function decreaseShortToken(address asset,uint256 amount,address user) public onlyMintContract{
        require(assetPools[asset] > 0,"this asset not allow to short");
        staking.decreaseShort(assetPools[asset], amount, user);
    }

    function unlock(uint256 positionId) public onlyMintContract {
        locker.releasePosition(positionId);
    }

    function setAssetPool(address asset,uint256 poolId) external onlyOwner {
        assetPools[asset] = poolId;
    }

    modifier onlyMintContract() {
        require(isMintContract(), "caller is not the mint contract");
        _;
    }
    
    function isMintContract() public view returns (bool) {
        return msg.sender == mintContract;
    }

    function setMintContract(address _mintContract) external onlyOwner {
        mintContract = _mintContract;
    }

}

