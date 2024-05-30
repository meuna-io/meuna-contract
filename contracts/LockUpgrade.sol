// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract LockUpgrade is Initializable,ReentrancyGuardUpgradeable,OwnableUpgradeable,PausableUpgradeable {
    using SafeMath for uint256;
    uint256 public duration;
    address public shortContract;
    address public token;
    uint256 public totalLockBalance;

    struct LockInfo {
        uint256 lockAmount;
        uint256 unLockTime;
        address receiver;
    }

    mapping (address => uint256) public countPosition;
    mapping (address => uint256[]) public userPositions;
    mapping (uint256 => LockInfo) public lockInfos;
    mapping (address => uint256[]) public positionsMap;
    mapping (uint256 => uint256) public mapIndex;

    event LockPosition(address indexed user, uint256 indexed positionId, uint256 amount);
    event IncreaseLock(address indexed user,uint256 indexed positionId,uint256 amount);
    event ReleasePosition(address indexed user, uint256 indexed positionId, uint256 amount);
    event UnlockPosition(address indexed user, uint256 indexed positionId, uint256 amount);

    function initialize(uint256 _duration,address _token) public initializer {
        OwnableUpgradeable.__Ownable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        duration = _duration;
        token = _token;
    }

    function setDuration(uint256 _duration) public onlyOwner {
        duration = _duration;
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
    
    function removePosition(address user,uint256 positionId) internal {
        uint256 positionIndex = mapIndex[positionId];
        uint256 lastPositionId = userPositions[user][countPosition[user] - 1];   
        userPositions[user][positionIndex] = lastPositionId;
        userPositions[user].pop();
        mapIndex[lastPositionId] = positionIndex;
        countPosition[user] = countPosition[user] - 1;
        mapIndex[positionId] = 0;
    }

    function lockPosition(uint256 positionId,address receiver) public onlyShortContract{
        uint256 positionLockBalance = IERC20(token).balanceOf(address(this)).sub(totalLockBalance);
        require(positionLockBalance > 0,"no lock token");
        require(lockInfos[positionId].receiver == address(0),"id locked");
        uint256 unLockTime = block.timestamp.add(duration);
        lockInfos[positionId].lockAmount = lockInfos[positionId].lockAmount.add(positionLockBalance);
        lockInfos[positionId].unLockTime = unLockTime;
        lockInfos[positionId].receiver = receiver;
        totalLockBalance = positionLockBalance.add(totalLockBalance);
        userPositions[receiver].push(positionId);
        countPosition[receiver] = countPosition[receiver] + 1;
        mapIndex[positionId] = countPosition[receiver] - 1;
        emit LockPosition(receiver,positionId,positionLockBalance);
    }

    function increaseLock(uint256 positionId,address receiver)  public onlyShortContract{
        uint256 positionLockBalance = IERC20(token).balanceOf(address(this)).sub(totalLockBalance);
        require(positionLockBalance > 0,"no lock token");
        require(lockInfos[positionId].lockAmount > 0,"this position no lock token");
        require(lockInfos[positionId].receiver == receiver , "not owner");
        uint256 unLockTime = block.timestamp.add(duration);
        lockInfos[positionId].lockAmount = lockInfos[positionId].lockAmount.add(positionLockBalance);
        lockInfos[positionId].unLockTime = unLockTime;
        lockInfos[positionId].receiver = receiver;
        totalLockBalance = positionLockBalance.add(totalLockBalance);
        emit IncreaseLock(receiver, positionId, positionLockBalance);
    }

    function releasePosition(uint256 positionId) public onlyShortContract{
        LockInfo storage lockInfo = lockInfos[positionId];
        uint256 unlockAmount =  lockInfo.lockAmount;
        lockInfo.lockAmount = 0;
        totalLockBalance = totalLockBalance.sub(unlockAmount);
        removePosition(lockInfo.receiver,positionId);
        IERC20(token).transfer(lockInfo.receiver, unlockAmount);
        emit ReleasePosition(lockInfo.receiver,positionId,unlockAmount);
    }
    
    function unlockPosition(uint256[] calldata positionIds) public nonReentrant {
        uint256 unlockAmount;
        for (uint256 i = 0; i < positionIds.length; i++) {
            require(block.timestamp > lockInfos[positionIds[i]].unLockTime,"no unlock");
            require(lockInfos[positionIds[i]].receiver == msg.sender , "not owner");
            unlockAmount = unlockAmount.add(lockInfos[positionIds[i]].lockAmount);
            emit UnlockPosition(lockInfos[positionIds[i]].receiver,positionIds[i],lockInfos[positionIds[i]].lockAmount);
            lockInfos[positionIds[i]].lockAmount = 0;
            removePosition(lockInfos[positionIds[i]].receiver,positionIds[i]);
            
        }
        totalLockBalance = totalLockBalance.sub(unlockAmount);
        IERC20(token).transfer(msg.sender, unlockAmount);
    }

    modifier onlyShortContract() {
        require(isShortContract(), "caller is not the short contract");
        _;
    }

    function isShortContract() public view returns (bool) {
        return msg.sender == shortContract;
    }

    function setShortContract(address _shortContract) external onlyOwner {
        shortContract = _shortContract;
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }

}
