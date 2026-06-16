/**
 * Agent management routes.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createAgent, readAgent, readAgentsByOwner, setMemoryPointer } from "../lib/contract.js";
import { requireWallet } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { param } from "../utils/params.js";

export const agentsRouter = Router();

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(2000).default(""),
  systemPrompt: z.string().max(8000).default(""),
  metadataHash: z.string().default("0x"),
});

const SetPointerSchema = z.object({
  memoryPointer: z.string().min(1),
});

agentsRouter.post(
  "/",
  requireWallet(),
  asyncHandler(async (req: Request, res: Response) => {
    const body = CreateAgentSchema.parse(req.body);
    if (!req.auth) throw new HttpError(401, "auth_required", "Authentication required");
    const { agentId, txHash } = await createAgent(body.name, body.metadataHash);
    res.status(201).json({
      agentId: agentId.toString(),
      owner: req.auth.address,
      name: body.name,
      description: body.description,
      systemPrompt: body.systemPrompt,
      memoryPointer: "",
      metadataHash: body.metadataHash,
      txHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    });
  }),
);

agentsRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = param(req, "id");
    if (!/^\d+$/.test(id)) throw new HttpError(400, "invalid_id", "Agent id must be numeric");
    const agent = await readAgent(id);
    if (!agent) throw new HttpError(404, "not_found", `Agent ${id} not found`);
    res.json({
      agentId: agent.agentId.toString(),
      owner: agent.owner,
      name: agent.name,
      metadataHash: agent.metadataHash,
      memoryPointer: agent.memoryPointer,
      createdAt: Number(agent.createdAt) * 1000,
      updatedAt: Number(agent.updatedAt) * 1000,
      active: agent.active,
    });
  }),
);

agentsRouter.get(
  "/owner/:address",
  asyncHandler(async (req: Request, res: Response) => {
    const address = param(req, "address");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new HttpError(400, "invalid_address", "Invalid Ethereum address");
    }
    const ids = await readAgentsByOwner(address);
    res.json({ owner: address, agentIds: ids.map((i) => i.toString()), count: ids.length });
  }),
);

agentsRouter.put(
  "/:id/memory-pointer",
  requireWallet(),
  asyncHandler(async (req: Request, res: Response) => {
    const id = param(req, "id");
    if (!/^\d+$/.test(id)) throw new HttpError(400, "invalid_id", "Agent id must be numeric");
    const body = SetPointerSchema.parse(req.body);
    const txHash = await setMemoryPointer(id, body.memoryPointer);
    res.json({ agentId: id, memoryPointer: body.memoryPointer, txHash });
  }),
);


