import { jest } from "@jest/globals";

// Mock contract module to avoid hitting chain in tests
jest.unstable_mockModule("../../src/lib/contract.js", () => ({
  readMemoryEntries: async () => [],
  readMemoryEntry: async () => null,
  getChainStatus: async () => ({ connected: false, blockNumber: null }),
  isChainConfigured: () => false,
  getRegistry: () => ({ getAgent: async () => null, getAgentsByOwner: async () => [] }),
  getMemoryContract: () => ({}),
  getAgenticIDContract: () => ({}),
  AEVUM_REGISTRY_ABI: [],
  AEVUM_MEMORY_ABI: [],
  AEVUM_AGENTIC_ID_ABI: [],
  getProvider: () => ({}),
  getWallet: () => ({}),
  createAgent: async () => ({ agentId: 1n, txHash: "0x" }),
  readAgent: async () => null,
  readAgentsByOwner: async () => [],
  setMemoryPointer: async () => "0x",
  logMemory: async () => ({ entryId: 1n, txHash: "0x" }),
  mintAgenticID: async () => ({ tokenId: 1n, txHash: "0x" }),
  resolveByHandle: async () => null,
}));

const { retrieveRelevant, appendMemory } = await import("../../src/agents/memoryAgent.js");
const { saveLocalIndex } = await import("../../src/lib/ogStorage.js");

describe("memoryAgent", () => {
  it("returns [] when no memories exist", async () => {
    const result = await retrieveRelevant("anything", "999");
    expect(result).toEqual([]);
  });

  it("ranks stored memories by similarity", async () => {
    const agentId = "42";
    await saveLocalIndex(agentId, [
      {
        id: "1",
        agentId,
        content: "I love cats and dogs",
        embedding: [],
        rootHash: "0x1",
        createdAt: Date.now(),
        role: "user",
      },
      {
        id: "2",
        agentId,
        content: "Quantum entanglement is fascinating",
        embedding: [],
        rootHash: "0x2",
        createdAt: Date.now(),
        role: "user",
      },
    ]);
    const result = await retrieveRelevant("Tell me about cats", agentId, 2);
    expect(result.length).toBe(2);
    expect(result[0]?.id).toBe("1");
    expect(result[0]!.similarity).toBeGreaterThan(result[1]!.similarity);
  });

  it("appends a new memory with an embedding", async () => {
    const agentId = "43";
    const entry = await appendMemory(agentId, {
      id: "99",
      content: "Hello world",
      rootHash: "0x99",
      createdAt: Date.now(),
      role: "user",
    });
    expect(entry.embedding.length).toBeGreaterThan(0);
    const result = await retrieveRelevant("Hello", agentId, 1);
    expect(result[0]?.id).toBe("99");
  });
});
