import { redact, detectPII } from "../../src/agents/privacyAgent.js";

describe("privacyAgent.redact", () => {
  it("returns text unchanged when no PII is present", () => {
    const r = redact("The weather is great today");
    expect(r.sanitized).toBe("The weather is great today");
    expect(r.foundPII).toEqual([]);
  });

  it("redacts email addresses", () => {
    const r = redact("Contact me at jane.doe@example.com please");
    expect(r.sanitized).toBe("Contact me at [REDACTED_EMAIL] please");
    expect(r.foundPII.some((m) => m.value === "jane.doe@example.com")).toBe(true);
  });

  it("redacts US phone numbers in common formats", () => {
    const r1 = redact("Call (415) 555-1234 today");
    expect(r1.sanitized).toBe("Call [REDACTED_PHONE] today");
    const r2 = redact("Call +1 415.555.1234 today");
    expect(r2.sanitized).toBe("Call [REDACTED_PHONE] today");
  });

  it("redacts SSNs", () => {
    const r = redact("SSN 123-45-6789 on file");
    expect(r.sanitized).toBe("SSN [REDACTED_SSN] on file");
    expect(r.foundPII.some((m) => m.value === "123-45-6789")).toBe(true);
  });

  it("redacts valid credit card numbers (Luhn)", () => {
    // 4111 1111 1111 1111 is a known valid Luhn test number
    const r = redact("Card 4111111111111111 expires soon");
    expect(r.sanitized).toBe("Card [REDACTED_CC] expires soon");
  });

  it("does not redact numbers that fail Luhn", () => {
    const r = redact("Reference 4111111111111112 (invalid Luhn)");
    expect(r.sanitized).toBe("Reference 4111111111111112 (invalid Luhn)");
  });

  it("redacts IPv4 addresses", () => {
    const r = redact("Server 192.168.1.42 is up");
    expect(r.sanitized).toBe("Server [REDACTED_IP] is up");
  });

  it("redacts IBANs", () => {
    const r = redact("Wire to GB29NWBK60161331926819 please");
    expect(r.sanitized).toBe("Wire to [REDACTED_IBAN] please");
  });

  it("handles multiple PII in one string", () => {
    const r = redact("Email a@b.com or call 415-555-1234 from 10.0.0.1");
    expect(r.foundPII.length).toBeGreaterThanOrEqual(3);
    expect(r.sanitized).toContain("[REDACTED_EMAIL]");
    expect(r.sanitized).toContain("[REDACTED_PHONE]");
    expect(r.sanitized).toContain("[REDACTED_IP]");
  });

  it("detectPII returns positions", () => {
    const matches = detectPII("a@b.com hello");
    expect(matches.length).toBe(1);
    expect(matches[0]?.type).toBe("email");
    expect(matches[0]?.start).toBe(0);
    expect(matches[0]?.end).toBe(7);
  });
});
