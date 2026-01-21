// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LPToken
 * @dev Represents shares in the Payments Vault
 */
contract LPToken is ERC20, Ownable, Pausable {

    address public vault;
    uint256 public renounceTimestamp;
    uint256 constant RENOUNCE_DELAY = 7 days;
    
    event VaultSet(address vault, address sender);
    event InitiateRenounce(uint256 timestamp);
    event ConfirmRenounce(uint256 timestamp);

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can call");
        _;
    }

    constructor(
        string memory name, 
        string memory symbol,
        address _vault
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_vault != address(0), "Vault cannot be zero");
        require(_vault.code.length > 0, "Vault must be contract");
        vault = _vault;
        emit VaultSet(_vault, msg.sender);
    }

    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault already set");
        require(_vault != address(0), "Vault cannot be zero address");
        require(_vault.code.length > 0, "Vault must be a contract");
        vault = _vault;
        emit VaultSet(_vault, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        require(from == msg.sender || allowance(from, vault) >= amount, 
            "Burn not authorized");
        
        if(from != msg.sender) {
            _spendAllowance(from, vault, amount);
        }
        _burn(from, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function initiateRenounce() external onlyOwner {
        renounceTimestamp = block.timestamp + RENOUNCE_DELAY;
        emit InitiateRenounce(renounceTimestamp);

    }
    
    function confirmRenounce() external onlyOwner {
        require(block.timestamp >= renounceTimestamp, "Delay not met");
        _transferOwnership(address(0));
        emit ConfirmRenounce(block.timestamp);
    }       
}
