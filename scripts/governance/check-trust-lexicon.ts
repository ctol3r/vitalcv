#!/usr/bin/env tsx
/**
 * check-trust-lexicon.ts — VitalCV constitutional governance CI enforcement.
 *
 * Doctrine: docs/ops/TRUST_GUARANTEE_LEXICON.md §1
 *           docs/ops/semantic-drift-detection.md §2
 *           docs/ops/constitutional-enforcement-matrix.md
 *
 * Scans apps/ + packages/ + docs/ for forbidden trust-language phrases.
 * Fails CI on violation. Emits machine-readable JSON + human-readable summary.
 *
 * Allowlist: docs/ops/trust-language-allowlist.txt (optional; per-line entries).
 *
 * Usage:
 *   pnpm tsx scripts/governance/check-trust-lexicon.ts
 *   pnpm tsx scripts/governance/check-trust-lexicon.ts --json > report.json
 *   pnpm tsx scripts/governance/check-trust-lexicon.ts --paths apps/web
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Inlined here to avoid build-order dependency on @vitalcv/governance-runtime
// (CI runs this BEFORE the package builds). The list MUST match
// packages/governance-runtime/src/registry.ts FORBIDDEN_LEXICON_PHRASES.
// A consistency test in the registry's __tests__ verifies alignment.
const FORBIDDEN_PHRASES: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bnon[\s-]?repudiab(le|ility)\b/i, label: "non-repudiable" },
  { pattern: /\bnon[\s-]?repudiation\b/i, label: "non-repudiation" },
  { pattern: /\bcryptographically[\s-]?guarantee[ds]?\b/i, label: "cryptographically guaranteed" },
  { pattern: /\breplay[\s-]?protect(ed|ion)\b/i, label: "replay protected" },
  { pattern: /\breplay[\s-]?resistan(t|ce)\b/i, label: "replay-resistant" },
  { pattern: /\bsigned[\s-]?mutation(s)?\b/i, label: "signed mutation" },
  { pattern: /\btamper[\s-]?proof\b/i, label: "tamper-proof" },
  { pattern: /\btrustless\b/i, label: "trustless" },
  { pattern: /\bprovably[\s-]?secure\b/i, label: "provably secure" },
  { pattern: /\bguaranteed[\s-]?dedup\b/i, label: "guaranteed dedup" },
  { pattern: /\batomic[\s-]?idempoten(cy|t)\b/i, label: "atomic idempotency" },
  { pattern: /\bcryptographically[\s-]?attest(ed|ation)\b/i, label: "cryptographically attested" },
  { pattern: /\bMerkle[\s-]?(audit|anchored)\b/, label: "Merkle audit/anchored" },
];

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly phrase: string;
  readonly context: string;
}

interface AllowlistEntry {
  readonly filePath: string; // glob-like: exact match OR prefix-with-trailing-slash
  readonly phraseLabel: string;
  readonly reason: string;
}

interface ScanReport {
  readonly scannedFiles: number;
  readonly scannedPaths: readonly string[];
  readonly violations: readonly Violation[];
  readonly allowlistedHits: number;
  readonly version: 1;
}

const REPO_ROOT = resolve(__dirname, "..", "..");

const DEFAULT_SCAN_ROOTS: readonly string[] = [
  "apps",
  "packages",
  "docs/ops",
];

const SCAN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".mdx",
]);

const EXCLUDE_DIR_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "_archive", // archived code per docs/ops/vitalcv-public-claims-matrix.md skipped-list
]);

/**
 * Allowlisted file paths — these files are ALLOWED to contain forbidden phrases
 * for documented reasons (test sentinels, lexicon definitions, governance docs
 * that discuss the phrases, OAuth/DPoP context, frozen YC MVP code).
 *
 * Per docs/ops/w2-pr4b-trust-language-enforcement.md §3.2 + §3.3.
 *
 * Format: prefix-match. If a violation's file path startsWith an entry, it's
 * allowlisted.
 */
