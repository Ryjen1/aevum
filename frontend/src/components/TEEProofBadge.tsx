import type { TEEProof } from '@/lib/types';
import { truncateHash } from '@/lib/format';

interface TEEProofBadgeProps {
  proof?: TEEProof | null;
  className?: string;
}

export function TEEProofBadge({ proof, className }: TEEProofBadgeProps): JSX.Element | null {
  if (!proof) return null;
  const verified = proof.verified;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] ${className ?? ''}`}
      title={verified ? `TEE verified - ${truncateHash(proof.hash, 10, 8)}` : 'TEE proof pending verification'}
    >
      {verified ? (
        <span className="term-green">[TEE:VERIFIED]</span>
      ) : (
        <span className="term-amber">[TEE:UNVERIFIED]</span>
      )}
    </span>
  );
}
