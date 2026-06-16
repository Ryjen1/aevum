/**
 * 0G Compute wrapper.
 *
 * Real TEE integration via @0gfoundation/0g-compute-ts-sdk.
 * Falls back to OpenAI when 0G Compute is unreachable in dev.
 */
import { Wallet, JsonRpcProvider } from "ethers";
import {
  createZGComputeNetworkBroker,
  createZGComputeNetworkReadOnlyBroker,
  type ZGComputeNetworkBroker,
  type ZGComputeNetworkReadOnlyBroker,
  type ServiceWithDetail,
} from "@0gfoundation/0g-compute-ts-sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { Provider, ProviderMetadata, InferenceResult, UsageStats } from "../types/index.js";

type Broker = ZGComputeNetworkBroker | null;
type ReadOnlyBroker = ZGComputeNetworkReadOnlyBroker | null;

let broker: Broker = null;
let readOnlyBroker: ReadOnlyBroker = null;
let providerCache: Provider[] | null = null;
let providerCacheAt = 0;
const PROVIDER_CACHE_TTL = 30_000;

let lastError: string | undefined;

async function getReadOnly(): Promise<ReadOnlyBroker> {
  if (readOnlyBroker) return readOnlyBroker;
  readOnlyBroker = await createZGComputeNetworkReadOnlyBroker(config.OG_RPC_URL);
  return readOnlyBroker;
}

async function getBroker(): Promise<Broker> {
  if (broker) return broker;
  if (!config.OG_PRIVATE_KEY || config.OG_PRIVATE_KEY === "0x" + "0".repeat(64)) {
    throw new Error("OG_PRIVATE_KEY not configured for compute broker");
  }
  const provider = new JsonRpcProvider(config.OG_RPC_URL);
  const wallet = new Wallet(config.OG_PRIVATE_KEY, provider);
  broker = await createZGComputeNetworkBroker(wallet as unknown as Parameters<typeof createZGComputeNetworkBroker>[0]);
  return broker;
}

function toProvider(svc: ServiceWithDetail): Provider {
  return {
    address: svc.provider,
    model: svc.model,
    serviceType: svc.serviceType,
    url: svc.url,
    inputPrice: svc.inputPrice,
    outputPrice: svc.outputPrice,
    verifiability: svc.verifiability,
    teeSignerAddress: svc.teeSignerAddress,
    teeSignerAcknowledged: svc.teeSignerAcknowledged,
  };
}

export async function listProviders(): Promise<Provider[]> {
  try {
    if (providerCache && Date.now() - providerCacheAt < PROVIDER_CACHE_TTL) {
      return providerCache;
    }
    const ro = await getReadOnly();
    if (!ro) return providerCache ?? [];
    const services = (await ro.inference.listServiceWithDetail()) as ServiceWithDetail[];
    providerCache = services.map(toProvider);
    providerCacheAt = Date.now();
    return providerCache;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    logger.warn({ err: lastError }, "0G Compute provider list failed");
    return providerCache ?? [];
  }
}

export async function getProviderMetadata(address: string): Promise<ProviderMetadata | null> {
  try {
    const ro = await getReadOnly();
    if (!ro) return null;
    const services = (await ro.inference.listServiceWithDetail()) as ServiceWithDetail[];
    const svc = services.find((s) => s.provider.toLowerCase() === address.toLowerCase());
    if (!svc) return null;
    return {
      ...toProvider(svc),
      endpoint: svc.url,
      healthMetrics: svc.healthMetrics,
      teeAttested: svc.modelInfo?.tee_attested,
      contextLength: svc.modelInfo?.context_length,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    logger.warn({ err: lastError, address }, "getProviderMetadata failed");
    return null;
  }
}

async function pickProvider(model?: string): Promise<Provider | null> {
  const providers = await listProviders();
  if (providers.length === 0) return null;
  const filtered = model
    ? providers.filter((p) => p.model.toLowerCase().includes(model.toLowerCase()))
    : providers;
  const candidates = filtered.length > 0 ? filtered : providers;
  // Prefer acknowledged TEE providers
  const tee = candidates.find((p) => p.teeSignerAcknowledged);
  return tee ?? candidates[0] ?? null;
}

async function runWithOpenAI(
  prompt: string,
  options: { model?: string; maxTokens?: number; temperature?: number },
): Promise<InferenceResult> {
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured and 0G Compute unavailable");
  }
  const body = {
    model: options.model ?? config.OPENAI_MODEL,
    messages: [{ role: "user" as const, content: prompt }],
    max_tokens: options.maxTokens ?? 512,
    temperature: options.temperature ?? 0.7,
  };
  const res = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI fallback failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
  const completion = json.choices[0]?.message.content ?? "";
  const usage: UsageStats = {
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
    totalTokens: json.usage?.total_tokens ?? 0,
    costUsd: 0,
  };
  return {
    response: completion,
    proof: "0x",
    providerAddress: "openai-fallback",
    teeVerified: false,
    usage,
  };
}

export interface InferenceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  providerAddress?: string;
}

export async function executeInference(
  prompt: string,
  options: InferenceOptions = {},
): Promise<InferenceResult> {
  const model = options.model ?? config.COMPUTE_DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 512;
  const temperature = options.temperature ?? 0.7;

  // If 0G is known to be down, just go straight to fallback
  if (config.DEV_MOCK_MODE) {
    return runWithOpenAI(prompt, { model, maxTokens, temperature });
  }

  try {
    const b = await getBroker();
    if (!b) throw new Error("0G Compute broker not initialized");
    const providerAddr =
      options.providerAddress ?? config.COMPUTE_PROVIDER_ADDRESS ?? (await pickProvider(model))?.address;
    if (!providerAddr) throw new Error("No 0G Compute provider available");

    const { endpoint, model: actualModel } = await b.inference.getServiceMetadata(providerAddr);
    const headers = await b.inference.getRequestHeaders(providerAddr, prompt);

    const messages: { role: "system" | "user"; content: string }[] = [];
    if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        model: actualModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      throw new Error(`0G Compute chat failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      id?: string;
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    const content = json.choices[0]?.message.content ?? "";
    const chatID = (res.headers.get("ZG-Res-Key") ?? json.id) || undefined;

    // Verify TEE proof if the service is verifiable
    let teeVerified = false;
    let proof = "0x";
    try {
      if (chatID) {
        const v = await b.inference.processResponse(providerAddr, chatID, content);
        teeVerified = v === true;
        proof = `0x${chatID}`;
      }
    } catch (err) {
      logger.warn({ err, providerAddr }, "TEE verification failed");
    }

    const usage: UsageStats = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
      costUsd: 0,
    };

    return {
      response: content,
      proof,
      providerAddress: providerAddr,
      teeVerified,
      usage,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    logger.error({ err: lastError }, "0G Compute inference failed, using OpenAI fallback");
    return runWithOpenAI(prompt, { model, maxTokens, temperature });
  }
}

export interface ComputeStatus {
  connected: boolean;
  providerCount: number;
  defaultProvider: string;
  fallbackMode: boolean;
  error?: string;
}

export async function computeStatus(): Promise<ComputeStatus> {
  try {
    const providers = await listProviders();
    return {
      connected: providers.length > 0,
      providerCount: providers.length,
      defaultProvider: config.COMPUTE_PROVIDER_ADDRESS,
      fallbackMode: providers.length === 0,
      error: lastError,
    };
  } catch (err) {
    return {
      connected: false,
      providerCount: 0,
      defaultProvider: "",
      fallbackMode: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
