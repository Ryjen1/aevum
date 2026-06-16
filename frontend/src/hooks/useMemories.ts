import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useApi } from '@/providers/ApiProvider';
import type { Memory, MemoryInput, Paginated } from '@/lib/types';

export interface MemoriesQueryParams {
  agentId?: string;
  dataType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useMemories(params: MemoriesQueryParams = {}) {
  const { api } = useApi();
  return useQuery<Paginated<Memory>, Error>({
    queryKey: ['memories', params],
    queryFn: () => api.listMemories(params),
    placeholderData: (prev) => prev,
  });
}

export function useMemory(id: string | undefined) {
  const { api } = useApi();
  return useQuery<Memory, Error>({
    queryKey: ['memory', id],
    queryFn: () => api.getMemory(id as string),
    enabled: Boolean(id),
  });
}

export function useLogMemory(agentId: string) {
  const { api } = useApi();
  const { address } = useAccount();
  const qc = useQueryClient();
  return useMutation<Memory, Error, MemoryInput>({
    mutationFn: (input) => {
      if (!address) throw new Error('Wallet not connected');
      return api.logMemory(agentId, input, address);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['memories'] });
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
