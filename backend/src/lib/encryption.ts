/**
 * AES-256-GCM encryption helpers used for protecting memory content
 * at rest in 0G Storage.
 *
 * Format: [12-byte IV][16-byte authTag][ciphertext]
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { keccak256, toUtf8Bytes, type BytesLike } from "ethers";

export const IV_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;
export const KEY_LENGTH = 32;

export function generateKey(): string {
  return "0x" + randomBytes(KEY_LENGTH).toString("hex");
}

export function keyFromHex(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== KEY_LENGTH * 2) {
    throw new Error(`Key must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes)`);
  }
  return Buffer.from(clean, "hex");
}

export function deriveKey(seed: string, salt: string = "aevum-memory"): Buffer {
  return createHash("sha256").update(`${salt}:${seed}`).digest();
}

export interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encrypt(data: Buffer | string, key: Buffer | string): EncryptedBlob {
  const keyBuf = typeof key === "string" ? keyFromHex(key) : key;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const input = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  const enc = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decrypt(blob: EncryptedBlob, key: Buffer | string): Buffer {
  const keyBuf = typeof key === "string" ? keyFromHex(key) : key;
  const iv = Buffer.from(blob.iv, "base64");
  const authTag = Buffer.from(blob.authTag, "base64");
  const ciphertext = Buffer.from(blob.ciphertext, "base64");
  if (iv.length !== IV_LENGTH) throw new Error(`Invalid IV length: ${iv.length}`);
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid authTag length: ${authTag.length}`);
  }
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function packEncrypted(blob: EncryptedBlob): Buffer {
  return Buffer.concat([
    Buffer.from(blob.iv, "base64"),
    Buffer.from(blob.authTag, "base64"),
    Buffer.from(blob.ciphertext, "base64"),
  ]);
}

export function unpackEncrypted(packed: Buffer): EncryptedBlob {
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Packed payload too short");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function encryptToBuffer(data: Buffer | string, key: Buffer | string): Buffer {
  return packEncrypted(encrypt(data, key));
}

export function decryptFromBuffer(packed: Buffer, key: Buffer | string): Buffer {
  return decrypt(unpackEncrypted(packed), key);
}

/**
 * Compute the 0G Storage-style content hash (keccak256 of UTF-8 bytes)
 * returned as a 0x-prefixed hex string. We treat the result as the
 * canonical "root hash" when no on-chain root has been published yet.
 */
export function hashContent(data: Buffer | string | BytesLike): string {
  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = toUtf8Bytes(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = toUtf8Bytes(String(data));
  }
  return keccak256(bytes);
}

/**
 * Pack a payload (plaintext or already-encrypted) and return both a
 * `contentHash` (keccak256 of the wire bytes) and the wire bytes.
 */
export function preparePayload(
  raw: Buffer | string,
  options: { encrypt: boolean; key: Buffer | string },
): { bytes: Buffer; contentHash: string; encrypted: boolean } {
  const bytes = options.encrypt ? encryptToBuffer(raw, options.key) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw, "utf-8");
  return {
    bytes,
    contentHash: hashContent(bytes),
    encrypted: options.encrypt,
  };
}
