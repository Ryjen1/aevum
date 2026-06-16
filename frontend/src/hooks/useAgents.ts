import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useApi } from '@/providers/ApiProvider';
import type { Agent, AgentInput, MemoryInput, Paginated } from '@/lib/types';
import type { Memory } from '@/lib/types';

export function useAgents(params: { owner?: string; page?: number; pageSize?: number } = {}) {
  const { api } = useApi();
  return useQuery<Paginated<Agent>, Error>({
    queryKey: ['agents', params],
    queryFn: () => api.listAgents(params),
    placeholderData: (prev) => prev,
  });
}

export function useAgent(id: string | undefined) {
  const { api } = useApi();
  return useQuery<Agent, Error>({
    queryKey: ['agent', id],
    queryFn: () => api.getAgent(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateAgent() {
  const { api } = useApi();
  const { address } = useAccount();
  const qc = useQueryClient();
  return useMutation<Agent, Error, AgentInput>({
    mutationFn: (input) => {
      if (!address) throw new Error('Wallet not connected');
      return api.createAgent(input, address);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useUpdateAgent() {
  const { api } = useApi();
  const { address } = useAccount();
  const qc = useQueryClient();
  return useMutation<Agent, Error, { id: string; input: Partial<AgentInput> }>({
    mutationFn: ({ id, input }) => {
      if (!address) throw new Error('Wallet not connected');
      return api.updateAgent(id, input, address);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['agents'] });
      void qc.invalidateQueries({ queryKey: ['agent', data.id] });
    },
  });
}

export function useUpdateMemory() {
  const { address } = useAccount();
  const qc = useQueryClient();
  return useMutation<Memory, Error, { agentId: string; memoryId: string; input: Partial<MemoryInput> }>({
    mutationFn: () => {
      if (!address) throw new Error('Wallet not connected');
      throw new Error('Memory updates are immutable in v1');
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['memories', vars.agentId] });
    },
  });
}
