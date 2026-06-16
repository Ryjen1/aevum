import { useMutation } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useApi } from '@/providers/ApiProvider';
import type { PipelineRequest, PipelineResponse } from '@/lib/types';

export function useRunPipeline() {
  const { api } = useApi();
  const { address } = useAccount();
  return useMutation<PipelineResponse, Error, PipelineRequest>({
    mutationFn: (req) => {
      if (!address) throw new Error('Wallet not connected');
      return api.runPipeline(req, address);
    },
  });
}