const ALLOWLIST_PATH_PREFIXES: readonly AllowlistEntry[] = Object.freeze([
  // Frozen YC MVP audit-event enum
  { filePath: "packages/audit/AuditEvent.ts", phraseLabel: "non-repudiation", reason: "Frozen YC MVP — Set literal of audit event types" },
  { filePath: "packages/audit/AuditScrapbook.ts", phraseLabel: "non-repudiation", reason: "Scrapbook switches on canonical event types" },
  // Frozen test descriptions
  { filePath: "packages/domain-common/__tests__/adversarial.frozen.test.ts", phraseLabel: "non-repudiation", reason: "Frozen test category description" },
  // Code comments grandfathered for canonical-event documentation
  { filePath: "apps/api/backend/src/routes/employerActions.ts", phraseLabel: "non-repudiation", reason: "Documents START_ATTESTED canonical event" },
  { filePath: "apps/api/backend/src/services/audit/auditService.ts", phraseLabel: "non-repudiation", reason: "Documents canonical events architecture" },
  { filePath: "apps/api/backend/src/services/ingest/ingestOrchestrator.ts", phraseLabel: "non-repudiation", reason: "Documents NPI_INGESTED canonical event" },
  { filePath: "apps/api/backend/src/routes/passportEntity.ts", phraseLabel: "non-repudiation", reason: "Documents PASSPORT_SHARED canonical event" },
  { filePath: "apps/api/backend/src/routes/employer-action.ts", phraseLabel: "non-repudiable", reason: "Code comment grandfathered" },
  { filePath: "apps/web/lib/crypto/receiptCandidateSigner.ts", phraseLabel: "non-repudiation", reason: "Documents intended TRUST-PERSIST-1 capability" },
  // Test sentinels for negation tests (the tests assert phrase absent from production)
  { filePath: "apps/web/__tests__/foundation-sweep-2.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/__tests__/foundation-sweep-3.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/__tests__/foundation-sweep-4.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/__tests__/foundation-sweep-5.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/__tests__/foundation-sweep-6-analytics-status.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/__tests__/clinician-profile-foundation.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/__tests__/passport-copy-truth.test.ts", phraseLabel: "tamper-proof", reason: "Negation test sentinel" },
  { filePath: "apps/web/lib/source-health/unavailableLane.ts", phraseLabel: "tamper-proof", reason: "BANNED_USER_FACING_PHRASES sentinel literal" },
  { filePath: "apps/web/lib/source-health/README.md", phraseLabel: "tamper-proof", reason: "Banned-list documentation" },
  // Doctrine docs that DEFINE the forbidden phrases
  { filePath: "docs/ops/TRUST_GUARANTEE_LEXICON.md", phraseLabel: "*", reason: "Defines all forbidden phrases" },
  { filePath: "docs/ops/vitalcv-public-claims-matrix.md", phraseLabel: "*", reason: "Defines bans" },
  { filePath: "docs/ops/audit-event-vocabulary-map.md", phraseLabel: "*", reason: "Discusses vocabulary" },
  { filePath: "docs/ops/replay-taxonomy-map.md", phraseLabel: "*", reason: "Discusses replay vocabulary" },
  { filePath: "docs/ops/operational-alias-layer.md", phraseLabel: "*", reason: "Discusses aliases including forbidden patterns" },
  { filePath: "docs/ops/canonical-query-model.md", phraseLabel: "*", reason: "Query model references forbidden phrases" },
  { filePath: "docs/ops/export-query-cohesion.md", phraseLabel: "*", reason: "Discusses forbidden phrases" },
  // Wave-prefix docs that discuss forbidden phrases adversarially
  { filePath: "docs/ops/w2-pr2c-", phraseLabel: "*", reason: "W2-PR2C governance review references phrases" },
  { filePath: "docs/ops/w2-pr3b-", phraseLabel: "*", reason: "W2-PR3B governance review references phrases" },
  { filePath: "docs/ops/w2-pr4b-", phraseLabel: "*", reason: "W2-PR4B governance review references phrases" },
  { filePath: "docs/ops/w2-pr5a-", phraseLabel: "*", reason: "W2-PR5A certification references phrases" },
  { filePath: "docs/ops/w2-pr6a-", phraseLabel: "*", reason: "W2-PR6A certification references phrases" },
  { filePath: "docs/ops/w2-pr7a-", phraseLabel: "*", reason: "W2-PR7A lineage convergence references phrases" },
  { filePath: "docs/ops/w2-pr9a-", phraseLabel: "*", reason: "W2-PR9A survivability references phrases" },
  { filePath: "docs/ops/w2-pr10a-", phraseLabel: "*", reason: "W2-PR10A trust-class references phrases" },
  { filePath: "docs/ops/w2-pr11a-", phraseLabel: "*", reason: "W2-PR11A enforcement references phrases" },
  { filePath: "docs/ops/w2-pr12a-", phraseLabel: "*", reason: "W2-PR12A monitoring references phrases" },
  { filePath: "docs/ops/w2-pr13a-", phraseLabel: "*", reason: "W2-PR13A breach simulation references phrases" },
  { filePath: "docs/ops/w2-pr14a-", phraseLabel: "*", reason: "W2-PR14A containment references phrases" },
  { filePath: "docs/ops/w2-pr15a-", phraseLabel: "*", reason: "W2-PR15A human governance references phrases" },
  { filePath: "docs/ops/w2-pr16a-", phraseLabel: "*", reason: "W2-PR16A institutional persistence references phrases" },
  { filePath: "docs/ops/constitutional-", phraseLabel: "*", reason: "Constitutional governance docs reference phrases" },
  { filePath: "docs/ops/survivability-inflation-audit.md", phraseLabel: "*", reason: "Audits inflation patterns" },
  { filePath: "docs/ops/dashboard-governance-enforcement.md", phraseLabel: "*", reason: "Discusses forbidden lexicon" },
  { filePath: "docs/ops/codex-constitutional-prompt-layer.md", phraseLabel: "*", reason: "Codex prompt references all 7 phrases" },
  { filePath: "docs/ops/semantic-drift-detection.md", phraseLabel: "*", reason: "Defines detection regex" },
  { filePath: "docs/ops/governance-knowledge-survivability.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/governance-context-recovery.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/operator-overconfidence-review.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/governance-erosion-escalation.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/human-governance-failure-taxonomy.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/institutional-memory-failure-taxonomy.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/constitutional-doctrine-persistence.md", phraseLabel: "*", reason: "References phrases" },
  { filePath: "docs/ops/MUTATION_GATE_SEQUENCE.md", phraseLabel: "*", reason: "References canonical event semantics" },
  { filePath: "docs/ops/AUTHORIZATION_BASELINE_V1.md", phraseLabel: "*", reason: "References lexicon" },
  // CRED0 doctrine doc — flagged for cleanup (per W2-PR4B inflation register)
  { filePath: "docs/CRED0_DOCTRINE.md", phraseLabel: "non-repudiable", reason: "CONTEXTUALLY UNSAFE per W2-PR4B; cleanup-wave target" },
  // OAuth/DPoP context — replay protection is the real cryptographic primitive
  { filePath: "apps/authz/", phraseLabel: "replay protected", reason: "OAuth 2.0/DPoP context — RFC 9449 mechanism" },
  { filePath: "apps/authz/", phraseLabel: "replay-resistant", reason: "Same" },
  { filePath: "apps/docs/api-security-profiles.md", phraseLabel: "replay protected", reason: "OAuth/DPoP nonce documentation" },
  { filePath: "apps/api/backend/src/services/oid4vp/", phraseLabel: "replay protected", reason: "OID4VP nonce" },
  { filePath: "docs/certification/", phraseLabel: "replay protected", reason: "OAuth conformance docs" },
  { filePath: "docs/plans/2026-02-24-auth-rbac-implementation.md", phraseLabel: "replay protected", reason: "OAuth-RBAC planning" },
  // Truthful negation example
  { filePath: "packages/trust-contract/src/system-coherence.ts", phraseLabel: "cryptographically guaranteed", reason: "Truthful disclaimer ('cannot be guaranteed')" },
  // Archive cleanup-wave target
  { filePath: "apps/web/app/_archive/", phraseLabel: "*", reason: "Archived; cleanup-wave target" },
  // The CI script itself (this file) lists the phrases as detection patterns
  { filePath: "scripts/governance/check-trust-lexicon.ts", phraseLabel: "*", reason: "Script defines the patterns" },
  // The package's registry that defines patterns + tests for them
  { filePath: "packages/governance-runtime/", phraseLabel: "*", reason: "Defines registry + tests forbidden patterns" },
  // UI primitives that DOCUMENT the forbidden phrases inside JSDoc comments
  { filePath: "apps/web/components/governance/ReplayWarning.tsx", phraseLabel: "*", reason: "UI primitive documents lexicon §1.3 forbidden phrases in JSDoc" },
  // Pre-existing domain-events module — `nonRepudiation` is a TypeScript module
  // name (case-sensitive). Case-insensitive regex matches the structural import,
  // not user-facing claim language. Cleanup optional via future module rename.
  { filePath: "packages/domain-events/", phraseLabel: "non-repudiation", reason: "Pre-existing TypeScript module name; structural import, not claim language" },
  // Pre-existing copy-truth test sentinel
  { filePath: "apps/web/__tests__/passport-copy-truth.test.ts", phraseLabel: "*", reason: "Negation-test sentinels for forbidden phrasings" },
]);

