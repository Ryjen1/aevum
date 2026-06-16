import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAgents } from './useAgents';

export interface StatusBarState {
  connected: boolean;
  memoryCount: number;
  agentCount: number;
  version: string;
  time: string;
}

const VERSION = 'v0.1.0';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function useStatusBar(): StatusBarState {
  const { isConnected, address } = useAccount();
  const agentsQuery = useAgents({ owner: address, pageSize: 50 });
  const agents = agentsQuery.data?.items ?? [];

  const [time, setTime] = useState<string>(() => formatTime(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return {
    connected: isConnected,
    memoryCount: agents.reduce((acc, a) => acc + a.memoryCount, 0),
    agentCount: agents.length,
    version: VERSION,
    time,
  };
}
