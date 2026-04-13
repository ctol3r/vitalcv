import { describe, it, expect } from "vitest";
import { canonicalize, canonicalEqual } from "../canonicalize";

describe("canonicalize", () => {
  it("trims and lowercases strings", () => {
    expect(canonicalize("  HELLO World  ")).toBe("hello world");
  });

  it("leaves numbers unchanged", () => {
    expect(canonicalize(42)).toBe(42);
    expect(canonicalize(0)).toBe(0);
    expect(canonicalize(-3.14)).toBe(-3.14);
  });

  it("leaves booleans unchanged", () => {
    expect(canonicalize(true)).toBe(true);
    expect(canonicalize(false)).toBe(false);
  });

  it("leaves null unchanged", () => {
    expect(canonicalize(null)).toBe(null);
  });

  it("sorts array elements after canonicalizing them", () => {
    expect(canonicalize(["NY", "CA"])).toEqual(["ca", "ny"]);
    expect(canonicalize(["B", "a", "C"])).toEqual(["a", "b", "c"]);
  });

  it("sorts object keys and canonicalizes values", () => {
    const input = { city: "  Springfield ", street: "123 MAIN ST" };
    const expected = { city: "springfield", street: "123 main st" };
    expect(canonicalize(input)).toEqual(expected);
  });

  it("sorts object keys alphabetically regardless of input order", () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(JSON.stringify(canonicalize(a))).toBe(JSON.stringify(canonicalize(b)));
  });

  it("handles nested objects", () => {
    const input = { address: { zip: "12345", city: "  NYC  " }, name: "SMITH" };
    const expected = { address: { city: "nyc", zip: "12345" }, name: "smith" };
    expect(canonicalize(input)).toEqual(expected);
  });

  it("handles nested arrays in objects", () => {
    const input = { states: ["NY", "CA"], name: "SMITH" };
    const expected = { name: "smith", states: ["ca", "ny"] };
    expect(canonicalize(input)).toEqual(expected);
  });

  it("returns undefined for undefined input", () => {
    expect(canonicalize(undefined)).toBe(undefined);
  });

  describe("idempotence", () => {
    const samples: unknown[] = [
      "Hello World",
      42,
      true,
      null,
      ["NY", "CA", "TX"],
      { b: 2, a: 1 },
      { address: { zip: "12345", city: "NYC" }, states: ["NY", "CA"] },
      "  PADDED  ",
      "",
      0,
      [],
      {},
    ];

    for (const sample of samples) {
      it(`canonicalize(canonicalize(${JSON.stringify(sample)})) === canonicalize(${JSON.stringify(sample)})`, () => {
        const once = canonicalize(sample);
        const twice = canonicalize(once);
        expect(twice).toEqual(once);
      });
    }
  });
});

describe("canonicalEqual", () => {
  it("returns true for identical primitives", () => {
    expect(canonicalEqual("hello", "hello")).toBe(true);
    expect(canonicalEqual(42, 42)).toBe(true);
    expect(canonicalEqual(null, null)).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(canonicalEqual("hello", "world")).toBe(false);
    expect(canonicalEqual(1, 2)).toBe(false);
  });

  it("returns true for deeply equal objects", () => {
    expect(canonicalEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it("returns false for different objects", () => {
    expect(canonicalEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns true for identical arrays", () => {
    expect(canonicalEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("returns false for different arrays", () => {
    expect(canonicalEqual([1, 2], [2, 1])).toBe(false);
  });
});
