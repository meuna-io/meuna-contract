// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IStaking {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function increaseShort(uint256 pid,uint256 amount,address to) external;

    function decreaseShort(uint256 pid,uint256 amount,address to) external;

}
