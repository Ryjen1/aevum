import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useAgents } from '@/hooks/useAgents';
import { useApi } from '@/providers/ApiProvider';
import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { TerminalStat } from '@/components/TerminalStat';
import { AgentCard } from '@/components/AgentCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/format';
import type { Paginated, SystemStatus, AuditLogEntry } from '@/lib/types';

const HEADER = '═══ AEVUM STATUS ═══';

const ACTION_LABELS: Record<string, string> = {
  inference: 'inference.complete',
  memory_logged: 'memory.logged',
  agent_created: 'agent.created',
  agent_updated: 'agent.updated',
  proof_verified: 'proof.verified',
};

const ACTION_COLORS: Record<string, string> = {
  inference: 'term-green',
  memory_logged: 'term-cyan',
  agent_created: 'term-amber',
  agent_updated: 'term-magenta',
  proof_verified: 'term-green',
};

export function Status(): JSX.Element {
  const { isConnected, address } = useAccount();
  const { api } = useApi();

  const agentsQuery = useAgents({ owner: address, pageSize: 12 });
  const statusQuery = useQuery<SystemStatus, Error>({
    queryKey: ['system', 'status'],
    queryFn: () => api.getSystemStatus(),
    refetchInterval: 30_000,
  });
  const activityQuery = useQuery<Paginated<AuditLogEntry>, Error>({
    queryKey: ['activity', address],
    queryFn: () => api.getAuditLog({ page: 1, pageSize: 10 }),
    refetchInterval: 15_000,
  });

  if (!isConnected) return <ConnectWalletPrompt />;

  const agents = agentsQuery.data?.items ?? [];
  const totalMemories = agents.reduce((acc, a) => acc + a.memoryCount, 0);
  const totalBytes = agents.reduce((acc, a) => acc + a.memoryBytes, 0);
  const totalInferences = activityQuery.data?.items.length ?? 0;
  const storage = statusQuery.data?.storage;
  const compute = statusQuery.data?.compute;

  const memoryQuota = 10_000;
  const memPercent = Math.min(100, (totalMemories / memoryQuota) * 100);
  const inferenceQuota = 1000;
  const inferencePercent = Math.min(100, (totalInferences / inferenceQuota) * 100);

  return (
    <div className="space-y-6">
      <pre className="term-green text-[10px] sm:text-xs leading-tight whitespace-pre overflow-x-auto">
{HEADER}
[ aevum // eternal archive ]  [ user: 0x{address?.slice(2, 6) ?? '----'}...{address?.slice(-4) ?? '----'} ]
[ uptime: ok ]  [ chain: {statusQuery.data?.chain.id ?? '---'} ]  [ block: {statusQuery.data?.chain.blockNumber ?? '------'} ]
{'─'.repeat(64)}
      </pre>

      <section aria-label="System stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TerminalStat
          label="AGENTS"
          value={formatNumber(agents.length)}
          percent={Math.min(100, agents.length * 10)}
          hint="of 10 max"
        />
        <TerminalStat
          label="MEMORIES"
          value={formatNumber(totalMemories)}
          percent={memPercent}
          hint={`quota ${memoryQuota.toLocaleString()}`}
        />
        <TerminalStat
          label="INFERENCES"
          value={formatNumber(totalInferences)}
          percent={inferencePercent}
          hint={`of ${inferenceQuota.toLocaleString()}/day`}
        />
        <TerminalStat
          label="STORAGE"
          value={formatNumber(Math.round(totalBytes / 1024)) + ' KB'}
          percent={Math.min(100, (totalBytes / (50 * 1024 * 1024)) * 100)}
          hint="on 0G"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="term-panel p-3 lg:col-span-2">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-terminal-border">
            <div className="text-xs">
              <span className="term-green">┌─[</span>
              <span className="term-text"> your_agents </span>
              <span className="term-green">]</span>
              <span className="term-dim ml-2">{agents.length} total</span>
            </div>
            <Link to="/registry" className="text-[10px] term-cyan hover:underline">
              [discover more &gt;]
            </Link>
          </div>
          {agentsQuery.isLoading ? (
            <div className="py-6 text-center"><LoadingSpinner label="loading agents" /></div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-xs term-muted border border-dashed border-terminal-border">
              <p>{'>'} no agents found</p>
              <p className="mt-1">install from the registry or create a new one</p>
              <div className="mt-3 flex justify-center gap-2">
                <Link to="/registry" className="term-btn-primary text-[10px]">[+ browse registry]</Link>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {agents.slice(0, 4).map((agent) => (
                <AgentCard key={agent.id} agent={agent} to="/archive" />
              ))}
            </div>
          )}
        </div>

        <div className="term-panel p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-terminal-border">
            <div className="text-xs">
              <span className="term-cyan">┌─[</span>
              <span className="term-text"> recent_activity </span>
              <span className="term-cyan">]</span>
            </div>
            {activityQuery.isFetching && <LoadingSpinner />}
          </div>
          <div className="font-mono text-[11px] space-y-1 max-h-64 overflow-y-auto">
            {(activityQuery.data?.items ?? []).map((e) => {
              const label = ACTION_LABELS[e.action] ?? e.action;
              const color = ACTION_COLORS[e.action] ?? 'term-muted';
              return (
                <div key={e.id} className="leading-relaxed">
                  <span className="term-dim">[{new Date(e.createdAt).toLocaleTimeString('en-GB')}]</span>{' '}
                  <span className={color}>{label}</span>{' '}
                  <span className="term-dim">agent:</span>{' '}
                  <span className="term-text">{e.agentId.slice(0, 8)}</span>
                  {e.hash && (
                    <>
                      <span className="term-dim"> tx:</span>{' '}
                      <span className="term-cyan">{e.hash.slice(0, 10)}...</span>
                    </>
                  )}
                </div>
              );
            })}
            {(activityQuery.data?.items ?? []).length === 0 && !activityQuery.isLoading && (
              <div className="text-center text-xs term-muted py-4">
                {'>'} no activity yet
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="term-panel p-3">
        <div className="text-xs pb-2 mb-3 border-b border-terminal-border">
          <span className="term-amber">┌─[</span>
          <span className="term-text"> system_health </span>
          <span className="term-amber">]</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <HealthRow
            label="chain"
            ok={statusQuery.data?.chain.connected}
            detail={statusQuery.data ? `#${statusQuery.data.chain.id} block ${statusQuery.data.chain.blockNumber ?? '?'}` : 'connecting...'}
          />
          <HealthRow
            label="storage"
            ok={storage?.connected}
            detail={storage?.network ?? '0G'}
          />
          <HealthRow
            label="compute"
            ok={compute?.connected}
            detail={compute?.teeEnabled ? 'TEE enabled' : 'TEE disabled'}
          />
        </div>
        <div className="mt-3 pt-3 border-t border-terminal-border text-[10px] space-y-0.5">
          <p className="term-muted">
            <span className="term-green">[aevum.storage]</span> status: ok &nbsp; tier: {storage?.connected ? 'connected' : 'offline'}
          </p>
          <p className="term-muted">
            <span className="term-green">[aevum.chain]</span> status: ok &nbsp; chain: {statusQuery.data?.chain.id ?? '?'} &nbsp; last_block: {statusQuery.data?.chain.blockNumber ?? '?'}
          </p>
          <p className="term-muted">
            <span className="term-green">[aevum.compute]</span> status: {compute?.connected ? 'ok' : 'unknown'} &nbsp; tee: {compute?.teeEnabled ? 'enabled' : 'disabled'} &nbsp; region: {compute?.region ?? 'n/a'}
          </p>
        </div>
      </section>
    </div>
  );
}

interface HealthRowProps {
  label: string;
  ok?: boolean;
  detail: string;
}

function HealthRow({ label, ok, detail }: HealthRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="term-muted uppercase text-[10px]">[{label}]</span>
      <span className={ok ? 'term-green' : 'term-amber'}>{ok ? '\u25CF connected' : '\u25CB offline'}</span>
      <span className="term-dim">|</span>
      <span className="term-text text-[10px]">{detail}</span>
    </div>
  );
}
