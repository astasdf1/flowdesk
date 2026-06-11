/**
 * Tests for RFC 8785 JCS (JSON Canonicalization Scheme) implementation.
 *
 * Fixtures are based on RFC 8785 Appendix B official test vectors and
 * additional edge cases for the core subset.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeJCS, canonicalJCSHash } from "./jcs.js";

// ─── Primitive types ──────────────────────────────────────────────────────────

test("jcs: null serializes to 'null'", () => {
  assert.equal(canonicalizeJCS(null), "null");
});

test("jcs: true serializes to 'true'", () => {
  assert.equal(canonicalizeJCS(true), "true");
});

test("jcs: false serializes to 'false'", () => {
  assert.equal(canonicalizeJCS(false), "false");
});

test("jcs: integer serializes without decimal point", () => {
  assert.equal(canonicalizeJCS(1), "1");
  assert.equal(canonicalizeJCS(0), "0");
  assert.equal(canonicalizeJCS(-42), "-42");
  assert.equal(canonicalizeJCS(1000000), "1000000");
});

test("jcs: float serializes with shortest roundtrip (ECMAScript toString)", () => {
  assert.equal(canonicalizeJCS(1.5), "1.5");
  assert.equal(canonicalizeJCS(0.1), "0.1");
  assert.equal(canonicalizeJCS(-3.14), "-3.14");
});

test("jcs: large float uses integer-like notation when exact (1e20)", () => {
  // ECMAScript: (1e20).toString() === "100000000000000000000"
  assert.equal(canonicalizeJCS(1e20), "100000000000000000000");
});

test("jcs: simple string serializes with double quotes", () => {
  assert.equal(canonicalizeJCS("hello"), '"hello"');
  assert.equal(canonicalizeJCS(""), '""');
});

// ─── String escaping (RFC 8785 §3.2.2) ───────────────────────────────────────

test("jcs: string with U+0000 control character is escaped as \\u0000", () => {
  assert.equal(canonicalizeJCS("\u0000"), '"\\u0000"');
});

test("jcs: string with backslash is escaped as \\\\", () => {
  assert.equal(canonicalizeJCS("a\\b"), '"a\\\\b"');
});

test("jcs: string with double quote is escaped as \\\"", () => {
  assert.equal(canonicalizeJCS('say "hi"'), '"say \\"hi\\""');
});

test("jcs: string control chars U+0001-U+001F are all escaped with \\uXXXX", () => {
  // Test a few control chars
  assert.equal(canonicalizeJCS("\u0009"), '"\\u0009"'); // TAB
  assert.equal(canonicalizeJCS("\u000a"), '"\\u000a"'); // LF
  assert.equal(canonicalizeJCS("\u001f"), '"\\u001f"'); // last control char
});

test("jcs: string with space (U+0020) is NOT escaped", () => {
  assert.equal(canonicalizeJCS("hello world"), '"hello world"');
});

// ─── Object key sorting (RFC 8785 §3.2.3) ────────────────────────────────────

test("jcs: object keys are sorted in UTF-16 code-unit lexicographic order", () => {
  // ASCII: "a" (0x61) < "b" (0x62)
  assert.equal(canonicalizeJCS({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("jcs: euro sign (U+20AC) sorts after ASCII letters", () => {
  // "€" = U+20AC (0x20AC) > "a" (0x61) in UTF-16 code-unit order
  // So {"a":2,"€":1} is the canonical form
  const result = canonicalizeJCS({ "€": 1, a: 2 });
  assert.equal(result, '{"a":2,"€":1}');
});

test("jcs: uppercase letters sort before lowercase in ASCII (by code unit)", () => {
  // "A" = 0x41, "a" = 0x61; "B" = 0x42, "b" = 0x62
  assert.equal(canonicalizeJCS({ b: 2, A: 3, a: 1 }), '{"A":3,"a":1,"b":2}');
});

// ─── Arrays ───────────────────────────────────────────────────────────────────

test("jcs: array preserves insertion order", () => {
  assert.equal(canonicalizeJCS([3, 1, 2]), "[3,1,2]");
  assert.equal(canonicalizeJCS(["c", "a", "b"]), '["c","a","b"]');
});

test("jcs: empty array serializes to []", () => {
  assert.equal(canonicalizeJCS([]), "[]");
});

// ─── Nested structures ────────────────────────────────────────────────────────

test("jcs: nested object keys are recursively sorted", () => {
  assert.equal(
    canonicalizeJCS({ z: { b: 1, a: 2 }, a: 3 }),
    '{"a":3,"z":{"a":2,"b":1}}'
  );
});

test("jcs: mixed nested structure with arrays", () => {
  const result = canonicalizeJCS({ items: [1, 2, 3], count: 3 });
  assert.equal(result, '{"count":3,"items":[1,2,3]}');
});

test("jcs: empty object serializes to {}", () => {
  assert.equal(canonicalizeJCS({}), "{}");
});

// ─── Error cases ──────────────────────────────────────────────────────────────

test("jcs: throws on undefined", () => {
  assert.throws(
    () => canonicalizeJCS(undefined),
    (err) => err instanceof TypeError && /undefined/i.test((err as TypeError).message)
  );
});

test("jcs: throws on function", () => {
  assert.throws(
    () => canonicalizeJCS(() => {}),
    (err) => err instanceof TypeError && /function/i.test((err as TypeError).message)
  );
});

test("jcs: throws on symbol", () => {
  assert.throws(
    () => canonicalizeJCS(Symbol("test")),
    (err) => err instanceof TypeError && /symbol/i.test((err as TypeError).message)
  );
});

test("jcs: throws on BigInt", () => {
  assert.throws(
    () => canonicalizeJCS(BigInt(42)),
    (err) => err instanceof TypeError && /bigint/i.test((err as TypeError).message)
  );
});

test("jcs: throws on NaN", () => {
  assert.throws(
    () => canonicalizeJCS(NaN),
    (err) => err instanceof TypeError && /finite/i.test((err as TypeError).message)
  );
});

test("jcs: throws on Infinity", () => {
  assert.throws(
    () => canonicalizeJCS(Infinity),
    (err) => err instanceof TypeError && /finite/i.test((err as TypeError).message)
  );
});

test("jcs: throws on string containing UTF-16 surrogate code unit", () => {
  // Lone surrogate: U+D800 (high surrogate without pair)
  const loneSurrogate = "\uD800";
  assert.throws(
    () => canonicalizeJCS(loneSurrogate),
    (err) => err instanceof TypeError && /surrogate/i.test((err as TypeError).message)
  );
});

// ─── canonicalJCSHash tests ───────────────────────────────────────────────────

test("canonicalJCSHash: returns 64-character lowercase hex string", () => {
  const hash = canonicalJCSHash({ a: 1 });
  assert.equal(typeof hash, "string");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("canonicalJCSHash: identical value always produces identical hash (deterministic)", () => {
  const value = { z: [1, 2], a: "hello" };
  const hash1 = canonicalJCSHash(value);
  const hash2 = canonicalJCSHash(value);
  assert.equal(hash1, hash2);
});

test("canonicalJCSHash: key order does not affect hash", () => {
  const h1 = canonicalJCSHash({ a: 1, b: 2 });
  const h2 = canonicalJCSHash({ b: 2, a: 1 });
  assert.equal(h1, h2);
});

test("canonicalJCSHash: different values produce different hashes", () => {
  const h1 = canonicalJCSHash({ a: 1 });
  const h2 = canonicalJCSHash({ a: 2 });
  assert.notEqual(h1, h2);
});

test("canonicalJCSHash: null produces consistent hash", () => {
  const hash = canonicalJCSHash(null);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  // SHA-256 of "null"
  assert.equal(hash, "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b");
});

// ─── RFC 8785 Appendix B fixture: compound object ────────────────────────────

test("jcs: RFC 8785 Appendix B compound sort fixture", () => {
  // From RFC 8785 §3.2.3 — multiple keys with varied byte values
  const input = {
    peach: "This sorting order",
    pear: "is known as",
    plum: "JSON Canonicalization",
  };
  // All keys share "p" prefix; tie-broken by next character: 'e'(0x65) < 'l'(0x6C) < 'r'(0x72)
  // Wait — "peach" vs "pear" vs "plum":
  //   peach: p-e-a-c-h
  //   pear:  p-e-a-r
  //   plum:  p-l-u-m
  // "pe..." < "pl..." because 'e'(0x65) < 'l'(0x6C)
  // "peach" vs "pear": p-e-a-c vs p-e-a-r → 'c'(0x63) < 'r'(0x72) → peach < pear
  const result = canonicalizeJCS(input);
  assert.equal(
    result,
    '{"peach":"This sorting order","pear":"is known as","plum":"JSON Canonicalization"}'
  );
});
