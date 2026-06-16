import { useState } from 'react';
import type { Memory } from '@/lib/types';
import { formatBytes, formatTimestampFull, truncateHash } from '@/lib/format';

interface MemoryCardProps {
  memory: Memory;
  chainId?: number;
  defaultExpanded?: boolean;
}

export function MemoryCard({ memory, chainId: _chainId, defaultExpanded = false }: MemoryCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const id = memory.id.padStart(3, '0').slice(-3);
  const agentShort = memory.agentId.slice(0, 6);

  return (
    <article className="term-panel">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-3 hover:bg-[#0d0d0d] transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="term-green tabular-nums">#{id}</span>
          <span className="term-dim">|</span>
          <span className="term-cyan">AGENT:{agentShort}</span>
          <span className="term-dim">|</span>
          <span className="term-amber uppercase">TYPE:{memory.dataType}</span>
          <span className="term-dim">|</span>
          <span className="term-text">{truncateHash(memory.contentHash, 8, 6)}</span>
          <span className="term-dim">|</span>
          <span className="term-muted">{formatTimestampFull(memory.createdAt)}</span>
          <span className="ml-auto term-dim text-[10px]">{expanded ? '[-]' : '[+]'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-terminal-border pt-3 space-y-2">
          <pre className="text-xs term-text whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {memory.content}
          </pre>
          <div className="flex flex-wrap items-center gap-3 text-[10px] pt-2 border-t border-terminal-border">
            <span className="term-muted">SIZE: <span className="term-text">{formatBytes(memory.sizeBytes)}</span></span>
            <span className="term-muted">ROOT: <span className="term-text">{truncateHash(memory.storageRoot, 8, 6)}</span></span>
            <span className="term-muted">ACCESS: <span className="term-text">{memory.accessControls.map((a) => a.type).join(',') || 'none'}</span></span>
          </div>
        </div>
      )}
    </article>
  );
}
