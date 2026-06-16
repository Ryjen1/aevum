// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AevumRegistry} from "../src/AevumRegistry.sol";

/// @title AevumRegistryTest
/// @notice Foundry unit tests for AevumRegistry.
contract AevumRegistryTest is Test {
    AevumRegistry internal registry;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    event AgentCreated(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string role,
        uint256 timestamp
    );

    event MemoryUpdated(
        uint256 indexed agentId,
        bytes32 oldRoot,
        bytes32 newRoot,
        uint256 size,
        uint256 timestamp
    );

    event OwnershipTransferred(
        uint256 indexed agentId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    event RegistrarSet(address indexed registrar, bool allowed);

    function setUp() public {
        registry = new AevumRegistry();
    }

    /*//////////////////////////////////////////////////////////////
                            createAgent
    //////////////////////////////////////////////////////////////*/

    function test_createAgent_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit AgentCreated(1, alice, "Atlas-1", "memory", block.timestamp);
        vm.prank(alice);
        uint256 id = registry.createAgent("Atlas-1", "memory");
        assertEq(id, 1, "first agentId should be 1");
    }

    function test_createAgent_storesStruct() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("Atlas", "orchestrator");

        AevumRegistry.Agent memory a = registry.getAgent(id);
        assertEq(a.name, "Atlas");
        assertEq(a.role, "orchestrator");
        assertEq(a.owner, alice);
        assertEq(a.memoryPointer, bytes32(0));
        assertEq(a.memorySize, 0);
        assertEq(a.createdAt, uint64(block.timestamp));
        assertEq(a.lastUpdated, uint64(block.timestamp));
    }

    function test_createAgent_revertsOnEmptyName() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("EmptyName()"));
        registry.createAgent("", "memory");
    }

    function test_createAgent_incrementsId() public {
        vm.startPrank(alice);
        uint256 a1 = registry.createAgent("A", "memory");
        uint256 a2 = registry.createAgent("B", "orchestrator");
        uint256 a3 = registry.createAgent("C", "privacy");
        vm.stopPrank();

        assertEq(a1, 1);
        assertEq(a2, 2);
        assertEq(a3, 3);
        assertEq(registry.totalAgents(), 3);
    }

    function test_getAgentsByOwner_returnsAll() public {
        vm.prank(alice);
        uint256 a1 = registry.createAgent("A", "memory");
        vm.prank(bob);
        uint256 b1 = registry.createAgent("B", "memory");
        vm.prank(alice);
        uint256 a2 = registry.createAgent("C", "orchestrator");

        uint256[] memory aliceAgents = registry.getAgentsByOwner(alice);
        assertEq(aliceAgents.length, 2);
        assertEq(aliceAgents[0], a1);
        assertEq(aliceAgents[1], a2);

        uint256[] memory bobAgents = registry.getAgentsByOwner(bob);
        assertEq(bobAgents.length, 1);
        assertEq(bobAgents[0], b1);

        uint256[] memory empty = registry.getAgentsByOwner(carol);
        assertEq(empty.length, 0);
    }

    /*//////////////////////////////////////////////////////////////
                          updateMemoryPointer
    //////////////////////////////////////////////////////////////*/

    function test_updateMemoryPointer_onlyOwner() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");

        bytes32 root = keccak256("encrypted-blob");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("NotAgentOwner(address,uint256)", bob, id));
        registry.updateMemoryPointer(id, root, 1024);
    }

    function test_updateMemoryPointer_happyPath() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");

        bytes32 root1 = keccak256("blob-1");
        bytes32 root2 = keccak256("blob-2");

        vm.expectEmit(true, false, false, true);
        emit MemoryUpdated(id, bytes32(0), root1, 1024, block.timestamp);
        vm.prank(alice);
        registry.updateMemoryPointer(id, root1, 1024);

        AevumRegistry.Agent memory a = registry.getAgent(id);
        assertEq(a.memoryPointer, root1);
        assertEq(a.memorySize, 1024);
        assertGe(a.lastUpdated, a.createdAt);

        vm.expectEmit(true, false, false, true);
        emit MemoryUpdated(id, root1, root2, 2048, block.timestamp);
        vm.prank(alice);
        registry.updateMemoryPointer(id, root2, 2048);

        a = registry.getAgent(id);
        assertEq(a.memoryPointer, root2);
        assertEq(a.memorySize, 2048);
    }

    function test_updateMemoryPointer_revertsOnZeroRoot() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("ZeroMemoryPointer()"));
        registry.updateMemoryPointer(id, bytes32(0), 100);
    }

    function test_updateMemoryPointer_revertsForMissingAgent() public {
        vm.expectRevert(abi.encodeWithSignature("AgentDoesNotExist(uint256)", 999));
        registry.updateMemoryPointer(999, keccak256("x"), 1);
    }

    /*//////////////////////////////////////////////////////////////
                          transferOwnership
    //////////////////////////////////////////////////////////////*/

    function test_transferOwnership_happyPath() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");

        vm.expectEmit(true, true, true, true);
        emit OwnershipTransferred(id, alice, bob, block.timestamp);
        vm.prank(alice);
        registry.transferOwnership(id, bob);

        AevumRegistry.Agent memory a = registry.getAgent(id);
        assertEq(a.owner, bob);

        uint256[] memory aliceAgents = registry.getAgentsByOwner(alice);
        assertEq(aliceAgents.length, 0);
        uint256[] memory bobAgents = registry.getAgentsByOwner(bob);
        assertEq(bobAgents.length, 1);
        assertEq(bobAgents[0], id);
    }

    function test_transferOwnership_onlyOwner() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("NotAgentOwner(address,uint256)", bob, id));
        registry.transferOwnership(id, carol);
    }

    function test_transferOwnership_revertsOnZeroAddress() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        registry.transferOwnership(id, address(0));
    }

    function test_transferOwnership_revertsForMissingAgent() public {
        vm.expectRevert(abi.encodeWithSignature("AgentDoesNotExist(uint256)", 999));
        registry.transferOwnership(999, bob);
    }

    /*//////////////////////////////////////////////////////////////
                       helpers / view functions
    //////////////////////////////////////////////////////////////*/

    function test_getAgent_revertsForMissing() public {
        vm.expectRevert(abi.encodeWithSignature("AgentDoesNotExist(uint256)", 42));
        registry.getAgent(42);
    }

    function test_ownerOf_andExists() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        assertTrue(registry.exists(id));
        assertEq(registry.ownerOf(id), alice);

        assertFalse(registry.exists(999));
    }

    function test_memoryPointerOf() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        bytes32 r = keccak256("blob");
        vm.prank(alice);
        registry.updateMemoryPointer(id, r, 64);
        assertEq(registry.memoryPointerOf(id), r);
    }

    /*//////////////////////////////////////////////////////////////
                       registrar pattern (interop)
    //////////////////////////////////////////////////////////////*/

    function test_setRegistrar_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        registry.setRegistrar(alice, true);
    }

    function test_createAgentFor_happyPath() public {
        vm.prank(registry.owner());
        registry.setRegistrar(address(this), true);

        uint256 id = registry.createAgentFor("Bot", "memory", bob);
        assertEq(id, 1);
        assertEq(registry.ownerOf(id), bob);
    }

    function test_createAgentFor_revertsForNonRegistrar() public {
        vm.expectRevert(abi.encodeWithSignature("NotRegistrar(address)", address(this)));
        registry.createAgentFor("Bot", "memory", bob);
    }

    function test_createAgentFor_revertsOnZeroOwner() public {
        vm.prank(registry.owner());
        registry.setRegistrar(address(this), true);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        registry.createAgentFor("Bot", "memory", address(0));
    }

    function test_transferOwnershipFor_onlyRegistrar() public {
        vm.expectRevert(abi.encodeWithSignature("NotRegistrar(address)", address(this)));
        registry.transferOwnershipFor(1, alice, bob);
    }

    function test_transferOwnershipFor_happyPath() public {
        // Create agent via normal flow, then exercise the registrar path.
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");

        vm.prank(registry.owner());
        registry.setRegistrar(address(this), true);
        registry.transferOwnershipFor(id, alice, bob);

        assertEq(registry.ownerOf(id), bob);
        assertEq(registry.getAgentsByOwner(alice).length, 0);
        assertEq(registry.getAgentsByOwner(bob).length, 1);
    }

    function test_transferOwnershipFor_revertsOnStaleFrom() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        vm.prank(alice);
        registry.transferOwnership(id, bob);

        vm.prank(registry.owner());
        registry.setRegistrar(address(this), true);
        // From address doesn't match the current owner.
        vm.expectRevert(abi.encodeWithSignature("NotCurrentOwner(address,uint256)", alice, id));
        registry.transferOwnershipFor(id, alice, carol);
    }

    function test_updateMemoryPointerFor_happyPath() public {
        vm.prank(alice);
        uint256 id = registry.createAgent("A", "memory");
        vm.prank(registry.owner());
        registry.setRegistrar(address(this), true);
        registry.updateMemoryPointerFor(id, alice, keccak256("r"), 100);
        assertEq(registry.memoryPointerOf(id), keccak256("r"));
    }
}
