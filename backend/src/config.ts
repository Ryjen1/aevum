/**
 * Application configuration loaded from environment variables.
 * All required variables are validated at import time.
 */
import { z } from "zod";

// Environment variables can be loaded via Node's built-in --env-file flag:
//   node --env-file=.env dist/index.js
// or via any process manager (pm2, systemd, docker compose, etc.).

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: z.string().default("*"),

  OG_RPC_URL: z.string().url().default("https://evmrpc-testnet.0g.ai"),
  OG_INDEXER_RPC: z.string().url().default("https://indexer-storage-testnet-turbo.0g.ai"),
  OG_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "OG_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string")
    .default("0x" + "0".repeat(64)),

  COMPUTE_PROVIDER_ADDRESS: z.string().default(""),
  COMPUTE_DEFAULT_MODEL: z.string().default("qwen2.5-7b-instruct"),
  COMPUTE_GAS_PRICE: z.string().default(""),

  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)")
    .default("0".repeat(64)),

  AUTH_NONCE_SECRET: z.string().default(""),
  SIWE_DOMAIN: z.string().default("localhost"),
  AUTH_URI: z.string().default("http://localhost:4000"),

  AEVUM_REGISTRY_ADDRESS: z.string().default(""),
  AEVUM_MEMORY_ADDRESS: z.string().default(""),
  AEVUM_AGENTIC_ID_ADDRESS: z.string().default(""),

  LOCAL_STORAGE_DIR: z.string().default("./.cache/storage"),

  DEV_MOCK_MODE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const config: AppConfig = loadConfig();

export function corsOriginList(): string[] | "*" {
  if (config.CORS_ORIGINS === "*") return "*";
  return config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}
