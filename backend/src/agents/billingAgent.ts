/**
 * Billing agent — usage tracking.
 *
 * Stores a rolling in-memory log of operations per user and can
 * optionally flush batches to 0G Storage for permanent audit.
 */
import { uploadMemory } from "../lib/ogStorage.js";
import { logger } from "../logger.js";

export interface UsageRecord {
  userAddress: string;
  operation: string;
  metadata: Record<string, unknown>;
  at: number;
}

const usage: UsageRecord[] = [];
const MAX_IN_MEMORY = 10_000;

export function trackUsage(
  userAddress: string,
  operation: string,
  metadata: Record<string, unknown> = {},
): void {
  usage.push({ userAddress, operation, metadata, at: Date.now() });
  if (usage.length > MAX_IN_MEMORY) {
    usage.splice(0, usage.length - MAX_IN_MEMORY);
  }
}

export function usageFor(userAddress: string, limit: number = 100): UsageRecord[] {
  return usage
    .filter((u) => u.userAddress.toLowerCase() === userAddress.toLowerCase())
    .slice(-limit)
    .reverse();
}

export function totalUsage(userAddress: string): number {
  return usage.filter((u) => u.userAddress.toLowerCase() === userAddress.toLowerCase()).length;
}

export async function flushToStorage(): Promise<string | null> {
  if (usage.length === 0) return null;
  try {
    const res = await uploadMemory(JSON.stringify(usage), { encrypt: true });
    usage.length = 0;
    return res.rootHash;
  } catch (err) {
    logger.warn({ err }, "flushToStorage failed");
    return null;
  }
}
