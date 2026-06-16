/**
 * Typed ethers v6 wrappers for the Aevum smart contracts.
 *
 * Contracts are accessed via minimal ABIs (the production deployment
 * is in the contracts/ workspace). All write operations are no-ops
 * when DEV_MOCK_MODE is true so the backend can run end-to-end without
 * a live chain.
 */
import { JsonRpcProvider, Wallet, Contract, type Signer, isAddress, type AddressLike, type BigNumberish, type EventLog } from "ethers";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const AEVUM_REGISTRY_ABI = [
  "function createAgent(string name, string metadataHash) returns (uint256 agentId)",
  "function getAgent(uint256 agentId) view returns (tuple(address owner, string name, string metadataHash, string memoryPointer, uint64 createdAt, uint64 updatedAt, bool active))",
  "function getAgentsByOwner(address owner) view returns (uint256[])",
  "function setMemoryPointer(uint256 agentId, string memoryPointer)",
  "function setActive(uint256 agentId, bool active)",
  "event AgentCreated(uint256 indexed agentId, address indexed owner, string name, string metadataHash)",
  "event MemoryPointerUpdated(uint256 indexed agentId, string memoryPointer, uint64 updatedAt)",
] as const;

export const AEVUM_MEMORY_ABI = [
  "function logMemory(uint256 agentId, string contentHash, string rootHash, uint8 role) returns (uint256 entryId)",
  "function getEntries(uint256 agentId, uint256 offset, uint256 limit) view returns (tuple(uint256 id, string contentHash, string rootHash, uint8 role, uint64 createdAt)[])",
  "function getEntry(uint256 agentId, uint256 entryId) view returns (tuple(uint256 id, string contentHash, string rootHash, uint8 role, uint64 createdAt))",
  "function entryCount(uint256 agentId) view returns (uint256)",
  "event MemoryLogged(uint256 indexed agentId, uint256 indexed entryId, string contentHash, string rootHash, uint8 role)",
] as const;

export const AEVUM_AGENTIC_ID_ABI = [
  "function mintAgenticID(address to, uint256 agentId, string handle, string did) returns (uint256 tokenId)",
  "function resolveByHandle(string handle) view returns (address)",
  "function resolveByDID(string did) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event AgenticIDMinted(uint256 indexed tokenId, address indexed to, uint256 agentId, string handle, string did)",
] as const;

export interface AgentRecord {
  agentId: bigint;
  owner: string;
  name: string;
  metadataHash: string;
  memoryPointer: string;
  createdAt: bigint;
  updatedAt: bigint;
  active: boolean;
}

export interface MemoryEntryRecord {
  id: bigint;
  contentHash: string;
  rootHash: string;
  role: number;
  createdAt: bigint;
}

export interface AgenticIDRecord {
  tokenId: bigint;
  to: string;
  agentId: bigint;
  handle: string;
  did: string;
}

let provider: JsonRpcProvider | null = null;
let wallet: Signer | null = null;

export function getProvider(): JsonRpcProvider {
  if (!provider) provider = new JsonRpcProvider(config.OG_RPC_URL);
  return provider;
}

export function getWallet(): Signer {
  if (wallet) return wallet;
  const w = new Wallet(config.OG_PRIVATE_KEY, getProvider());
  wallet = w as unknown as Signer;
  return wallet;
}

function getContract<T extends Contract>(address: string, abi: readonly unknown[]): T {
  if (!isAddress(address)) {
    throw new Error(`Invalid contract address: ${address}`);
  }
  if (config.DEV_MOCK_MODE) {
    // In mock mode, build a Contract object pointed at a fake address —
    // callers should check isChainConfigured() before invoking write methods.
    return new Contract(address, abi as never, getWallet()) as unknown as T;
  }
  return new Contract(address, abi as never, getWallet()) as unknown as T;
}

export function isChainConfigured(): boolean {
  return Boolean(config.AEVUM_REGISTRY_ADDRESS && isAddress(config.AEVUM_REGISTRY_ADDRESS));
}

