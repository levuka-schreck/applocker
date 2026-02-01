// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/AppExToken.sol";
import "../src/PaymentsVault.sol";

contract DeployAppEx is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address admin2 = vm.envOr("ADMIN_2", address(0));
        address admin3 = vm.envOr("ADMIN_3", address(0));
        address governor1 = vm.envOr("GOVERNOR_1", address(0));        
        
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
        usdc.mint(deployer, 10_000_000 * 10**6); // 10M USDC
        console.log("Minted 10M USDC to deployer");

        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        
        // The vault contract will be the proposer/executor
        // Set to address(0) for executor to allow anyone to execute after delay
        proposers[0] = address(vault);
        executors[0] = address(0);
        
        // 1 day delay (86400 seconds) - adjust as needed
        TimelockController timelock = new TimelockController(
            600,      // minDelay
            proposers,  // proposers
            executors,  // executors  
            msg.sender  // admin
        );

        console.log("Timelock deployed at:", address(timelock));

        // Add additional admins if specified
        if (admin2 != address(0)) {
            vault.addAdmin(admin2);
            console.log("Added admin:", admin2);
        }
        if (admin3 != address(0)) {
            vault.addAdmin(admin3);
            console.log("Added admin:", admin3);
        }

        // Initialize governor if specified
        if (governor1 != address(0)) {
            vault.initializeGovernor(governor1);
            console.log("Initialized governor:", governor1);
        }

        vm.stopBroadcast();

        // Output deployment addresses
        console.log("\n========================================");
        console.log("\nDEPLOYMENT ADDRESSES");
        console.log("\n========================================");
        console.log("\nNEXT_PUBLIC_USDC_ADDRESS=",address(usdc));
        console.log("\nNEXT_PUBLIC_APPEX_TOKEN_ADDRESS=",address(appex));
        console.log("\nNEXT_PUBLIC_PAYMENTS_VAULT_ADDRESS=",address(vault));
        console.log("\nNEXT_PUBLIC_LP_TOKEN_ADDRESS=",address(vault.lpToken()));
        console.log("\nTIMELOCK=",address(timelock));
        console.log("\n========================================");
        console.log("\nAdd the NEXT envs to frontend/.env, and timelock used in UI.");
        console.log("\n========================================");
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
