import { useAccount, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/providers/ApiProvider';
import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { HashDisplay } from '@/components/HashDisplay';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getExplorerLink } from '@/lib/chains';
import type { AuditLogEntry, Paginated, SystemStatus } from '@/lib/types';
import { formatTimestampFull } from '@/lib/format';

const HEADER = '═══ SYSTEM CONSOLE ═══';

interface ContractInfo {
  name: string;
  envKey: string;
  description: string;
}

const CONTRACTS: ContractInfo[] = [
  { name: 'AGENT REGISTRY', envKey: 'VITE_AGENT_REGISTRY_ADDRESS', description: 'on-chain ownership and metadata for AI agents' },
  { name: 'MEMORY REGISTRY', envKey: 'VITE_MEMORY_REGISTRY_ADDRESS', description: 'pointer registry from agent -> 0G storage root' },
  { name: 'PROOF VERIFIER', envKey: 'VITE_PROOF_VERIFIER_ADDRESS', description: 'verifies tee signatures for inference outputs' },
];

export function System(): JSX.Element {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { api } = useApi();

  const statusQuery = useQuery<SystemStatus, Error>({
    queryKey: ['system', 'status'],
    queryFn: () => api.getSystemStatus(),
    refetchInterval: 20_000,
  });

  const auditQuery = useQuery<Paginated<AuditLogEntry>, Error>({
    queryKey: ['audit', 'system'],
    queryFn: () => api.getAuditLog({ page: 1, pageSize: 15 }),
    refetchInterval: 30_000,
  });

  if (!isConnected) return <ConnectWalletPrompt />;

  return (
    <div className="space-y-4">
      <pre className="term-green text-[10px] sm:text-xs leading-tight whitespace-pre overflow-x-auto">
{HEADER}
[ system // contracts, health & on-chain audit ]  [ chain: {chainId ?? '?'} ]
{'─'.repeat(64)}
      </pre>

      <section aria-label="System status" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusRow
          label="CHAIN"
          ok={statusQuery.data?.chain.connected}
          primary={statusQuery.data?.chain.connected ? 'connected' : 'disconnected'}
          secondary={statusQuery.data ? `chain #${statusQuery.data.chain.id} - block ${statusQuery.data.chain.blockNumber ?? '?'}` : 'loading...'}
        />
        <StatusRow
          label="STORAGE"
          ok={statusQuery.data?.storage.connected}
          primary={statusQuery.data?.storage.connected ? 'connected' : 'offline'}
          secondary={statusQuery.data?.storage.network ?? '0G'}
          hint={statusQuery.data?.storage.indexerHeight ? `indexer block #${statusQuery.data.storage.indexerHeight}` : statusQuery.data?.storage.message}
        />
        <StatusRow
          label="COMPUTE"
          ok={statusQuery.data?.compute.connected}
          primary={statusQuery.data?.compute.connected ? 'connected' : 'offline'}
          secondary={statusQuery.data?.compute.teeEnabled ? 'tee enabled' : 'tee disabled'}
          hint={statusQuery.data?.compute.region}
        />
      </section>

      <section className="term-panel p-3">
        <div className="text-xs pb-2 mb-3 border-b border-terminal-border">
          <span className="term-amber">┌─[</span> deployed_contracts <span className="term-amber">]</span>
        </div>
        <ul className="divide-y divide-terminal-border">
          {CONTRACTS.map((c) => {
            const addr = (import.meta.env[c.envKey] as string | undefined) ?? '';
            return (
              <li key={c.envKey} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="term-text font-semibold">[{c.name}]</p>
                  <p className="text-[10px] term-muted mt-0.5">// {c.description}</p>
                </div>
                {addr ? (
                  <HashDisplay hash={addr} chainId={chainId} head={6} tail={4} />
                ) : (
                  <span className="text-xs term-amber">[not configured]</span>
                )}
              </li>
            );
          })}
        </ul>
        {chainId && (
          <a
            href={getExplorerLink(chainId, '', 'address')}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-block text-xs term-cyan hover:underline"
          >
            [open 0g explorer &gt;]
          </a>
        )}
      </section>

      <section className="term-panel p-3">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-terminal-border">
          <div className="text-xs">
            <span className="term-magenta">┌─[</span> audit_log <span className="term-magenta">]</span>
            <span className="ml-2 term-dim">last {auditQuery.data?.items.length ?? 0} entries</span>
          </div>
          {auditQuery.isFetching && <LoadingSpinner />}
        </div>
        <div className="font-mono text-[11px] space-y-1 max-h-96 overflow-y-auto">
          {(auditQuery.data?.items ?? []).map((e) => (
            <div key={e.id} className="leading-relaxed flex flex-wrap items-center gap-2">
              <span className="term-dim">[{formatTimestampFull(e.createdAt)}]</span>
              <span className="term-green">{e.action}</span>
              <span className="term-dim">agent:</span>
              <span className="term-text">{e.agentId.slice(0, 10)}</span>
              {e.hash && (
                <>
                  <span className="term-dim">tx:</span>
                  <HashDisplay hash={e.hash} chainId={chainId} showCopy head={6} tail={4} />
                </>
              )}
            </div>
          ))}
          {auditQuery.data?.items.length === 0 && !auditQuery.isLoading && (
            <div className="text-center term-muted py-4 text-xs">{'>'} no entries yet</div>
          )}
        </div>
      </section>

      <section className="term-panel p-3">
        <div className="text-xs pb-2 mb-3 border-b border-terminal-border">
          <span className="term-green">┌─[</span> diagnostics <span className="term-green">]</span>
        </div>
        <pre className="text-[11px] space-y-0.5 leading-relaxed whitespace-pre-wrap break-all">
          <span className="term-green">[aevum.storage]</span> <span className="term-muted">status:</span> <span className="term-text">{statusQuery.data?.storage.connected ? 'ok' : 'offline'}</span>  <span className="term-dim">//</span> <span className="term-muted">{statusQuery.data?.storage.network ?? 'n/a'}</span>{'\n'}
          <span className="term-green">[aevum.chain]</span> <span className="term-muted">status:</span> <span className="term-text">{statusQuery.data?.chain.connected ? 'ok' : 'offline'}</span>  <span className="term-dim">//</span> <span className="term-muted">chain #{statusQuery.data?.chain.id ?? '?'} block {statusQuery.data?.chain.blockNumber ?? '?'}</span>{'\n'}
          <span className="term-green">[aevum.compute]</span> <span className="term-muted">status:</span> <span className="term-text">{statusQuery.data?.compute.connected ? 'ok' : 'unknown'}</span>  <span className="term-dim">//</span> <span className="term-muted">tee: {statusQuery.data?.compute.teeEnabled ? 'enabled' : 'disabled'} region: {statusQuery.data?.compute.region ?? 'n/a'}</span>{'\n'}
        </pre>
      </section>

      <section className="term-panel p-3">
        <div className="text-xs pb-2 mb-3 border-b border-terminal-border">
          <span className="term-cyan">┌─[</span> deploy_instructions <span className="term-cyan">]</span>
        </div>
        <pre className="text-[11px] term-text whitespace-pre-wrap leading-relaxed">
{`$ pnpm i                              # install workspace deps
$ pnpm contracts:deploy --network galileo
# copy deployed addresses into frontend/.env:
#   VITE_AGENT_REGISTRY_ADDRESS=0x...
#   VITE_MEMORY_REGISTRY_ADDRESS=0x...
#   VITE_PROOF_VERIFIER_ADDRESS=0x...
$ pnpm dev:backend                    # starts api on :4000
$ pnpm dev:frontend                   # starts web on :5173`}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a className="term-btn" href="https://chainscan-galileo.0g.ai" target="_blank" rel="noreferrer noopener">
            [0g explorer]
          </a>
          <a className="term-btn" href="https://docs.0g.ai" target="_blank" rel="noreferrer noopener">
            [0g docs]
          </a>
        </div>
      </section>
    </div>
  );
}

interface StatusRowProps {
  label: string;
  ok?: boolean;
  primary: string;
  secondary: string;
  hint?: string;
}

function StatusRow({ label, ok, primary, secondary, hint }: StatusRowProps): JSX.Element {
  return (
    <div className="term-panel p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="term-muted uppercase tracking-widest text-[10px]">[{label}]</span>
        <span className={ok ? 'term-green' : 'term-amber'}>
          {ok ? '\u25CF connected' : '\u25CB offline'}
        </span>
      </div>
      <p className={`mt-2 text-sm font-semibold ${ok ? 'term-green' : 'term-amber'}`}>{primary}</p>
      <p className="mt-1 text-[10px] term-muted">{secondary}</p>
      {hint && <p className="mt-1 text-[10px] term-dim">{hint}</p>}
    </div>
  );
}