function isAllowlisted(violation: Violation): boolean {
  for (const entry of ALLOWLIST_PATH_PREFIXES) {
    if (
      violation.file.startsWith(entry.filePath) &&
      (entry.phraseLabel === "*" || entry.phraseLabel === violation.phrase)
    ) {
      return true;
    }
  }
  return false;
}

function* walkDir(dir: string): Generator<string> {
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (EXCLUDE_DIR_NAMES.has(entry)) continue;
      const full = join(current, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile()) {
        const dotIdx = entry.lastIndexOf(".");
        if (dotIdx === -1) continue;
        const ext = entry.slice(dotIdx);
        if (SCAN_EXTENSIONS.has(ext)) {
          yield full;
        }
      }
    }
  }
}

function scanFile(absPath: string): Violation[] {
  const violations: Violation[] = [];
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return violations;
  }

  const relPath = relative(REPO_ROOT, absPath);
  const lines = content.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    for (const { pattern, label } of FORBIDDEN_PHRASES) {
      const match = pattern.exec(line);
      if (match !== null) {
        const column = match.index;
        violations.push({
          file: relPath,
          line: lineIdx + 1,
          column: column + 1,
          phrase: label,
          context: line.trim().slice(0, 200),
        });
        // Only report ONE phrase-hit per line per pattern (avoid noise from regex iteration)
      }
    }
  }
  return violations;
}

