// Aevum shared types — mirror backend contracts

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

export type DataType = 'text' | 'embedding' | 'transaction' | 'document' | 'preference' | 'event';

export type AgentRole = 'assistant' | 'analyst' | 'trader' | 'researcher' | 'custom';

export interface Agent {
  id: string;
  address: Address;
  owner: Address;
  name: string;
  role: AgentRole;
  description?: string;
  memoryCount: number;
  memoryBytes: number;
  lastActivity: string; // ISO timestamp
  createdAt: string;
  chainId: number;
  teeEnabled: boolean;
  status: 'active' | 'paused' | 'archived';
}

export interface AgentInput {
  name: string;
  role: AgentRole;
  description?: string;
  teeEnabled?: boolean;
}

export interface Memory {
  id: string;
  agentId: string;
  dataType: DataType;
  content: string; // text preview or summary
  contentHash: Hash;
  storageRoot: Hash;
  sizeBytes: number;
  createdAt: string;
  accessControls: AccessControl[];
  metadata?: Record<string, string | number | boolean>;
}

export interface AccessControl {
  type: 'owner' | 'public' | 'allowlist';
  address?: Address;
}

export interface MemoryInput {
  dataType: DataType;
  content: string;
  metadata?: Record<string, string | number | boolean>;
  accessControls?: AccessControl[];
}

export interface PipelineRequest {
  agentId: string;
  prompt: string;
  maxMemories?: number;
  stream?: boolean;
}

export interface TEEProof {
  hash: Hash;
  signature: Hash;
  enclave: string;
  timestamp: string;
  verified: boolean;
}

export interface PipelineResponse {
  requestId: string;
  agentId: string;
  response: string;
  memoriesUsed: Memory[];
  proof?: TEEProof;
  inferenceMs: number;
  auditLogId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  proof?: TEEProof;
  memoriesUsed?: Memory[];
  auditLogId?: string;
  pending?: boolean;
  error?: string;
}

export interface ActivityEntry {
  id: string;
  agentId: string;
  agentName: string;
  type: 'memory_logged' | 'inference' | 'agent_created' | 'agent_updated' | 'proof_verified';
  summary: string;
  hash?: Hash;
  createdAt: string;
}

export interface MarketplaceAgent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  owner: Address;
  installs: number;
  rating: number; // 0..5
  tags: string[];
  teeEnabled: boolean;
  publishedAt: string;
}

export interface AuditLogEntry {
  id: string;
  agentId: string;
  action: string;
  actor: Address;
  hash?: Hash;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface StorageStatus {
  connected: boolean;
  network: string;
  rpcUrl: string;
  indexerHeight?: number;
  uploadRoot?: Hash;
  message?: string;
}

export interface SystemStatus {
  chain: { connected: boolean; id: number; blockNumber?: number };
  storage: StorageStatus;
  compute: { connected: boolean; teeEnabled: boolean; region?: string; message?: string };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
