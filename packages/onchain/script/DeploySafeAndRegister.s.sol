// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentIdentityRegistry.sol";

/// @notice Deploys a 1-of-1 Safe for clenjex agent wallet, then mints the Agent Identity NFT.
/// Safe v1.3.0 contracts are pre-deployed on all major chains.
contract DeploySafeAndRegister is Script {
    // Safe v1.3.0 singletons + factory (deterministic, same on all chains)
    address constant SAFE_SINGLETON    = 0x3E5c63644E683549055b9Be8653de26E0B4CD36E; // GnosisSafeL2
    address constant SAFE_FACTORY     = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2; // GnosisSafeProxyFactory
    address constant FALLBACK_HANDLER = 0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4; // CompatibilityFallbackHandler

    // Our deployed Identity Registry on Base Sepolia
    address constant IDENTITY_REGISTRY = 0xF112ba99A3586Ac4b5dA4148c0a03ADD2C6BFA0a;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY_HEX");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // --- 1. Deploy Safe (1-of-1, deployer as sole owner) ---
        address[] memory owners = new address[](1);
        owners[0] = deployer;
        uint256 threshold = 1;

        // Encode Safe.setup() call
        bytes memory setupData = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners,
            threshold,
            address(0),          // to (no delegate call)
            bytes(""),           // data
            FALLBACK_HANDLER,    // fallbackHandler (enables EIP-1271)
            address(0),          // paymentToken
            0,                   // payment
            payable(address(0)) // paymentReceiver
        );

        // Deploy via factory with salt nonce = 0
        address safe = IGnosisSafeProxyFactory(SAFE_FACTORY).createProxyWithNonce(
            SAFE_SINGLETON,
            setupData,
            0 // salt nonce
        );

        console.log("Safe deployed:", safe);

        // --- 2. Register Agent Identity NFT ---
        // Agent Registration JSON will be hosted on IPFS (placeholder URI for now)
        string memory agentRegistrationURI = "ipfs://bafybeig37ioeot2bggiif3ioxg7qlktkg3sqnk7yy4h5wqlhujmzk4dfm/clenjex-agent.json";

        uint256 tokenId = AgentIdentityRegistry(IDENTITY_REGISTRY).registerAgent(
            deployer,      // owner of NFT
            safe,          // agent wallet = the Safe we just deployed
            "clenjex",     // agent name
            agentRegistrationURI
        );

        vm.stopBroadcast();

        console.log("=== clenjex Agent Identity ===");
        console.log("Safe (agent wallet):", safe);
        console.log("Agent NFT token ID:", tokenId);
        console.log("Agent NFT owner:", deployer);
        console.log("");
        console.log("Next: update .env with SAFE_ADDRESS and AGENT_NFT_ID");
        console.log("Next: upload Agent Registration JSON to IPFS and update tokenURI");
    }
}

interface IGnosisSafeProxyFactory {
    function createProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) external returns (address proxy);
}
