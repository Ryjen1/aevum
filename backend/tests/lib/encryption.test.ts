import {
  encrypt,
  decrypt,
  generateKey,
  hashContent,
  encryptToBuffer,
  decryptFromBuffer,
  packEncrypted,
  unpackEncrypted,
} from "../../src/lib/encryption.js";

describe("encryption", () => {
  it("generates a 32-byte key in hex", () => {
    const k = generateKey();
    expect(k.startsWith("0x")).toBe(true);
    expect(k.slice(2).length).toBe(64);
  });

  it("round-trips a string with the same key", () => {
    const k = generateKey();
    const plain = "Hello, Aevum!";
    const blob = encrypt(plain, k);
    const out = decrypt(blob, k);
    expect(out.toString("utf-8")).toBe(plain);
  });

  it("round-trips a buffer", () => {
    const k = generateKey();
    const buf = Buffer.from([0, 1, 2, 3, 4, 255, 254]);
    const blob = encrypt(buf, k);
    const out = decrypt(blob, k);
    expect(Buffer.compare(out, buf)).toBe(0);
  });

  it("fails to decrypt with a different key", () => {
    const k1 = generateKey();
    const k2 = generateKey();
    const blob = encrypt("secret", k1);
    expect(() => decrypt(blob, k2)).toThrow();
  });

  it("round-trips a packed buffer", () => {
    const k = generateKey();
    const blob = encrypt("Aevum memory blob", k);
    const packed = packEncrypted(blob);
    const unpacked = unpackEncrypted(packed);
    const out = decrypt(unpacked, k);
    expect(out.toString("utf-8")).toBe("Aevum memory blob");
  });

  it("encryptToBuffer / decryptFromBuffer round-trip", () => {
    const k = generateKey();
    const packed = encryptToBuffer("packed", k);
    const out = decryptFromBuffer(packed, k);
    expect(out.toString("utf-8")).toBe("packed");
  });

  it("hashContent produces a stable 0x-prefixed keccak256", () => {
    const h1 = hashContent("hello");
    const h2 = hashContent("hello");
    const h3 = hashContent("hello!");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1.startsWith("0x")).toBe(true);
    expect(h1.slice(2).length).toBe(64);
  });

  it("packEncrypted preserves iv/authTag/ciphertext exactly", () => {
    const k = generateKey();
    const blob = encrypt("payload", k);
    const packed = packEncrypted(blob);
    expect(packed.length).toBe(12 + 16 + Buffer.from(blob.ciphertext, "base64").length);
  });
});
