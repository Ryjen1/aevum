# Aevum — Setup & Deployment Guide

> Detailed walkthrough for local development, testing, and deployment to 0G Galileo (testnet) and 0G mainnet.

---

## 1. Prerequisites

| Tool | Version | Purpose | Install |
|---|---|---|---|
| **Node.js** | ≥ 20.x | Frontend + backend runtime | https://nodejs.org |
| **npm** | ≥ 10.x | Workspace package manager | bundled with Node |
| **Foundry** | latest | Solidity toolchain (forge, cast, anvil) | https://book.getfoundry.sh/getting-started/installation |
| **MetaMask** (or Rainbow/Rabby) | latest | Wallet for signing | https://metamask.io |
| **Git** | ≥ 2.40 | Version control | https://git-scm.com |
| **pnpm** (optional) | ≥ 9 | Faster installs | `npm i -g pnpm` |

### 0G-specific prerequisites

| Item | How to get it |
|---|---|
| 0G Galileo testnet RPC | `https://evmrpc-testnet.0g.ai` (verify in 0G docs) |
| 0G Galileo explorer | `https://chainscan-galileo.0g.ai` |
| Testnet 0G tokens | 0G faucet (see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) if it's down) |
| 0G Storage RPC | Provided by 0G (see `.env.example`) |
| 0G Compute endpoint | Provided by 0G (see `.env.example`) |

---

## 2. Environment Variables

Aevum uses **three** `.env` files: root, backend, frontend.

### `aevum/.env` (root — for Foundry)

```bash
# Wallet that will deploy contracts
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY_HERE

# 0G Galileo testnet
OG_GALILEO_RPC=https://evmrpc-testnet.0g.ai
OG_GALILEO_CHAIN_ID=16600
OG_EXPLORER_API_KEY=YOUR_OG_EXPLORER_API_KEY

# Etherscan-compatible verification (if 0G supports it)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

### `aevum/backend/.env`

```bash
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# 0G Chain (read pointers, write receipts)
OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16600
OG_REGISTRY_ADDRESS=0x_DEPLOYED_AevumRegistry_ADDRESS
OG_MEMORY_ADDRESS=0x_DEPLOYED_AevumMemory_ADDRESS
OG_AGENTIC_ID_ADDRESS=0x_DEPLOYED_AevumAgenticID_ADDRESS

# 0G Storage
OG_STORAGE_RPC=https://storage-testnet.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-testnet.0g.ai

# 0G Compute (TEE)
OG_COMPUTE_ENDPOINT=https://compute-testnet.0g.ai
OG_COMPUTE_TEE_ROOT_KEY=0x...   # published by 0G, used to verify attestations

# 0G Pay
OG_PAY_ENDPOINT=https://pay-testnet.0g.ai
OG_PAY_SETTLEMENT_ADDRESS=0x...

# OpenAI fallback
OPENAI_API_KEY=sk-...

# Encryption
AEVUM_MASTER_KEY=0x...   # 32 bytes hex; dev only — production uses per-wallet key derivation

# Logging
LOG_LEVEL=info
```

### `aevum/frontend/.env`

```bash
# wagmi / viem
VITE_OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
VITE_OG_CHAIN_ID=16600

# Contract addresses
VITE_REGISTRY_ADDRESS=0x_DEPLOYED_AevumRegistry_ADDRESS
VITE_MEMORY_ADDRESS=0x_DEPLOYED_AevumMemory_ADDRESS
VITE_AGENTIC_ID_ADDRESS=0x_DEPLOYED_AevumAgenticID_ADDRESS

# Backend
VITE_BACKEND_URL=http://localhost:3000

# WalletConnect / RainbowKit
VITE_WALLETCONNECT_PROJECT_ID=YOUR_WALLETCONNECT_PROJECT_ID
```

> ⚠️ **Never commit `.env` files.** They are gitignored. Use `.env.example` (committed) as a template.

---

## 3. Local Development

### 3.1 Clone & install

```bash
git clone https://github.com/your-org/aevum.git
cd aevum

# Install all workspaces (root, backend, frontend)
npm install

# Install Foundry dependencies for contracts
cd contracts
forge install
cd ..
```

### 3.2 Configure environment

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill in the values from section 2
```

### 3.3 Run the backend

```bash
npm run dev:backend
# or: cd backend && npm run dev
# backend at http://localhost:3000
```

Sanity check:

```bash
curl http://localhost:3000/health
# → {"status":"ok","version":"0.1.0"}
```

### 3.4 Run the frontend

