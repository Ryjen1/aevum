import { useEffect, useState } from 'react';
import type { ChatMessage as ChatMessageType } from '@/lib/types';
import { TEEProofBadge } from './TEEProofBadge';
import { truncateHash } from '@/lib/format';
import { LoadingSpinner } from './LoadingSpinner';

interface MessageBubbleProps {
  message: ChatMessageType;
  chainId?: number;
  onOpenAudit?: (id: string) => void;
}

export function MessageBubble({ message, chainId: _chainId, onOpenAudit: _onOpenAudit }: MessageBubbleProps): JSX.Element {
  const [displayed, setDisplayed] = useState<string>('');
  const isUser = message.role === 'user';

  useEffect(() => {
    if (message.pending) {
      setDisplayed('');
      return;
    }
    const full = message.content;
    if (full.length <= 60) {
      setDisplayed(full);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 4;
      setDisplayed(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [message.content, message.pending]);

  if (message.role === 'system') {
    return (
      <div className="text-xs term-muted py-1">
        <span className="term-dim">[system]</span> {message.content}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="text-xs leading-relaxed">
        <span className="term-magenta">[user]</span> <span className="term-text whitespace-pre-wrap break-words">{message.content}</span>
      </div>
    );
  }

  if (message.pending) {
    return (
      <div className="space-y-1 text-xs leading-relaxed">
        <div>
          <span className="term-green">[aevum.memory]</span> <span className="term-muted">retrieving 5 relevant memories...</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="term-green">[aevum.llm]</span>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs leading-relaxed">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="term-green">[aevum.llm]</span>
        {message.proof && <TEEProofBadge proof={message.proof} />}
        {message.proof && (
          <span className="term-dim">[{new Date(message.proof.timestamp).toLocaleTimeString('en-GB')}]</span>
        )}
      </div>
      <div className="pl-0 term-text whitespace-pre-wrap break-words">
        {displayed}
        {displayed.length < message.content.length && <span className="cursor-blink term-green">_</span>}
      </div>
      {message.memoriesUsed && message.memoriesUsed.length > 0 && (
        <div className="term-muted">
          <span className="term-cyan">[aevum.memory]</span> used {message.memoriesUsed.length} memories: {message.memoriesUsed.map((m) => truncateHash(m.contentHash, 6, 4)).join(', ')}
        </div>
      )}
      {message.auditLogId && (
        <div className="term-muted">
          <span className="term-amber">[aevum.chain]</span> audit: {truncateHash(message.auditLogId, 8, 6)}
        </div>
      )}
    </div>
  );
}