export function getRegistry(): Contract {
  if (!config.AEVUM_REGISTRY_ADDRESS) {
    throw new Error("AEVUM_REGISTRY_ADDRESS not configured");
  }
  return getContract(config.AEVUM_REGISTRY_ADDRESS, AEVUM_REGISTRY_ABI);
}

export function getMemoryContract(): Contract {
  if (!config.AEVUM_MEMORY_ADDRESS) {
    throw new Error("AEVUM_MEMORY_ADDRESS not configured");
  }
  return getContract(config.AEVUM_MEMORY_ADDRESS, AEVUM_MEMORY_ABI);
}

export function getAgenticIDContract(): Contract {
  if (!config.AEVUM_AGENTIC_ID_ADDRESS) {
    throw new Error("AEVUM_AGENTIC_ID_ADDRESS not configured");
  }
  return getContract(config.AEVUM_AGENTIC_ID_ADDRESS, AEVUM_AGENTIC_ID_ABI);
}

export async function getChainStatus(): Promise<{ connected: boolean; blockNumber: number | null; error?: string }> {
  try {
    const bn = await getProvider().getBlockNumber();
    return { connected: true, blockNumber: bn };
  } catch (err) {
    return { connected: false, blockNumber: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============ Registry ============

export async function createAgent(name: string, metadataHash: string): Promise<{ agentId: bigint; txHash: string }> {
  if (config.DEV_MOCK_MODE) return mockAgentId(name);
  const registry = getRegistry();
  const tx = await registry.createAgent(name, metadataHash);
  const receipt = await tx.wait();
  const event = findEvent(receipt?.logs ?? [], "AgentCreated(uint256,address,string,string)");
  if (!event) throw new Error("AgentCreated event not found in receipt");
  const args = event.args as unknown as { agentId: bigint };
  return { agentId: args.agentId, txHash: receipt?.hash ?? tx.hash };
}

export async function readAgent(agentId: BigNumberish): Promise<AgentRecord | null> {
  if (config.DEV_MOCK_MODE) return mockAgentRecord(agentId);
  const registry = getRegistry();
  try {
    const raw = (await registry.getAgent(agentId)) as readonly [
      string, string, string, string, bigint, bigint, boolean,
    ] & {
      owner: string; name: string; metadataHash: string; memoryPointer: string;
      createdAt: bigint; updatedAt: bigint; active: boolean;
    };
    return {
      agentId: BigInt(agentId as string),
      owner: raw.owner,
      name: raw.name,
      metadataHash: raw.metadataHash,
      memoryPointer: raw.memoryPointer,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      active: raw.active,
    };
  } catch (err) {
    logger.warn({ err, agentId: agentId.toString() }, "readAgent failed");
    return null;
  }
}

export async function readAgentsByOwner(owner: AddressLike): Promise<bigint[]> {
  if (config.DEV_MOCK_MODE) return [];
  const registry = getRegistry();
  const ids = (await registry.getAgentsByOwner(owner)) as readonly bigint[];
  return Array.from(ids);
}

export async function setMemoryPointer(agentId: BigNumberish, pointer: string): Promise<string> {
  if (config.DEV_MOCK_MODE) return "0x-mock-tx";
  const registry = getRegistry();
  const tx = await registry.setMemoryPointer(agentId, pointer);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

// ============ Memory ============

export async function logMemory(
  agentId: BigNumberish,
  contentHash: string,
  rootHash: string,
  role: number,
): Promise<{ entryId: bigint; txHash: string }> {
  if (config.DEV_MOCK_MODE) {
    return { entryId: BigInt(Date.now()), txHash: "0x-mock-tx" };
  }
  const mem = getMemoryContract();
  const tx = await mem.logMemory(agentId, contentHash, rootHash, role);
  const receipt = await tx.wait();
  const event = findEvent(receipt?.logs ?? [], "MemoryLogged(uint256,uint256,string,string,uint8)");
  if (!event) throw new Error("MemoryLogged event not found in receipt");
  const args = event.args as unknown as { entryId: bigint };
  return { entryId: args.entryId, txHash: receipt?.hash ?? tx.hash };
}

export async function readMemoryEntries(
  agentId: BigNumberish,
  offset: number,
  limit: number,
): Promise<MemoryEntryRecord[]> {
  if (config.DEV_MOCK_MODE) return [];
  const mem = getMemoryContract();
  const raw = (await mem.getEntries(agentId, offset, limit)) as readonly {
    id: bigint; contentHash: string; rootHash: string; role: bigint | number; createdAt: bigint;
  }[];
  return raw.map((e) => ({
    id: e.id,
    contentHash: e.contentHash,
    rootHash: e.rootHash,
    role: Number(e.role),
    createdAt: e.createdAt,
  }));
}

export async function readMemoryEntry(agentId: BigNumberish, entryId: BigNumberish): Promise<MemoryEntryRecord | null> {
  if (config.DEV_MOCK_MODE) return null;
  const mem = getMemoryContract();
  try {
    const raw = (await mem.getEntry(agentId, entryId)) as {
      id: bigint; contentHash: string; rootHash: string; role: bigint; createdAt: bigint;
    };
    return { id: raw.id, contentHash: raw.contentHash, rootHash: raw.rootHash, role: Number(raw.role), createdAt: raw.createdAt };
  } catch (err) {
    logger.warn({ err }, "readMemoryEntry failed");
    return null;
  }
}

// ============ AgenticID ============

export async function mintAgenticID(
  to: AddressLike,
  agentId: BigNumberish,
  handle: string,
  did: string,
): Promise<{ tokenId: bigint; txHash: string }> {
  if (config.DEV_MOCK_MODE) {
    return { tokenId: BigInt(Date.now()), txHash: "0x-mock-tx" };
  }
  const c = getAgenticIDContract();
  const tx = await c.mintAgenticID(to, agentId, handle, did);
  const receipt = await tx.wait();
  const event = findEvent(receipt?.logs ?? [], "AgenticIDMinted(uint256,address,uint256,string,string)");
  if (!event) throw new Error("AgenticIDMinted event not found");
  const args = event.args as unknown as { tokenId: bigint };
  return { tokenId: args.tokenId, txHash: receipt?.hash ?? tx.hash };
}

export async function resolveByHandle(handle: string): Promise<string | null> {
  if (config.DEV_MOCK_MODE) return null;
  try {
    const c = getAgenticIDContract();
    const addr = (await c.resolveByHandle(handle)) as string;
    return addr === "0x0000000000000000000000000000000000000000" ? null : addr;
  } catch {
    return null;
  }
}

// ============ Helpers ============

function findEvent(logs: readonly EventLog[] | readonly unknown[], signature: string): EventLog | null {
  for (const log of logs) {
    const l = log as EventLog;
    if (l?.fragment && `${l.fragment.name}(${l.fragment.inputs.map((i) => i.type).join(",")})` === signature) {
      return l;
    }
  }
  return null;
}

function mockAgentId(name: string): { agentId: bigint; txHash: string } {
  const seed = `${name}-${Date.now()}-${Math.random()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return { agentId: BigInt(h % 1_000_000_000), txHash: "0x-mock" };
}

function mockAgentRecord(agentId: BigNumberish): AgentRecord {
  const id = BigInt(agentId as string);
  return {
    agentId: id,
    owner: config.OG_PRIVATE_KEY === "0x" + "0".repeat(64) ? "0x0000000000000000000000000000000000000000" : new Wallet(config.OG_PRIVATE_KEY).address,
    name: `Mock Agent ${id.toString()}`,
    metadataHash: "0x",
    memoryPointer: "0x",
    createdAt: BigInt(Date.now()),
    updatedAt: BigInt(Date.now()),
    active: true,
  };
}
