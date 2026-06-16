import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';

interface ApiContextValue {
  api: typeof api;
}

const ApiContext = createContext<ApiContextValue | null>(null);

interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps): JSX.Element {
  const value = useMemo<ApiContextValue>(() => ({ api }), []);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}
