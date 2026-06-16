# Aevum — Wave 1 Submission

> **Project Name:** Aevum
> **Track:** 0G Bridge Buildathon — Wave 1 (Project Scoping & 0G Integration Plan)
> **Deadline:** June 26, 2026
> **Submitted by:** _[Team name]_ · GitHub: `your-org/aevum`

---

## One-Liner

> **The memory layer for the 0G agent ecosystem — persistent, encrypted, verifiable AI agent memory on decentralized infrastructure.**

---

## Problem Statement

AI agents today have **amnesia**. Every session, every API call, every new chat thread starts from zero. The copilot that helped you debug a Solidity contract on Monday doesn't remember it on Tuesday. The research agent you trained on your thesis forgets the literature review. The trading agent that worked with you last week can't recall your risk tolerance. This isn't a UX bug — it's an **infrastructure gap**. At population scale, an agent ecosystem needs *petabytes* of conversation history, *cryptographically verifiable* ownership and provenance, *attestable* inference (so users can trust what the model actually did), and *economic rails* so agents can pay for compute without a centralized billing middleman. No current provider delivers all four. Centralized cloud vendors fail on ownership and verifiability; pure on-chain solutions fail on storage cost; L1-native identity projects fail on inference attestation. The 0G modular stack — Storage, Chain, Compute, Pay, Agentic ID — is the first time these four primitives are available in one composable system, and that is exactly what an agent memory layer needs.

## Solution Overview

Aevum is the **memory layer for the 0G agent ecosystem**. We give every AI agent four things that today don't exist together: (1) **persistent memory** that survives across sessions, devices, and clients, encrypted with AES-256-GCM and stored on 0G Storage; (2) **on-chain identity** via a registry of agents and an ERC-7857 Agentic ID NFT that is transferable and travels with the agent; (3) **verifiable inference** for every response, with TEE-attested proofs from 0G Compute that the user can verify against published TEE root keys; and (4) **privacy by default**, enforced by a privacy agent that runs *last* in every pipeline to redact PII and scrub secrets before anything is returned or persisted.

Under the hood, Aevum is a multi-agent pipeline: `MemoryAgent` recalls relevant context from 0G Storage, `OrchestratorAgent` synthesizes a response inside a 0G Compute TEE, and `PrivacyAgent` redacts and signs the final answer. The frontend is a wallet-connected dashboard where users register agents, chat with them, see TEE proof badges on every response, and watch their agent's memory grow over time. Settlement is per-invoice via 0G Pay, removing centralized billing. The entire stack is open source (MIT), reproducible from a single `git clone`, and ships with a Foundry contract suite, a TypeScript backend, a React frontend, and a 5-wave delivery plan.

---

## 0G Integration Plan

Aevum uses **all five** 0G components. Each is load-bearing.

### Storage — 0G Storage

**What we store:** encrypted memory blobs (conversation turns, notes, retrieved documents) and encrypted agent metadata JSON.

**How we store it:** every memory is serialized as canonical JSON, encrypted with a per-memory AES-256-GCM data encryption key (DEK), the DEK is wrapped with the owner's session key, and the ciphertext is uploaded to 0G Storage which returns a content root hash. The root hash + a 0G Storage URI are written on-chain to `AevumMemory.append(agentId, rootHash, uri)`. Reads are the reverse: read pointers from chain → fetch from 0G Storage → unwrap DEK → decrypt.

**Why 0G:** centralized object stores are a single point of failure and a single point of censorship. Agents that need to be sovereign cannot anchor their memory on AWS. 0G Storage is content-addressed, replicated across independent operators, and integrally linked to the rest of the 0G stack — so the same root hash that proves data integrity can also anchor a chain pointer without bridging.

**Code:** `backend/src/services/storage.ts`, `backend/src/agents/MemoryAgent.ts`

### Chain — 0G Chain

**What lives on-chain:**
- `AevumRegistry` — directory of agents, mapping `agentId → owner → linkedAgenticId`
- `AevumMemory` — per-agent ordered list of memory pointers (`rootHash`, `uri`, `createdAt`) and per-agent ACL (owner, delegates, scopes)
- `AevumAgenticID` — ERC-721-compatible NFT implementing ERC-7857; holds encrypted `tokenURI`, inference public key, ownership

**Why 0G:** we need a chain that is *fast* (we append a memory on every user turn) and *cheap* (every agent will produce thousands of memories). 0G Chain's throughput and gas profile let us write a pointer per memory without making the product uneconomic. 0G also gives us native composability with the rest of the 0G stack — the same chain that holds ownership also settles 0G Pay invoices, so we don't need bridge contracts.

