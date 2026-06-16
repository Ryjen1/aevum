/**
 * Memory agent — vector-search over an agent's stored memories.
 */
import { retrieveMemory, loadLocalIndex, saveLocalIndex } from "../lib/ogStorage.js";
import { generateEmbedding, generateEmbeddingSync, topKSimilar } from "../lib/embeddings.js";
import { readMemoryEntries } from "../lib/contract.js";
import { logger } from "../logger.js";
import type { MemoryChunk, MemoryEntry } from "../types/index.js";

interface LocalIndexEntry {
  id: string;
  agentId: string;
  content: string;
  embedding: number[];
  rootHash: string;
  createdAt: number;
  role: MemoryEntry["role"];
}

async function loadAgentMemories(agentId: string): Promise<LocalIndexEntry[]> {
  const local = await loadLocalIndex<LocalIndexEntry>(agentId);
  if (local.length > 0) return local;
  try {
    const entries = await readMemoryEntries(agentId, 0, 50);
    const mems: LocalIndexEntry[] = [];
    for (const e of entries) {
      try {
        const buf = await retrieveMemory(e.rootHash, { decrypt: true });
        mems.push({
          id: e.id.toString(),
          agentId,
          content: buf.toString("utf-8"),
          embedding: [],
          rootHash: e.rootHash,
          createdAt: Number(e.createdAt) * 1000,
          role: e.role === 0 ? "user" : e.role === 1 ? "assistant" : "system",
        });
      } catch (err) {
        logger.debug({ err, rootHash: e.rootHash }, "Failed to load memory from storage");
      }
    }
    return mems;
  } catch (err) {
    logger.debug({ err, agentId }, "Memory contract not available");
    return [];
  }
}

export async function retrieveRelevant(
  query: string,
  agentId: string,
  limit: number = 5,
): Promise<MemoryChunk[]> {
  const memories = await loadAgentMemories(agentId);
  if (memories.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  const withEmbeddings: LocalIndexEntry[] = memories.map((m) =>
    m.embedding && m.embedding.length > 0 ? m : { ...m, embedding: generateEmbeddingSync(m.content) },
  );
  const ranked = topKSimilar(queryEmbedding, withEmbeddings, limit);
  return ranked.map(({ item, similarity }) => ({
    id: item.id,
    agentId: item.agentId,
    content: item.content,
    embedding: item.embedding,
    similarity,
    rootHash: item.rootHash,
    createdAt: item.createdAt,
  }));
}

export async function appendMemory(
  agentId: string,
  entry: Omit<LocalIndexEntry, "agentId" | "embedding"> & { embedding?: number[] },
): Promise<LocalIndexEntry> {
  const existing = await loadLocalIndex<LocalIndexEntry>(agentId);
  const embedding = entry.embedding && entry.embedding.length > 0
    ? entry.embedding
    : await generateEmbedding(entry.content);
  const record: LocalIndexEntry = {
    id: entry.id,
    agentId,
    content: entry.content,
    embedding,
    rootHash: entry.rootHash,
    createdAt: entry.createdAt,
    role: entry.role,
  };
  await saveLocalIndex(agentId, [...existing, record]);
  return record;
}
