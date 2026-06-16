/**
 * Aevum backend entry point.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config, corsOriginList } from "./config.js";
import { logger } from "./logger.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler, notFoundHandler, HttpError } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { agentsRouter } from "./routes/agents.js";
import { memoriesRouter } from "./routes/memories.js";
import { orchestratorRouter } from "./routes/orchestrator.js";
import { storageRouter } from "./routes/storage.js";
import { buildSiweChallenge } from "./middleware/auth.js";
import { randomBytes } from "node:crypto";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ extended: true, limit: "4mb" }));
  app.use(cors({ origin: corsOriginList(), credentials: true }));
  app.use(requestLogger);

  app.get("/", (_req, res) => {
    res.json({
      service: "aevum-backend",
      version: "0.1.0",
      endpoints: [
        "GET  /",
        "GET  /api/health",
        "POST /api/auth/challenge",
        "POST /api/agents",
        "GET  /api/agents/:id",
        "GET  /api/agents/owner/:address",
        "PUT  /api/agents/:id/memory-pointer",
        "POST /api/memories",
        "GET  /api/memories/:agentId",
        "GET  /api/memories/:agentId/:entryId",
        "POST /api/orchestrator/run",
        "GET  /api/orchestrator/audit/:id",
        "GET  /api/orchestrator/audit",
        "GET  /api/orchestrator/providers",
        "GET  /api/orchestrator/providers/:address",
        "POST /api/storage/upload",
        "GET  /api/storage/:rootHash",
        "GET  /api/storage/status",
      ],
    });
  });

  // Auth challenge endpoint (no wallet required)
  app.post("/api/auth/challenge", (req: Request, res: Response) => {
    const address = (req.body && typeof req.body.address === "string" ? req.body.address : "") as string;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new HttpError(400, "invalid_address", "Invalid Ethereum address");
    }
    const nonce = randomBytes(16).toString("hex");
    const message = buildSiweChallenge(address, nonce);
    res.json({ message, nonce });
  });

  app.use("/api/health", healthRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/memories", memoriesRouter);
  app.use("/api/orchestrator", orchestratorRouter);
  app.use("/api/storage", storageRouter);

  app.use(notFoundHandler);
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
    errorHandler(err, req, res, next),
  );

  return app;
}

function main(): void {
  const app = createApp();
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(
      { port: config.PORT, host: config.HOST, env: config.NODE_ENV },
      "Aevum backend listening",
    );
  });
  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

const isEntry = (() => {
  try {
    // Detect "node dist/index.js" / "tsx src/index.ts"
    if (!process.argv[1]) return false;
    return process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js");
  } catch {
    return false;
  }
})();

if (isEntry) {
  main();
}
