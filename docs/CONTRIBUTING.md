# Contributing to Aevum

> Thanks for your interest in Aevum. This document covers how to file issues, submit PRs, run tests, and follow the code style.

---

## Code of conduct

Be kind. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) (abbreviated):

- **Be welcoming.** No harassment, no exclusionary language.
- **Be respectful.** Disagree on the merits, never on the person.
- **Assume good faith.** Bugs happen; questions are valid.

Violations → `conduct@aevum.xyz`.

---

## Filing issues

### Bug reports

Use the **Bug report** issue template. Include:

- **What happened** — the actual behavior
- **What you expected** — the desired behavior
- **Reproduction steps** — minimal, deterministic
- **Environment** — OS, Node version, Foundry version, branch, commit SHA
- **Logs / screenshots** — full error output, not paraphrased

### Feature requests

Use the **Feature request** template. Include:

- **Problem** — what user pain this addresses
- **Proposal** — high-level approach (not a full spec)
- **Alternatives** — what else you considered
- **Scope** — which wave this would land in (if you know)

### Security disclosures

**Do not file public issues for security bugs.** Email `security@aevum.xyz` with:

- Description
- Reproduction
- Impact
- Suggested fix (optional)

We'll respond within 48 hours. We pay bounties for valid reports once the program is funded (W4+).

---

## Development setup

```bash
git clone https://github.com/your-org/aevum.git
cd aevum
npm install
cd contracts && forge install && cd ..
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill in the env vars (see docs/SETUP.md)
npm test
```

See [`docs/SETUP.md`](./SETUP.md) for the full walkthrough.

---

## Project structure

```
aevum/
├── contracts/        # Solidity (Foundry) — AevumRegistry, AevumMemory, AevumAgenticID
├── backend/          # TypeScript Node + Express — multi-agent pipeline
├── frontend/         # React + Vite + wagmi + RainbowKit
├── docs/             # architecture, setup, demo, pitch, posts
├── scripts/          # CI, deploy, e2e
└── .github/          # issue templates, workflows
```

| Component | Owner (default) | Wave |
|---|---|---|
| `contracts/` | Smart Contracts lead | W2 |
| `backend/` | Backend lead | W3 |
| `frontend/` | Frontend lead | W3-W4 |
| `docs/` | Ops / GTM | all |
| `scripts/` | Backend lead | W3+ |

---

## Code style

### Solidity

- Solidity `^0.8.20`
- OpenZeppelin contracts for all standard primitives
- `forge fmt` must pass (CI enforces)
- NatSpec comments on all public functions (`/// @notice`, `/// @param`, `/// @return`)
- No `pragma experimental` in production code
- Custom errors, not `require` strings, in all new code
- Run `slither .` locally before pushing; CI runs it on every PR

### TypeScript (backend + frontend)

- TypeScript strict (`"strict": true`)
- ESLint with `@typescript-eslint/recommended`
- No `any` outside of `*.test.ts` (and only when unavoidable there)
- Prefer `readonly` for all exported object types
- File naming: `PascalCase.tsx` for React components, `camelCase.ts` for everything else
- Imports sorted by `eslint-plugin-import` order: external → internal → relative
- Run `npm run lint && npm run typecheck` before pushing

### React

- Functional components only; no class components
- Hooks at the top of the component, no conditional hooks
- State: `useState` for local, Zustand for shared, wagmi/RainbowKit for chain
- Tailwind CSS for styling; no inline `style={{}}` except for dynamic values
- Accessibility: every interactive element has a label, every image has alt text

### Tests

- **Solidity:** Foundry (forge-std). One test file per contract: `ContractName.t.sol`. Use `vm.prank`, `vm.expectRevert`, fuzz where it adds value.
- **Backend:** Vitest. Tests live next to source as `*.test.ts`. Mock external services (0G, OpenAI) with `vi.mock`.
- **Frontend:** Vitest + Testing Library. One test per component: `Component.test.tsx`.

---

## Branching & commits

### Branches

| Branch | Purpose |
|---|---|
| `main` | production-ready; protected; squash-merge only |
| `wave/N` | the active wave's integration branch |
| `feat/short-name` | feature work |
| `fix/short-name` | bug fixes |
| `docs/short-name` | documentation-only |

### Commit messages

We use **Conventional Commits**:

```
feat(backend): add MemoryAgent recall
fix(contracts): correct AevumMemory ACL scope encoding
docs(arch): update sequence diagram for TEE fallback
test(backend): cover PrivacyAgent PII redaction
chore(deps): bump wagmi to 2.12.0
```

PR titles should also follow this format.

---

## Pull request process

1. **Open a draft PR early.** Don't wait until everything is done. Drafts get earlier review.
2. **Fill the PR template.** What, why, how, screenshots, testing steps.
3. **One PR = one concern.** Don't bundle a refactor with a feature with a fix.
4. **All CI checks must pass** before review:
   - `forge test` green
   - `npm test` green (both packages)
   - `npm run lint` clean
   - `npm run typecheck` clean
5. **Two approvals required** for `main`. One for `wave/N`.
6. **Squash-merge only.** The PR title becomes the commit message.
7. **Delete the branch** after merge.

### PR template (auto-loaded)

```markdown
## What
<!-- 1-2 sentences -->

## Why
<!-- Link to issue, or describe the user need -->

## How
<!-- Implementation notes, design decisions -->

## Testing
<!-- What you tested, how, results -->

## Screenshots
<!-- For UI changes -->

## Checklist
- [ ] Tests added/updated
- [ ] Docs updated (if user-facing)
- [ ] CI green
- [ ] No new lint warnings
```

---

## Release process

- Wave releases are tagged `wave-N` and `v0.N.0`.
- Mainnet release at W5 is tagged `v1.0.0`.
- Releases are drafted by the lead, reviewed by all team members, then published.
- A release includes: git tag, GitHub release notes (auto-generated from PRs), updated `CHANGELOG.md`.

---

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](../LICENSE).
