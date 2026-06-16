// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AevumRegistry
/// @notice On-chain identity registry for AI agents. Each agent is owned by a wallet
///         and tracks a pointer to the agent's encrypted memory on 0G Storage.
/// @dev    Agent ids are auto-incremented and 1-indexed. Storage layout packs related
///         fields together to minimise SLOADs. The contract is non-upgradeable and uses
///         CEI ordering for all state-changing functions.
contract AevumRegistry is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    /// @notice Data type for an on-chain AI agent.
    struct Agent {
        string name;          // 0  - slot 0
        string role;          // 1  - slot 1
        bytes32 memoryPointer; // 2 - slot 2
        uint256 memorySize;   // 3  - slot 3
        address owner;        // 4  - slot 4
        uint64 createdAt;     // 5  - slot 5 (packed with lastUpdated below)
        uint64 lastUpdated;   // 6  - slot 5 (packed with createdAt)
    }

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a new agent identity is registered.
    event AgentCreated(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string role,
        uint256 timestamp
    );

    /// @notice Emitted when an agent's memory pointer is updated.
    event MemoryUpdated(
        uint256 indexed agentId,
        bytes32 oldRoot,
        bytes32 newRoot,
        uint256 size,
        uint256 timestamp
    );

    /// @notice Emitted when ownership of an agent is transferred.
    event OwnershipTransferred(
        uint256 indexed agentId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    /// @notice Emitted when a registrar's authorisation is updated.
    event RegistrarSet(address indexed registrar, bool allowed);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @dev Caller is not the agent owner.
    error NotAgentOwner(address caller, uint256 agentId);

    /// @dev Agent id does not exist.
    error AgentDoesNotExist(uint256 agentId);

    /// @dev Empty name string.
    error EmptyName();

    /// @dev Zero address passed where a real address is required.
    error ZeroAddress();

    /// @dev Storage root is the zero hash.
    error ZeroMemoryPointer();

    /// @dev Caller is not an authorized registrar.
    error NotRegistrar(address caller);

    /// @dev `from` is not the current owner of the agent.
    error NotCurrentOwner(address from, uint256 agentId);

    /*//////////////////////////////////////////////////////////////
                              STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev agentId => Agent data.
    mapping(uint256 => Agent) private _agents;

    /// @dev owner => list of agent ids they own.
    mapping(address => uint256[]) private _ownedAgents;

    /// @dev Cumulative counter of agents ever created (also serves as next id).
    uint256 private _nextAgentId;

    /// @dev Authorized contracts that may create agents on behalf of a user.
    mapping(address => bool) private _registrars;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy the registry. The deployer becomes the contract owner.
    constructor() Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL — WRITE
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new agent identity. The caller becomes the owner.
    /// @param  name Human-readable agent name (e.g. "Atlas-1").
    /// @param  role Functional role (e.g. "memory", "orchestrator", "privacy").
    /// @return agentId The newly assigned agent id (1-indexed).
    function createAgent(string calldata name, string calldata role) external nonReentrant returns (uint256 agentId) {
        // Checks
        if (bytes(name).length == 0) revert EmptyName();

        // Effects
        _nextAgentId += 1;
        agentId = _nextAgentId;

        uint64 ts = uint64(block.timestamp);
        _agents[agentId] = Agent({
            name: name,
            role: role,
            memoryPointer: bytes32(0),
            memorySize: 0,
            owner: msg.sender,
            createdAt: ts,
            lastUpdated: ts
        });
        _ownedAgents[msg.sender].push(agentId);

        // Interactions (event only, no external calls)
        emit AgentCreated(agentId, msg.sender, name, role, block.timestamp);
    }

    /// @notice Authorise (or de-authorise) a contract as a registrar. Only the contract owner may call.
    /// @param  registrar Address of the contract.
    /// @param  allowed   True to authorise, false to revoke.
    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        if (registrar == address(0)) revert ZeroAddress();
        _registrars[registrar] = allowed;
        emit RegistrarSet(registrar, allowed);
    }

    /// @notice Read whether an address is an authorised registrar.
    function isRegistrar(address registrar) external view returns (bool) {
        return _registrars[registrar];
    }

    /// @notice Create an agent on behalf of `owner`. Only callable by an authorised registrar.
    /// @dev    Used by AevumAgenticID so that the ERC-721 owner is also the AevumRegistry owner.
    /// @param  name  Agent name.
    /// @param  role  Agent role.
    /// @param  owner Final owner of the new agent.
    /// @return agentId The newly assigned agent id.
    function createAgentFor(string calldata name, string calldata role, address owner)
        external
        nonReentrant
        returns (uint256 agentId)
    {
        if (!_registrars[msg.sender]) revert NotRegistrar(msg.sender);
        if (owner == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();

        _nextAgentId += 1;
        agentId = _nextAgentId;

        uint64 ts = uint64(block.timestamp);
        _agents[agentId] = Agent({
            name: name,
            role: role,
            memoryPointer: bytes32(0),
            memorySize: 0,
            owner: owner,
            createdAt: ts,
            lastUpdated: ts
        });
        _ownedAgents[owner].push(agentId);

        emit AgentCreated(agentId, owner, name, role, block.timestamp);
    }

    /// @notice Create an agent on behalf of `owner` with an initial memory pointer set.
    ///         Only callable by an authorised registrar (e.g. AevumAgenticID on clone).
    /// @param  name  Agent name.
    /// @param  role  Agent role.
    /// @param  owner Final owner of the new agent.
    /// @param  root  Initial 0G Storage root hash.
    /// @param  size  Initial memory size in bytes.
    /// @return agentId The newly assigned agent id.
    function createAgentWithMemory(
        string calldata name,
        string calldata role,
        address owner,
        bytes32 root,
        uint256 size
    ) external nonReentrant returns (uint256 agentId) {
        if (!_registrars[msg.sender]) revert NotRegistrar(msg.sender);
        if (owner == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (root == bytes32(0)) revert ZeroMemoryPointer();

        _nextAgentId += 1;
        agentId = _nextAgentId;

        uint64 ts = uint64(block.timestamp);
        _agents[agentId] = Agent({
            name: name,
            role: role,
            memoryPointer: root,
            memorySize: size,
            owner: owner,
            createdAt: ts,
            lastUpdated: ts
        });
        _ownedAgents[owner].push(agentId);

        emit AgentCreated(agentId, owner, name, role, block.timestamp);
        emit MemoryUpdated(agentId, bytes32(0), root, size, block.timestamp);
    }

    /// @notice Transfer agent ownership from `from` to `to`. Only callable by an
    ///         authorised registrar (e.g. AevumAgenticID during an NFT transfer).
    /// @dev    `from` must be the current on-chain owner; this protects against a
    ///         registrar passing a stale address.
    function transferOwnershipFor(uint256 agentId, address from, address to) external nonReentrant {
        if (!_registrars[msg.sender]) revert NotRegistrar(msg.sender);
        if (to == address(0)) revert ZeroAddress();

        Agent storage agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentDoesNotExist(agentId);
        if (agent.owner != from) revert NotCurrentOwner(from, agentId);

        _removeAgentFromOwner(from, agentId);
        agent.owner = to;
        _ownedAgents[to].push(agentId);
        agent.lastUpdated = uint64(block.timestamp);

        emit OwnershipTransferred(agentId, from, to, block.timestamp);
    }

    /// @notice Update memory pointer for an agent owned by `from`. Only callable by
    ///         an authorised registrar. `from` must be the current owner.
    function updateMemoryPointerFor(uint256 agentId, address from, bytes32 rootHash, uint256 size) external nonReentrant {
        if (!_registrars[msg.sender]) revert NotRegistrar(msg.sender);
        if (rootHash == bytes32(0)) revert ZeroMemoryPointer();

        Agent storage agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentDoesNotExist(agentId);
        if (agent.owner != from) revert NotCurrentOwner(from, agentId);

        bytes32 oldRoot = agent.memoryPointer;
        agent.memoryPointer = rootHash;
        agent.memorySize = size;
        agent.lastUpdated = uint64(block.timestamp);

        emit MemoryUpdated(agentId, oldRoot, rootHash, size, block.timestamp);
    }

    /// @notice Update the memory pointer and size for an agent. Only the owner may call.
    /// @param  agentId Target agent.
    /// @param  rootHash Root hash of encrypted memory on 0G Storage.
    /// @param  size     Size in bytes of the encrypted memory payload.
    function updateMemoryPointer(uint256 agentId, bytes32 rootHash, uint256 size) external nonReentrant {
        // Checks
        Agent storage agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentDoesNotExist(agentId);
        if (agent.owner != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        if (rootHash == bytes32(0)) revert ZeroMemoryPointer();

        // Effects
        bytes32 oldRoot = agent.memoryPointer;
        agent.memoryPointer = rootHash;
        agent.memorySize = size;
        agent.lastUpdated = uint64(block.timestamp);

        // Interactions
        emit MemoryUpdated(agentId, oldRoot, rootHash, size, block.timestamp);
    }

    /// @notice Transfer ownership of an agent. Only the current owner may call.
    /// @param  agentId  Target agent.
    /// @param  newOwner Address of the new owner.
    function transferOwnership(uint256 agentId, address newOwner) external nonReentrant {
        // Checks
        if (newOwner == address(0)) revert ZeroAddress();
        Agent storage agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentDoesNotExist(agentId);
        if (agent.owner != msg.sender) revert NotAgentOwner(msg.sender, agentId);

        // Effects
        address previousOwner = agent.owner;
        _removeAgentFromOwner(previousOwner, agentId);
        agent.owner = newOwner;
        _ownedAgents[newOwner].push(agentId);
        agent.lastUpdated = uint64(block.timestamp);

        // Interactions
        emit OwnershipTransferred(agentId, previousOwner, newOwner, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL — VIEW / PURE
    //////////////////////////////////////////////////////////////*/

    /// @notice Read the full Agent struct for an agent id.
    /// @param  agentId Target agent id.
    /// @return The Agent struct.
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        Agent memory a = _agents[agentId];
        if (a.owner == address(0)) revert AgentDoesNotExist(agentId);
        return a;
    }

    /// @notice Return all agent ids owned by an address.
    /// @param  owner Owner address.
    /// @return Array of agent ids.
    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownedAgents[owner];
    }

    /// @notice Total number of agents ever created.
    function totalAgents() external view returns (uint256) {
        return _nextAgentId;
    }

    /// @notice Convenience getter for the current memory pointer of an agent.
    function memoryPointerOf(uint256 agentId) external view returns (bytes32) {
        return _agents[agentId].memoryPointer;
    }

    /// @notice Convenience getter for the current owner of an agent.
    function ownerOf(uint256 agentId) external view returns (address) {
        address o = _agents[agentId].owner;
        if (o == address(0)) revert AgentDoesNotExist(agentId);
        return o;
    }

    /// @notice Check whether an agent id is registered.
    function exists(uint256 agentId) external view returns (bool) {
        return _agents[agentId].owner != address(0);
    }

    /*//////////////////////////////////////////////////////////////
                              INTERNAL
    //////////////////////////////////////////////////////////////*/

    /// @dev Remove `agentId` from `owner`'s owned-agents list. Maintains order
    ///      (swap-with-last) and does not preserve ordering. O(n) on removal.
    function _removeAgentFromOwner(address owner, uint256 agentId) internal {
        uint256[] storage list = _ownedAgents[owner];
        uint256 len = list.length;
        for (uint256 i = 0; i < len;) {
            if (list[i] == agentId) {
                list[i] = list[len - 1];
                list.pop();
                return;
            }
            unchecked { ++i; }
        }
    }
}