**Code:** `contracts/src/AevumRegistry.sol`, `contracts/src/AevumMemory.sol`, `contracts/src/AevumAgenticID.sol`

### Compute — 0G Compute (TEE)

**What we compute inside TEEs:** all LLM inference (synthesis, embeddings, PII detection, secret scanning) by default. The TEE produces an attestation quote containing the code hash, model hash, input digest, and output digest. The frontend verifies this attestation against 0G's published TEE root keys and shows a ✅ badge.

**Fallback:** if 0G Compute is unreachable, we fall back to OpenAI **and explicitly set `provider: "openai-fallback"`** in the response envelope so the UI shows a ⚠️ badge. We never silently downgrade.

**Why 0G:** "verifiable AI" is the missing primitive in the agent stack. Anyone can claim they used GPT-4; only TEE attestation + on-chain anchoring of the attestation hash can prove it. 0G Compute is the first TEE-attested inference network that's natively integrated with 0G Storage and 0G Chain, so the entire loop (input → model → output → proof → on-chain anchor) stays in one trust domain.

**Code:** `backend/src/services/compute.ts`, `backend/src/agents/OrchestratorAgent.ts`, `backend/src/agents/PrivacyAgent.ts`

### Pay — 0G Pay

**What we pay for:** per-inference inference cost (TEE minutes, embedding calls, privacy transforms) and per-storage cost (0G Storage write/read).

**How:** on wallet connect, the frontend opens a 0G Pay session. The backend issues a per-request invoice, the user signs an off-chain authorization, the backend batches and settles via 0G Pay at the end of each session. The user gets a single on-chain receipt per session, not per request.

**Why 0G:** agent products have usage-based cost curves that don't fit subscription SaaS. A power user running 10k inferences/day should pay 10k× what a casual user pays. Per-invoice pay without an intermediary is the only way to make this work globally and credibly. 0G Pay gives us that, natively, on the same chain that holds ownership.

**Code:** `backend/src/services/pay.ts`, `frontend/src/hooks/usePay.ts`

### Agentic ID — ERC-7857

**What we tokenize:** the *agent itself*. The `AevumAgenticID` NFT carries the agent's encrypted metadata (personality, system prompt, model preferences) in its `tokenURI`, the inference TEE public key, and the ownership record. Transferring the NFT transfers the agent — including the chain pointer to its memory and the right to decrypt that memory.

**Why 0G / ERC-7857:** an agent without a portable identity is just a service. An agent *with* a portable, verifiable, transferable identity is a **digital actor** that can be bought, sold, licensed, and composed. ERC-7857 on 0G makes this possible from day one of the standard, and we are committing to being a reference implementation.

**Code:** `contracts/src/AevumAgenticID.sol`

---

## Technical Approach

### Architecture summary

Aevum is a three-tier system:

1. **Smart contracts on 0G Chain** — `AevumRegistry`, `AevumMemory`, `AevumAgenticID`. All settlement and ownership. UUPS upgradeable.
2. **Backend (Node + Express + TypeScript)** — multi-agent pipeline (`MemoryAgent` → `OrchestratorAgent` → `PrivacyAgent`), encryption service, TEE orchestrator, pay session manager.
3. **Frontend (React + Vite + wagmi + RainbowKit)** — wallet connect, agent dashboard, chat UI, TEE proof badge, paymeter, agent transfer modal.

### Key design decisions

| Decision | Why |
|---|---|
| **Per-memory DEK, not one master key** | A single leak should not compromise a user's full history. |
| **Canonical JSON serialization before encryption** | Deterministic hashing → reliable dedup → cheaper storage. |
| **Privacy agent runs last** | It sees the final formatted response, not a draft that could leak in logs. |
| **TEE attestation hash anchored on-chain** | So the proof is verifiable without trusting the backend. |
| **OpenAI fallback is *explicit*, never silent** | Trust is a UI surface, not just a backend invariant. |
| **ERC-7857 from day one** | Agent identity is the whole point — not a v2 feature. |
| **All on-chain data is pointers + hashes, never plaintext** | Cheaper, faster, and provably private. |

### Engineering quality bars

- **Contracts:** Foundry, OpenZeppelin, ≥ 90% test coverage, Slither clean, UUPS upgradeable.
- **Backend:** TypeScript strict, ESLint clean, ≥ 80% test coverage, end-to-end pipeline test.
- **Frontend:** TypeScript strict, ESLint clean, accessibility (WCAG 2.1 AA), Lighthouse ≥ 90.

---

