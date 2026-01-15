// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/AppExToken.sol";
import "../src/PaymentsVault.sol";

contract DeployAppEx is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying contracts with address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy AppEx Token
        AppExToken appex = new AppExToken();
        console.log("AppExToken deployed at:", address(appex));

        // Deploy Payments Vault
        PaymentsVault vault = new PaymentsVault(
            address(usdc),
            address(appex),
            "AppEx LP Token",
            "appexLP"
        );
        console.log("PaymentsVault deployed at:", address(vault));

        // Setup initial allocations
        setupAllocations(appex, vault, deployer);

        // Setup test borrower
        vault.approveBorrower(
            deployer,
            1000000 * 10**6, // 1M USDC limit
            500, // 5% LP yield
            200  // 2% protocol fee
        );
        console.log("Test borrower approved:", deployer);

        // Mint test USDC to deployer
        usdc.mint(deployer, 10000000 * 10**6); // 10M USDC
        console.log("Minted 10M USDC to deployer");

        vm.stopBroadcast();

        // Output deployment addresses
        console.log("\n========================================");
        console.log("DEPLOYMENT ADDRESSES");
        console.log("========================================");
        console.log("USDC:", address(usdc));
        console.log("APPEX:", address(appex));
        console.log("VAULT:", address(vault));
        console.log("LP_TOKEN:", address(vault.lpToken()));
        console.log("========================================");
        console.log("\nAdd these to frontend/.env:");
        console.log("========================================");
        console.log("VITE_USDC_ADDRESS=%s", address(usdc));
        console.log("VITE_APPEX_ADDRESS=%s", address(appex));
        console.log("VITE_VAULT_ADDRESS=%s", address(vault));
        console.log("========================================");
    }

    function setupAllocations(
        AppExToken appex,
        PaymentsVault vault,
        address deployer
    ) internal {
        // Public allocation - 10% (100M tokens) - fully unlocked
        appex.transferTokens(deployer, 100_000_000 * 10**18);
        
        // Liquidity allocation - 10% (100M tokens) - fully unlocked
        appex.transferTokens(address(vault), 100_000_000 * 10**18);

        // Combined Ecosystem + Team allocation for demo
        // In production, these would go to separate multisig addresses
        // Total: 450M tokens (300M ecosystem + 150M team)
        // Using weighted average vesting: ~6 month cliff, ~32 month vesting
        appex.createVestingSchedule(
            deployer, // In production, split between ecosystem and team multisigs
            450_000_000 * 10**18, // Combined 30% + 15%
            6 * 30 days, // Weighted average cliff
            32 * 30 days, // Weighted average vesting
            17 // Weighted average TGE unlock (~75M tokens)
        );

        console.log("Token allocations setup complete");
        console.log("Note: Ecosystem and Team allocations combined for demo");
        console.log("Production should use separate multisig addresses");
    }
}