function parseArgs(): { paths: readonly string[]; jsonOutput: boolean } {
  const args = process.argv.slice(2);
  const paths: string[] = [];
  let jsonOutput = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--json") {
      jsonOutput = true;
    } else if (a === "--paths") {
      const next = args[i + 1];
      if (typeof next === "string" && next.length > 0 && !next.startsWith("--")) {
        paths.push(...next.split(",").map((p) => p.trim()).filter((p) => p.length > 0));
        i++;
      }
    }
  }
  return { paths, jsonOutput };
}

function main(): void {
  const args = parseArgs();
  const scanRoots = args.paths.length > 0 ? args.paths : DEFAULT_SCAN_ROOTS;

  const rawViolations: Violation[] = [];
  let scannedFiles = 0;

  for (const rootRel of scanRoots) {
    const rootAbs = join(REPO_ROOT, rootRel);
    if (!existsSync(rootAbs)) {
      if (!args.jsonOutput) {
        console.error(`[skip] ${rootRel}: does not exist`);
      }
      continue;
    }
    for (const file of walkDir(rootAbs)) {
      scannedFiles += 1;
      const found = scanFile(file);
      rawViolations.push(...found);
    }
  }

  let allowlistedCount = 0;
  const violations: Violation[] = [];
  for (const v of rawViolations) {
    if (isAllowlisted(v)) {
      allowlistedCount += 1;
    } else {
      violations.push(v);
    }
  }

  const report: ScanReport = {
    scannedFiles,
    scannedPaths: scanRoots,
    violations,
    allowlistedHits: allowlistedCount,
    version: 1,
  };

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[trust-lexicon] Scanned ${scannedFiles} files in: ${scanRoots.join(", ")}`);
    console.log(`[trust-lexicon] Allowlisted hits: ${allowlistedCount}`);
    console.log(`[trust-lexicon] Violations: ${violations.length}`);
    if (violations.length > 0) {
      console.log("");
      console.log("=== FORBIDDEN PHRASE VIOLATIONS ===");
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line}:${v.column} — "${v.phrase}"`);
        console.log(`    ${v.context}`);
      }
      console.log("");
      console.log("Substitutions: see docs/ops/operational-alias-layer.md §11 quick-reference");
      console.log("Allowlist additions require founder + Codex SAFE per TRUST_GUARANTEE_LEXICON.md §6");
    }
  }

  if (violations.length > 0) {
    process.exit(1);
  }
}

main();
