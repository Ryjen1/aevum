// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AevumRegistry} from "./AevumRegistry.sol";

/// @title ITransferVerifier
/// @notice Minimal interface for the TEE/zk oracle that authorises ERC-7857-style
///         agent transfers. In production this would be a 0G Compute TEE service.
interface ITransferVerifier {
    function verifyTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external view returns (bool);

    function verifyClone(
        address to,
        uint256 sourceTokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external view returns (bool);
}

/// @title AevumAgenticID
/// @notice ERC-721 wrapper that mints AI agents (registered in AevumRegistry) as
///         transferable, encrypted-metadata NFTs. Implements the core pieces of
///         ERC-7857 — verifiable transfer with a sealed key, cloning, and
///         per-executor usage authorisation — guarded by an oracle address that
///         (in production) is a 0G Compute TEE service.
/// @dev    The contract does not store plaintext agent state; the token URI points
///         to encrypted metadata on 0G Storage, and the sealed key is supplied at
///         transfer time by the oracle.
contract AevumAgenticID is ERC721, Ownable, AccessControl, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 ROLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Can update the trusted oracle address.
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when an agent NFT is minted.
    event AgentMinted(
        uint256 indexed tokenId,
        uint256 indexed agentId,
        address indexed owner,
        string tokenURI
    );

