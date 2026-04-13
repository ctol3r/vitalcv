import { describe, it, expect } from "vitest";
import { sourceRank, RANK } from "../priority";
import type { Source } from "../types";

describe("sourceRank", () => {
  it("STATE has the highest rank", () => {
    expect(sourceRank("STATE")).toBe(3);
  });

  it("NPPES is second", () => {
    expect(sourceRank("NPPES")).toBe(2);
  });

  it("USER is third", () => {
    expect(sourceRank("USER")).toBe(1);
  });

  it("RESUME is lowest", () => {
    expect(sourceRank("RESUME")).toBe(0);
  });

  it("maintains strict ordering STATE > NPPES > USER > RESUME", () => {
    expect(sourceRank("STATE")).toBeGreaterThan(sourceRank("NPPES"));
    expect(sourceRank("NPPES")).toBeGreaterThan(sourceRank("USER"));
    expect(sourceRank("USER")).toBeGreaterThan(sourceRank("RESUME"));
  });
});

describe("RANK exhaustiveness", () => {
  it("covers all Source values", () => {
    const allSources: Source[] = ["STATE", "NPPES", "USER", "RESUME"];
    for (const source of allSources) {
      expect(RANK[source]).toBeDefined();
      expect(typeof RANK[source]).toBe("number");
    }
  });
});
