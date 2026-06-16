# Aevum — X / Twitter Posts

> Pre-written posts for the mandatory Wave 1 submission and for ongoing updates through Wave 5.
> Required hashtags on every post: **#0GBridge** **#BuildOn0G**
> Required tags: **@0G_labs** **@0G_Builders** **@AKINDO_io**

> 💡 **Image/video suggestions** are noted in `[brackets]`. Each post should ship with a 1200×675 OG image or a 15-30s video.

---

## Wave 1 — Launch Post (mandatory)

**[Image: Aevum hero card — logo + tagline + "Wave 1 submission" badge + 0G logo]**

> AI agents have amnesia. Every session, every API call — they start from zero.
>
> Aevum fixes this. We're building the memory layer for the @0G_labs agent ecosystem:
>
> 🧠 persistent encrypted memory on 0G Storage
> 🪪 on-chain identity via ERC-7857 Agentic IDs
> ✅ TEE-attested inference on 0G Compute
> 💸 per-invoice settlement on 0G Pay
>
> Wave 1 submission just dropped. Five waves to mainnet.
>
> [Image: 5-wave roadmap graphic]
>
> Docs, architecture, and contracts → github.com/your-org/aevum
>
> Built on 0G. By the @0G_Builders community. For the @AKINDO_io Bridge Buildathon.
>
> #0GBridge #BuildOn0G

---

## Wave 2 — Progress Post (contracts live on Galileo)

**[Image: 0G Explorer screenshot showing 3 verified contracts + green checkmarks]**

> Wave 2 ✅
>
> AevumRegistry, AevumMemory, and AevumAgenticID (ERC-7857) are live on 0G Galileo.
>
> [Image: contract addresses table]
>
> Foundry test suite: [N] tests, [N]% coverage, Slither clean.
>
> All on-chain logic settled: agent ownership, memory pointers, per-agent ACLs, NFT transfers.
>
> Wave 3 next: the memory pipeline (Memory → Orchestrator → Privacy agents) wired to 0G Storage.
>
> thx @0G_labs for the support. see you in W3.
>
> #0GBridge #BuildOn0G

---

## Wave 3 — Pipeline + Frontend Live

**[Video: 30s screen recording of a real chat turn in the Aevum frontend, with TEE proof badge visible]**

> Aevum v0.1 is live. 👇
>
> [Video: chat UI → user asks "remember when we talked about X?" → response streams in with ✅ TEE-verified badge → memory citation visible]
>
> What's working today:
> • wallet connect on 0G Galileo
> • register an agent (mints an Agentic ID NFT)
> • chat with the agent
> • every response is encrypted, stored on 0G Storage, pointer written on-chain
>
> Built on @0G_labs Storage + Chain. @0G_Builders is the best.
>
> v1.0 with TEE inference + 0G Pay drops in W4.
>
> #0GBridge #BuildOn0G

---

## Wave 4 — Verifiable Inference + Pay

**[Image: side-by-side — TEE-verified ✅ vs OpenAI fallback ⚠️ badges]**

> Wave 4: Aevum is now TEE-verified end-to-end.
>
> Every AI response ships with a 0G Compute TEE attestation. Tap the badge to see:
> • model hash
> • code hash
> • input digest
> • output digest
> • signed quote
>
> Verify it against @0G_labs' published TEE roots. If 0G Compute is down, we fall back to OpenAI — and we tell you, with a ⚠️ badge. Never silent.
>
> Also: 0G Pay sessions are live. Per-invoice settlement. No middleman.
>
> [Image: pay receipt]
>
> Mainnet and Token2049 in W5. 🫡
>
> #0GBridge #BuildOn0G

---

## Wave 5 — Mainnet + Demo Day

**[Video: 90s of the live demo from DEMO_SCRIPT.md, captioned]**

> Aevum is on 0G mainnet. 🟢
>
> [Video: connect wallet → register agent → ask → TEE-verified response → on-chain proof → transfer agent to a new wallet → new wallet decrypts memory]
>
> Every agent on 0G can now have:
> • persistent encrypted memory
> • a portable, transferable identity
> • cryptographically verifiable inference
> • pay-as-you-go settlement
>
> We pitched this live at Token2049. The dream: every agent on 0G uses Aevum as its memory.
>
> thx @0G_labs @0G_Builders @AKINDO_io for an incredible 5 waves.
>
> Repo (MIT): github.com/your-org/aevum
> Docs: aevum.xyz/docs
> Try it: aevum.xyz
>
> #0GBridge #BuildOn0G

---

## Bonus Posts (use as needed)

### Demo day live-tweet

> We're on stage at Token2049 RIGHT NOW showing Aevum — memory layer for the 0G agent ecosystem.
>
> Live demo: connect → register agent → ask → TEE-verified response → on-chain → transfer to a friend.
>
> [Image: stage photo]
>
> #0GBridge #BuildOn0G

### Ship-day mini post

> ship day. aevum v1.0 is live.
>
> 🧠 encrypted memory on @0G_labs Storage
> 🪪 ERC-7857 agent identity on 0G Chain
> ✅ TEE-attested inference on 0G Compute
> 💸 per-invoice pay on 0G Pay
>
> try it → aevum.xyz
>
> #0GBridge #BuildOn0G

### Technical deep-dive thread (W2)

> 🧵 how aevum stores a memory
>
> 1/ user says something to their agent
> 2/ canonical JSON (sorted keys, no whitespace)
> 3/ generate random 256-bit DEK
> 4/ AES-256-GCM encrypt the JSON with the DEK
> 5/ wrap the DEK with the owner's session key
> 6/ upload ciphertext to @0G_labs Storage → get root hash
> 7/ write (rootHash, uri) to AevumMemory on 0G Chain
> 8/ emit MemoryStored event
>
> Reads are the reverse. Plaintext never touches disk.
>
> [Image: architecture diagram]
>
> #0GBridge #BuildOn0G

### Post-buildathon retrospective (after W5)

> 5 waves. 1 product. here's what we shipped.
>
> • 3 contracts on 0G mainnet
> • 1k+ agents registered
> • 10k+ encrypted memories
> • 100% TEE-attested inferences
> • Token2049 demo: ✅
>
> what we learned: @0G_labs' modular stack is the only place you can credibly build agent infrastructure.
>
> what's next: design partners, paid tier, more 0G components (DA, inference marketplace).
>
> #0GBridge #BuildOn0G

---

## Posting cadence

| Wave | Posts |
|---|---|
| W1 (submission day) | 1 launch + 1 thread (problem + solution) |
| W2 (contracts deployed) | 1 progress + 1 technical deep-dive |
| W3 (frontend live) | 1 announcement + 1 short demo video |
| W4 (TEE + Pay live) | 1 announcement + 1 "how verification works" thread |
| W5 (mainnet + demo day) | 1 announcement + 1 live-tweet + 1 retrospective |

## Image template checklist

For every post, ship a 1200×675 image with:
- Aevum wordmark in white
- 0G wordmark in the corner
- Wave number / post topic as a 1-line caption
- Dark background (brand color #0A0A0F)
- High contrast for thumbnail legibility
