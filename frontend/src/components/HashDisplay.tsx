import { useState } from 'react';
import type { Hash } from '@/lib/types';
import { copyToClipboard, truncateHash, txExplorer } from '@/lib/format';

interface HashDisplayProps {
  hash: Hash | string;
  chainId?: number;
  head?: number;
  tail?: number;
  showCopy?: boolean;
  showExplorer?: boolean;
  label?: string;
  className?: string;
}

export function HashDisplay({
  hash,
  chainId,
  head = 8,
  tail = 6,
  showCopy = true,
  showExplorer = true,
  label,
  className,
}: HashDisplayProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await copyToClipboard(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className ?? ''}`}>
      {label !== undefined && label !== '' && <span className="term-muted">{label}:</span>}
      <span className="term-green">{truncateHash(hash, head, tail)}</span>
      {showCopy && (
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-[10px] term-muted hover:term-green transition-colors"
          aria-label={copied ? 'Copied hash' : 'Copy hash'}
        >
          {copied ? '[COPIED]' : '[COPY]'}
        </button>
      )}
      {showExplorer && chainId && (
        <a
          href={txExplorer(chainId, hash)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[10px] term-cyan hover:underline"
          aria-label="View on explorer"
        >
          [VIEW]
        </a>
      )}
    </span>
  );
}
