// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {AevumRegistry} from "../src/AevumRegistry.sol";
import {AevumAgenticID} from "../src/AevumAgenticID.sol";
import {MockOracle} from "./mocks/MockOracle.sol";

/// @title AevumAgenticIDTest
/// @notice Foundry unit tests for the ERC-7857-inspired AevumAgenticID wrapper.
contract AevumAgenticIDTest is Test {
    AevumRegistry internal registry;
    AevumAgenticID internal nft;
    MockOracle internal oracle;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal admin = makeAddr("admin");

    uint256 internal aliceToken;

    event AgentMinted(
        uint256 indexed tokenId,
        uint256 indexed agentId,
        address indexed owner,
        string tokenURI
    );

    event AgentTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        bytes sealedKey,
        bytes proof
    );

    event AgentCloned(uint256 indexed sourceTokenId, uint256 indexed newTokenId, address indexed to, bytes sealedKey);

    event UsageAuthorized(uint256 indexed tokenId, address indexed executor, uint256 permissions);
    event UsageRevoked(uint256 indexed tokenId, address indexed executor);

    function setUp() public {
        registry = new AevumRegistry();
        oracle = new MockOracle();
        nft = new AevumAgenticID(address(registry), address(oracle), admin);

        // Authorise the NFT as a registrar.
        vm.prank(registry.owner());
        registry.setRegistrar(address(nft), true);

        // Mint an agent to Alice.
        vm.prank(alice);
        aliceToken = nft.mint(alice, "Atlas", "memory", "ipfs://enc/1");
    }

    /*//////////////////////////////////////////////////////////////
                                 mint
    //////////////////////////////////////////////////////////////*/

    function test_mint_createsAgentAndNft() public view {
        assertEq(nft.ownerOf(aliceToken), alice);
        assertEq(nft.tokenToAgent(aliceToken), 1);
        assertEq(nft.agentToToken(1), aliceToken);
        assertEq(registry.ownerOf(1), alice);
        assertEq(nft.tokenURI(aliceToken), "ipfs://enc/1");
        assertEq(nft.totalSupply(), 1);
    }

    function test_mint_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit AgentMinted(2, 2, bob, "ipfs://enc/2");
        vm.prank(bob);
        nft.mint(bob, "Bot", "privacy", "ipfs://enc/2");
    }

    function test_mint_revertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        nft.mint(address(0), "x", "y", "z");
    }

    /*//////////////////////////////////////////////////////////////
                               transfer
    //////////////////////////////////////////////////////////////*/

    function test_transfer_happyPath() public {
        bytes memory sealedKey = hex"deadbeef";
        bytes memory proof = hex"01";

        vm.recordLogs();
        vm.prank(alice);
        nft.transfer(alice, bob, aliceToken, sealedKey, proof);

        // OZ's `_transfer` emits the standard `Transfer` event, then we emit
        // our own `AgentTransferred`. Verify both were emitted.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawTransfer = false;
        bool sawAgentTransferred = false;
        for (uint256 i = 0; i < logs.length; i++) {
            bytes32 topic0 = logs[i].topics[0];
            if (topic0 == keccak256("Transfer(address,address,uint256)")) sawTransfer = true;
            if (topic0 == keccak256("AgentTransferred(uint256,address,address,bytes,bytes)")) sawAgentTransferred = true;
        }
        assertTrue(sawTransfer, "expected standard ERC-721 Transfer");
        assertTrue(sawAgentTransferred, "expected AgentTransferred");

        assertEq(nft.ownerOf(aliceToken), bob);
        // Registry ownership moves with the NFT.
        assertEq(registry.ownerOf(nft.tokenToAgent(aliceToken)), bob);
    }

    function test_transfer_revertsIfOracleDenies() public {
        oracle.setShouldVerify(false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OracleVerificationFailed()"));
        nft.transfer(alice, bob, aliceToken, hex"00", hex"00");
    }

    function test_transfer_revertsIfOracleNotSet() public {
        // Build a fresh NFT without an oracle.
        AevumRegistry reg2 = new AevumRegistry();
        AevumAgenticID nft2 = new AevumAgenticID(address(reg2), address(0), admin);
        vm.prank(reg2.owner());
        reg2.setRegistrar(address(nft2), true);
        vm.prank(alice);
        uint256 tid = nft2.mint(alice, "x", "y", "z");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OracleNotSet()"));
        nft2.transfer(alice, bob, tid, hex"00", hex"00");
    }

    /*//////////////////////////////////////////////////////////////
                                clone
    //////////////////////////////////////////////////////////////*/

    function test_clone_createsCopy() public {
        // Give the source agent a memory pointer so we can verify it's propagated.
        vm.prank(alice);
        registry.updateMemoryPointer(1, keccak256("root"), 123);

        bytes memory sealedKey = hex"abcd";
        bytes memory proof = hex"02";

        vm.recordLogs();
        vm.prank(alice);
        uint256 newTokenId = nft.clone(carol, aliceToken, sealedKey, proof);

        // Verify both AgentCloned and AgentCreated were emitted.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawCloned = false;
        bool sawCreated = false;
        for (uint256 i = 0; i < logs.length; i++) {
            bytes32 t0 = logs[i].topics[0];
            if (t0 == keccak256("AgentCloned(uint256,uint256,address,bytes)")) sawCloned = true;
            if (t0 == keccak256("AgentCreated(uint256,address,string,string,uint256)")) sawCreated = true;
        }
        assertTrue(sawCloned, "expected AgentCloned");
        assertTrue(sawCreated, "expected AgentCreated for the new registry agent");

        assertEq(newTokenId, 2);
        assertEq(nft.ownerOf(newTokenId), carol);
        // New agent is distinct, has same memory pointer.
        assertGt(nft.tokenToAgent(newTokenId), nft.tokenToAgent(aliceToken));
        AevumRegistry.Agent memory newAgent = registry.getAgent(nft.tokenToAgent(newTokenId));
        assertEq(newAgent.owner, carol);
        assertEq(newAgent.memoryPointer, keccak256("root"));
        assertEq(newAgent.memorySize, 123);
        // Source unchanged.
        assertEq(nft.ownerOf(aliceToken), alice);
    }

    function test_clone_revertsIfOracleDenies() public {
        oracle.setCloneShouldVerify(false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OracleVerificationFailed()"));
        nft.clone(carol, aliceToken, hex"00", hex"00");
    }

    /*//////////////////////////////////////////////////////////////
                          usage authorisation
    //////////////////////////////////////////////////////////////*/

    function test_authorizeAndRevokeUsage() public {
        vm.expectEmit(true, true, false, true);
        emit UsageAuthorized(aliceToken, carol, 0x07);
        vm.prank(alice);
        nft.authorizeUsage(aliceToken, carol, 0x07);
        assertEq(nft.usagePermissions(aliceToken, carol), 0x07);
        assertTrue(nft.isAuthorizedFor(aliceToken, carol));

        vm.expectEmit(true, true, false, false);
        emit UsageRevoked(aliceToken, carol);
        vm.prank(alice);
        nft.revokeUsage(aliceToken, carol);
        assertEq(nft.usagePermissions(aliceToken, carol), 0);
        assertFalse(nft.isAuthorizedFor(aliceToken, carol));
    }

    function test_revokeUsage_revertsWhenNone() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("NoUsageToRevoke(uint256,address)", aliceToken, carol));
        nft.revokeUsage(aliceToken, carol);
    }

    function test_setOracle_adminOnly() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setOracle(address(0xdead));

        address newOracle = address(0xbeef);
        vm.prank(admin);
        nft.setOracle(newOracle);
        assertEq(nft.oracle(), newOracle);
    }

    function test_setTokenURI_onlyOwner() public {
        vm.prank(alice);
        nft.setTokenURI(aliceToken, "ipfs://new");
        assertEq(nft.tokenURI(aliceToken), "ipfs://new");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("NotTokenOwner(address,uint256)", bob, aliceToken));
        nft.setTokenURI(aliceToken, "ipfs://hack");
    }
}
