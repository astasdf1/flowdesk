/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) implementation.
 *
 * Implements the core I-Serialization subset of RFC 8785:
 * - Lexicographic key sort by UTF-16 code-unit order (RFC 8785 §3.2.3)
 * - Number normalization: integers as-is, floats use ECMAScript shortest-roundtrip toString()
 * - String escaping: only `"`, `\`, and U+0000-U+001F are escaped (RFC 8785 §3.2.2)
 * - Recursive arrays and objects
 * - Surrogate pair rejection: strings containing UTF-16 surrogates (U+D800-U+DFFF) are rejected
 *
 * No external dependencies — uses only node:crypto.
 */

import { createHash } from "node:crypto";

/**
 * Returns true if the string contains any UTF-16 surrogate code unit (U+D800..U+DFFF).
 * Such strings are not valid Unicode scalars and are rejected per our subset.
 */
function hasSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/**
 * Escape a string per RFC 8785 §3.2.2:
 * - `"` → `\"`
 * - `\` → `\\`
 * - U+0000-U+001F → `\uXXXX`
 * All other code units are emitted verbatim (including non-BMP via surrogate pairs,
 * but surrogates are rejected before reaching this function).
 */
function escapeString(s: string): string {
  let result = '"';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x22) {
      result += '\\"';
    } else if (code === 0x5c) {
      result += "\\\\";
    } else if (code <= 0x1f) {
      result += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      result += s[i];
    }
  }
  result += '"';
  return result;
}

/**
 * Serialize a number per RFC 8785 §3.2.2:
 * - NaN and Infinity are not valid JSON and are rejected.
 * - Integers (Number.isInteger) are emitted as integer strings.
 * - All other numbers use ECMAScript Number.prototype.toString(), which
 *   produces the shortest roundtrip decimal representation — matching V8/JSC/SpiderMonkey.
 */
function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new TypeError(`JCS: number must be finite, got ${n}`);
  }
  // ECMAScript Number.prototype.toString() already produces shortest-roundtrip output
  // for both integers and floats (e.g., 1e20 → "100000000000000000000").
  return n.toString();
}

/**
 * Core recursive JCS serializer.
 * Throws on: undefined, functions, symbols, BigInt, surrogates in strings.
 */
function serializeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";

  if (typeof value === "number") {
    return serializeNumber(value);
  }

  if (typeof value === "string") {
    if (hasSurrogate(value)) {
      throw new TypeError(`JCS: string contains UTF-16 surrogate code units, which are rejected`);
    }
    return escapeString(value);
  }

  if (typeof value === "bigint") {
    throw new TypeError(`JCS: BigInt values are not supported`);
  }

  if (typeof value === "undefined") {
    throw new TypeError(`JCS: undefined values are not supported`);
  }

  if (typeof value === "function") {
    throw new TypeError(`JCS: function values are not supported`);
  }

  if (typeof value === "symbol") {
    throw new TypeError(`JCS: symbol values are not supported`);
  }

  if (Array.isArray(value)) {
    // Arrays: preserve insertion order (RFC 8785 §3.2.3 only sorts object keys)
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++) {
      parts.push(serializeValue(value[i]));
    }
    return "[" + parts.join(",") + "]";
  }

  if (typeof value === "object") {
    // Sort keys by UTF-16 code-unit lexicographic order (RFC 8785 §3.2.3)
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => {
      // JavaScript string comparison uses UTF-16 code-unit order — exactly RFC 8785 §3.2.3
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    const parts: string[] = [];
    for (const key of keys) {
      if (hasSurrogate(key)) {
        throw new TypeError(`JCS: object key "${key}" contains UTF-16 surrogate code units`);
      }
      const serializedKey = escapeString(key);
      const serializedValue = serializeValue(obj[key]);
      parts.push(serializedKey + ":" + serializedValue);
    }
    return "{" + parts.join(",") + "}";
  }

  // Should not reach here with strict TypeScript, but guard anyway
  throw new TypeError(`JCS: unsupported value type: ${typeof value}`);
}

/**
 * Canonicalize a JSON-serializable value per RFC 8785 JCS.
 *
 * Returns a deterministic UTF-8 string suitable for SHA-256 hashing.
 * Throws if value contains undefined, functions, symbols, BigInt, non-finite numbers,
 * or UTF-16 surrogate code units.
 *
 * Key properties:
 * - Object keys are sorted in UTF-16 code-unit order (RFC 8785 §3.2.3)
 * - Number serialization uses ECMAScript Number.prototype.toString() (shortest roundtrip)
 * - Only `"`, `\`, and U+0000-U+001F are escaped in strings (RFC 8785 §3.2.2)
 * - Array element order is preserved
 */
export function canonicalizeJCS(value: unknown): string {
  return serializeValue(value);
}

/**
 * Compute SHA-256 hex digest of the JCS-canonicalized value.
 *
 * Returns a 64-character lowercase hex string.
 * Deterministic: identical values (regardless of original key order) produce identical hashes.
 * Throws on the same inputs that canonicalizeJCS throws on.
 */
export function canonicalJCSHash(value: unknown): string {
  const canonical = canonicalizeJCS(value);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
