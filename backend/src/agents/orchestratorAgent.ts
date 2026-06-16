/**
 * Orchestrator agent — runs the full Aevum pipeline.
 *
 * Steps:
 *   1. memoryAgent  — fetch relevant memories from 0G Storage
 *   2. 0G Compute   — run inference in TEE
 *   3. privacyAgent — redact PII from the response
 *   4. Persist      — store new memory in 0G Storage + update on-chain pointer
 */
import { randomUUID } from "node:crypto";
import { retrieveRelevant, appendMemory } from "./memoryAgent.js";
import { redact } from "./privacyAgent.js";
import { executeInference } from "../lib/ogCompute.js";
import { uploadMemory } from "../lib/ogStorage.js";
import { setMemoryPointer, readAgent } from "../lib/contract.js";
import { logger } from "../logger.js";
import type {
  AuditLogEntry,
  PipelineRequest,
  PipelineResponse,
} from "../types/index.js";

function audit(
  log: AuditLogEntry[],
  step: string,
  agent: string,
  status: AuditLogEntry["status"],
  message: string,
  meta?: Record<string, unknown>,
): void {
  log.push({ step, agent, at: Date.now(), status, message, ...(meta ? { meta } : {}) });
}

function buildContextPrompt(query: string, memories: { content: string; similarity: number }[]): string {
  if (memories.length === 0) return query;
  const ctx = memories
    .map((m, i) => `[Memory ${i + 1} — similarity ${m.similarity.toFixed(3)}]\n${m.content}`)
    .join("\n\n");
  return `The following are relevant memories retrieved from the agent's encrypted store:\n\n${ctx}\n\n---\n\nUser query: ${query}`;
}

export async function runPipeline(
  request: PipelineRequest,
): Promise<PipelineResponse> {
  const id = randomUUID();
  const startedAt = Date.now();
  const log: AuditLogEntry[] = [];
  audit(log, "start", "orchestrator", "ok", `Pipeline started for agent ${request.agentId}`);

  const result: PipelineResponse = {
    id,
    response: "",
    redactedResponse: "",
    foundPII: [],
    memories: [],
    proof: "0x",
    providerAddress: "",
    teeVerified: false,
    storage: { rootHash: null, txHash: null, stored: false },
    auditLog: log,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
    startedAt,
    finishedAt: startedAt,
  };

  // 1. Memory retrieval
  let memories: ReturnType<typeof retrieveRelevant> extends Promise<infer T> ? T : never = [] as never;
  try {
    memories = await retrieveRelevant(request.query, request.agentId, request.topK ?? 5);
    audit(log, "memory-retrieval", "memoryAgent", "ok", `Retrieved ${memories.length} memories`, {
      count: memories.length,
    });
  } catch (err) {
    audit(log, "memory-retrieval", "memoryAgent", "error", "Memory retrieval failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    memories = [] as never;
  }
  result.memories = memories;

  // 2. 0G Compute inference
  let inference;
  try {
    inference = await executeInference(buildContextPrompt(request.query, memories), {
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      systemPrompt: request.systemPrompt,
    });
    audit(log, "inference", "compute", "ok", "Inference complete", {
      provider: inference.providerAddress,
      teeVerified: inference.teeVerified,
    });
  } catch (err) {
    audit(log, "inference", "compute", "error", "Inference failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    result.response = "I am currently unable to process this request. Please try again later.";
    result.finishedAt = Date.now();
    return result;
  }
  result.response = inference.response;
  result.proof = inference.proof;
  result.providerAddress = inference.providerAddress;
  result.teeVerified = inference.teeVerified;
  result.usage = inference.usage;

  // 3. Privacy redaction (always last)
  const redacted = redact(inference.response);
  result.redactedResponse = redacted.sanitized;
  result.foundPII = redacted.foundPII;
  audit(
    log,
    "redaction",
    "privacyAgent",
    redacted.foundPII.length > 0 ? "warn" : "ok",
    redacted.foundPII.length > 0
      ? `Redacted ${redacted.foundPII.length} PII item(s)`
      : "No PII detected",
    { count: redacted.foundPII.length },
  );

  // 4. Persist memory
  if (request.saveToMemory !== false) {
    try {
      const turn = JSON.stringify({
        query: request.query,
        response: redacted.sanitized,
        user: request.userAddress,
        at: Date.now(),
      });
      const upload = await uploadMemory(turn, { encrypt: true });
      await appendMemory(request.agentId, {
        id: randomUUID(),
        content: turn,
        rootHash: upload.rootHash,
        createdAt: Date.now(),
        role: "assistant",
      });
      result.storage = {
        rootHash: upload.rootHash,
        txHash: upload.txHash,
        stored: true,
      };
      audit(log, "persist", "orchestrator", "ok", "Memory stored to 0G", {
        rootHash: upload.rootHash,
        fallback: upload.fallback,
      });

      // Update on-chain pointer (best-effort)
      try {
        const exists = await readAgent(request.agentId);
        if (exists) {
          const tx = await setMemoryPointer(request.agentId, upload.rootHash);
          audit(log, "pointer-update", "contract", "ok", "Memory pointer updated", { tx });
        }
      } catch (err) {
        audit(log, "pointer-update", "contract", "warn", "Skipped on-chain pointer update", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (err) {
      logger.warn({ err }, "Persist step failed");
      audit(log, "persist", "orchestrator", "error", "Persist failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  result.finishedAt = Date.now();
  audit(log, "finish", "orchestrator", "ok", `Pipeline complete in ${result.finishedAt - startedAt}ms`);
  return result;
}
