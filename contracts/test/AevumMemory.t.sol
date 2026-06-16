// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AevumRegistry} from "../src/AevumRegistry.sol";
import {AevumMemory} from "../src/AevumMemory.sol";

/// @title AevumMemoryTest
/// @notice Foundry unit tests for AevumMemory.
contract AevumMemoryTest is Test {
    AevumRegistry internal registry;
    AevumMemory internal memoryLog;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal aliceAgent;
    uint256 internal bobAgent;

    event MemoryLogged(
        uint256 indexed agentId,
        uint256 indexed entryId,
        bytes32 contentHash,
        bytes32 storageRoot,
        uint8 dataType,
        uint256 parent,
        uint256 timestamp
    );

    event AccessGranted(uint256 indexed agentId, uint256 indexed entryId, address indexed user);
    event AccessRevoked(uint256 indexed agentId, uint256 indexed entryId, address indexed user);

    function setUp() public {
        registry = new AevumRegistry();
        memoryLog = new AevumMemory(address(registry));

        vm.prank(alice);
        aliceAgent = registry.createAgent("A", "memory");

        vm.prank(bob);
        bobAgent = registry.createAgent("B", "orchestrator");
    }

    /*//////////////////////////////////////////////////////////////
                              logMemory
    //////////////////////////////////////////////////////////////*/

    function test_logMemory_happyPath() public {
        bytes32 content = keccak256("encrypted");
        bytes32 root = keccak256("storage-root");

        vm.expectEmit(true, true, false, true);
        emit MemoryLogged(aliceAgent, 1, content, root, uint8(AevumMemory.DataType.RAW), 0, block.timestamp);

        vm.prank(alice);
        uint256 entryId = memoryLog.logMemory(aliceAgent, content, root, uint8(AevumMemory.DataType.RAW), 0);
        assertEq(entryId, 1);

        AevumMemory.MemoryEntry memory e = memoryLog.getMemory(aliceAgent, 1);
        assertEq(e.agentId, aliceAgent);
        assertEq(e.entryId, 1);
        assertEq(e.contentHash, content);
        assertEq(e.storageRoot, root);
        assertEq(uint256(e.dataType), uint256(AevumMemory.DataType.RAW));
        assertEq(e.parent, 0);
        assertEq(e.timestamp, uint64(block.timestamp));
    }

    function test_logMemory_revertsForUnknownAgent() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("AgentDoesNotExist(uint256)", 999));
        memoryLog.logMemory(999, keccak256("x"), keccak256("y"), 0, 0);
    }

    function test_logMemory_revertsForNonOwner() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("NotAgentOwner(address,uint256)", bob, aliceAgent));
        memoryLog.logMemory(aliceAgent, keccak256("x"), keccak256("y"), 0, 0);
    }

    function test_logMemory_revertsOnZeroContentHash() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("ZeroContentHash()"));
        memoryLog.logMemory(aliceAgent, bytes32(0), keccak256("y"), 0, 0);
    }

    function test_logMemory_revertsOnZeroStorageRoot() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("ZeroStorageRoot()"));
        memoryLog.logMemory(aliceAgent, keccak256("x"), bytes32(0), 0, 0);
    }

    function test_logMemory_revertsOnInvalidDataType() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("InvalidDataType(uint8)", 200));
        memoryLog.logMemory(aliceAgent, keccak256("x"), keccak256("y"), 200, 0);
    }

    function test_logMemory_parentChain() public {
        bytes32 c1 = keccak256("e1");
        bytes32 c2 = keccak256("e2");
        bytes32 c3 = keccak256("e3");
        bytes32 r = keccak256("root");

        vm.startPrank(alice);
        uint256 e1 = memoryLog.logMemory(aliceAgent, c1, r, 1, 0);
        uint256 e2 = memoryLog.logMemory(aliceAgent, c2, r, 1, e1);
        uint256 e3 = memoryLog.logMemory(aliceAgent, c3, r, 1, e2);
        vm.stopPrank();

        assertEq(memoryLog.getMemory(aliceAgent, e1).parent, 0);
        assertEq(memoryLog.getMemory(aliceAgent, e2).parent, e1);
        assertEq(memoryLog.getMemory(aliceAgent, e3).parent, e2);
    }

    function test_logMemory_revertsOnInvalidParent() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("EntryDoesNotExist(uint256,uint256)", aliceAgent, 99));
        memoryLog.logMemory(aliceAgent, keccak256("x"), keccak256("y"), 0, 99);
    }

    function test_logMemory_supportsAllDataTypes() public {
        vm.startPrank(alice);
        memoryLog.logMemory(aliceAgent, keccak256("a"), keccak256("r"), 0, 0);
        memoryLog.logMemory(aliceAgent, keccak256("b"), keccak256("r"), 1, 0);
        memoryLog.logMemory(aliceAgent, keccak256("c"), keccak256("r"), 2, 0);
        memoryLog.logMemory(aliceAgent, keccak256("d"), keccak256("r"), 3, 0);
        vm.stopPrank();

        assertEq(memoryLog.totalEntries(aliceAgent), 4);
    }

    /*//////////////////////////////////////////////////////////////
                            pagination
    //////////////////////////////////////////////////////////////*/

    function test_getAgentMemories_latestFirstPagination() public {
        vm.startPrank(alice);
        for (uint256 i = 1; i <= 5; i++) {
            memoryLog.logMemory(aliceAgent, bytes32(i), keccak256("r"), 0, 0);
        }
        vm.stopPrank();

        // Latest first: page 0 should be [5, 4, 3]
        uint256[] memory page1 = memoryLog.getAgentMemories(aliceAgent, 0, 3);
        assertEq(page1.length, 3);
        assertEq(page1[0], 5);
        assertEq(page1[1], 4);
        assertEq(page1[2], 3);

        // Page 1: [2, 1]
        uint256[] memory page2 = memoryLog.getAgentMemories(aliceAgent, 3, 3);
        assertEq(page2.length, 2);
        assertEq(page2[0], 2);
        assertEq(page2[1], 1);

        // Past the end -> empty
        uint256[] memory empty = memoryLog.getAgentMemories(aliceAgent, 100, 10);
        assertEq(empty.length, 0);
    }

    function test_getAgentMemories_emptyForUnknownAgent() public view {
        uint256[] memory r = memoryLog.getAgentMemories(999, 0, 10);
        assertEq(r.length, 0);
    }

    /*//////////////////////////////////////////////////////////////
                          access control
    //////////////////////////////////////////////////////////////*/

    function test_grantAndRevokeAccess() public {
        vm.prank(alice);
        uint256 id = memoryLog.logMemory(aliceAgent, keccak256("x"), keccak256("y"), 0, 0);

        // Initially no one but the owner.
        assertFalse(memoryLog.hasAccess(aliceAgent, id, bob));
        assertTrue(memoryLog.hasAccess(aliceAgent, id, alice));

        vm.expectEmit(true, true, true, false);
        emit AccessGranted(aliceAgent, id, bob);
        vm.prank(alice);
        memoryLog.grantAccess(aliceAgent, id, bob);
        assertTrue(memoryLog.hasAccess(aliceAgent, id, bob));

        vm.expectEmit(true, true, true, false);
        emit AccessRevoked(aliceAgent, id, bob);
        vm.prank(alice);
        memoryLog.revokeAccess(aliceAgent, id, bob);
        assertFalse(memoryLog.hasAccess(aliceAgent, id, bob));
    }

    function test_hasAccess_revertsOnMissingEntry() public {
        vm.expectRevert(abi.encodeWithSignature("EntryDoesNotExist(uint256,uint256)", aliceAgent, 7));
        memoryLog.hasAccess(aliceAgent, 7, bob);
    }

    function test_grantAccess_onlyOwner() public {
        vm.prank(alice);
        uint256 id = memoryLog.logMemory(aliceAgent, keccak256("x"), keccak256("y"), 0, 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("NotAgentOwner(address,uint256)", bob, aliceAgent));
        memoryLog.grantAccess(aliceAgent, id, carol);
    }

    function test_ownerChangeUpdatesAccess() public {
        vm.prank(alice);
        uint256 id = memoryLog.logMemory(aliceAgent, keccak256("x"), keccak256("y"), 0, 0);

        // Alice transfers the agent to Bob; Bob is now the implicit owner.
        vm.prank(alice);
        registry.transferOwnership(aliceAgent, bob);

        assertTrue(memoryLog.hasAccess(aliceAgent, id, bob));
        assertFalse(memoryLog.hasAccess(aliceAgent, id, alice));

        // Bob (new owner) can grant access to Alice.
        vm.prank(bob);
        memoryLog.grantAccess(aliceAgent, id, alice);
        assertTrue(memoryLog.hasAccess(aliceAgent, id, alice));
    }

    function test_logMemory_incrementsPerAgent() public {
        vm.startPrank(alice);
        uint256 a1 = memoryLog.logMemory(aliceAgent, keccak256("a"), keccak256("r"), 0, 0);
        uint256 a2 = memoryLog.logMemory(aliceAgent, keccak256("b"), keccak256("r"), 0, 0);
        vm.stopPrank();

        vm.prank(bob);
        uint256 b1 = memoryLog.logMemory(bobAgent, keccak256("c"), keccak256("r"), 0, 0);

        assertEq(a1, 1);
        assertEq(a2, 2);
        assertEq(b1, 1, "entry id counter is per-agent");
    }
}
