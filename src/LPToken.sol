// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LPToken
 * @dev Represents shares in the Payments Vault
 */
contract LPToken is ERC20, Ownable {
    address public vault;

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can call");
        _;
    }

    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {}

    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault already set");
        vault = _vault;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}
