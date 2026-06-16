# Aevum Contracts

On-chain AI-agent identity, memory log, and ERC-721 wrapper for the
**Aevum** protocol, deployed on **0G Chain**.

## Architecture

Three contracts compose the protocol:

| Contract           | Purpose                                                                 |
|--------------------|-------------------------------------------------------------------------|
| `AevumRegistry`    | Identity layer. One agent per row, owned by a wallet, with a pointer to encrypted memory on 0G Storage. |
| `AevumMemory`      | Per-agent append-only log of memory entries (hashes + 0G Storage root + access list). |
| `AevumAgenticID`   | ERC-721 wrapper. Mints agents as NFTs with sealed-key / TEE-proof transfer and cloning. |

Deployment order (also the dependency order):

```
AevumRegistry
   ├── AevumMemory      (immutable reference to AevumRegistry)
   └── AevumAgenticID   (immutable reference to AevumRegistry, registered as a "registrar" so its mints create registry agents atomically owned by the NFT recipient)
```

## Layout

```
contracts/
├── foundry.toml
├── remappings.txt
├── .env.example
├── src/
│   ├── AevumRegistry.sol
│   ├── AevumMemory.sol
│   └── AevumAgenticID.sol
├── test/
│   ├── AevumRegistry.t.sol
│   ├── AevumMemory.t.sol
│   ├── AevumAgenticID.t.sol
│   └── mocks/MockOracle.sol
└── script/
    └── Deploy.s.sol
```

## Build & test

```bash
# install deps (one time)
forge install

# compile
forge build

# run all tests
forge test -vv
```

## Network configuration

The deployment script reads from environment variables (see `.env.example`):

| Variable             | Example                                | Purpose                          |
|----------------------|----------------------------------------|----------------------------------|
| `PRIVATE_KEY`        | `0xabc…`                               | Deployer key (with `0x` prefix). |
| `OG_RPC_URL`         | `https://evmrpc.0g.ai`                 | 0G Chain mainnet RPC.            |
| `OG_CHAIN_ID`        | `16660`                                | 0G Chain mainnet chain id.       |
| `OG_EXPLORER_URL`    | `https://chainscan.0g.ai`              | Block explorer for verification. |
| `OG_ORACLE`          | `0x000…` or a TEE oracle address       | Trusted oracle for ERC-7857 transfers. |
| `OG_ADMIN`           | an admin EOA / multisig                | Receives `ORACLE_ADMIN_ROLE`.    |

Testnet counterparts: `OG_RPC_URL_TESTNET=https://evmrpc-testnet.0g.ai`,
`OG_CHAIN_ID_TESTNET=16602`, `OG_EXPLORER_URL_TESTNET=https://chainscan-galileo.0g.ai`.

## Deploy

```bash
cp .env.example .env
# fill in PRIVATE_KEY, OG_RPC_URL, ...

# load env, then deploy (one command):
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $OG_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```

The script:

1. Deploys `AevumRegistry`.
2. Deploys `AevumMemory` wired to the registry.
3. Deploys `AevumAgenticID` wired to the registry (oracle address and admin from env).
4. Authorises `AevumAgenticID` as a registrar on the registry.
5. Prints a summary of all addresses to stdout.

After deployment, set the real oracle with `AevumAgenticID.setOracle(<tee-address>)`
from the `OG_ADMIN` account (this is the `ORACLE_ADMIN_ROLE` holder).

## Verify on 0G explorer

```bash
forge verify-contract \
  --chain-id $OG_CHAIN_ID \
  --verifier custom \
  --verifier-url $OG_EXPLORER_URL/api \
  <CONTRACT_ADDRESS> \
  src/AevumRegistry.sol:AevumRegistry
```

(repeat per contract; the verifier URL is `https://chainscan.0g.ai/api` on mainnet
and `https://chainscan-galileo.0g.ai/api` on testnet — match the network you
deployed to).

## Notes on the oracle (ERC-7857 placeholder)

`AevumAgenticID.transfer` and `AevumAgenticID.clone` call a trusted oracle
(`ITransferVerifier`) to verify the TEE / zk proof and the sealed key. In
production this should be a 0G Compute TEE service. For local development the
`MockOracle` in `test/mocks/` can be deployed and its address passed as
`OG_ORACLE`.

The `clone` operation propagates the source agent's memory pointer to the new
agent; if the source has no memory, the new agent is created without one.
