# Aevum — Troubleshooting

> Common errors and fixes, organized by component. If your issue isn't here, open a GitHub issue with the `bug` label and the output of `npm run doctor`.

---

## 0. First-step diagnostic

```bash
# from the repo root
npm run doctor          # prints versions of node, npm, forge, anvil, git
curl https://evmrpc-testnet.0g.ai -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

If `npm run doctor` doesn't exist yet (W1), run these manually:

```bash
node --version          # expect v20.x or higher
npm --version
forge --version
cast --version
```

---

## 1. Foundry not installed

**Symptom:** `forge: command not found`

**Fix:**

```bash
# macOS / Linux
curl -L https://foundry.paradigm.xyz | bash
foundryup

# verify
forge --version
```

If `foundryup` fails behind a corporate proxy:

```bash
# set proxy
export HTTP_PROXY=http://user:pass@proxy:8080
export HTTPS_PROXY=http://user:pass@proxy:8080
foundryup
```

If you have an Apple Silicon Mac and see `bad CPU type`:

```bash
arch -x86_64 bash -c "$(curl -L https://foundry.paradigm.xyz)"
```

If you have Windows: use WSL2.

---

## 2. 0G testnet faucet not working

**Symptom:** Faucet returns 429 / "try again later" / no tokens appearing.

**Fixes (try in order):**

1. Wait 5 minutes — the faucet rate-limits per wallet per hour.
2. Confirm you're requesting on the right network — chain ID `16600` (Galileo). Faucet is network-specific.
3. Try a different wallet address (some faucets restrict mainnet-funded wallets).
4. Check the 0G Discord `#faucet-requests` channel — mods can drip manually.
5. Bridge from a public L1 (if 0G supports it in your wave) using the 0G bridge UI.
6. As a last resort, ping @0G_Builders on X with your wallet address and a polite ask.

> Don't pay for 0G testnet tokens on a third-party site. The official faucet is the only legit source.

---

## 3. MetaMask not connecting

**Symptom:** "Connect Wallet" does nothing, or the wallet popup never appears.

**Fixes (try in order):**

1. **Refresh the page** — MetaMask state can desync after long dev sessions.
2. **Check the network** — switch MetaMask to 0G Galileo (chain ID `16600`). If it's not in your network list, click "Add Network" and use:
   - Network name: `0G Galileo`
   - RPC: `https://evmrpc-testnet.0g.ai`
   - Chain ID: `16600`
   - Currency: `0G`
   - Explorer: `https://chainscan-galileo.0g.ai`
3. **Disable conflicting extensions** — Rabby, Phantom, and multiple MetaMask instances can collide.
4. **Check console** — open DevTools → Console. If you see `User rejected request`, re-click "Connect" and approve.
5. **Clear site data** — MetaMask → Settings → Connected sites → Disconnect for `localhost:5173`. Reload.
6. **Try a different browser** — Chrome → Firefox. Sometimes MetaMask's inpage provider is wedged.
7. **WalletConnect fallback** — RainbowKit's modal has a WalletConnect option. Use that if inpage fails.

---

## 4. 0G Storage upload failing

**Symptom:** `storage.upload()` throws `ECONNREFUSED`, `timeout`, or `insufficient funds`.

**Fixes:**

1. **Check the RPC** — `curl https://storage-testnet.0g.ai/v1/health` should return 200.
2. **Check your balance** — storage requires a small amount of 0G for the indexer fee. Use the faucet (§2).
3. **Increase timeout** — uploads of large blobs can take 30+ seconds:
   ```ts
   const client = new ZeroGStorage({ rpc: process.env.OG_STORAGE_RPC, timeoutMs: 60_000 });
   ```
4. **Check the file size** — payloads >100 MB may need chunked uploads. The `storage.ts` service handles this automatically; if you've bypassed it, restore the default.
5. **Pin a known-good hash** — try uploading a 1-byte file. If that works, the issue is payload size, not connectivity.

---

## 5. 0G Compute provider unavailable

**Symptom:** `compute.infer()` throws `503`, `timeout`, or `no providers`.

**Fixes:**

