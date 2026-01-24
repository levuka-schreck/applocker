// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LPToken
 * @notice LP Token for the AppEx Payments Vault
 * @dev Minted when users deposit USDC, burned on withdrawal
 */
contract LPToken is ERC20, Ownable {
    address public vault;

    error OnlyVault();
    error ZeroAddress();
    error VaultAlreadySet();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    /**
     * @notice Constructor
     * @param _name Token name
     * @param _symbol Token symbol
     */
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        // Vault will be set via setVault() after deployment
    }

    /**
     * @notice Set the vault address (can only be called once by owner)
     * @param _vault Address of the PaymentsVault
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        if (vault != address(0)) revert VaultAlreadySet();
        vault = _vault;
        // Transfer ownership to the vault
        _transferOwnership(_vault);
    }

    /**
     * @notice Mint LP tokens to an address
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /**
     * @notice Burn LP tokens from an address
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }

    /**
     * @notice Returns the number of decimals (matches USDC)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
