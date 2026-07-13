// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {AevumRegistry} from "../src/AevumRegistry.sol";
import {AevumMemory} from "../src/AevumMemory.sol";
import {AevumAgenticID} from "../src/AevumAgenticID.sol";

/// @title Deploy
/// @notice Foundry deployment script for the Aevum protocol.
/// @dev    Deploys in the required order:
///         1. AevumRegistry   — identity layer
///         2. AevumMemory     — memory log (references registry)
///         3. AevumAgenticID  — ERC-721 wrapper (references registry; registered as
///                               a registrar so its mints create registry agents
///                               owned by the NFT recipient)
/// @dev    Usage:
///         forge script script/Deploy.s.sol:Deploy \
///             --rpc-url $OG_RPC_URL \
///             --broadcast \
///             --private-key $PRIVATE_KEY
contract Deploy is Script {
    function run() external {
        // Pull the oracle address from env (placeholder for 0G Compute TEE).
        // 0x0000…0000 disables verifiable transfer/clone until the oracle is set.
        address oracle = vm.envOr("OG_ORACLE", address(0));
        address admin = vm.envOr("OG_ADMIN", msg.sender);

        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        // 1) Identity
        AevumRegistry registry = new AevumRegistry();
        console2.log("AevumRegistry deployed at:", address(registry));

        // 2) Memory log (depends on registry)
        AevumMemory memoryLog = new AevumMemory(address(registry));
        console2.log("AevumMemory   deployed at:", address(memoryLog));

        // 3) Agentic ID (depends on registry)
        AevumAgenticID agenticId = new AevumAgenticID(address(registry), oracle, admin);
        console2.log("AevumAgenticID deployed at:", address(agenticId));

        // Wire AevumAgenticID in as a registrar so mints can create registry
        // agents atomically owned by the NFT recipient.
        registry.setRegistrar(address(agenticId), true);
        console2.log("AevumAgenticID authorised as registrar");

        // If the deployer is also the admin, grant the admin role explicitly.
        // (Constructor already grants DEFAULT_ADMIN_ROLE + ORACLE_ADMIN_ROLE to `admin`,
        //  so this is purely informational.)
        console2.log("Oracle address (set post-deploy via setOracle):", oracle);
        console2.log("Admin address:", admin);

        vm.stopBroadcast();

        // Summary block — easy to grep in CI / buildathon judges' tools.
        console2.log("\n--- Aevum deployment summary ---");
        console2.log("Chain ID            :", block.chainid);
        console2.log("Deployer            :", msg.sender);
        console2.log("AevumRegistry       :", address(registry));
        console2.log("AevumMemory         :", address(memoryLog));
        console2.log("AevumAgenticID      :", address(agenticId));
        console2.log("OG_ORACLE (settable):", oracle);
    }
}
