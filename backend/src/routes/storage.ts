/**
 * Storage routes — direct 0G Storage interactions.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireWallet } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { uploadMemory, retrieveMemory, storageStatus } from "../lib/ogStorage.js";
import { trackUsage } from "../agents/billingAgent.js";
import { param, queryString } from "../utils/params.js";

export const storageRouter = Router();

const UploadSchema = z.object({
  data: z.string().min(1),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8"),
  encrypt: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

storageRouter.post(
  "/upload",
  requireWallet(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new HttpError(401, "auth_required", "Authentication required");
    const body = UploadSchema.parse(req.body);
    const buf = body.encoding === "base64" ? Buffer.from(body.data, "base64") : Buffer.from(body.data, "utf-8");
    const result = await uploadMemory(buf, { encrypt: body.encrypt, tags: body.tags });
    trackUsage(req.auth.address, "storage.upload", {
      size: result.size,
      encrypted: result.encrypted,
      fallback: result.fallback,
    });
    res.status(201).json(result);
  }),
);

storageRouter.get(
  "/:rootHash",
  asyncHandler(async (req: Request, res: Response) => {
    const rootHash = param(req, "rootHash");
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(rootHash)) {
      throw new HttpError(400, "invalid_hash", "Invalid root hash");
    }
    const decrypt = queryString(req, "decrypt") === "true";
    try {
      const buf = await retrieveMemory(rootHash, { decrypt });
      // Return as base64 with a hint about content type
      res.json({
        rootHash: rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`,
        size: buf.length,
        encoding: "base64",
        data: buf.toString("base64"),
        decrypted: decrypt,
      });
    } catch (err) {
      throw new HttpError(404, "not_found", err instanceof Error ? err.message : "Not found");
    }
  }),
);

storageRouter.get(
  "/status",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await storageStatus());
  }),
);