```bash
npm run dev:frontend
# or: cd frontend && npm run dev
# frontend at http://localhost:5173
```

Connect MetaMask to the 0G Galileo testnet (add it manually if not preloaded — chain ID `16600`).

### 3.5 Run a local 0G node (optional, for contract dev only)

You can use Anvil (Foundry) as a stand-in for 0G Chain during contract development:

```bash
anvil
# in another terminal:
forge script contracts/script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

> 0G Storage and 0G Compute do not have local simulators yet — for those, deploy to Galileo and use the testnet.

---

## 4. Testing

### 4.1 Smart contracts (Foundry)

```bash
cd contracts

# Unit tests
forge test -vv

# Coverage
forge coverage

# Gas snapshot
forge snapshot

# Fuzz (optional, slow)
forge test --fuzz
```

### 4.2 Backend (Vitest)

```bash
cd backend
npm test
npm run test:watch   # during development
```

### 4.3 Frontend (Vitest + Testing Library)

```bash
cd frontend
npm test
```

### 4.4 End-to-end pipeline

```bash
# Requires: anvil running, contracts deployed, backend + frontend up
npm run test:e2e
# Spins through: connect → register agent → ask → assert TEE proof → assert memory persisted
```

### 4.5 Lint & typecheck

```bash
# from repo root
npm run lint          # both packages
npm run typecheck     # both packages
```

---

## 5. Smart Contract Deployment

### 5.1 Galileo testnet (Wave 2+)

```bash
cd contracts

# 1. Dry-run (no broadcast)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $OG_GALILEO_RPC \
  --private-key $PRIVATE_KEY

# 2. Real deployment
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $OG_GALILEO_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# 3. Copy the printed addresses into backend/.env and frontend/.env:
#    OG_REGISTRY_ADDRESS, OG_MEMORY_ADDRESS, OG_AGENTIC_ID_ADDRESS
```

### 5.2 Mainnet (Wave 5)

Repeat with mainnet RPC. **Audit before mainnet.** The deploy script has a `--confirm-mainnet` flag that requires you to type the network name to proceed.

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $OG_MAINNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --confirm-mainnet
```

### 5.3 Post-deployment checklist

- [ ] All three contracts verified on 0G Explorer
- [ ] Source code published
- [ ] Initial ownership set to multisig (not EOA) for mainnet
- [ ] Upgrade timelock configured (UUPS admin)
- [ ] Contract addresses updated in `.env` files
- [ ] Frontend redeployed with new addresses
- [ ] Smoke test: register agent end-to-end on deployed contracts

---

## 6. Frontend Deployment (Vercel)

### 6.1 One-time

1. Push the repo to GitHub.
2. Go to https://vercel.com → New Project → import the repo.
3. **Root directory:** `frontend`
4. **Build command:** `npm run build`
5. **Output directory:** `dist`
6. Add all `VITE_*` env vars from section 2.

### 6.2 Per environment

| Env | Branch | URL |
|---|---|---|
| Preview | any PR | `aevum-git-<branch>.vercel.app` |
| Staging | `main` | `aevum-staging.vercel.app` |
| Production | `release/w5` | `aevum.vercel.app` |

### 6.3 Custom domain (W5+)

Add a CNAME for `app.aevum.xyz` pointing to `cname.vercel-dns.com` and configure in Vercel.

---

## 7. Backend Deployment

The backend is a stateless Node service. Recommended hosts:

- **Fly.io** — easiest, supports persistent volumes if needed
- **Railway** — zero-config for Node
- **Render** — fine, cold starts are okay
- **A self-hosted VPS** — fine for low traffic; needs a reverse proxy (Caddy or nginx)

Whichever you pick:
1. Set all backend env vars
2. Run `npm run build && npm run start`
3. Put behind HTTPS (Caddy auto-TLS is the path of least resistance)
4. Set up a health-check on `/health`

---

## 8. CI/CD

`.github/workflows/ci.yml` (already in repo) runs on every PR:

1. `npm ci` (root + workspaces)
2. `forge install && forge test` (contracts)
3. `npm run lint` (backend + frontend)
4. `npm run typecheck` (backend + frontend)
5. `npm test` (backend + frontend unit tests)

`.github/workflows/deploy.yml` (W2+) deploys on tagged releases:
- tag `contracts-v*` → run `forge script ... --broadcast`
- tag `frontend-v*` → trigger Vercel deploy hook

---

## 9. Troubleshooting

See [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) for common errors and fixes (Foundry install, faucet issues, MetaMask connect failures, 0G Storage uploads, frontend build errors, test failures).
