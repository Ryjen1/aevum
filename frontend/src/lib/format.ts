import type { Address, Hash } from './types';
import { getExplorerLink } from './chains';

export function truncateAddress(addr: string | Address | undefined, head = 6, tail = 4): string {
  if (!addr) return '';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function truncateHash(hash: string | Hash | undefined, head = 8, tail = 6): string {
  if (!hash) return '';
  if (hash.length <= head + tail + 2) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function asciiBar(percent: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

export function formatBytes(bytes: number | bigint | undefined, decimals = 1): string {
  if (bytes === undefined || bytes === null) return '—';
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / Math.pow(1024, i);
  return `${value.toFixed(decimals)} ${units[i]}`;
}

export function formatNumber(n: number | bigint | undefined): string {
  if (n === undefined || n === null) return '—';
  const value = typeof n === 'bigint' ? Number(n) : n;
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatTimestamp(iso: string | number | Date | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604_800) return `${Math.floor(diff / 86_400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimestampFull(iso: string | number | Date | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function addressExplorer(chainId: number, address: Address | string): string {
  return getExplorerLink(chainId, address, 'address');
}

export function txExplorer(chainId: number, hash: Hash | string): string {
  return getExplorerLink(chainId, hash, 'tx');
}

export function isAddress(value: string | undefined | null): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isHash(value: string | undefined | null): value is Hash {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return Promise.reject(new Error('Clipboard not available'));
  }
  return navigator.clipboard.writeText(text);
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
