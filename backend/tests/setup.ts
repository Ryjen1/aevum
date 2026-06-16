// Test setup: ensure deterministic config and silence logger output.
process.env["NODE_ENV"] = "test";
process.env["LOG_LEVEL"] = "silent";
process.env["ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env["OG_PRIVATE_KEY"] = "0x" + "1".repeat(64);
process.env["DEV_MOCK_MODE"] = "true";
process.env["SIWE_DOMAIN"] = "localhost";
process.env["CORS_ORIGINS"] = "*";
process.env["OG_RPC_URL"] ??= "https://evmrpc-testnet.0g.ai";
process.env["OG_INDEXER_RPC"] ??= "https://indexer-storage-testnet-turbo.0g.ai";
process.env["LOCAL_STORAGE_DIR"] ??= "./.cache/test-storage";
