import { defineChain } from 'viem';

export const OG_MAINNET = defineChain({
  id: 16661,
  name: '0G Mainnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc.0g.ai'] },
    public: { http: ['https://evmrpc.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://chainscan.0g.ai' },
  },
  testnet: false,
});

export const OG_GALILEO = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
    public: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Galileo Explorer', url: 'https://chainscan-galileo.0g.ai' },
  },
  testnet: true,
});

export const OG_NEWTON = defineChain({
  id: 16600,
  name: '0G Newton Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-newton.0g.ai'] },
    public: { http: ['https://evmrpc-newton.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Newton Explorer', url: 'https://chainscan-newton.0g.ai' },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = [OG_MAINNET, OG_GALILEO, OG_NEWTON] as const;

export const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_OG_CHAIN_ID) || OG_GALILEO.id;

export const CHAIN_BY_ID: Record<number, (typeof SUPPORTED_CHAINS)[number]> = SUPPORTED_CHAINS.reduce(
  (acc, chain) => {
    acc[chain.id] = chain;
    return acc;
  },
  {} as Record<number, (typeof SUPPORTED_CHAINS)[number]>,
);

export function getExplorerLink(chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string {
  const chain = CHAIN_BY_ID[chainId];
  if (!chain) return '#';
  const base = chain.blockExplorers.default.url;
  return `${base}/${type}/${hash}`;
}
