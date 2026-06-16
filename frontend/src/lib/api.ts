import type {
  Agent,
  AgentInput,
  ActivityEntry,
  AuditLogEntry,
  ChatMessage,
  MarketplaceAgent,
  Memory,
  MemoryInput,
  Paginated,
  PipelineRequest,
  PipelineResponse,
  StorageStatus,
  SystemStatus,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const API_PREFIX = '/api';

class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  walletAddress?: string,
): Promise<T> {
  const url = `${API_BASE}${API_PREFIX}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (walletAddress) {
    headers.set('X-Wallet-Address', walletAddress);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : 'Network error',
      'NETWORK_ERROR',
      0,
    );
  }

  if (!response.ok) {
    let payload: { code?: string; message?: string; details?: Record<string, unknown> } = {};
    try {
      payload = await response.json();
    } catch {
      /* ignore non-json */
    }
    throw new ApiError(
      payload.message ?? `Request failed: ${response.status}`,
      payload.code ?? 'HTTP_ERROR',
      response.status,
      payload.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface AgentsListParams {
  owner?: string;
  page?: number;
  pageSize?: number;
}

export const api = {
  // System
  getSystemStatus(): Promise<SystemStatus> {
    return request<SystemStatus>('/system/status');
  },
  getStorageStatus(): Promise<StorageStatus> {
    return request<StorageStatus>('/storage/status');
  },
  getAuditLog(params: { page?: number; pageSize?: number; agentId?: string } = {}): Promise<Paginated<AuditLogEntry>> {
    return request<Paginated<AuditLogEntry>>(`/audit-log${qs(params)}`);
  },

  // Agents
  listAgents(params: AgentsListParams = {}): Promise<Paginated<Agent>> {
    return request<Paginated<Agent>>(`/agents${qs(params as Record<string, string | number | boolean | null | undefined>)}`);
  },
  getAgent(id: string): Promise<Agent> {
    return request<Agent>(`/agents/${encodeURIComponent(id)}`);
  },
  createAgent(input: AgentInput, walletAddress: string): Promise<Agent> {
    return request<Agent>('/agents', { method: 'POST', body: JSON.stringify(input) }, walletAddress);
  },
  updateAgent(id: string, input: Partial<AgentInput>, walletAddress: string): Promise<Agent> {
    return request<Agent>(`/agents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }, walletAddress);
  },
  getAgentActivity(id: string, params: { page?: number; pageSize?: number } = {}): Promise<Paginated<ActivityEntry>> {
    return request<Paginated<ActivityEntry>>(`/agents/${encodeURIComponent(id)}/activity${qs(params)}`);
  },

  // Memories
  listMemories(params: {
    agentId?: string;
    dataType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<Paginated<Memory>> {
    return request<Paginated<Memory>>(`/memories${qs(params)}`);
  },
  getMemory(id: string): Promise<Memory> {
    return request<Memory>(`/memories/${encodeURIComponent(id)}`);
  },
  logMemory(agentId: string, input: MemoryInput, walletAddress: string): Promise<Memory> {
    return request<Memory>(
      `/agents/${encodeURIComponent(agentId)}/memories`,
      { method: 'POST', body: JSON.stringify(input) },
      walletAddress,
    );
  },

  // Orchestrator / pipeline
  runPipeline(req: PipelineRequest, walletAddress: string): Promise<PipelineResponse> {
    return request<PipelineResponse>(
      '/orchestrator/run',
      { method: 'POST', body: JSON.stringify(req) },
      walletAddress,
    );
  },

  // Chat history
  getChatHistory(agentId: string, params: { limit?: number } = {}): Promise<ChatMessage[]> {
    return request<ChatMessage[]>(`/agents/${encodeURIComponent(agentId)}/chat${qs(params)}`);
  },

  // Marketplace
  listMarketplace(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<Paginated<MarketplaceAgent>> {
    return request<Paginated<MarketplaceAgent>>(`/marketplace${qs(params)}`);
  },
  installMarketplaceAgent(id: string, walletAddress: string): Promise<Agent> {
    return request<Agent>(`/marketplace/${encodeURIComponent(id)}/install`, { method: 'POST' }, walletAddress);
  },
  publishMarketplaceAgent(input: { name: string; description: string; role: string; tags: string[] }, walletAddress: string): Promise<MarketplaceAgent> {
    return request<MarketplaceAgent>('/marketplace', { method: 'POST', body: JSON.stringify(input) }, walletAddress);
  },
};

export { ApiError };
export type { PipelineRequest };
