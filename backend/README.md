# Aevum Backend

Backend for **Aevum** — decentralized AI agent memory infrastructure on 0G.

This service orchestrates the agent pipeline:

1. **Memory Agent** — vector search over the agent's encrypted memories on 0G Storage
2. **0G Compute (TEE)** — runs LLM inference with cryptographic proof via `@0gfoundation/0g-compute-ts-sdk`
3. **Privacy Agent** — always-last PII redaction before the response leaves the system
4. **Persistence** — new memory blobs are encrypted and stored to 0G Storage, with the on-chain pointer updated via the AevumRegistry contract

## Quick start

```bash
# 1. Install
cd backend
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your OG_PRIVATE_KEY, ENCRYPTION_KEY, and contract addresses

# 3. Dev (auto-restart on file change)
npm run dev

# 4. Production build
npm run build
npm start
```

Generate a 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment variables

See [`.env.example`](./.env.example) for the full list. The most important ones:

| Var | Purpose |
|-----|---------|
| `PORT` | HTTP port (default `4000`) |
| `OG_RPC_URL` | 0G chain RPC |
| `OG_INDEXER_RPC` | 0G Storage indexer RPC |
| `OG_PRIVATE_KEY` | Relayer wallet for storage uploads & on-chain writes |
| `COMPUTE_PROVIDER_ADDRESS` | Default 0G Compute provider (auto-pick if empty) |
| `ENCRYPTION_KEY` | 32-byte hex key for memory encryption |
| `AEVUM_REGISTRY_ADDRESS` | AevumRegistry contract |
| `AEVUM_MEMORY_ADDRESS` | AevumMemory contract |
| `OPENAI_API_KEY` | Optional dev fallback when 0G Compute is down |
| `DEV_MOCK_MODE` | `true` ⇒ all 0G services become local stubs |

If `DEV_MOCK_MODE=true` is set, the backend runs end-to-end with no network access (great for CI). If a real 0G endpoint is unreachable, the backend **logs a warning and falls back** to a local cache (`.cache/storage`) so development never blocks.

## Architecture

```
src/
├── index.ts            # Express entry
├── config.ts           # Zod-validated env config
├── logger.ts           # pino logger
├── lib/
│   ├── ogStorage.ts    # 0G Storage wrapper (upload / retrieve / status)
│   ├── ogCompute.ts    # 0G Compute TEE wrapper (listProviders / executeInference)
│   ├── contract.ts     # ethers v6 contract wrappers
│   ├── encryption.ts   # AES-256-GCM helpers
│   └── embeddings.ts   # vector embeddings (MiniLM-L6-v2 with hash fallback)
├── agents/
│   ├── memoryAgent.ts      # vector search
│   ├── orchestratorAgent.ts# full pipeline
│   ├── privacyAgent.ts     # PII redaction
│   └── billingAgent.ts     # usage tracking
├── routes/
│   ├── health.ts
│   ├── agents.ts
│   ├── memories.ts
│   ├── orchestrator.ts
│   └── storage.ts
└── middleware/
    ├── auth.ts         # EIP-4361 (Sign-In with Ethereum)
    ├── errorHandler.ts
    └── logger.ts
```

## API

All authenticated endpoints require two headers:

- `x-aevum-siwe` — full SIWE message text
- `x-aevum-signature` — 0x-prefixed signature of the message

You can get a challenge from `POST /api/auth/challenge`.

### `GET /api/health`

Returns status of every integration: 0G Storage, 0G Compute, the 0G chain, and the Aevum contracts.

### `POST /api/orchestrator/run` (auth)

The main AI endpoint. Runs the full pipeline (memory retrieval → TEE inference → PII redaction → persist) and returns the result with audit log.

```json
{
  "query": "What did we talk about last week?",
  "agentId": "1",
  "userAddress": "0xYourWallet",
  "topK": 5,
  "model": "qwen2.5-7b-instruct",
  "maxTokens": 512,
  "temperature": 0.7
}
```

Response includes: `response`, `redactedResponse`, `foundPII[]`, `memories[]`, `proof`, `providerAddress`, `teeVerified`, `storage`, `auditLog[]`, `usage`.

### `GET /api/orchestrator/audit/:id` (auth)

Look up a previous pipeline run by id.

### `GET /api/orchestrator/audit` (auth)

List the most recent 50 runs.

### `GET /api/orchestrator/providers`

List available 0G Compute providers (no auth).

### `GET /api/orchestrator/providers/:address`

Detailed metadata for a single provider (endpoint, model, TEE attestation, health).

### `POST /api/agents` (auth)

Create a new on-chain agent.

### `GET /api/agents/:id`

Read an agent by numeric id.

### `GET /api/agents/owner/:address`

List all agent ids owned by a wallet.

### `PUT /api/agents/:id/memory-pointer` (auth)

Update the on-chain memory root hash pointer for an agent.

### `POST /api/memories` (auth)

Log a new memory. Body: `{ agentId, content, role, encrypt, metadata }`. Returns `{ id, rootHash, txHash, fallback, ... }`.

### `GET /api/memories/:agentId?offset=0&limit=20`

List memories for an agent.

### `GET /api/memories/:agentId/:entryId`

Fetch a specific memory entry.

### `POST /api/storage/upload` (auth)

Upload an arbitrary encrypted blob to 0G Storage.

### `GET /api/storage/:rootHash?decrypt=true|false`

Download a blob. `decrypt=true` requires the server to hold the matching `ENCRYPTION_KEY`.

### `GET /api/storage/status`

Connection status of the storage backend.

## Testing

```bash
npm test                  # all tests
npm run test:storage      # storage-only
npm run test:compute      # compute-only
npm run typecheck         # TS in strict mode, 0 errors required
npm run lint
```

Tests use `DEV_MOCK_MODE=true` so no real 0G endpoints are needed. External SDK calls are mocked in `tests/routes/health.test.ts` and `tests/integration/orchestrator.test.ts`.

## Deployment

1. Set `NODE_ENV=production` and disable pretty logs.
2. Provide a funded `OG_PRIVATE_KEY` (relayer).
3. Provide the deployed `AEVUM_*_ADDRESS` contract addresses.
4. Point `OG_RPC_URL` / `OG_INDEXER_RPC` at 0G mainnet (or testnet).
5. Run behind a reverse proxy (Caddy / nginx) for TLS.
6. Use `node --env-file=.env dist/index.js` or pm2 / systemd.

## License

MIT — part of the 0G Bridge Buildathon submission.
