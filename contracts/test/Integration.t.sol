// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AevumRegistry} from "../src/AevumRegistry.sol";
import {AevumMemory} from "../src/AevumMemory.sol";
import {AevumAgenticID} from "../src/AevumAgenticID.sol";
import {MockOracle} from "./mocks/MockOracle.sol";

/// @title IntegrationTest
/// @notice End-to-end integration tests exercising the full Aevum protocol:
///         Registry ↔ Memory ↔ AgenticID cross-contract flows.
contract IntegrationTest is Test {
    AevumRegistry internal registry;
    AevumMemory internal memoryLog;
    AevumAgenticID internal nft;
    MockOracle internal oracle;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal admin = makeAddr("admin");

    function setUp() public {
        registry = new AevumRegistry();
        memoryLog = new AevumMemory(address(registry));
        oracle = new MockOracle();
        nft = new AevumAgenticID(address(registry), address(oracle), admin);

        // Wire the NFT as a registrar
        vm.prank(registry.owner());
        registry.setRegistrar(address(nft), true);
    }

    /*//////////////////////////////////////////////////////////////
           FULL LIFECYCLE: mint → log memories → transfer
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint an agent, log several memories, then transfer the agent NFT.
    function test_fullLifecycle_mintLogTransfer() public {
        // 1) Alice mints an agent NFT
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "ResearchBot", "memory", "ipfs://metadata/1");
        uint256 agentId = nft.tokenToAgent(tokenId);
        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);

        // 2) Alice logs 5 memories
        vm.startPrank(alice);
        for (uint256 i = 1; i <= 5; i++) {
            memoryLog.logMemory(
                agentId,
                bytes32(keccak256(abi.encodePacked(i))),
                bytes32(keccak256(abi.encodePacked("root", i))),
                uint8(AevumMemory.DataType.CONVERSATION),
                i > 1 ? i - 1 : 0
            );
        }
        vm.stopPrank();

        assertEq(memoryLog.totalEntries(agentId), 5);

        // 3) Alice grants Bob read access to entry 3
        vm.prank(alice);
        memoryLog.grantAccess(agentId, 3, bob);
        assertTrue(memoryLog.hasAccess(agentId, 3, bob));
        assertFalse(memoryLog.hasAccess(agentId, 1, bob));

        // 4) Alice transfers the agent to Bob via the NFT
        bytes memory sealedKey = hex"deadbeef";
        bytes memory proof = hex"01";
        vm.prank(alice);
        nft.transfer(alice, bob, tokenId, sealedKey, proof);

        // 5) Verify ownership moved
        assertEq(nft.ownerOf(tokenId), bob);
        assertEq(registry.ownerOf(agentId), bob);

        // 6) Bob now has implicit owner access to all memories
        assertTrue(memoryLog.hasAccess(agentId, 1, bob));
        assertTrue(memoryLog.hasAccess(agentId, 3, bob));

        // 7) Alice no longer has owner access
        assertFalse(memoryLog.hasAccess(agentId, 1, alice));

        // 8) Bob can log new memories
        vm.prank(bob);
        memoryLog.logMemory(
            agentId,
            keccak256("bob-memory"),
            keccak256("bob-root"),
            uint8(AevumMemory.DataType.RAW),
            5
        );
        assertEq(memoryLog.totalEntries(agentId), 6);
    }

    /*//////////////////////////////////////////////////////////////
           CLONE: copy agent + memories to new owner
    //////////////////////////////////////////////////////////////*/

    /// @notice Clone an agent that has memories and verify the clone has the same memory pointer.
    function test_clone_copiesMemoryPointer() public {
        // Alice mints and adds memory
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "DataBot", "orchestrator", "ipfs://meta/1");
        uint256 agentId = nft.tokenToAgent(tokenId);

        vm.prank(alice);
        registry.updateMemoryPointer(agentId, keccak256("encrypted-blob-1"), 1024);

        // Log some memories
        vm.startPrank(alice);
        memoryLog.logMemory(agentId, keccak256("m1"), keccak256("r1"), 0, 0);
        memoryLog.logMemory(agentId, keccak256("m2"), keccak256("r2"), 1, 1);
        vm.stopPrank();

        // Clone to Carol
        vm.prank(alice);
        uint256 cloneTokenId = nft.clone(carol, tokenId, hex"abcd", hex"02");

        uint256 cloneAgentId = nft.tokenToAgent(cloneTokenId);

        // Clone has the same memory pointer
        AevumRegistry.Agent memory cloneAgent = registry.getAgent(cloneAgentId);
        assertEq(cloneAgent.memoryPointer, keccak256("encrypted-blob-1"));
        assertEq(cloneAgent.memorySize, 1024);
        assertEq(cloneAgent.owner, carol);

        // Original is unchanged
        AevumRegistry.Agent memory origAgent = registry.getAgent(agentId);
        assertEq(origAgent.owner, alice);
        assertEq(origAgent.memoryPointer, keccak256("encrypted-blob-1"));

        // Clone has its OWN empty memory log (independent entries)
        assertEq(memoryLog.totalEntries(cloneAgentId), 0);

        // Carol can log memories to the clone
        vm.prank(carol);
        memoryLog.logMemory(cloneAgentId, keccak256("carol-m"), keccak256("carol-r"), 2, 0);
        assertEq(memoryLog.totalEntries(cloneAgentId), 1);
        assertEq(memoryLog.totalEntries(agentId), 2, "original unaffected");
    }

    /*//////////////////////////////////////////////////////////////
           MULTI-AGENT: multiple agents per owner
    //////////////////////////////////////////////////////////////*/

    /// @notice Owner with multiple agents, each has independent memory logs.
    function test_multiAgent_independentMemories() public {
        vm.startPrank(alice);
        uint256 t1 = nft.mint(alice, "Bot-1", "memory", "ipfs://1");
        uint256 t2 = nft.mint(alice, "Bot-2", "privacy", "ipfs://2");
        uint256 t3 = nft.mint(alice, "Bot-3", "orchestrator", "ipfs://3");
        vm.stopPrank();

        uint256 a1 = nft.tokenToAgent(t1);
        uint256 a2 = nft.tokenToAgent(t2);
        uint256 a3 = nft.tokenToAgent(t3);

        // Each agent gets different memories
        vm.startPrank(alice);
        memoryLog.logMemory(a1, keccak256("a1m1"), keccak256("r"), 0, 0);
        memoryLog.logMemory(a2, keccak256("a2m1"), keccak256("r"), 0, 0);
        memoryLog.logMemory(a2, keccak256("a2m2"), keccak256("r"), 1, 0);
        memoryLog.logMemory(a3, keccak256("a3m1"), keccak256("r"), 2, 0);
        vm.stopPrank();

        assertEq(memoryLog.totalEntries(a1), 1);
        assertEq(memoryLog.totalEntries(a2), 2);
        assertEq(memoryLog.totalEntries(a3), 1);

        // Alice owns all three
        uint256[] memory owned = registry.getAgentsByOwner(alice);
        assertEq(owned.length, 3);

        // Transfer only Bot-2 to Bob
        vm.prank(alice);
        nft.transfer(alice, bob, t2, hex"00", hex"01");

        assertEq(registry.getAgentsByOwner(alice).length, 2);
        assertEq(registry.getAgentsByOwner(bob).length, 1);
        assertEq(registry.ownerOf(a2), bob);
    }

    /*//////////////////////////////////////////////////////////////
           ACL CROSS-CONTRACT: registry ownership drives memory access
    //////////////////////////////////////////////////////////////*/

    /// @notice Memory access follows registry ownership — transferring NFT changes memory ACL.
    function test_acl_followsOwnership() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "SecureBot", "memory", "ipfs://secure");
        uint256 agentId = nft.tokenToAgent(tokenId);

        // Alice logs a memory and grants Bob explicit access
        vm.startPrank(alice);
        uint256 entry = memoryLog.logMemory(agentId, keccak256("secret"), keccak256("root"), 0, 0);
        memoryLog.grantAccess(agentId, entry, bob);
        vm.stopPrank();

        assertTrue(memoryLog.hasAccess(agentId, entry, bob));

        // Transfer agent to Carol
        vm.prank(alice);
        nft.transfer(alice, carol, tokenId, hex"00", hex"01");

        // Carol is now owner (implicit access), Bob retains explicit grant
        assertTrue(memoryLog.hasAccess(agentId, entry, carol));
        assertTrue(memoryLog.hasAccess(agentId, entry, bob));

        // Carol can revoke Bob's explicit access
        vm.prank(carol);
        memoryLog.revokeAccess(agentId, entry, bob);
        assertFalse(memoryLog.hasAccess(agentId, entry, bob));

        // Carol still has access as owner
        assertTrue(memoryLog.hasAccess(agentId, entry, carol));
    }

    /*//////////////////////////////////////////////////////////////
           USAGE PERMISSIONS + MEMORY
    //////////////////////////////////////////////////////////////*/

    /// @notice Authorize an executor, then verify they can interact with memory.
    function test_usagePermissions_andMemory() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "SharedBot", "memory", "ipfs://shared");
        uint256 agentId = nft.tokenToAgent(tokenId);

        // Log memories
        vm.startPrank(alice);
        memoryLog.logMemory(agentId, keccak256("m1"), keccak256("r"), 0, 0);
        memoryLog.logMemory(agentId, keccak256("m2"), keccak256("r"), 0, 0);
        vm.stopPrank();

        // Authorize Bob with read + write permissions (bits 0 and 1)
        vm.prank(alice);
        nft.authorizeUsage(tokenId, bob, 0x03);
        assertTrue(nft.isAuthorizedFor(tokenId, bob));

        // Bob still needs explicit ACL for memory access
        assertFalse(memoryLog.hasAccess(agentId, 1, bob));

        // Alice grants Bob memory access (separate from usage permission)
        vm.prank(alice);
        memoryLog.grantAccess(agentId, 1, bob);
        assertTrue(memoryLog.hasAccess(agentId, 1, bob));

        // Revoke usage permission
        vm.prank(alice);
        nft.revokeUsage(tokenId, bob);
        assertFalse(nft.isAuthorizedFor(tokenId, bob));

        // Memory access is independent of usage permission
        assertTrue(memoryLog.hasAccess(agentId, 1, bob));
    }

    /*//////////////////////////////////////////////////////////////
           REGISTRAR CROSS-CONTRACT: createAgentWithMemory via clone
    //////////////////////////////////////////////////////////////*/

    /// @notice Clone with memory pointer uses createAgentWithMemory in registry.
    function test_clone_usesCreateAgentWithMemory() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "MemBot", "memory", "ipfs://mem");
        uint256 agentId = nft.tokenToAgent(tokenId);

        // Set memory pointer
        vm.prank(alice);
        registry.updateMemoryPointer(agentId, keccak256("big-blob"), 5000);

        // Clone — should create agent with memory via createAgentWithMemory
        vm.prank(alice);
        uint256 cloneTokenId = nft.clone(bob, tokenId, hex"ff", hex"01");
        uint256 cloneAgentId = nft.tokenToAgent(cloneTokenId);

        AevumRegistry.Agent memory cloneAgent = registry.getAgent(cloneAgentId);
        assertEq(cloneAgent.memoryPointer, keccak256("big-blob"));
        assertEq(cloneAgent.memorySize, 5000);
        assertEq(cloneAgent.owner, bob);
    }

    /*//////////////////////////////////////////////////////////////
           EDGE: transfer → clone → transfer chain
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfer, then clone, then transfer the clone — all ownership moves correctly.
    function test_transferCloneTransfer_chain() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "ChainBot", "memory", "ipfs://chain");
        uint256 agentId = nft.tokenToAgent(tokenId);

        vm.prank(alice);
        registry.updateMemoryPointer(agentId, keccak256("chain-root"), 200);

        // 1) Alice → Bob (transfer)
        vm.prank(alice);
        nft.transfer(alice, bob, tokenId, hex"aa", hex"01");
        assertEq(registry.ownerOf(agentId), bob);

        // 2) Bob clones to Carol
        vm.prank(bob);
        uint256 cloneTokenId = nft.clone(carol, tokenId, hex"bb", hex"02");
        uint256 cloneAgentId = nft.tokenToAgent(cloneTokenId);

        // 3) Carol → Alice (transfer clone)
        vm.prank(carol);
        nft.transfer(carol, alice, cloneTokenId, hex"cc", hex"03");
        assertEq(registry.ownerOf(cloneAgentId), alice);
        assertEq(nft.ownerOf(cloneTokenId), alice);

        // Verify all ownership is correct
        assertEq(registry.ownerOf(agentId), bob);
        assertEq(registry.ownerOf(cloneAgentId), alice);
    }
}
