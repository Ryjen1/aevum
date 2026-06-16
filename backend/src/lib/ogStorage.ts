/**
 * 0G Storage wrapper.
 *
 * Uses @0glabs/0g-ts-sdk Indexer for upload/download of memory blobs.
 * Gracefully falls back to a local filesystem cache when 0G is
 * unreachable (dev only).
 *
 * The SDK is published against ethers v5 types but we run ethers v6;
 * we therefore adapt the signer at the call boundary.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Wallet, JsonRpcProvider, type Signer as V6Signer } from "ethers";
import { Indexer, ZgFile, Blob } from "@0glabs/0g-ts-sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";
import {
  encryptToBuffer,
  decryptFromBuffer,
  hashContent,
  keyFromHex,
  type EncryptedBlob,
} from "./encryption.js";
import type { StorageStatus, UploadResult } from "../types/index.js";

let connected = false;
let networkName = "unknown";
let lastError: string | undefined;
let usingFallback = false;

const cacheDir = config.LOCAL_STORAGE_DIR;
const memCache = new Map<string, Buffer>();

let indexer: Indexer | null = null;
let provider: JsonRpcProvider | null = null;
let wallet: V6Signer | null = null;

async function ensureDirectories(): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(join(cacheDir, "blobs"), { recursive: true });
}

function localPath(rootHash: string): string {
  return join(cacheDir, "blobs", `${rootHash.replace(/^0x/, "")}.bin`);
}

async function init(): Promise<void> {
  if (indexer && wallet) return;
  try {
    provider = new JsonRpcProvider(config.OG_RPC_URL);
    wallet = new Wallet(config.OG_PRIVATE_KEY, provider);
    indexer = new Indexer(config.OG_INDEXER_RPC);
    // Probe the network — Indexer is HTTP so a quick getShardedNodes() call
    // is enough to know if the indexer is up.
    await Promise.race([
      indexer.getShardedNodes(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5_000)),
    ]);
    networkName = await provider.getNetwork().then((n) => n.name).catch(() => "0g");
    connected = true;
    usingFallback = false;
    lastError = undefined;
    logger.info({ indexer: config.OG_INDEXER_RPC, rpc: config.OG_RPC_URL }, "Connected to 0G Storage");
  } catch (err) {
    connected = false;
    usingFallback = true;
    lastError = err instanceof Error ? err.message : String(err);
    logger.warn({ err: lastError }, "0G Storage unavailable, using local filesystem fallback");
    await ensureDirectories();
  }
}

function toV5Signer(v6: V6Signer): unknown {
  // The 0g-ts-sdk accepts any ethers v5 Signer. We hand it a minimal
  // adapter that delegates to our v6 wallet — the SDK only uses
  // getAddress() and signMessage() in the upload path.
  return {
    getAddress: async (): Promise<string> => v6.getAddress(),
    signMessage: async (msg: string | Uint8Array): Promise<string> => {
      if (typeof msg === "string") return v6.signMessage(msg);
      return v6.signMessage(msg);
    },
    provider: v6.provider ?? null,
  };
}

async function blobFromBuffer(data: Buffer, name: string): Promise<Blob> {
  // Blob's API only accepts browser File objects, so for Node we fall
  // through to ZgFile.
  await ensureDirectories();
  const tmp = join(cacheDir, `tmp-${randomUUID()}-${name}`);
  await fs.writeFile(tmp, data);
  const fd = await fs.open(tmp, "r");
  const zg = await ZgFile.fromNodeFileHandle(fd);
  // ZgFile extends AbstractFile, which is what uploadFile expects.
  return zg as unknown as Blob;
}

async function writeFallback(rootHash: string, data: Buffer): Promise<void> {
  await ensureDirectories();
  await fs.writeFile(localPath(rootHash), data);
  memCache.set(rootHash, data);
}

export interface UploadOptions {
  encrypt?: boolean;
  tags?: string[];
}

export async function uploadMemory(
  data: Buffer | string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  await init();
  const raw = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  const shouldEncrypt = options.encrypt === true;
  const key = keyFromHex(config.ENCRYPTION_KEY);
  const payload = shouldEncrypt ? encryptToBuffer(raw, key) : raw;

  if (!connected || !indexer || !wallet) {
    const rootHash = hashContent(payload);
    await writeFallback(rootHash, payload);
    return { rootHash, txHash: "0x", size: payload.length, encrypted: shouldEncrypt, fallback: true };
  }

  try {
    const file = await blobFromBuffer(payload, "memory");
    const [result, err] = await indexer.upload(
      file,
      config.OG_RPC_URL,
      toV5Signer(wallet) as never,
      { tags: options.tags ?? ["aevum", "memory"], finalityRequired: true } as never,
    );
    if (err || !result) {
      throw err ?? new Error("Upload returned no result");
    }
    return {
      rootHash: result.rootHash,
      txHash: result.txHash,
      size: payload.length,
      encrypted: shouldEncrypt,
      fallback: false,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    logger.error({ err: lastError }, "0G upload failed, falling back to local cache");
    connected = false;
    usingFallback = true;
    const rootHash = hashContent(payload);
    await writeFallback(rootHash, payload);
    return { rootHash, txHash: "0x", size: payload.length, encrypted: shouldEncrypt, fallback: true };
  }
}

export interface RetrieveOptions {
  decrypt?: boolean;
}

export async function retrieveMemory(
  rootHash: string,
  options: RetrieveOptions = {},
): Promise<Buffer> {
  await init();
  const normalized = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;

  // Try in-memory first
  const cached = memCache.get(normalized);
  if (cached) return finalize(cached, options.decrypt === true);

  // Try local FS
  try {
    const buf = await fs.readFile(localPath(normalized));
    memCache.set(normalized, buf);
    return finalize(buf, options.decrypt === true);
  } catch {
    // not in local cache
  }

  if (!connected || !indexer) {
    throw new Error(`Memory ${normalized} not found in fallback cache`);
  }

  // Pull from 0G via the indexer downloader
  const tmp = join(cacheDir, `dl-${randomUUID()}`);
  try {
    const dlErr = await indexer.download(normalized, tmp, true);
    if (dlErr) throw dlErr;
    const buf = await fs.readFile(tmp);
    memCache.set(normalized, buf);
    return finalize(buf, options.decrypt === true);
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

function finalize(buf: Buffer, decrypt: boolean): Buffer {
  if (!decrypt) return buf;
  const key = keyFromHex(config.ENCRYPTION_KEY);
  return decryptFromBuffer(buf, key);
}

export function isEncryptedBuffer(buf: Buffer): boolean {
  // We only need to know whether the *first byte* could plausibly be an
  // IV prefix; the encryption helpers produce [12 IV][16 tag][cipher].
  // Without metadata this is heuristic. Use `getMetadata()` for accuracy.
  return buf.length >= 12 + 16;
}

export async function getMetadata(rootHash: string): Promise<EncryptedBlob | null> {
  const buf = await retrieveMemory(rootHash, { decrypt: false });
  if (buf.length < 12 + 16) return null;
  // We can't reliably tell if it was encrypted; assume true and let the
  // caller handle decryption errors.
  return {
    iv: buf.subarray(0, 12).toString("base64"),
    authTag: buf.subarray(12, 28).toString("base64"),
    ciphertext: buf.subarray(28).toString("base64"),
  };
}

export async function storageStatus(): Promise<StorageStatus> {
  await init();
  return {
    connected,
    network: networkName,
    fallbackMode: usingFallback,
    fallbackDir: usingFallback ? cacheDir : undefined,
    rpcUrl: config.OG_RPC_URL,
    indexerUrl: config.OG_INDEXER_RPC,
    error: lastError,
  };
}

export async function listLocalMemories(agentId: string): Promise<string[]> {
  await ensureDirectories();
  const dir = join(cacheDir, "agents", agentId);
  await fs.mkdir(dir, { recursive: true });
  const files = await fs.readdir(dir);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

export async function saveLocalIndex(agentId: string, entries: unknown[]): Promise<void> {
  await ensureDirectories();
  const dir = join(cacheDir, "agents", agentId);
  await fs.mkdir(dir, { recursive: true });
  const file = join(dir, "index.json");
  await fs.writeFile(file, JSON.stringify(entries, null, 2));
}

export async function loadLocalIndex<T>(agentId: string): Promise<T[]> {
  try {
    const file = join(cacheDir, "agents", agentId, "index.json");
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export const __test__ = { memCache, writeFallback, localPath, cacheDir };
