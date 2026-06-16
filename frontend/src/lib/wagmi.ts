import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from './chains';
import type { Chain } from 'viem';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'aevum-default-project-id';

const orderedChains: readonly [Chain, ...Chain[]] = [
  ...(SUPPORTED_CHAINS as unknown as readonly [Chain, ...Chain[]]),
];

const fallbackChains: readonly [Chain, ...Chain[]] = orderedChains.length > 0
  ? orderedChains
  : (() => {
      throw new Error('No supported chains configured');
    })();

void DEFAULT_CHAIN_ID;

export const wagmiConfig = getDefaultConfig({
  appName: 'Aevum',
  projectId,
  chains: fallbackChains,
  ssr: false,
  batch: { multicall: { wait: 200 } },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
