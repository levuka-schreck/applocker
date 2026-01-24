// In your Foundry project, create script/DeployTimelock.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

contract DeployTimelock is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        
        // The vault contract will be the proposer/executor
        // Set to address(0) for executor to allow anyone to execute after delay
        proposers[0] = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
        executors[0] = address(0);
        
        // 1 day delay (86400 seconds) - adjust as needed
        TimelockController timelock = new TimelockController(
            86400,      // minDelay
            proposers,  // proposers
            executors,  // executors  
            msg.sender  // admin
        );

        console.log("Timelock deployed at:", address(timelock));
        
        vm.stopBroadcast();
    }
}