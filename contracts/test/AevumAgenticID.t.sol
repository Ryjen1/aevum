// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

        vm.prank(registry.owner());
        registry.setRegistrar(address(nft), true);

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
        assertEq(registry.ownerOf(nft.tokenToAgent(aliceToken)), bob);
    }

    function test_transfer_revertsIfOracleDenies() public {
        oracle.setShouldVerify(false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OracleVerificationFailed()"));
        nft.transfer(alice, bob, aliceToken, hex"00", hex"00");
    }

    function test_transfer_revertsIfOracleNotSet() public {
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
        vm.prank(alice);
        registry.updateMemoryPointer(1, keccak256("root"), 123);

        bytes memory sealedKey = hex"abcd";
        bytes memory proof = hex"02";

        vm.recordLogs();
        vm.prank(alice);
        uint256 newTokenId = nft.clone(carol, aliceToken, sealedKey, proof);

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
        assertGt(nft.tokenToAgent(newTokenId), nft.tokenToAgent(aliceToken));
        AevumRegistry.Agent memory newAgent = registry.getAgent(nft.tokenToAgent(newTokenId));
        assertEq(newAgent.owner, carol);
        assertEq(newAgent.memoryPointer, keccak256("root"));
        assertEq(newAgent.memorySize, 123);
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

    /*//////////////////////////////////////////////////////////////
              ADDITIONAL TESTS — Wave 2 coverage
    //////////////////////////////////////////////////////////////*/

    /// @notice clone: works without memory pointer (zero memoryPointer branch)
    function test_clone_noMemoryPointer() public {
        bytes memory sealedKey = hex"abcd";
        bytes memory proof = hex"02";

        uint256 newTokenId = nft.clone(carol, aliceToken, sealedKey, proof);

        assertEq(newTokenId, 2);
        assertEq(nft.ownerOf(newTokenId), carol);
        AevumRegistry.Agent memory newAgent = registry.getAgent(nft.tokenToAgent(newTokenId));
        assertEq(newAgent.owner, carol);
        assertEq(newAgent.memoryPointer, bytes32(0));
        assertEq(newAgent.memorySize, 0);
    }

    /// @notice clone: reverts for non-existent token
    function test_clone_revertsForNonExistentToken() public {
        vm.expectRevert(abi.encodeWithSignature("AgentNotMinted(uint256)", 999));
        nft.clone(carol, 999, hex"00", hex"00");
    }

    /// @notice clone: reverts on zero address
    function test_clone_revertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        nft.clone(address(0), aliceToken, hex"00", hex"00");
    }

    /// @notice clone: reverts when oracle not set
    function test_clone_revertsWhenOracleNotSet() public {
        AevumRegistry reg2 = new AevumRegistry();
        AevumAgenticID nft2 = new AevumAgenticID(address(reg2), address(0), admin);
        vm.prank(reg2.owner());
        reg2.setRegistrar(address(nft2), true);
        vm.prank(alice);
        uint256 tid = nft2.mint(alice, "x", "y", "z");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OracleNotSet()"));
        nft2.clone(carol, tid, hex"00", hex"00");
    }

    /// @notice transfer: reverts for non-existent token
    function test_transfer_revertsForNonExistentToken() public {
        vm.expectRevert(abi.encodeWithSignature("AgentNotMinted(uint256)", 999));
        nft.transfer(alice, bob, 999, hex"00", hex"00");
    }

    /// @notice transfer: reverts on zero address
    function test_transfer_revertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        nft.transfer(alice, address(0), aliceToken, hex"00", hex"00");
    }

    /// @notice authorizeUsage: admin role can authorize
    function test_authorizeUsage_adminCanAuthorize() public {
        vm.prank(admin);
        nft.authorizeUsage(aliceToken, carol, 0x03);
        assertEq(nft.usagePermissions(aliceToken, carol), 0x03);
    }

    /// @notice authorizeUsage: reverts on zero address
    function test_authorizeUsage_revertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        nft.authorizeUsage(aliceToken, address(0), 0x01);
    }

    /// @notice authorizeUsage: reverts for non-owner
    function test_authorizeUsage_revertsForNonOwner() public {
        vm.prank(bob);
        vm.expectRevert();
        nft.authorizeUsage(aliceToken, carol, 0x01);
    }

    /// @notice revokeUsage: admin role can revoke
    function test_revokeUsage_adminCanRevoke() public {
        vm.prank(alice);
        nft.authorizeUsage(aliceToken, carol, 0x07);

        vm.prank(admin);
        nft.revokeUsage(aliceToken, carol);
        assertEq(nft.usagePermissions(aliceToken, carol), 0);
    }

    /// @notice revokeUsage: reverts for non-owner
    function test_revokeUsage_revertsForNonOwner() public {
        vm.prank(alice);
        nft.authorizeUsage(aliceToken, carol, 0x07);

        vm.prank(bob);
        vm.expectRevert();
        nft.revokeUsage(aliceToken, carol);
    }

    /// @notice setTokenURI: reverts for non-existent token
    function test_setTokenURI_revertsForNonExistentToken() public {
        vm.expectRevert(abi.encodeWithSignature("AgentNotMinted(uint256)", 999));
        nft.setTokenURI(999, "ipfs://x");
    }

    /// @notice tokenURI: reverts for non-existent token
    function test_tokenURI_revertsForNonExistentToken() public {
        vm.expectRevert();
        nft.tokenURI(999);
    }

    /// @notice supportsInterface: returns true for ERC721
    function test_supportsInterface_ERC721() public view {
        // ERC721 interfaceId = 0x80ac58cd
        assertTrue(nft.supportsInterface(0x80ac58cd));
    }

    /// @notice supportsInterface: returns true for AccessControl
    function test_supportsInterface_AccessControl() public view {
        // AccessControl interfaceId = 0x7965db0b
        assertTrue(nft.supportsInterface(0x7965db0b));
    }

    /// @notice supportsInterface: returns true for ERC165
    function test_supportsInterface_ERC165() public view {
        // ERC165 interfaceId = 0x01ffc9a7
        assertTrue(nft.supportsInterface(0x01ffc9a7));
    }

    /// @notice supportsInterface: returns false for random interface
    function test_supportsInterface_randomInterface() public view {
        assertFalse(nft.supportsInterface(0xdeadbeef));
    }

    /// @notice isAuthorizedFor: false when no permissions set
    function test_isAuthorizedFor_falseByDefault() public view {
        assertFalse(nft.isAuthorizedFor(aliceToken, carol));
    }

    /// @notice Multiple mints increment supply correctly
    function test_mint_multipleIncrementsSupply() public {
        vm.prank(bob);
        uint256 t2 = nft.mint(bob, "B1", "orchestrator", "ipfs://2");
        vm.prank(carol);
        uint256 t3 = nft.mint(carol, "C1", "privacy", "ipfs://3");

        assertEq(nft.totalSupply(), 3);
        assertEq(t2, 2);
        assertEq(t3, 3);
    }

    /// @notice Multiple agents, multiple clones
    function test_clone_multipleClones() public {
        vm.prank(alice);
        uint256 t2 = nft.mint(alice, "A2", "memory", "ipfs://a2");

        // setUp minted token 1, we minted token 2, so clones get 3 and 4
        vm.prank(alice);
        uint256 clone1 = nft.clone(bob, aliceToken, hex"aa", hex"01");
        vm.prank(alice);
        uint256 clone2 = nft.clone(carol, t2, hex"bb", hex"02");

        assertEq(clone1, 3);
        assertEq(clone2, 4);
        assertEq(nft.ownerOf(clone1), bob);
        assertEq(nft.ownerOf(clone2), carol);
    }

    /// @notice Fuzz: authorizeUsage with random non-zero permissions
    function testFuzz_authorizeUsage_randomPermissions(uint256 perms) public {
        vm.assume(perms != 0);
        vm.prank(alice);
        nft.authorizeUsage(aliceToken, carol, perms);
        assertEq(nft.usagePermissions(aliceToken, carol), perms);
        assertTrue(nft.isAuthorizedFor(aliceToken, carol));
    }

    /// @notice authorizeUsage with zero permissions — isAuthorizedFor returns false
    function test_authorizeUsage_zeroPermissions() public {
        vm.prank(alice);
        nft.authorizeUsage(aliceToken, carol, 0);
        assertEq(nft.usagePermissions(aliceToken, carol), 0);
        assertFalse(nft.isAuthorizedFor(aliceToken, carol));
    }
}
