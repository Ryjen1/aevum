# Aevum — Pitch Deck Outline (Token2049 Demo Day)

> 10 slides, 5 minutes total → ~30s per slide.
> Designed for a 16:9 stage screen, presenter on stage, deck advancing on clicker.

---

## Slide 1 — Title

**Headline:** Aevum
**Subhead:** The memory layer for the 0G agent ecosystem
**Footer:** 0G Bridge Buildathon · Wave [N] · 2026
**Visual:** Aevum logo (large), 0G logo (small), team logo strip
**Speaker (5s):** "Hi, we're _[team]_. Aevum is the memory layer for the 0G agent ecosystem."

---

## Slide 2 — Problem

**Headline:** AI agents have amnesia
**Three bullets (left column):**
- Every session starts from zero
- Memory is owned by centralized vendors
- No portable identity, no verifiable inference

**Right column:** Cartoon of a copilot greeting a user with "Hi again!" for the 47th time.
**Speaker (25s):** Frame the problem the way it lands with the audience — "Imagine hiring a junior dev who forgets your codebase every morning."

---

## Slide 3 — Solution

**Headline:** Persistent, encrypted, verifiable memory — on 0G
**Three pillars (icon row):**
- 🧠 **Memory** on 0G Storage (encrypted, content-addressed)
- 🪪 **Identity** on 0G Chain (ERC-7857 Agentic ID)
- ✅ **Inference** in 0G Compute TEE (attested, verifiable)

**Speaker (25s):** "Aevum gives every agent all three. Backed by the only stack that delivers all three: 0G."

---

## Slide 4 — How it Works (5 0G components)

**Title:** Built on all five 0G components
**Layout:** 5-column row, one per component, with the Aevum role in 6 words max.

| 0G Component | Aevum role |
|---|---|
| 0G Storage | Encrypted memory blobs |
| 0G Chain | Ownership + pointers |
| 0G Compute | Attested inference |
| 0G Pay | Per-invoice settlement |
| ERC-7857 | Transferable agent NFT |

**Speaker (30s):** Walk the row left-to-right. The kicker: "Five components, one product. You can't build Aevum anywhere else."

---

## Slide 5 — Architecture Diagram

**Title:** Aevum architecture
**Visual:** the high-level Mermaid diagram (exported as PNG) from `docs/ARCHITECTURE.md` §1.
**Speaker (25s):** Trace one path: user → wallet → backend → memory agent → 0G storage → TEE → privacy agent → response. Speed is more important than depth here.

---

## Slide 6 — Live Demo (Screenshot)

**Title:** Live demo
**Visual:** High-res screenshot of the Aevum chat UI with a real conversation, the TEE proof badge visible.
**Backup plan:** if demo fails, this is the screenshot.
**Speaker (5s):** "Let me show you." → switch to live demo.

> If you're using a live demo, slides 6-7 are replaced by the 3-minute demo. See `DEMO_SCRIPT.md`.

---

## Slide 7 — Traction (Placeholder for W4/W5)

**Title:** Traction
**Metrics row (3-4 KPIs with big numbers):**
- [N] agents registered
- [N]k memories stored
- [N] TEE-attested inferences
- [N] active users

**Chart:** memory storage growth (line chart, 5 weeks)
**Speaker (20s):** "Here's what the last wave shipped." Always anchor to a user story, not a vanity number.

---

## Slide 8 — Market

**Title:** Every AI agent needs memory
**TAM math:**
- AI agent market: $X B by 2030 (cite source)
- Memory layer = % of that = $Y B
- 0G-aligned subset = $Z B

**Right column:** 3 logos of agent platforms that would integrate (placeholder)
**Speaker (25s):** Don't over-claim. The honest pitch: "Even a 1% attach rate is enormous, and 0G makes it possible to serve credibly."

---

## Slide 9 — Roadmap

**Title:** Wave 1 → Mainnet → Token2049
**Visual:** 5-step horizontal timeline with the wave name, date, and one-line milestone.

| W1 | W2 | W3 | W4 | W5 |
|---|---|---|---|---|
| Scope | Contracts | Memory | TEE + Pay | Mainnet + Demo Day |
| ✅ | → | → | → | → |

**Speaker (25s):** Walk the timeline. Spend the most time on W5 ("See you here.").

---

## Slide 10 — Team + Ask

**Left half:** Team grid — 3-5 photos, names, one-line role each.
**Right half:** The ask.
- Wave 1: feedback from 0G / AKINDO
- Wave 2-4: 0G Compute credits, intro to 0G Storage node operators
- Wave 5: Token2049 slot, ecosystem intros, post-launch design partners

**Bottom:** Contact (email, X handle, GitHub)
**Speaker (25s):** Close with the ask. Make it specific, not "funding" or "support". "We need X to ship Y by Z."

---

## Production Notes

- **Font:** Inter (or system sans), 32pt minimum body
- **Colors:** Aevum brand on dark; 0G brand on light
- **Aspect:** 16:9, 1920×1080
- **Format:** Google Slides or Pitch (so you can edit from any device on event day)
- **Exports:** PDF (backup), Keynote/PowerPoint (presenter copy), Google Slides (online backup)
- **Timing rehearsal:** the entire deck should land at 4:30, leaving 30s for stage banter and handoff
- **Q&A prep:** expected questions:
  - "Why not just use a vector DB?" → decentralization + verifiability + ownership, none of which a vector DB gives you
  - "What's the encryption scheme?" → AES-256-GCM, per-memory DEK, owner-wrapped
  - "What if 0G Storage goes down?" → replicated; we also store root hash on-chain for recovery
  - "How do you make money?" → 0G Pay per inference, plus premium features (W5+)
  - "Is ERC-7857 finalized?" → we implement the current draft; will update if the standard changes
