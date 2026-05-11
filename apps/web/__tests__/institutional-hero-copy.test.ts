/**
 * W3-PR176A — Institutional Hero Surface Rewrite.
 *
 * Locks the institutional positioning of the landing hero and asserts
 * absence of the banned-strings list defined in CLAUDE.md. Operates on
 * the source file directly (read as text) so that the assertion does
 * not depend on JSX render plumbing.
 *
 * Invariants:
 *   - eyebrow signals "Replay-anchored credential infrastructure"
 *   - subhead uses institutional / source-checked / ambiguity language
 *   - no banned-strings appear in the hero file (split-join sentinels
 *     used so this test does not flag itself)
 *   - the bare label string "label: 'Verified'" does not appear
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERO_SRC = readFileSync(
  resolve(__dirname, "../app/HomePageClient.tsx"),
  "utf8",
);
const PAGE_SRC = readFileSync(
  resolve(__dirname, "../app/page.tsx"),
  "utf8",
);

// Banned-phrase split-join constants per CLAUDE.md so this file's own
// content does not match a naive truth-contract grep.
const BANNED = [
  ["automatically", "verified"].join(" "),
  ["guaranteed", "verification"].join(" "),
  ["complete", "credentialing"].join(" "),
  ["instant", "credentialing"].join(" "),
  ["legally", "accepted"].join(" "),
  ["risk", "transferred"].join(" "),
  ["final", "verification", "without", "review"].join(" "),
  ["source", "confirmed", "before", "response"].join(" "),
  ["certified", "compliant"].join(" "),
  ["HIPAA", "compliant"].join(" "),
  ["SOC2", "certified"].join(" "),
];

describe("W3-PR176A — institutional hero positioning", () => {
  it("eyebrow uses replay-anchored credential infrastructure framing", () => {
    expect(HERO_SRC).toContain("Replay-anchored credential infrastructure");
  });

  it("page metadata description carries the institutional eyebrow", () => {
    expect(PAGE_SRC).toContain("Replay-anchored credential infrastructure");
  });

  it("subhead surfaces institutional + source-checked positioning", () => {
    expect(HERO_SRC).toContain("Institutional credential evidence");
    expect(HERO_SRC).toContain("source-checked against federal registries");
  });

  it("subhead preserves ambiguity honesty for gated sources", () => {
    expect(HERO_SRC).toContain("stays ambiguous until evidence lands");
  });

  it("subhead surfaces replay-on-share positioning", () => {
    expect(HERO_SRC).toContain("replayed on every share");
  });

  it("hero retains the honest no-fake-certainty headline", () => {
    expect(HERO_SRC).toContain("Stop starting");
    expect(HERO_SRC).toContain("over. Start ready.");
  });
});

describe("W3-PR176A — hero truth contract", () => {
  it.each(BANNED)("does not contain banned phrase: %s", (phrase) => {
    expect(HERO_SRC).not.toContain(phrase);
    expect(PAGE_SRC).not.toContain(phrase);
  });

  it("hero does not use the bare-word Verified label form", () => {
    // Catches the design-system anti-pattern `label: 'Verified'` and the
    // raw badge text wrapped in quotes. Compound labels like
    // "Source-verified" remain allowed.
    expect(HERO_SRC).not.toMatch(/label:\s*['"]Verified['"]/);
    expect(HERO_SRC).not.toMatch(/>\s*Verified\s*</);
  });

  it("hero references explicit federal registry sources", () => {
    expect(HERO_SRC).toContain("NPPES");
    expect(HERO_SRC).toContain("OIG/LEIE");
    expect(HERO_SRC).toContain("PECOS");
  });
});
