import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '@/providers/ApiProvider';
import type { StorageStatus } from '@/lib/types';

export function useStorageStatus() {
  const { api } = useApi();
  return useQuery<StorageStatus, Error>({
    queryKey: ['storage', 'status'],
    queryFn: () => api.getStorageStatus(),
    refetchInterval: 30_000,
  });
}

export function useUploadFile() {
  const { api: _api } = useApi();
  return useMutation<{ root: string; size: number; uri: string }, Error, { data: Uint8Array; name?: string }>({
    mutationFn: async ({ data, name }) => {
      const base64 = btoa(String.fromCharCode(...data));
      const res = await fetch(`${(import.meta.env.VITE_API_URL as string | undefined) ?? ''}/api/storage/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, name }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed: ${res.status}`);
      }
      return (await res.json()) as { root: string; size: number; uri: string };
    },
  });
}
