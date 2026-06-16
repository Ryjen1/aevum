/**
 * Memory routes — log and retrieve memories for an agent.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireWallet } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { uploadMemory, listLocalMemories, loadLocalIndex } from "../lib/ogStorage.js";
import { logMemory, readMemoryEntry, readMemoryEntries } from "../lib/contract.js";
import { generateEmbedding } from "../lib/embeddings.js";
import { appendMemory } from "../agents/memoryAgent.js";
import { trackUsage } from "../agents/billingAgent.js";
import { param } from "../utils/params.js";
import type { MemoryEntry } from "../types/index.js";

export const memoriesRouter = Router();

const LogMemorySchema = z.object({
  agentId: z.string().regex(/^\d+$/),
  content: z.string().min(1).max(64_000),
  role: z.enum(["user", "assistant", "system"]).default("user"),
  encrypt: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

const ListSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

memoriesRouter.post(
  "/",
  requireWallet(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new HttpError(401, "auth_required", "Authentication required");
    const body = LogMemorySchema.parse(req.body);
    const upload = await uploadMemory(body.content, { encrypt: body.encrypt });
    const contentHash = `0x${randomUUID().replace(/-/g, "").padEnd(64, "0").slice(0, 64)}`;
    const roleNum = body.role === "user" ? 0 : body.role === "assistant" ? 1 : 2;
    let onChain: { entryId: string; txHash: string } | null = null;
    try {
      const r = await logMemory(body.agentId, contentHash, upload.rootHash, roleNum);
      onChain = { entryId: r.entryId.toString(), txHash: r.txHash };
    } catch (err) {
      // Memory contract may not be configured; that's fine in dev.
      onChain = null;
      void err;
    }
    const embedding = await generateEmbedding(body.content);
    await appendMemory(body.agentId, {
      id: onChain?.entryId ?? randomUUID(),
      content: body.content,
      rootHash: upload.rootHash,
      createdAt: Date.now(),
      role: body.role,
      embedding,
    });
    trackUsage(req.auth.address, "memory.log", {
      agentId: body.agentId,
      size: upload.size,
      encrypted: body.encrypt,
    });
    res.status(201).json({
      id: onChain?.entryId ?? null,
      rootHash: upload.rootHash,
      txHash: upload.txHash ?? onChain?.txHash ?? null,
      fallback: upload.fallback,
      contentHash,
      role: body.role,
      agentId: body.agentId,
      createdAt: Date.now(),
    });
  }),
);

memoriesRouter.get(
  "/:agentId",
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = param(req, "agentId");
    if (!/^\d+$/.test(agentId)) throw new HttpError(400, "invalid_id", "Agent id must be numeric");
    const { offset, limit } = ListSchema.parse(req.query);

    let onChain: Awaited<ReturnType<typeof readMemoryEntries>> = [];
    try {
      onChain = await readMemoryEntries(agentId, offset, limit);
    } catch {
      onChain = [];
    }
    const local = await loadLocalIndex<MemoryEntry>(agentId);
    const items = local.slice(offset, offset + limit);
    res.json({
      agentId,
      offset,
      limit,
      count: items.length + onChain.length,
      items,
      onChain: onChain.map((e) => ({
        id: e.id.toString(),
        contentHash: e.contentHash,
        rootHash: e.rootHash,
        role: e.role,
        createdAt: Number(e.createdAt) * 1000,
      })),
    });
  }),
);

memoriesRouter.get(
  "/:agentId/:entryId",
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = param(req, "agentId");
    const entryId = param(req, "entryId");
    if (!/^\d+$/.test(agentId) || !/^.+$/.test(entryId)) {
      throw new HttpError(400, "invalid_id", "Invalid id(s)");
    }
    if (/^\d+$/.test(entryId)) {
      const entry = await readMemoryEntry(agentId, entryId);
      if (entry) {
        res.json({
          id: entry.id.toString(),
          contentHash: entry.contentHash,
          rootHash: entry.rootHash,
          role: entry.role,
          createdAt: Number(entry.createdAt) * 1000,
        });
        return;
      }
    }
    // Try local cache by id
    const local = await loadLocalIndex<MemoryEntry>(agentId);
    const found = local.find((m) => m.id === entryId);
    if (found) {
      res.json(found);
      return;
    }
    // Try by listing all (last resort)
    const all = await listLocalMemories(agentId);
    res.json({ agentId, entryId, available: all });
  }),
);
