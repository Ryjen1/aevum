/**
 * Shared type definitions for the Aevum backend.
 */

export type Address = `0x${string}`;

export type Bytes32 = `0x${string}`;

export interface Agent {
  id: string;
  owner: string;
  name: string;
  description: string;
  systemPrompt: string;
  memoryPointer: string;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  metadataHash: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  contentHash: string;
  embedding: number[];
  rootHash: string;
  createdAt: number;
  role: "user" | "assistant" | "system";
  metadata: Record<string, unknown>;
}

export interface MemoryChunk {
  id: string;
  agentId: string;
  content: string;
  embedding: number[];
  similarity: number;
  rootHash: string;
  createdAt: number;
}

export interface PipelineRequest {
  query: string;
  agentId: string;
  userAddress: string;
  systemPrompt?: string;
  topK?: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  saveToMemory?: boolean;
}

export interface PipelineResponse {
  id: string;
  response: string;
  redactedResponse: string;
  foundPII: PIIMatch[];
  memories: MemoryChunk[];
  proof: string;
  providerAddress: string;
  teeVerified: boolean;
  storage: {
    rootHash: string | null;
    txHash: string | null;
    stored: boolean;
  };
  auditLog: AuditLogEntry[];
  usage: UsageStats;
  startedAt: number;
  finishedAt: number;
}

export interface AuditLogEntry {
  step: string;
  agent: string;
  at: number;
  status: "ok" | "warn" | "error";
  message: string;
  meta?: Record<string, unknown>;
}

export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface Provider {
  address: string;
  model: string;
  serviceType: string;
  url: string;
  inputPrice: bigint;
  outputPrice: bigint;
  verifiability: string;
  teeSignerAddress: string;
  teeSignerAcknowledged: boolean;
}

export interface ProviderMetadata extends Provider {
  endpoint: string;
  healthMetrics?: {
    status: string;
    uptime: number;
    avgResponseTime: number;
    lastCheck: string;
  };
  teeAttested?: boolean;
  contextLength?: number;
}

export interface InferenceResult {
  response: string;
  proof: string;
  providerAddress: string;
  teeVerified: boolean;
  usage: UsageStats;
}

export interface StorageStatus {
  connected: boolean;
  network: string;
  fallbackMode: boolean;
  fallbackDir?: string;
  rpcUrl: string;
  indexerUrl: string;
  error?: string;
}

export interface UploadResult {
  rootHash: string;
  txHash: string;
  size: number;
  encrypted: boolean;
  fallback: boolean;
}

export interface PIIMatch {
  type: "email" | "phone" | "ssn" | "credit_card" | "ip" | "iban";
  value: string;
  start: number;
  end: number;
}

export interface RedactionResult {
  sanitized: string;
  foundPII: PIIMatch[];
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  uptime: number;
  version: string;
  integrations: {
    storage: StorageStatus;
    compute: {
      connected: boolean;
      providerCount: number;
      defaultProvider: string;
      fallbackMode: boolean;
      error?: string;
    };
    chain: {
      connected: boolean;
      rpcUrl: string;
      blockNumber: number | null;
      error?: string;
    };
    contracts: {
      registry: boolean;
      memory: boolean;
      agenticId: boolean;
    };
  };
}

export interface AuthContext {
  address: Address;
  ensName?: string;
  issuedAt: string;
  expiresAt?: string;
  nonce: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
