import { jest } from "@jest/globals";
import request from "supertest";

// Mock all external integrations BEFORE importing the app
jest.unstable_mockModule("../../src/lib/ogStorage.js", () => {
  return {
    uploadMemory: async (data: Buffer | string) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      return {
        rootHash: "0x" + Buffer.from(text).toString("hex").padEnd(64, "0").slice(0, 64),
        txHash: "0xabc",
        size: text.length,
        encrypted: true,
        fallback: true,
      };
    },
    retrieveMemory: async () => Buffer.from(""),
    storageStatus: async () => ({
      connected: false,
      network: "test",
      fallbackMode: true,
      rpcUrl: "",
      indexerUrl: "",
    }),
    listLocalMemories: async () => [],
    saveLocalIndex: async () => undefined,
    loadLocalIndex: async () => [],
  };
});

jest.unstable_mockModule("../../src/lib/ogCompute.js", () => ({
  executeInference: async (prompt: string) => ({
    response: `Echo: ${prompt.slice(0, 50)}`,
    proof: "0xproof",
    providerAddress: "0xprovider",
    teeVerified: true,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0 },
  }),
  listProviders: async () => [
    {
      address: "0xprovider",
      model: "qwen2.5-7b-instruct",
      serviceType: "chatbot",
      url: "https://example.com/v1/proxy",
      inputPrice: 0n,
      outputPrice: 0n,
      verifiability: "TEE",
      teeSignerAddress: "0xtee",
      teeSignerAcknowledged: true,
    },
  ],
  getProviderMetadata: async (address: string) => ({
    address,
    model: "qwen2.5-7b-instruct",
    serviceType: "chatbot",
    url: "https://example.com/v1/proxy",
    inputPrice: 0n,
    outputPrice: 0n,
    verifiability: "TEE",
    teeSignerAddress: "0xtee",
    teeSignerAcknowledged: true,
    endpoint: "https://example.com/v1/proxy",
  }),
  computeStatus: async () => ({
    connected: true,
    providerCount: 1,
    defaultProvider: "",
    fallbackMode: false,
  }),
}));

jest.unstable_mockModule("../../src/lib/contract.js", () => ({
  readMemoryEntries: async () => [],
  readMemoryEntry: async () => null,
  getChainStatus: async () => ({ connected: true, blockNumber: 12345 }),
  isChainConfigured: () => false,
  getRegistry: () => ({}),
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

const { createApp } = await import("../../src/index.js");

describe("GET /api/health", () => {
  it("returns the health status JSON", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("integrations");
    expect(res.body.integrations).toHaveProperty("storage");
    expect(res.body.integrations).toHaveProperty("compute");
    expect(res.body.integrations).toHaveProperty("chain");
  });
});
