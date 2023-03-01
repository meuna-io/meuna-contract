// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import './mocks/ERC20Mock.sol';

contract Faccet {

    address public stable;

    constructor(address _stable) {
        stable = _stable;
    }

    function claim() external {
        ERC20Mock(stable).mint(msg.sender,100000000000000000000);
    }   
}
