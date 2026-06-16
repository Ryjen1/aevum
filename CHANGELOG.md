# Changelog

All notable changes to Aevum are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-06-16 · Wave 1 submission

### Added
- Initial project scaffold: Foundry contracts, Node backend, React + Vite frontend
- Smart contract scaffolds:
  - `AevumRegistry` — agent directory (interface + skeleton)
  - `AevumMemory` — per-agent memory pointer registry (interface + skeleton)
  - `AevumAgenticID` — ERC-7857 Agentic ID NFT (interface + skeleton)
- Documentation:
  - `README.md` — project hero, 0G component deep-dive, architecture, roadmap
  - `docs/ARCHITECTURE.md` — full technical architecture, Mermaid diagrams, security model
  - `docs/WAVE1_SUBMISSION.md` — AKINDO submission content
  - `docs/SETUP.md` — local dev, testing, deployment
  - `docs/DEMO_SCRIPT.md` — 3-minute demo video script
  - `docs/PITCH_DECK.md` — 10-slide Token2049 deck outline
  - `docs/X_POSTS.md` — pre-written social posts for waves 1-5
  - `docs/TROUBLESHOOTING.md` — common errors and fixes
  - `docs/CONTRIBUTING.md` — how to contribute, code style, PR process
- License: MIT (`LICENSE`)
- CI workflow: `.github/workflows/ci.yml`
- Package manifests: `frontend/package.json`, contracts `foundry.toml`

### Notes
- This is the **Wave 1 submission**: project scoping and 0G integration plan.
- The contracts in `contracts/src/` are scaffolds; full implementations land in W2.
- The backend and frontend directories exist for layout, with empty source folders pending W3+ implementation.

---

## [Unreleased]

### Planned for Wave 2 (2026-07-17) — Core Smart Contracts
- Full `AevumRegistry` implementation with UUPS upgradeability
- Full `AevumMemory` with per-agent ACL and scope encoding
- Full `AevumAgenticID` (ERC-7857) with encrypted metadata URI
- Foundry test suite ≥ 90% coverage
- Slither clean
- Deployment to 0G Galileo testnet

### Planned for Wave 3 (2026-08-07) — Memory Pipeline + 0G Storage
- `MemoryAgent` and `OrchestratorAgent` end-to-end
- Encrypted write/read to 0G Storage
- Frontend v0.1 (connect wallet, view agents, basic chat)

### Planned for Wave 4 (2026-08-28) — Verifiable Inference + 0G Pay
- `PrivacyAgent` with PII redaction
- 0G Compute TEE integration
- 0G Pay session lifecycle
- Frontend v1.0 with TEE proof badge, usage receipts, agent transfer UI

### Planned for Wave 5 (2026-09-18) — Mainnet + Demo Day
- Mainnet deployment
- ERC-7857 transfer flow end-to-end
- Public launch
- Token2049 Demo Day pitch
