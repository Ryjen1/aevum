import { Link } from 'react-router-dom';
import type { Agent } from '@/lib/types';
import { formatBytes, formatNumber, formatTimestamp, truncateAddress } from '@/lib/format';

interface AgentCardProps {
  agent: Agent;
  to?: string;
  className?: string;
}

export function AgentCard({ agent, to, className }: AgentCardProps): JSX.Element {
  const status = agent.status === 'active' ? 'term-green' : agent.status === 'paused' ? 'term-amber' : 'term-muted';
  const statusChar = agent.status === 'active' ? '\u25CF' : agent.status === 'paused' ? '\u25D0' : '\u25CB';

  const content = (
    <div className={`term-panel p-3 hover:border-terminal-green transition-colors h-full flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-terminal-border">
        <span className="text-[10px] term-muted uppercase tracking-widest">
          AGENT #{agent.id.slice(0, 6)}
        </span>
        <span className={`text-[10px] ${status} flex items-center gap-1`}>
          <span>{statusChar}</span>
          <span className="uppercase">{agent.status}</span>
        </span>
      </div>
      <h3 className="text-sm term-text font-semibold truncate">{agent.name}</h3>
      <p className="mt-1 text-[10px] term-muted uppercase tracking-wider">
        {agent.role} {agent.teeEnabled && <span className="term-cyan">[TEE]</span>}
      </p>
      {agent.description && (
        <p className="mt-2 text-xs term-muted line-clamp-2">{agent.description}</p>
      )}
      <div className="mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="term-muted">memories:</span>
          <span className="term-text tabular-nums">{formatNumber(agent.memoryCount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="term-muted">size:</span>
          <span className="term-text tabular-nums">{formatBytes(agent.memoryBytes)}</span>
        </div>
        <div className="flex justify-between">
          <span className="term-muted">owner:</span>
          <span className="term-text">{truncateAddress(agent.owner, 6, 4)}</span>
        </div>
      </div>
      <div className="mt-auto pt-2 border-t border-terminal-border text-[10px] term-dim">
        last: {formatTimestamp(agent.lastActivity)}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{content}</Link>;
  }
  return content;
}
