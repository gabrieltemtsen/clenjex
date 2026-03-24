// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentIdentityRegistry.sol";
import "../src/ReputationRegistry.sol";
import "../src/ValidationRegistry.sol";
import "../src/RiskRouter.sol";

/// @notice Deploys all clenjex ERC-8004 contracts to Base Sepolia (or mainnet).
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
/// Required env vars: DEPLOYER_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY
contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY_HEX");
        vm.startBroadcast(deployerKey);

        AgentIdentityRegistry identity = new AgentIdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry();
        ValidationRegistry validation = new ValidationRegistry();
        RiskRouter riskRouter = new RiskRouter();

        vm.stopBroadcast();

        console.log("=== clenjex ERC-8004 Deployment (chain:", block.chainid, ") ===");
        console.log("AgentIdentityRegistry:", address(identity));
        console.log("ReputationRegistry:   ", address(reputation));
        console.log("ValidationRegistry:   ", address(validation));
        console.log("RiskRouter:           ", address(riskRouter));
        console.log("");
        console.log("Next: update packages/onchain/deployments.json + .env with these addresses");
    }
}