1. **Wait and retry** — TEEs can be momentarily offline during scaling events.
2. **Check the 0G status page** (or 0G Discord `#status`).
3. **The fallback should kick in automatically** — the compute service catches this error and routes to OpenAI with `provider: "openai-fallback"`. If it doesn't, your error handler is broken. Check `backend/src/services/compute.ts`.
4. **Verify env var** — `OG_COMPUTE_ENDPOINT` must be set. Without it, we don't even try.
5. **Local mode (W5+)** — set `AEVUM_COMPUTE_MODE=local` to use a local model. No TEE proof will be issued.

---

## 6. Frontend build errors (Node polyfills)

**Symptom:** Vite build fails with `Buffer is not defined`, `process is not defined`, or `crypto.subtle is undefined`.

**Fix:**

We use `vite-plugin-node-polyfills`. Make sure it's configured in `frontend/vite.config.ts`:

```ts
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
});
```

If you've added a new dependency that uses Node built-ins (`buffer`, `stream`, `crypto`), reinstall:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 7. Test failures

### 7.1 Foundry tests fail

**Symptom:** `forge test` returns failures.

**Fixes:**

1. `forge clean && forge build` — start clean.
2. Check that `lib/` has the right git submodules:
   ```bash
   cd contracts
   forge install OpenZeppelin/openzeppelin-contracts --no-commit
   forge install foundry-rs/forge-std --no-commit
   ```
3. For "out of gas" failures in tests, bump the limit:
   ```solidity
   vm.deal(user, 100 ether);
   vm.prank(user);
   target.someFunction{value: 1 ether}();
   ```

### 7.2 Backend tests fail

**Symptom:** `npm test` in `backend/` errors.

**Fixes:**

1. Delete `coverage/` and `.vitest/` if they exist.
2. Check that `backend/.env.test` exists and has valid test RPCs.
3. If you see `ECONNREFUSED 127.0.0.1:8545`, start anvil first:
   ```bash
   anvil &
   npm test
   ```

### 7.3 Frontend tests fail

**Symptom:** `npm test` in `frontend/` errors.

**Fixes:**

1. Clear Vite cache: `rm -rf frontend/node_modules/.vite`.
2. Reset MSW handlers if you're using them.

### 7.4 E2E test fails

**Symptom:** `npm run test:e2e` errors.

**Fixes:**

1. Make sure `anvil` is running, contracts are deployed, backend is up, frontend build is served.
2. The e2e script (`scripts/e2e.sh`) is idempotent — re-run it; it'll redeploy and re-seed.
3. If the TEE proof is missing in the e2e assertion, you may be hitting the OpenAI fallback. Force TEE in `.env.test`:
   ```
   AEVUM_COMPUTE_MODE=tee
   AEVUM_REQUIRE_TEE=true
   ```

---

## 8. Common wallet errors

### "Insufficient funds for gas"

You need a small amount of 0G on Galileo for gas. Faucet (§2).

### "Nonce too low" / "Nonce too high"

Reset MetaMask's nonce: Settings → Advanced → Reset Account. Or just send a no-op tx (transfer 0 to yourself).

### "User denied transaction signature"

The user clicked "Reject" in MetaMask. Re-prompt and approve.

### "Chain ID mismatch"

The contract address is on a different chain than your wallet. Switch networks in MetaMask.

---

## 9. Performance issues

**Slow TEE inference:**
- Normal latency: 300-800ms.
- If > 2s, check your region — pick the closest 0G Compute endpoint.
- If 0G Compute is overloaded, the fallback to OpenAI is ~200ms faster.

**Slow 0G Storage reads:**
- First read after write is slow (propagation). Subsequent reads are cached.
- If consistently slow, you're on a cold shard. The SDK retries on other shards automatically.

**Slow chain reads:**
- `pointers(agentId)` is O(N). If a single agent has > 10k memories, consider paginating (`AevumMemory.pointers(agentId, offset, limit)` — W2 spec).

---

## 10. Getting help

If none of the above fixes it:

1. Search the GitHub issues: `is:issue is:open`
2. Open a new issue with:
   - The exact command you ran
   - The full error output (copy-paste, not a screenshot)
   - Output of `npm run doctor` (or manual version dump)
   - OS + Node + Foundry versions
3. Ask in the 0G Discord `#aevum` channel
4. Ping @0G_Builders on X

> When in doubt, include the full error. "It doesn't work" is not actionable.
