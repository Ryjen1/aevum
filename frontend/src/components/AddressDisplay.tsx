import { useState } from 'react';
import type { Address } from '@/lib/types';
import { addressExplorer, copyToClipboard, truncateAddress } from '@/lib/format';

interface AddressDisplayProps {
  address: Address | string;
  chainId?: number;
  head?: number;
  tail?: number;
  showCopy?: boolean;
  showExplorer?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  chainId,
  head = 6,
  tail = 4,
  showCopy = true,
  showExplorer = true,
  className,
}: AddressDisplayProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await copyToClipboard(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className ?? ''}`}>
      <span className="term-text">{truncateAddress(address, head, tail)}</span>
      {showCopy && (
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-[10px] term-muted hover:term-green transition-colors"
          aria-label={copied ? 'Copied' : 'Copy address'}
        >
          {copied ? '[COPIED]' : '[COPY]'}
        </button>
      )}
      {showExplorer && chainId && (
        <a
          href={addressExplorer(chainId, address)}
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
