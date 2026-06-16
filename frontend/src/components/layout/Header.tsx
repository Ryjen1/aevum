import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain, useBlockNumber } from 'wagmi';
import { CHAIN_BY_ID, SUPPORTED_CHAINS } from '@/lib/chains';
import { truncateAddress } from '@/lib/format';

const LOGO_LINES = [
  ' \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u253C\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u253C\u2588\u253C\u2588\u2588\u2588\u253C\u2588\u253C\u2588\u2588\u253C\u2588\u253C\u2588\u2588\u2588\u2588\u2588\u2588\u253C',
  '\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u2588\u2588\u2588\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C',
  '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u253C\u2588\u2588\u2588\u2588\u2588\u253C  \u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C',
  '\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C \u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C',
  '\u2588\u253C  \u2588\u253C\u2588\u2588\u2588\u2588\u2588\u2588\u253C \u2588\u2588\u2588\u2588\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C\u2588\u253C',
  '\u2554\u2550\u2550\u2557 \u2554\u2550\u2550\u2557\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2557  \u255A\u2550\u2550\u2550\u2550\u2550\u2557 \u255A\u2550\u2557   \u255A\u2550\u2557',
];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function Header(): JSX.Element {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const [time, setTime] = useState<string>(() => formatTime(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentChain = chainId ? CHAIN_BY_ID[chainId] : undefined;
  const connected = isConnected;
  const walletShort = address ? truncateAddress(address, 6, 4) : 'disconnected';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-terminal-border bg-terminal-bg">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-4">
        <div className="flex items-center gap-3 py-1.5 text-[11px] overflow-x-auto whitespace-nowrap">
          <Link to="/status" className="term-green shrink-0 flex items-center gap-2">
            <span className="term-magenta">┌─[</span>
            <span className="font-bold">AEVUM</span>
            <span className="term-magenta">]</span>
          </Link>
          <span className="term-dim">─</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="term-muted">[0G:</span>
            <button
              type="button"
              onClick={() => {
                if (currentChain) {
                  const next = SUPPORTED_CHAINS.find((c) => c.id !== currentChain.id);
                  if (next) switchChain?.({ chainId: next.id });
                } else if (SUPPORTED_CHAINS[0]) {
                  switchChain?.({ chainId: SUPPORTED_CHAINS[0].id });
                }
              }}
              disabled={isSwitching}
              className="term-green hover:underline disabled:opacity-50"
              title="Click to switch network"
            >
              {currentChain ? (currentChain.testnet ? 'Galileo' : 'Mainnet') : 'none'}
            </button>
            <span className={connected ? 'term-green' : 'term-red'}>
              {connected ? '\u25CF' : '\u25CB'}
            </span>
            <span className="term-muted">]</span>
          </div>
          <span className="term-dim">─</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="term-muted">[BLK#</span>
            <span className="term-amber tabular-nums">
              {blockNumber ? blockNumber.toString() : '------'}
            </span>
            <span className="term-muted">]</span>
          </div>
          <span className="term-dim">─</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="term-muted">[</span>
            <span className="term-cyan tabular-nums">{time}</span>
            <span className="term-muted">]</span>
          </div>
          <div className="flex-1 min-w-2" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="term-muted">[</span>
            <span className="term-text">{walletShort}</span>
            <span className="term-muted">]</span>
            <span className="term-magenta">─┐</span>
          </div>
          <div className="shrink-0">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="address"
              label="connect"
            />
          </div>
        </div>
        <div className="hidden md:block py-1 text-[10px] term-dim overflow-hidden">
          <pre className="leading-tight whitespace-pre">{LOGO_LINES.join('\n')}</pre>
        </div>
      </div>
    </header>
  );
}
