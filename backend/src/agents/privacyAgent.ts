/**
 * Privacy agent — PII detection and redaction.
 *
 * Runs LAST in the pipeline to ensure no PII ever leaves the system.
 */
import type { PIIMatch, RedactionResult } from "../types/index.js";

const PATTERNS: Array<{ type: PIIMatch["type"]; re: RegExp; mask: (m: string) => string }> = [
  {
    type: "email",
    re: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g,
    mask: () => "[REDACTED_EMAIL]",
  },
  {
    type: "phone",
    re: /(?<![\d])(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}(?![\d])/g,
    mask: () => "[REDACTED_PHONE]",
  },
  {
    type: "ssn",
    re: /\b\d{3}-\d{2}-\d{4}\b/g,
    mask: () => "[REDACTED_SSN]",
  },
  {
    type: "credit_card",
    re: /(?<![\d])(?:\d{4}[ \-]?){3}\d{4}(?![\d])/g,
    mask: (m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19) return m;
      // Luhn check
      let sum = 0;
      let alt = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = digits.charCodeAt(i) - 48;
        if (alt) {
          n *= 2;
          if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
      }
      return sum % 10 === 0 ? "[REDACTED_CC]" : m;
    },
  },
  {
    type: "ip",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    mask: () => "[REDACTED_IP]",
  },
  {
    type: "iban",
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
    mask: () => "[REDACTED_IBAN]",
  },
];

function luhnValid(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function collectMatches(text: string): PIIMatch[] {
  const out: PIIMatch[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      if (m[0].length === 0) {
        p.re.lastIndex++;
        continue;
      }
      if (p.type === "credit_card" && !luhnValid(m[0])) continue;
      out.push({ type: p.type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  out.sort((a, b) => a.start - b.start);
  // Remove overlapping matches — keep the longest one.
  const filtered: PIIMatch[] = [];
  for (const m of out) {
    const last = filtered[filtered.length - 1];
    if (last && m.start < last.end) {
      if (m.end - m.start > last.end - last.start) {
        filtered[filtered.length - 1] = m;
      }
      continue;
    }
    filtered.push(m);
  }
  return filtered;
}

export function detectPII(text: string): PIIMatch[] {
  return collectMatches(text);
}

export function redact(text: string): RedactionResult {
  const matches = collectMatches(text);
  if (matches.length === 0) return { sanitized: text, foundPII: [] };

  // Replace right-to-left so indices stay valid
  let sanitized = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]!;
    const pattern = PATTERNS.find((p) => p.type === m.type)!;
    sanitized = sanitized.slice(0, m.start) + pattern.mask(m.value) + sanitized.slice(m.end);
  }
  const foundPII: PIIMatch[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const key = `${m.type}:${m.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    foundPII.push(m);
  }
  return { sanitized, foundPII };
}