## 5-Wave Plan

### Wave 1 — Project Scoping & 0G Integration Plan (this submission, Jun 26)
- ✅ Architecture document with Mermaid diagrams for all 5 components
- ✅ Smart contract scaffolds (interfaces + skeleton) in `contracts/src/`
- ✅ Repo + docs + quickstart + deploy plan
- ✅ Team assembled
- ⏳ Pending: review with 0G / AKINDO, finalize ERC-7857 conformance details

### Wave 2 — Core Smart Contracts (Jul 17)
- 🎯 `AevumRegistry` — full implementation, tests, deploy to Galileo testnet
- 🎯 `AevumMemory` — full implementation, ACL, tests, deploy to Galileo
- 🎯 `AevumAgenticID` — full ERC-7857 implementation, metadata encryption spec, tests, deploy to Galileo
- 🎯 Foundry test suite ≥ 90% coverage, Slither clean
- 🎯 OpenZeppelin audit checklist completed
- **Success criteria:** all three contracts deployed and verified on 0G Explorer, all tests green, gas report published

### Wave 3 — Memory Pipeline + 0G Storage (Aug 7)
- 🎯 `MemoryAgent` + `OrchestratorAgent` running end-to-end
- 🎯 Encrypted write/read to 0G Storage verified
- 🎯 Frontend v0.1: connect wallet, view agents, basic chat
- 🎯 Demo recording: 5-min Galileo walkthrough
- **Success criteria:** 100 encrypted memories round-tripped on Galileo, frontend deployed to Vercel preview, public demo video

### Wave 4 — Verifiable Inference + 0G Pay (Aug 28)
- 🎯 `PrivacyAgent` + 0G Compute TEE integration
- 🎯 0G Pay session lifecycle implemented
- 🎯 Frontend v1.0: TEE proof badge ✅/⚠️, usage receipts, agent transfer UI
- 🎯 Public frontend on Vercel production
- **Success criteria:** 50 real TEE-attested inferences end-to-end, 0G Pay session opens + settles correctly, public URL live

### Wave 5 — Mainnet + Demo Day (Sep 18)
- 🎯 Contracts deployed to 0G mainnet
- 🎯 ERC-7857 transfer flow live end-to-end (transfer agent, re-encrypt memory for new owner)
- 🎯 Public launch (X thread, blog post, demo video)
- 🎯 Token2049 Demo Day pitch
- **Success criteria:** mainnet deployment verified, 1k+ agents registered, public demo, Token2049 slot delivered

---

## Success Criteria — How We Measure Each Wave

| Wave | Primary metric | Stretch metric |
|---|---|---|
| W1 | Docs + contracts compile + team set | Mermaid diagrams reviewed by 0G |
| W2 | 3 contracts deployed on Galileo, ≥ 90% test coverage | Slither clean, gas report published |
| W3 | 100 encrypted memories round-tripped, frontend v0.1 live | 10 beta users |
| W4 | 50 TEE-attested inferences, 0G Pay working, v1.0 live | 100 active users, public tweet goes viral |
| W5 | Mainnet live, 1k+ agents, Token2049 pitch | Press coverage, 10k+ agents, paying users |

---

## Team

| | Role | Background |
|---|---|---|
| **_[Name 1]_** | Lead / Smart Contracts | Solidity, Foundry, ERC-721/1155/7857 |
| **_[Name 2]_** | Backend / Agents | TypeScript, multi-agent systems, 0G Storage SDK |
| **_[Name 3]_** | Frontend / UX | React, wagmi, RainbowKit |
| **_[Name 4]_** | 0G Integration | 0G Storage / Compute / Pay, TEE |
| **_[Name 5]_** | Ops / GTM | Hackathon ops, demo production, X/community |

_(Replace with real names, avatars, and links.)_

---

## Links

- **GitHub:** `https://github.com/your-org/aevum`
- **Architecture:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Setup guide:** [`docs/SETUP.md`](./SETUP.md)
- **Demo script:** [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)
- **Pitch deck:** [`docs/PITCH_DECK.md`](./PITCH_DECK.md)
- **X posts:** [`docs/X_POSTS.md`](./X_POSTS.md)
- **License:** [MIT](../LICENSE)
- **0G:** https://0g.ai

---

## Honest Scope Statement

Wave 1 is **scoping**, not a finished product. The contracts in `contracts/src/` are scaffolds. The pipeline is specified, not built. The frontend is empty. What Wave 1 *is*: a credible, technically grounded plan for assembling the five 0G components into a coherent product, with a team and a 5-wave schedule to actually ship it.
