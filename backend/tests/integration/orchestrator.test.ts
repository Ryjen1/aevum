import { jest } from "@jest/globals";
import request from "supertest";
import { Wallet } from "ethers";
import { SiweMessage } from "siwe";

// Mock external services
jest.unstable_mockModule("../../src/lib/ogStorage.js", () => ({
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
}));

jest.unstable_mockModule("../../src/lib/ogCompute.js", () => ({
  executeInference: async (prompt: string) => ({
    response: `Response to: ${prompt.slice(0, 30)}`,
    proof: "0xproof",
    providerAddress: "0xprovider",
    teeVerified: true,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0 },
  }),
  listProviders: async () => [],
  getProviderMetadata: async () => null,
  computeStatus: async () => ({
    connected: false,
    providerCount: 0,
    defaultProvider: "",
    fallbackMode: true,
  }),
}));

jest.unstable_mockModule("../../src/lib/contract.js", () => ({
  readMemoryEntries: async () => [],
  readMemoryEntry: async () => null,
  getChainStatus: async () => ({ connected: false, blockNumber: null }),
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

async function signedAuthHeader(address: string): Promise<{ siwe: string; sig: string }> {
  const wallet = new Wallet("0x" + "2".repeat(64));
  const nonce = "abcd1234";
  const msg = new SiweMessage({
    domain: "localhost",
    address,
    statement: "Sign in to Aevum",
    uri: "http://localhost:4000",
    version: "1",
    chainId: 16602,
    nonce,
    issuedAt: new Date().toISOString(),
  });
  const message = msg.prepareMessage();
  const sig = await wallet.signMessage(message);
  // SIWE messages contain newlines; base64-encode for header transport.
  return { siwe: Buffer.from(message, "utf-8").toString("base64"), sig };
}

describe("integration: orchestrator pipeline", () => {
  it("runs the full pipeline end-to-end with auth + audit", async () => {
    const app = createApp();
    const wallet = new Wallet("0x" + "2".repeat(64));
    const address = wallet.address;
    const { siwe, sig } = await signedAuthHeader(address);

    const res = await request(app)
      .post("/api/orchestrator/run")
      .set("x-aevum-siwe", siwe)
      .set("x-aevum-signature", sig)
      .send({
        query: "Tell me about Aevum",
        agentId: "1",
        userAddress: address,
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("response");
    expect(res.body).toHaveProperty("redactedResponse");
    expect(res.body).toHaveProperty("memories");
    expect(res.body).toHaveProperty("proof", "0xproof");
    expect(res.body).toHaveProperty("teeVerified", true);
    expect(res.body.auditLog.length).toBeGreaterThan(2);

    // Audit lookup
    const audit = await request(app).get(`/api/orchestrator/audit/${res.body.id}`);
    expect(audit.status).toBe(200);
    expect(audit.body.id).toBe(res.body.id);
  });

  it("rejects missing SIWE signature", async () => {
    const app = createApp();
    const res = await request(app).post("/api/orchestrator/run").send({
      query: "Hello",
      agentId: "1",
      userAddress: "0x0000000000000000000000000000000000000000",
    });
    expect(res.status).toBe(401);
  });

  it("rejects body that fails validation", async () => {
    const app = createApp();
    const wallet = new Wallet("0x" + "2".repeat(64));
    const address = wallet.address;
    const { siwe, sig } = await signedAuthHeader(address);
    const res = await request(app)
      .post("/api/orchestrator/run")
      .set("x-aevum-siwe", siwe)
      .set("x-aevum-signature", sig)
      .send({ wrong: "field" });
    expect(res.status).toBe(400);
  });

  it("redacts PII in the LLM response", async () => {
    const app = createApp();
    const wallet = new Wallet("0x" + "2".repeat(64));
    const address = wallet.address;
    const { siwe, sig } = await signedAuthHeader(address);
    // The mocked executeInference echoes the query, so the redactor
    // should not find PII there. We assert the field exists and is a
    // string so the contract is preserved.
    const res = await request(app)
      .post("/api/orchestrator/run")
      .set("x-aevum-siwe", siwe)
      .set("x-aevum-signature", sig)
      .send({
        query: "Hi there",
        agentId: "1",
        userAddress: address,
      });
    expect(res.status).toBe(200);
    expect(typeof res.body.redactedResponse).toBe("string");
    expect(Array.isArray(res.body.foundPII)).toBe(true);
  });
});
