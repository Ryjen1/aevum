/**
 * Orchestrator routes — the main AI pipeline endpoint.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireWallet } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { runPipeline } from "../agents/orchestratorAgent.js";
import { trackUsage } from "../agents/billingAgent.js";
import { listProviders, getProviderMetadata } from "../lib/ogCompute.js";
import { logger } from "../logger.js";
import { param } from "../utils/params.js";
import type { PipelineResponse } from "../types/index.js";

export const orchestratorRouter = Router();

const PipelineRequestSchema = z.object({
  query: z.string().min(1).max(16_000),
  agentId: z.string().regex(/^\d+$/),
  userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  systemPrompt: z.string().max(8000).optional(),
  topK: z.coerce.number().int().min(1).max(50).optional(),
  model: z.string().optional(),
  maxTokens: z.coerce.number().int().min(16).max(8192).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  saveToMemory: z.boolean().optional(),
});

// In-memory audit log. For production, flush periodically to 0G.
const auditLog = new Map<string, PipelineResponse>();
const MAX_AUDIT_ENTRIES = 1000;

function storeAudit(entry: PipelineResponse): void {
  auditLog.set(entry.id, entry);
  if (auditLog.size > MAX_AUDIT_ENTRIES) {
    const firstKey = auditLog.keys().next().value;
    if (firstKey !== undefined) auditLog.delete(firstKey);
  }
}

orchestratorRouter.post(
  "/run",
  requireWallet(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new HttpError(401, "auth_required", "Authentication required");
    const body = PipelineRequestSchema.parse(req.body);
    if (body.userAddress.toLowerCase() !== req.auth.address.toLowerCase()) {
      throw new HttpError(403, "forbidden", "userAddress does not match authenticated wallet");
    }
    try {
      const result = await runPipeline(body);
      storeAudit(result);
      trackUsage(req.auth.address, "pipeline.run", {
        agentId: body.agentId,
        tokens: result.usage.totalTokens,
        teeVerified: result.teeVerified,
        durationMs: result.finishedAt - result.startedAt,
      });
      res.json(result);
    } catch (err) {
      logger.error({ err }, "Pipeline run failed");
      throw new HttpError(500, "pipeline_failed", err instanceof Error ? err.message : "Unknown error");
    }
  }),
);

orchestratorRouter.get(
  "/audit/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = param(req, "id");
    const entry = auditLog.get(id);
    if (!entry) throw new HttpError(404, "not_found", `Audit entry ${id} not found`);
    res.json(entry);
  }),
);

orchestratorRouter.get(
  "/audit",
  asyncHandler(async (_req: Request, res: Response) => {
    const items = Array.from(auditLog.values()).slice(-50).reverse();
    res.json({ count: items.length, items });
  }),
);

orchestratorRouter.get(
  "/providers",
  asyncHandler(async (_req: Request, res: Response) => {
    const providers = await listProviders();
    res.json({ count: providers.length, providers });
  }),
);

orchestratorRouter.get(
  "/providers/:address",
  asyncHandler(async (req: Request, res: Response) => {
    const address = param(req, "address");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new HttpError(400, "invalid_address", "Invalid address");
    }
    const meta = await getProviderMetadata(address);
    if (!meta) throw new HttpError(404, "not_found", `Provider ${address} not found`);
    res.json(meta);
  }),
);
