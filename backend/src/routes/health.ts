/**
 * Health endpoint.
 */
import { Router, type Request, type Response } from "express";
import { storageStatus } from "../lib/ogStorage.js";
import { computeStatus } from "../lib/ogCompute.js";
import { getChainStatus, isChainConfigured } from "../lib/contract.js";
import { config } from "../config.js";
import type { HealthStatus } from "../types/index.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const [storage, compute, chain] = await Promise.all([
    storageStatus(),
    computeStatus(),
    getChainStatus(),
  ]);
  const status: HealthStatus = {
    status: "ok",
    uptime: process.uptime(),
    version: "0.1.0",
    integrations: {
      storage,
      compute,
      chain: {
        connected: chain.connected,
        rpcUrl: config.OG_RPC_URL,
        blockNumber: chain.blockNumber,
        ...(chain.error ? { error: chain.error } : {}),
      },
      contracts: {
        registry: isChainConfigured(),
        memory: Boolean(config.AEVUM_MEMORY_ADDRESS),
        agenticId: Boolean(config.AEVUM_AGENTIC_ID_ADDRESS),
      },
    },
  };
  if (!storage.connected || !chain.connected) status.status = "degraded";
  if (storage.connected === false && chain.connected === false && compute.providerCount === 0) {
    status.status = "down";
  }
  res.json(status);
});
