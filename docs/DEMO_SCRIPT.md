# Aevum — 3-Minute Demo Video Script

> Target length: **3:00** (180 seconds)
> Format: screen recording + voiceover + light graphics
> Output: 1080p MP4, uploaded to YouTube (unlisted) and X (native)

---

## 0:00 – 0:20 · Cold Open (20s)

**Visual:** Black screen → fade in on a chat window with the message *"Hi! How can I help you today?"* → quick cuts of the same chat, different apps, every time the same empty greeting.

**Voiceover:**
> AI agents today have amnesia. Every session starts from zero. Your copilot forgets what you shipped last week. Your research agent forgets the paper you cited. Your trading agent forgets your risk rules.
>
> Aevum fixes this. It's the memory layer for the 0G agent ecosystem.

**Visual:** Aevum logo + tagline reveal: *"Aevum — persistent, encrypted, verifiable AI memory on 0G."*

---

## 0:20 – 0:50 · The Problem (30s)

**Visual:** Side-by-side comparison.

**Left panel:** "Today's copilots"
- User: "Hey, remember the Solidity bug we fixed yesterday?"
- Copilot: "I don't have context from previous conversations. Could you remind me?"

**Right panel:** "With Aevum"
- User: "Hey, remember the Solidity bug we fixed yesterday?"
- Copilot: "Yes — the unchecked transfer in `withdraw()` from contract `0x4f…`. We patched it by adding a zero-address check. Want me to write a regression test?"

**Voiceover:**
> Every modern AI is forgetful by design. The infrastructure they run on is stateless. Memory has to live somewhere — and today, that "somewhere" is a centralized vendor you don't own, can't verify, and can't move.
>
> Aevum flips that. Memory lives on 0G — encrypted, on-chain, verifiable, transferable.

---

## 0:50 – 1:30 · Show Aevum (40s)

**Visual:** Live screen recording of the Aevum frontend.

**Steps (show each, no voiceover pause):**

1. **0:52** — Open `app.aevum.xyz`. Click "Connect Wallet". MetaMask pops. Sign.
2. **0:58** — Dashboard loads. Show the "My Agents" panel — empty for a new user.
3. **1:02** — Click "Register Agent". Type name: "Research Copilot". Sign tx.
4. **1:09** — 0G Explorer tab opens. Show the `registerAgent` tx confirmed, the `AevumAgenticID` NFT minted to the wallet.
5. **1:14** — Back to the app. The new agent is listed with its token ID.
6. **1:18** — Click into the agent. Chat panel opens.
7. **1:24** — First message: *"What does the Aevum whitepaper say about per-memory DEKs?"*
8. **1:30** — Response streams in.

**Voiceover (under the screen):**
> One click to register an agent on 0G Chain. The agent gets an ERC-7857 Agentic ID NFT — it's ownable, transferable, and points to encrypted metadata on 0G Storage. Now we can ask it a question.

---

## 1:30 – 2:10 · Show the Magic (40s)

**Visual:** Same chat panel. The response is on screen.

**Steps:**

1. **1:32** — Highlight the ✅ TEE proof badge on the response. Voiceover: "Every response is attested by 0G Compute running inside a TEE. The badge means we cryptographically verified that this model, with this code, on this input, produced this output."
2. **1:42** — Scroll to the "Sources" / "Memories" panel. Show 3 cited memories with timestamps.
3. **1:48** — Voiceover: "The agent remembered the Aevum whitepaper because Aevum encrypted it and stored it on 0G Storage — a memory pointer written to 0G Chain. The next time you ask, it'll still be there."
4. **1:58** — Now ask a *new* question: *"And the encryption scheme we picked — why AES-256-GCM specifically?"*
5. **2:04** — Response comes back citing the same memory *and* a new one. Voiceover: "Each turn writes a new encrypted memory. After a week, after a month, the agent knows you."

**Visual overlay:** animated counter "Memories: 1 → 4 → 12 → 47 → 200" syncing with the timeline.

---

## 2:10 – 2:40 · Show the On-Chain Layer (30s)

**Visual:** Cut to 0G Explorer.

**Steps:**

1. **2:11** — Open the agent's address. Show the `AevumRegistry` entry: owner = my wallet, linked Agentic ID = token #42.
2. **2:18** — Open the `AevumMemory` contract. Show `pointers(42)` returning an array of root hashes. Highlight one.
3. **2:24** — Copy the root hash, paste into 0G Storage explorer. Show the encrypted blob. Voiceover: "On-chain we store the pointer. Off-chain, on 0G Storage, we store the encrypted content. The key never leaves the owner's wallet."
4. **2:34** — Back to the app. Click "Transfer Agent". Sign tx. Show the agent disappear from my dashboard and appear in a *second* wallet's dashboard. Voiceover: "The agent is an NFT. Transfer it, and the memory moves with it. ERC-7857."

---

## 2:40 – 3:00 · Wave 5 Vision (20s)

**Visual:** Cut to a stylized slide. Big text.

**Text on screen:**
> **Wave 5 vision:**
> *Every agent on 0G will use Aevum as its memory.*

**Voiceover:**
> Today, Aevum works. By Wave 5, it works for every agent on 0G — every copilot, every trading bot, every research assistant, every DAO steward. Aevum is the memory layer for the 0G agent ecosystem, and we're just getting started.

**Visual:** Aevum logo + 0G logo. URL: `aevum.xyz`. GitHub: `github.com/your-org/aevum`.

**End card:** "Built on 0G · 0G Bridge Buildathon · MIT licensed"

**Music fade.**

---

## Production Notes

- **Resolution:** 1920×1080
- **Frame rate:** 30 fps
- **Audio:** -14 LUFS, voiceover only, light background music (royalty-free)
- **Captions:** auto-generated + manually corrected, burned-in
- **Tools:** OBS for screen capture, DaVinci Resolve or Descript for edit
- **Backup recording:** a second OBS pass at 720p in case the primary corrupts
- **Length check:** the script is exactly 180s of voiceover — add 5-10s of breathing room between sections, total runtime 3:00–3:10

### On-screen elements to design

- Aevum logo (white on dark)
- "TEE-verified" ✅ badge in the UI (W4)
- "Memory" panel with timestamps
- 0G Explorer page (real, not mocked)
- 0G Storage page showing encrypted blob
- 0G Chain confirmation toast

### What NOT to do

- Don't use placeholder text in the UI — fill it with real demo data
- Don't use a Lorem Ipsum agent name — call it "Research Copilot" or "Solana Dev Buddy"
- Don't cut audio mid-sentence — always end on a full breath
- Don't show the wallet seed phrase — ever
