// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AevumRegistry} from "./AevumRegistry.sol";

/// @title AevumMemory
/// @notice Append-only on-chain log of memory entries tied to agents in the
///         AevumRegistry. Each entry records hashes of encrypted content and
///         the 0G Storage root, plus an access list for permissioned memory.
/// @dev    Entry ids are auto-incremented per agent, starting at 1. The
///         contract does not store plaintext memory; only hashes and pointers
///         are recorded. All state-changing functions follow CEI.
contract AevumMemory is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    /// @notice Memory entry data type.
    enum DataType {
        RAW,         // 0
        EMBEDDING,   // 1
        CONVERSATION,// 2
        DOCUMENT     // 3
    }

    /// @notice A single memory entry.
    struct MemoryEntry {
        uint256 agentId;      // 0  - slot 0
        uint256 entryId;      // 1  - slot 0 (packed)
        bytes32 contentHash;  // 2  - slot 1
        bytes32 storageRoot;  // 3  - slot 1 (packed)
        uint8   dataType;     // 4  - slot 2
        uint64  timestamp;    // 5  - slot 2 (packed with dataType)
        uint256 parent;       // 6  - slot 3
    }

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a new memory entry is logged.
    event MemoryLogged(
        uint256 indexed agentId,
        uint256 indexed entryId,
        bytes32 contentHash,
        bytes32 storageRoot,
        uint8 dataType,
        uint256 parent,
        uint256 timestamp
    );

    /// @notice Emitted when access to an entry is granted.
    event AccessGranted(uint256 indexed agentId, uint256 indexed entryId, address indexed user);

    /// @notice Emitted when access to an entry is revoked.
    event AccessRevoked(uint256 indexed agentId, uint256 indexed entryId, address indexed user);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotAgentOwner(address caller, uint256 agentId);
    error AgentDoesNotExist(uint256 agentId);
    error EntryDoesNotExist(uint256 agentId, uint256 entryId);
    error ParentEntryMismatch(uint256 agentId, uint256 parentAgentId, uint256 parentEntryId);
    error ZeroContentHash();
    error ZeroStorageRoot();
    error InvalidDataType(uint8 dataType);

    /*//////////////////////////////////////////////////////////////
                              STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Composite key (agentId, entryId) => MemoryEntry.
    mapping(uint256 => mapping(uint256 => MemoryEntry)) private _entries;

    /// @dev agentId => total number of entries logged for that agent.
    mapping(uint256 => uint256) private _entryCounts;

    /// @dev agentId => index of ordered entry ids (latest first, index 0 = newest).
    mapping(uint256 => uint256[]) private _agentEntryIds;

    /// @dev (agentId, entryId) => user => has access.
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private _access;

    /// @dev The registry contract used to validate agents.
    AevumRegistry public immutable registry;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _registry Address of the deployed AevumRegistry contract.
    constructor(address _registry) Ownable(msg.sender) {
        registry = AevumRegistry(_registry);
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Reverts if `agentId` is not a registered agent.
    modifier onlyExistingAgent(uint256 agentId) {
        if (!registry.exists(agentId)) revert AgentDoesNotExist(agentId);
        _;
    }

    /// @dev Reverts if `msg.sender` is not the owner of `agentId`.
    modifier onlyAgentOwner(uint256 agentId) {
        address agentOwner = registry.ownerOf(agentId);
        if (agentOwner != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL — WRITE
    //////////////////////////////////////////////////////////////*/

    /// @notice Append a new memory entry for an agent. Only the agent owner may call.
    /// @param  agentId    Target agent id (must be registered in AevumRegistry).
    /// @param  contentHash Hash of the encrypted memory content.
    /// @param  storageRoot 0G Storage root hash for the encrypted payload.
    /// @param  dataType    One of the DataType enum values.
    /// @param  parent      Entry id this memory chains from (0 if none).
    /// @return entryId    The newly assigned entry id for the agent.
    function logMemory(
        uint256 agentId,
        bytes32 contentHash,
        bytes32 storageRoot,
        uint8 dataType,
        uint256 parent
    ) external nonReentrant onlyExistingAgent(agentId) onlyAgentOwner(agentId) returns (uint256 entryId) {
        // Checks
        if (contentHash == bytes32(0)) revert ZeroContentHash();
        if (storageRoot == bytes32(0)) revert ZeroStorageRoot();
        if (dataType > uint8(DataType.DOCUMENT)) revert InvalidDataType(dataType);
        if (parent != 0) {
            // Parent must be an existing entry for the same agent.
            if (_entries[agentId][parent].entryId == 0) {
                revert EntryDoesNotExist(agentId, parent);
            }
        }

        // Effects
        _entryCounts[agentId] += 1;
        entryId = _entryCounts[agentId];

        _entries[agentId][entryId] = MemoryEntry({
            agentId: agentId,
            entryId: entryId,
            contentHash: contentHash,
            storageRoot: storageRoot,
            dataType: dataType,
            timestamp: uint64(block.timestamp),
            parent: parent
        });

        // Append to the head so iteration is "latest first" without sorting on read.
        _agentEntryIds[agentId].push(entryId);

        // Interactions
        emit MemoryLogged(agentId, entryId, contentHash, storageRoot, dataType, parent, block.timestamp);
    }

    /// @notice Grant `user` access to a memory entry. Only the agent owner may call.
    function grantAccess(uint256 agentId, uint256 entryId, address user) external nonReentrant {
        if (user == address(0)) revert AgentDoesNotExist(0);
        if (_entries[agentId][entryId].entryId == 0) revert EntryDoesNotExist(agentId, entryId);

        // Check ownership via registry (CEI: external call after state write below is fine
        // because the function is read-only against registry, but we want to revert early).
        address agentOwner = registry.ownerOf(agentId);
        if (agentOwner != msg.sender) revert NotAgentOwner(msg.sender, agentId);

        // Effects
        _access[agentId][entryId][user] = true;

        // Interactions
        emit AccessGranted(agentId, entryId, user);
    }

    /// @notice Revoke `user`'s access to a memory entry. Only the agent owner may call.
    function revokeAccess(uint256 agentId, uint256 entryId, address user) external nonReentrant {
        if (_entries[agentId][entryId].entryId == 0) revert EntryDoesNotExist(agentId, entryId);

        address agentOwner = registry.ownerOf(agentId);
        if (agentOwner != msg.sender) revert NotAgentOwner(msg.sender, agentId);

        // Effects
        _access[agentId][entryId][user] = false;

        // Interactions
        emit AccessRevoked(agentId, entryId, user);
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL — VIEW / PURE
    //////////////////////////////////////////////////////////////*/

    /// @notice Fetch a single memory entry.
    function getMemory(uint256 agentId, uint256 entryId) external view returns (MemoryEntry memory) {
        MemoryEntry memory e = _entries[agentId][entryId];
        if (e.entryId == 0) revert EntryDoesNotExist(agentId, entryId);
        return e;
    }

    /// @notice Paginated list of entry ids for an agent, latest first.
    /// @param  agentId Target agent id.
    /// @param  offset  Number of newest entries to skip (0 = start at the newest).
    /// @param  limit   Maximum number of ids to return.
    /// @return entryIds Array of entry ids (subset of all entries).
    function getAgentMemories(uint256 agentId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory entryIds)
    {
        uint256[] storage all = _agentEntryIds[agentId];
        uint256 total = all.length;
        if (offset >= total) {
            return new uint256[](0);
        }

        // The storage array is in push order, i.e. oldest at index 0 and the
        // newest at the last index. We want to return entries in reverse order,
        // starting at the newest and skipping `offset` newest entries.
        uint256 firstExclusive = total - offset; // index immediately after the first entry we keep
        uint256 count = limit;
        if (count > firstExclusive) count = firstExclusive;

        entryIds = new uint256[](count);
        for (uint256 k = 0; k < count;) {
            entryIds[k] = all[firstExclusive - 1 - k];
            unchecked { ++k; }
        }
    }

    /// @notice Check whether `user` can read an entry. The agent owner is always allowed.
    function hasAccess(uint256 agentId, uint256 entryId, address user) external view returns (bool) {
        if (_entries[agentId][entryId].entryId == 0) revert EntryDoesNotExist(agentId, entryId);
        if (user == registry.ownerOf(agentId)) return true;
        return _access[agentId][entryId][user];
    }

    /// @notice Total number of entries ever logged for an agent.
    function totalEntries(uint256 agentId) external view returns (uint256) {
        return _entryCounts[agentId];
    }

    /// @notice Returns the latest entry id for an agent (0 if none).
    function latestEntryId(uint256 agentId) external view returns (uint256) {
        return _entryCounts[agentId];
    }
}
