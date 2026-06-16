/**
 * Local embedding helpers.
 *
 * Production: uses @xenova/transformers (MiniLM-L6-v2, 384-dim) when
 * available. Dev / CI: a deterministic 384-dim hash-based fallback so
 * tests don't need a model download.
 */
import { createHash } from "node:crypto";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const EMBEDDING_DIM = 384;

let pipelinePromise: Promise<unknown> | null = null;
let featureExtractor: ((text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>) | null = null;

async function loadModel(): Promise<void> {
  if (featureExtractor) return;
  if (pipelinePromise === null) {
    pipelinePromise = (async (): Promise<void> => {
      try {
        // Dynamic import keeps transformers.js optional — dev/CI doesn't
        // need to download a 23 MB model to run unit tests.
        const mod = await (Function("m", "return import(m)") as (m: string) => Promise<Record<string, unknown>>)(
          "@xenova/transformers",
        );
        const transformers = mod as {
          pipeline: (task: string, model: string) => Promise<unknown>;
        };
        const extractor = (await transformers.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")) as (
          text: string,
          options: { pooling: string; normalize: boolean },
        ) => Promise<{ data: Float32Array }>;
        featureExtractor = extractor;
        logger.info("Loaded MiniLM-L6-v2 embedding model");
      } catch (err) {
        logger.warn({ err }, "transformers.js unavailable, using hash-based embeddings");
        featureExtractor = null;
      }
    })();
  }
  await pipelinePromise;
}

/**
 * Generate a deterministic 384-dim pseudo-embedding from a string.
 * Used as a fallback when no transformer model is available.
 */
function hashEmbedding(text: string): number[] {
  const out = new Array<number>(EMBEDDING_DIM).fill(0);
  const normalized = text.toLowerCase().trim();
  // Walk overlapping 3-grams to fill the vector
  for (let i = 0; i < normalized.length; i++) {
    const slice = normalized.slice(i, i + 3);
    const h = createHash("sha256").update(slice).digest();
    for (let j = 0; j < 4; j++) {
      const idx = (h[j * 2] * 256 + h[j * 2 + 1]) % EMBEDDING_DIM;
      out[idx] += 1;
    }
  }
  // Mix in word-level features
  for (const word of normalized.split(/\s+/)) {
    if (!word) continue;
    const h = createHash("sha256").update(word).digest();
    for (let j = 0; j < 8; j++) {
      const idx = h[j] % EMBEDDING_DIM;
      out[idx] += 2;
    }
  }
  // L2 normalize
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (config.DEV_MOCK_MODE) return hashEmbedding(text);
  try {
    await loadModel();
    if (featureExtractor) {
      const out = await featureExtractor(text, { pooling: "mean", normalize: true });
      return Array.from(out.data as Float32Array);
    }
  } catch (err) {
    logger.warn({ err }, "Embedding model failed, using fallback");
  }
  return hashEmbedding(text);
}

export function generateEmbeddingSync(text: string): number[] {
  return hashEmbedding(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}

export function topKSimilar<T extends { embedding: number[] }>(
  query: number[],
  candidates: T[],
  k: number,
): Array<{ item: T; similarity: number }> {
  const scored = candidates.map((item) => ({
    item,
    similarity: cosineSimilarity(query, item.embedding),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
