import { generateEmbedding, generateEmbeddingSync, cosineSimilarity, topKSimilar, EMBEDDING_DIM } from "../../src/lib/embeddings.js";

describe("embeddings", () => {
  it("generates a deterministic sync embedding of the right dimension", () => {
    const a = generateEmbeddingSync("the quick brown fox");
    const b = generateEmbeddingSync("the quick brown fox");
    const c = generateEmbeddingSync("the slow brown fox");
    expect(a.length).toBe(EMBEDDING_DIM);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("cosineSimilarity of a vector with itself is 1", () => {
    const a = generateEmbeddingSync("hello world");
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity of orthogonal-ish vectors is low", () => {
    const a = generateEmbeddingSync("banana split ice cream");
    const b = generateEmbeddingSync("blockchain cryptography zk-snark circuit");
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeLessThan(0.5);
  });

  it("cosineSimilarity throws on length mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });

  it("topKSimilar returns the most similar items first", () => {
    const query = generateEmbeddingSync("a cat sitting on a mat");
    const items = [
      { id: "a", embedding: generateEmbeddingSync("a cat sitting on a mat") },
      { id: "b", embedding: generateEmbeddingSync("completely unrelated quantum physics") },
      { id: "c", embedding: generateEmbeddingSync("a feline rests on a rug") },
    ];
    const top = topKSimilar(query, items, 2);
    expect(top[0]?.item.id).toBe("a");
    expect(top.length).toBe(2);
    expect(top[0]!.similarity).toBeGreaterThan(top[1]!.similarity);
  });

  it("generateEmbedding async falls back to deterministic when no model", async () => {
    const a = await generateEmbedding("hello world");
    const b = await generateEmbedding("hello world");
    expect(a.length).toBe(EMBEDDING_DIM);
    expect(a).toEqual(b);
  });
});
