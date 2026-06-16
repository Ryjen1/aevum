import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useAgents } from '@/hooks/useAgents';
import { useLogMemory, useMemories } from '@/hooks/useMemories';
import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { MemoryCard } from '@/components/MemoryCard';
import { Modal } from '@/components/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { DataType, MemoryInput } from '@/lib/types';

const HEADER = '═══ MEMORY ARCHIVE ═══';
const DATA_TYPES: DataType[] = ['text', 'embedding', 'transaction', 'document', 'preference', 'event'];
const PAGE_SIZE = 20;

export function Archive(): JSX.Element {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const agentsQuery = useAgents({ owner: address, pageSize: 50 });
  const agents = agentsQuery.data?.items ?? [];

  const [agentId, setAgentId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dataType, setDataType] = useState<DataType | ''>('');
  const [page, setPage] = useState(1);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!agentId && agents.length > 0 && agents[0]) setAgentId(agents[0].id);
  }, [agentId, agents]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [agentId, debouncedSearch, dataType]);

  const query = useMemo(
    () => ({
      agentId: agentId || undefined,
      search: debouncedSearch || undefined,
      dataType: dataType || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [agentId, debouncedSearch, dataType, page],
  );

  const memoriesQuery = useMemories(query);
  const items = memoriesQuery.data?.items ?? [];
  const total = memoriesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!isConnected) return <ConnectWalletPrompt />;

  return (
    <div className="space-y-4">
      <pre className="term-green text-[10px] sm:text-xs leading-tight whitespace-pre overflow-x-auto">
{HEADER}
[ memory archive // search & inspect on-chain agent memory ]  [ chain: {chainId ?? '?'} ]
{'─'.repeat(64)}
      </pre>

      <div className="term-panel p-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px_auto] gap-2 text-xs items-end">
          <div>
            <label htmlFor="search" className="block text-[10px] term-muted uppercase tracking-widest mb-1">
              [search:]
            </label>
            <input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="________________"
              className="term-input"
            />
          </div>
          <div>
            <label htmlFor="agent-filter" className="block text-[10px] term-muted uppercase tracking-widest mb-1">
              [agent:]
            </label>
            <select id="agent-filter" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="term-input">
              {agents.length === 0 && <option value="">no agents</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type-filter" className="block text-[10px] term-muted uppercase tracking-widest mb-1">
              [type:]
            </label>
            <select id="type-filter" value={dataType} onChange={(e) => setDataType(e.target.value as DataType | '')} className="term-input">
              <option value="">all</option>
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button type="button" className="term-btn-primary" onClick={() => setLogOpen(true)} disabled={!agentId}>
            [+ LOG]
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] term-muted px-1">
        <span>
          {memoriesQuery.isLoading ? (
            <LoadingSpinner label="loading" />
          ) : (
            <span>{'>'} {total} {total === 1 ? 'memory' : 'memories'} indexed</span>
          )}
        </span>
        {memoriesQuery.isFetching && !memoriesQuery.isLoading && <LoadingSpinner />}
      </div>

      <div className="term-panel">
        <div className="px-3 py-1.5 border-b border-terminal-border text-[10px] term-muted uppercase tracking-widest">
          <span className="term-green">┌─[</span> results <span className="term-green">]</span> &nbsp; ID &nbsp; | &nbsp; AGENT &nbsp; | &nbsp; TYPE &nbsp; | &nbsp; HASH &nbsp; | &nbsp; TIMESTAMP
        </div>
        <div className="divide-y divide-terminal-border">
          {items.map((m) => (
            <MemoryCard key={m.id} memory={m} chainId={chainId} />
          ))}
          {!memoriesQuery.isLoading && items.length === 0 && (
            <div className="text-center py-10 text-xs term-muted">
              <p>{'>'} no memories match this filter</p>
              <p className="mt-1 term-dim">try clearing search or selecting a different agent</p>
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2 pt-2 text-xs">
          <button
            type="button"
            className="term-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            [&lt; PREV]
          </button>
          <span className="term-muted">
            PAGE {page}/{totalPages}
          </span>
          <button
            type="button"
            className="term-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            [NEXT &gt;]
          </button>
        </nav>
      )}

      <LogMemoryModal open={logOpen} onClose={() => setLogOpen(false)} agentId={agentId} />
    </div>
  );
}

interface LogMemoryModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
}

function LogMemoryModal({ open, onClose, agentId }: LogMemoryModalProps): JSX.Element {
  const log = useLogMemory(agentId);
  const [dataType, setDataType] = useState<DataType>('text');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const reset = (): void => {
    setDataType('text');
    setContent('');
    setTags('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!content.trim() || !agentId) return;
    const input: MemoryInput = {
      dataType,
      content: content.trim(),
      metadata: tags
        ? { tags: tags.split(',').map((t) => t.trim()).filter(Boolean).join(',') }
        : undefined,
    };
    try {
      await log.mutateAsync(input);
      reset();
      onClose();
    } catch {
      /* error captured in mutation state */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="LOG NEW MEMORY"
      description="persisted to 0G storage and indexed for retrieval"
      size="lg"
      footer={
        <>
          <button type="button" className="term-btn" onClick={onClose}>[CANCEL]</button>
          <button
            type="button"
            className="term-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={!content.trim() || log.isPending}
          >
            {log.isPending ? <LoadingSpinner /> : '[SIGN & LOG]'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div>
          <label htmlFor="data-type" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[data type]</label>
          <select
            id="data-type"
            className="term-input"
            value={dataType}
            onChange={(e) => setDataType(e.target.value as DataType)}
          >
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="content" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[content]</label>
          <textarea
            id="content"
            className="term-input min-h-[140px] resize-y font-mono"
            placeholder="paste or write a memory..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tags" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[tags (comma separated)]</label>
          <input
            id="tags"
            className="term-input"
            placeholder="research, 0g, defi"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        {log.isError && (
          <p className="text-xs term-red">[error] failed to log: {log.error?.message}</p>
        )}
      </div>
    </Modal>
  );
}
