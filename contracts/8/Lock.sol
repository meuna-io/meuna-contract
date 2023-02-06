// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Lock is Ownable {
    using SafeMath for uint256;
    uint256 public duration;
    address public mintContract;
    address public token;
    uint256 public totalLockBalance;

    struct LockInfo {
        uint256 lockAmount;
        uint256 unLockTime;
        address receiver;
    }

    mapping (uint256 => LockInfo) public lockInfos;
    mapping (address => uint256[]) public positionsMap;
    mapping (uint256 => uint256) public mapIndex;

    constructor(uint256 _duration,address _mintContract,address _token) {
        duration = _duration;
        mintContract = _mintContract;
        token = _token;
    }

    function setDuration(uint256 _duration) public onlyOwner {
        duration = _duration;
    }

    function lockPosition(uint256 positionId,address receiver) public onlyMintContract{
        uint256 positionLockBalance = IERC20(token).balanceOf(address(this)).sub(totalLockBalance);
        if(positionLockBalance > 0){
            uint256 unLockTime = block.timestamp.add(duration);
            lockInfos[positionId].lockAmount = positionLockBalance;
            lockInfos[positionId].unLockTime = unLockTime;
            lockInfos[positionId].receiver = receiver;
            totalLockBalance = positionLockBalance.add(totalLockBalance);
            uint256[] storage positions = positionsMap[receiver];
            positions.push(positionId);
            mapIndex[positionId] = positions.length - 1;
        }
    }

    function unlockPostion(uint256[] calldata positionIds) public {
        uint256 unlockAmount;
        for (uint256 i = 0; i < positionIds.length; i++) {
            require(lockInfos[positionIds[i]].unLockTime > block.timestamp,"no unlock");
            require(lockInfos[positionIds[i]].receiver == msg.sender , "not owner");
            unlockAmount = unlockAmount.add(lockInfos[positionIds[i]].lockAmount);
            lockInfos[positionIds[i]].lockAmount = 0;
            uint256[] storage positions = positionsMap[msg.sender];
            uint256 length = positions.length;
            uint256 lastId = positions[length-1];
            uint256 index = mapIndex[positionIds[i]];
            positions[index] = lastId;
            positions.pop();
            mapIndex[lastId] = index; 
            mapIndex[positionIds[i]] = 0;
        }
        totalLockBalance = totalLockBalance.sub(unlockAmount);
        IERC20(token).transfer(msg.sender, unlockAmount);
    }

    modifier onlyMintContract() {
        require(isMintContract(), "caller is not the mint contract");
        _;
    }
    
    function isMintContract() public view returns (bool) {
        return msg.sender == mintContract;
    }
}
