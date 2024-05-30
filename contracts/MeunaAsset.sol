// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import '@openzeppelin/contracts/access/Ownable.sol';

contract MeunaAsset is ERC20, Ownable {
    
    mapping (address => bool) public setter;
    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from,uint256 value);
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        
    }

    function mint(address to, uint256 amount) external {
      require(setter[msg.sender], "!setter");
      _mint(to, amount);
      emit Mint(to, amount);
    }

    function burn(uint256 amount) external {
      require(setter[msg.sender], "!setter");
      _burn(msg.sender,amount);
      emit Burn(msg.sender,amount);
    }

    function addSetter(address _setter) external onlyOwner {
        setter[_setter] = true;
    }

    function removeSetter(address _setter) external onlyOwner {
        setter[_setter] = false;
    }
}
