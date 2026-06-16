import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { Modal } from '@/components/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useApi } from '@/providers/ApiProvider';
import type { Agent, AgentRole, MarketplaceAgent, Paginated } from '@/lib/types';
import { formatNumber, formatTimestamp, truncateAddress } from '@/lib/format';

const HEADER = '═══ AGENT REGISTRY ═══';

function ratingStars(rating: number): string {
  const full = Math.round(rating);
  return '\u2605'.repeat(Math.max(0, full)) + '\u2606'.repeat(Math.max(0, 5 - full));
}

export function Registry(): JSX.Element {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { api } = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);

  const list = useQuery<Paginated<MarketplaceAgent>, Error>({
    queryKey: ['registry', search],
    queryFn: () => api.listMarketplace({ search, pageSize: 24 }),
  });

  const install = useMutation<Agent, Error, { id: string }>({
    mutationFn: ({ id }) => {
      if (!address) throw new Error('Wallet not connected');
      return api.installMarketplaceAgent(id, address);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  if (!isConnected) return <ConnectWalletPrompt />;

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <pre className="term-green text-[10px] sm:text-xs leading-tight whitespace-pre overflow-x-auto">
{HEADER}
[ registry // discover & install community agents ]  [ chain: {chainId ?? '?'} ]
{'─'.repeat(64)}
      </pre>

      <div className="term-panel p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="flex-1">
          <span className="text-[10px] term-muted uppercase tracking-widest">[search: </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="________________"
            className="term-input inline-block w-[calc(100%-120px)] ml-1"
            aria-label="Search registry"
          />
          <span className="text-[10px] term-muted uppercase tracking-widest"> ]</span>
        </div>
        <button type="button" className="term-btn-primary" onClick={() => setPublishOpen(true)}>
          [+ PUBLISH]
        </button>
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="term-panel p-3 h-48 flex items-center justify-center">
              <LoadingSpinner label="loading" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="term-panel p-10 text-center text-xs">
          <p className="term-muted">{'>'} no agents found in registry</p>
          <p className="mt-1 term-dim">be the first to publish one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((m) => (
            <article key={m.id} className="term-panel flex flex-col hover:border-terminal-green transition-colors">
              <div className="px-3 py-1.5 border-b border-terminal-border text-[10px] term-muted uppercase tracking-widest flex items-center justify-between">
                <span className="term-cyan">┌─[ AGENT </span>
                <span className="text-term-text">#{m.id.slice(0, 6)}</span>
                <span className="term-cyan"> ]─┐</span>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="text-sm term-text font-semibold">{m.name}</h3>
                <p className="text-[10px] term-muted mt-0.5">
                  by <span className="term-text">{truncateAddress(m.owner, 6, 4)}</span>
                </p>
                <p className="mt-2 text-xs term-muted line-clamp-3 flex-1">{m.description}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  <span className="term-border border px-1.5 py-0.5 term-amber uppercase">{m.role}</span>
                  {m.teeEnabled && (
                    <span className="term-border border px-1.5 py-0.5 term-cyan">[TEE]</span>
                  )}
                  {m.tags.slice(0, 3).map((t) => (
                    <span key={t} className="term-border border px-1.5 py-0.5 term-muted">#{t}</span>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-terminal-border flex items-center justify-between text-[10px]">
                  <span className="term-green">{ratingStars(m.rating)}</span>
                  <span className="term-muted">{formatNumber(m.installs)} installs</span>
                </div>
                <div className="mt-1 text-[10px] term-dim">
                  published: {formatTimestamp(m.publishedAt)}
                </div>
              </div>
              <div className="border-t border-terminal-border p-2">
                <button
                  type="button"
                  className="term-btn-primary w-full text-xs"
                  onClick={() => install.mutate({ id: m.id })}
                  disabled={install.isPending}
                >
                  {install.isPending ? <LoadingSpinner /> : '[INSTALL]'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} walletAddress={address ?? ''} />
    </div>
  );
}

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}

function PublishModal({ open, onClose, walletAddress }: PublishModalProps): JSX.Element {
  const { api } = useApi();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<AgentRole>('assistant');
  const [tags, setTags] = useState('');

  const publish = useMutation<MarketplaceAgent, Error, { name: string; description: string; role: string; tags: string[] }>({
    mutationFn: (input) => {
      if (!walletAddress) throw new Error('Wallet not connected');
      return api.publishMarketplaceAgent(input, walletAddress);
    },
    onSuccess: () => {
      onClose();
      setName('');
      setDescription('');
      setTags('');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="PUBLISH YOUR AGENT"
      description="share it with the community - owners can install in one click"
      footer={
        <>
          <button type="button" className="term-btn" onClick={onClose}>[CANCEL]</button>
          <button
            type="button"
            className="term-btn-primary"
            onClick={() =>
              publish.mutate({
                name: name.trim(),
                description: description.trim(),
                role,
                tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
              })
            }
            disabled={!name.trim() || !description.trim() || publish.isPending}
          >
            {publish.isPending ? <LoadingSpinner /> : '[PUBLISH]'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div>
          <label htmlFor="pub-name" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[name]</label>
          <input id="pub-name" className="term-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pub-role" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[role]</label>
          <select id="pub-role" className="term-input" value={role} onChange={(e) => setRole(e.target.value as AgentRole)}>
            {(['assistant', 'analyst', 'trader', 'researcher', 'custom'] as AgentRole[]).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pub-desc" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[description]</label>
          <textarea
            id="pub-desc"
            className="term-input min-h-[120px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="pub-tags" className="block term-muted uppercase text-[10px] tracking-widest mb-1">[tags (comma separated)]</label>
          <input id="pub-tags" className="term-input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        {publish.isError && (
          <p className="text-xs term-red">[error] failed to publish: {publish.error?.message}</p>
        )}
      </div>
    </Modal>
  );
}
