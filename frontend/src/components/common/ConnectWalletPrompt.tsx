import { ConnectButton } from '@rainbow-me/rainbowkit';

const DISCONNECTED_ART = `
 +----------------------------+
 |                            |
 |  > NO WALLET DETECTED      |
 |                            |
 |  connection: null          |
 |  status:    idle           |
 |  awaiting:  wallet.signIn  |
 |                            |
 +----------------------------+
`;

export function ConnectWalletPrompt(): JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="max-w-md w-full term-panel p-6">
        <pre className="text-[10px] term-green leading-tight whitespace-pre overflow-x-auto text-left">
          {DISCONNECTED_ART}
        </pre>
        <div className="mt-4 text-left">
          <p className="text-xs term-muted">
            <span className="term-green">aevum</span> is a wallet-gated terminal for the eternal archive
            of AI agent memory. connect a wallet on 0G mainnet or galileo testnet to access
            your agents, browse memories, and chat with the oracle.
          </p>
          <p className="mt-3 text-[10px] term-dim">
            {'>'} connect wallet to continue<span className="cursor-blink">_</span>
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <ConnectButton showBalance={false} chainStatus="icon" label="connect wallet" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
          <div className="term-border border p-2 text-center">
            <p className="term-muted">AGENTS</p>
            <p className="mt-1 term-green">verifiable</p>
          </div>
          <div className="term-border border p-2 text-center">
            <p className="term-muted">MEMORY</p>
            <p className="mt-1 term-green">persistent</p>
          </div>
          <div className="term-border border p-2 text-center">
            <p className="term-muted">COMPUTE</p>
            <p className="mt-1 term-green">[TEE]</p>
          </div>
        </div>
      </div>
    </div>
  );
}