    /// @notice Emitted when an agent NFT is transferred with a sealed key + proof.
    event AgentTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        bytes sealedKey,
        bytes proof
    );

    /// @notice Emitted when an agent NFT is cloned to a new owner.
    event AgentCloned(
        uint256 indexed sourceTokenId,
        uint256 indexed newTokenId,
        address indexed to,
        bytes sealedKey
    );

    /// @notice Emitted when usage of an agent is authorised for an executor.
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor, uint256 permissions);

    /// @notice Emitted when usage authorisation is revoked.
    event UsageRevoked(uint256 indexed tokenId, address indexed executor);

    /// @notice Emitted when the trusted oracle address is updated.
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error OracleNotSet();
    error OracleVerificationFailed();
    error AgentNotMinted(uint256 tokenId);
    error ZeroAddress();
    error TokenAlreadyLinked(uint256 tokenId);
    error NoUsageToRevoke(uint256 tokenId, address executor);
    error NotTokenOwner(address caller, uint256 tokenId);

    /*//////////////////////////////////////////////////////////////
                              STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev tokenId => AevumRegistry agentId.
    mapping(uint256 => uint256) public tokenToAgent;

    /// @dev agentId => tokenId (reverse lookup; 0 if unminted).
    mapping(uint256 => uint256) public agentToToken;

    /// @dev tokenId => tokenURI (encrypted metadata pointer on 0G Storage).
    mapping(uint256 => string) private _tokenURIs;

    /// @dev tokenId => executor => permissions bitmap (uint256).
    mapping(uint256 => mapping(address => uint256)) public usagePermissions;

    /// @dev TEE oracle address. Zero means transfers are rejected.
    address public oracle;

    /// @dev Trusted AevumRegistry contract.
    AevumRegistry public immutable registry;

    /// @dev token id counter (1-indexed).
    uint256 private _nextTokenId;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _registry   Address of the deployed AevumRegistry.
    /// @param _oracle     Initial trusted oracle address (can be zero; set before transfers).
    /// @param admin       Address that receives ORACLE_ADMIN_ROLE.
    constructor(address _registry, address _oracle, address admin) ERC721("Aevum Agentic ID", "AEVUMID") Ownable(msg.sender) {
        if (_registry == address(0)) revert ZeroAddress();
        registry = AevumRegistry(_registry);
        oracle = _oracle;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOracle() {
        if (oracle == address(0)) revert OracleNotSet();
        if (msg.sender != oracle) revert OracleVerificationFailed();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL — WRITE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint a new agent NFT. Atomically creates the underlying AevumRegistry
    ///         agent and assigns it to `to`.
    /// @param  to        Recipient of the new NFT (and the AevumRegistry owner).
    /// @param  agentName Human-readable agent name.
    /// @param  role      Functional role of the agent.
    /// @param  uri       Token URI (encrypted metadata on 0G Storage).
    /// @return tokenId   The newly minted token id.
    function mint(address to, string calldata agentName, string calldata role, string calldata uri)
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ZeroAddress();

        // Effects — increment counter first for CEI ordering.
        _nextTokenId += 1;
        tokenId = _nextTokenId;
        _tokenURIs[tokenId] = uri;

        // Interactions — registry call creates the agent.
        uint256 agentId = registry.createAgentFor(agentName, role, to);

        // Effects — complete state writes after external call.
        tokenToAgent[tokenId] = agentId;
        agentToToken[agentId] = tokenId;

        _safeMint(to, tokenId);
        emit AgentMinted(tokenId, agentId, to, uri);
    }

    /// @notice Transfer an agent NFT with oracle-verified re-encryption. The oracle
    ///         is expected to provide a `sealedKey` encrypted for `to` and a TEE
    ///         attestation `proof`. The standard ERC-721 ownership transfer then
    ///         runs through OZ's _update hook.
    /// @param  from      Current owner of the token.
    /// @param  to        Recipient.
    /// @param  tokenId   Token being transferred.
    /// @param  sealedKey Encrypted agent secret bound to `to`.
    /// @param  proof     Oracle / TEE attestation.
    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external nonReentrant {
        if (oracle == address(0)) revert OracleNotSet();
        if (to == address(0)) revert ZeroAddress();
        if (tokenToAgent[tokenId] == 0) revert AgentNotMinted(tokenId);

        // Checks — oracle verification.
        bool ok = ITransferVerifier(oracle).verifyTransfer(from, to, tokenId, sealedKey, proof);
        if (!ok) revert OracleVerificationFailed();

        // Effects — standard ERC-721 transfer (caller must be authorised by OZ).
        _transfer(from, to, tokenId);

        // Move AevumRegistry ownership in lock-step with the NFT. We use the
        // permissioned registrar entry-point so the NFT contract (not the NFT
        // owner) is the caller of the registry.
        registry.transferOwnershipFor(tokenToAgent[tokenId], from, to);

        // Interactions
        emit AgentTransferred(tokenId, from, to, sealedKey, proof);
    }

    /// @notice Clone an agent NFT. Mints a new NFT for `to` that references a
    ///         fresh AevumRegistry agent with the same memory pointer/size as
    ///         the source. The oracle attests that the new sealed key is bound
    ///         to `to`.
    /// @param  to            Recipient of the cloned NFT.
    /// @param  sourceTokenId Token being cloned (must already exist).
    /// @param  sealedKey     Encrypted key for the clone, bound to `to`.
    /// @param  proof         Oracle / TEE attestation.
    /// @return newTokenId    Id of the freshly minted clone.
    function clone(address to, uint256 sourceTokenId, bytes calldata sealedKey, bytes calldata proof)
        external
        nonReentrant
        returns (uint256 newTokenId)
    {
        if (oracle == address(0)) revert OracleNotSet();
        if (to == address(0)) revert ZeroAddress();
        if (tokenToAgent[sourceTokenId] == 0) revert AgentNotMinted(sourceTokenId);

        // Checks — oracle verification.
        bool ok = ITransferVerifier(oracle).verifyClone(to, sourceTokenId, sealedKey, proof);
        if (!ok) revert OracleVerificationFailed();

        // Effects — read source data and increment counter before external calls.
        AevumRegistry.Agent memory src = registry.getAgent(tokenToAgent[sourceTokenId]);
        string memory uri = _tokenURIs[sourceTokenId];
        _nextTokenId += 1;
        newTokenId = _nextTokenId;
        _tokenURIs[newTokenId] = uri;

        // Interactions — registry call creates the clone agent.
        uint256 newAgentId;
        if (src.memoryPointer == bytes32(0)) {
            newAgentId = registry.createAgentFor(src.name, src.role, to);
        } else {
            newAgentId =
                registry.createAgentWithMemory(src.name, src.role, to, src.memoryPointer, src.memorySize);
        }

        // Effects — complete state writes after external call.
        tokenToAgent[newTokenId] = newAgentId;
        agentToToken[newAgentId] = newTokenId;

        _safeMint(to, newTokenId);
        emit AgentCloned(sourceTokenId, newTokenId, to, sealedKey);
    }

    /// @notice Authorise `executor` to use the agent represented by `tokenId`.
    ///         `permissions` is an opaque bitmap (e.g. bit 0 = read memory,
    ///         bit 1 = write memory, bit 2 = invoke model).
    /// @dev    Only the token owner or an account with the default admin role
    ///         may grant / revoke.
    function authorizeUsage(uint256 tokenId, address executor, uint256 permissions) external {
        _requireOwned(tokenId);
        if (executor == address(0)) revert ZeroAddress();
        address tokenOwner = _ownerOf(tokenId);
        if (msg.sender != tokenOwner && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert OracleVerificationFailed(); // reuse: caller not authorised
        }
        usagePermissions[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor, permissions);
    }

    /// @notice Revoke any usage authorisation previously granted to `executor`.
    function revokeUsage(uint256 tokenId, address executor) external {
        _requireOwned(tokenId);
        address tokenOwner = _ownerOf(tokenId);
        if (msg.sender != tokenOwner && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert OracleVerificationFailed();
        }
        if (usagePermissions[tokenId][executor] == 0) revert NoUsageToRevoke(tokenId, executor);
        usagePermissions[tokenId][executor] = 0;
        emit UsageRevoked(tokenId, executor);
    }

    /// @notice Update the trusted oracle address. Caller must have ORACLE_ADMIN_ROLE.
    function setOracle(address newOracle) external onlyRole(ORACLE_ADMIN_ROLE) {
        address previous = oracle;
        oracle = newOracle;
        emit OracleUpdated(previous, newOracle);
    }

    /// @notice Set the per-token URI (encrypted metadata pointer on 0G Storage).
    function setTokenURI(uint256 tokenId, string calldata uri) external {
        address tokenOwner = _ownerOf(tokenId);
        if (tokenOwner == address(0)) revert AgentNotMinted(tokenId);
        if (tokenOwner != msg.sender) revert NotTokenOwner(msg.sender, tokenId);
        _tokenURIs[tokenId] = uri;
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL — VIEW / PURE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ERC721
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    /// @notice Total supply of minted agent NFTs.
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Convenience getter — does `executor` have any non-zero permission on `tokenId`?
    function isAuthorizedFor(uint256 tokenId, address executor) external view returns (bool) {
        return usagePermissions[tokenId][executor] != 0;
    }

    /// @notice See {IERC165-supportsInterface}. Adds AccessControl + ERC721.
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
