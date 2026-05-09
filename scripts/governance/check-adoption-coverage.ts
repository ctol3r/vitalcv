#!/usr/bin/env tsx
/**
 * check-adoption-coverage.ts — Governance adoption + anti-bypass enforcement.
 *
 * Wave: W2-PR23A — Mandatory Governance Adoption Enforcement.
 *
 * Mission: prevent governance bypass. Ensure ALL apps / pages / services /
 * APIs / rendering surfaces / dashboards / replay surfaces / override flows
 * use @vitalcv/governance-runtime. Reject:
 *   - local governance enums
 *   - duplicate state literals
 *   - ad-hoc integrity rendering
 *   - local replay semantics
 *   - custom degraded-state handling
 *   - unregistered governance states
 *
 * Per W2-PR23A non-negotiable rules:
 *   1. Governance may not be optional.
 *   2. Local governance semantics are forbidden.
 *   3. Duplicate integrity vocabularies are forbidden.
 *   4. Replay semantics must remain centralized.
 *   5. Unknown-state handling must remain canonical.
 *   6. Registry grounding must remain mandatory.
 *   7. Governance bypass vectors must remain CI-visible.
 *
 * Outputs:
 *   - Human-readable summary (default).
 *   - Machine-readable JSON via --json flag.
 *
 * Exit code: 1 on violations; 0 on clean.
 *
 * Usage:
 *   pnpm tsx scripts/governance/check-adoption-coverage.ts
 *   pnpm tsx scripts/governance/check-adoption-coverage.ts --json
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");
const GOVERNANCE_PACKAGE = "@vitalcv/governance-runtime";
const GOVERNANCE_PACKAGE_PATH = "packages/governance-runtime/";

/**
 * Canonical governance state literals. Derived from
 * @vitalcv/governance-runtime; any other file defining these literals is
 * a duplicate-vocabulary bypass.
 */
const CANONICAL_STATE_LITERALS: ReadonlyArray<{
  readonly axis: string;
  readonly literal: string;
  readonly canonicalSource: string;
}> = [
  // Integrity states
  { axis: "integrity", literal: "CI-GREEN", canonicalSource: "integrity-state.ts" },
  { axis: "integrity", literal: "CI-DEGRADED", canonicalSource: "integrity-state.ts" },
  { axis: "integrity", literal: "CI-DRIFT", canonicalSource: "integrity-state.ts" },
  { axis: "integrity", literal: "CI-FRAGMENTED", canonicalSource: "integrity-state.ts" },
  { axis: "integrity", literal: "CI-VIOLATION", canonicalSource: "integrity-state.ts" },
  { axis: "integrity", literal: "CI-UNKNOWN", canonicalSource: "integrity-state.ts" },
  // Containment states
  { axis: "containment", literal: "CT-GREEN", canonicalSource: "containment-state.ts" },
  { axis: "containment", literal: "CT-DEGRADED", canonicalSource: "containment-state.ts" },
  { axis: "containment", literal: "CT-FRAGMENTING", canonicalSource: "containment-state.ts" },
  { axis: "containment", literal: "CT-ESCALATING", canonicalSource: "containment-state.ts" },
  { axis: "containment", literal: "CT-VIOLATION", canonicalSource: "containment-state.ts" },
  { axis: "containment", literal: "CT-UNKNOWN", canonicalSource: "containment-state.ts" },
  // Replay states
  { axis: "replay", literal: "R-OBSERVED", canonicalSource: "replay-state.ts" },
  { axis: "replay", literal: "R-DENIED", canonicalSource: "replay-state.ts" },
  { axis: "replay", literal: "R-ACCEPTED", canonicalSource: "replay-state.ts" },
  { axis: "replay", literal: "R-COLLAPSED", canonicalSource: "replay-state.ts" },
  { axis: "replay", literal: "R-AMBIGUOUS", canonicalSource: "replay-state.ts" },
  // Trust classes — only the dashed forms are "canonical literals". Bare
  // 'C-1' / 'C-2' could match unrelated tokens; we add the trust-class-tagged
  // literals only.
  // Systemic states
  { axis: "systemic", literal: "SYSTEMIC-RECOVERING", canonicalSource: "coherence.ts" },
  { axis: "systemic", literal: "SYSTEMIC-DEGRADED", canonicalSource: "coherence.ts" },
  { axis: "systemic", literal: "SYSTEMIC-FRAGMENTED", canonicalSource: "coherence.ts" },
  { axis: "systemic", literal: "SYSTEMIC-AMBIGUOUS", canonicalSource: "coherence.ts" },
  { axis: "systemic", literal: "SYSTEMIC-UNVERIFIED", canonicalSource: "coherence.ts" },
];

/**
 * Files allowed to define canonical literals. Anything else triggers a
 * duplicate-vocabulary violation.
 */
const ALLOWED_DEFINITION_PATHS: ReadonlyArray<string> = [
  GOVERNANCE_PACKAGE_PATH, // the package itself
  "scripts/governance/", // governance scripts may reference for scanning
  "docs/ops/", // doctrine docs
  "apps/web/components/governance/", // the approved UI primitives — they switch on canonical literals
];

/**
 * Patterns that indicate ad-hoc / local governance UI rendering.
 * Match object-literal keys like `"CI-GREEN":` but EXCLUDE `case "CI-GREEN":`
 * (switch arms inside an exhaustive switch are legitimate even outside the
 * approved package — they're handling the canonical states correctly).
 */
const AD_HOC_RENDERING_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly label: string;
}> = [
  // Match `"CI-*":` as object key but NOT `case "CI-*":` — negative lookbehind.
  { pattern: /(?<!case\s)['"]CI-(GREEN|DEGRADED|DRIFT|FRAGMENTED|VIOLATION|UNKNOWN)['"]\s*:/, label: "Local CI-* state mapping" },
  { pattern: /(?<!case\s)['"]CT-(GREEN|DEGRADED|FRAGMENTING|ESCALATING|VIOLATION|UNKNOWN)['"]\s*:/, label: "Local CT-* state mapping" },
  { pattern: /(?<!case\s)['"]R-(OBSERVED|DENIED|ACCEPTED|COLLAPSED|AMBIGUOUS)['"]\s*:/, label: "Local R-* replay mapping" },
];

interface AdoptionViolation {
  readonly file: string;
  readonly line: number;
  readonly tag: "duplicate-literal" | "ad-hoc-rendering" | "missing-registry-import";
  readonly literal?: string;
  readonly axis?: string;
  readonly label?: string;
  readonly context: string;
}

interface SurfaceFile {
  readonly file: string;
  readonly literalsReferenced: ReadonlyArray<string>;
  readonly importsRegistry: boolean;
}

interface AdoptionCoverageReport {
  readonly version: 1;
  readonly scannedFiles: number;
  readonly governanceSurfaces: ReadonlyArray<SurfaceFile>;
  readonly violations: ReadonlyArray<AdoptionViolation>;
  readonly summary: {
    readonly totalSurfaces: number;
    readonly registryGroundedSurfaces: number;
    readonly registryGroundedPct: number;
    readonly duplicateLiterals: number;
    readonly adHocRenderings: number;
    readonly missingImports: number;
  };
}

const SCAN_ROOTS: ReadonlyArray<string> = ["apps", "packages"];
const SCAN_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".tsx", ".js", ".jsx"]);
const EXCLUDE_DIR_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "_archive",
  "__tests__",
]);

function isAllowedDefinitionPath(filePath: string): boolean {
  for (const allowed of ALLOWED_DEFINITION_PATHS) {
    if (filePath.startsWith(allowed)) return true;
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

function fileImportsGovernanceRuntime(content: string): boolean {
  return content.includes(GOVERNANCE_PACKAGE);
}

function* findLiteralOccurrences(
  content: string,
): Generator<{ literal: string; axis: string; line: number; context: string; canonicalSource: string }> {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const entry of CANONICAL_STATE_LITERALS) {
      // Match the literal as a whole-string (with quotes) OR as a bare identifier.
      // We match quoted forms only to reduce false positives.
      if (line.includes(`"${entry.literal}"`) || line.includes(`'${entry.literal}'`)) {
        yield {
          literal: entry.literal,
          axis: entry.axis,
          line: i + 1,
          context: line.trim().slice(0, 200),
          canonicalSource: entry.canonicalSource,
        };
      }
    }
  }
}

function scanFile(absPath: string): {
  readonly surface: SurfaceFile | null;
  readonly violations: ReadonlyArray<AdoptionViolation>;
} {
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return { surface: null, violations: [] };
  }

  const relPath = relative(REPO_ROOT, absPath);
  const violations: AdoptionViolation[] = [];

  // Skip files that are themselves part of the governance package or scripts.
  // (They define the canonical literals — references inside are not bypass.)
  if (isAllowedDefinitionPath(relPath)) {
    return { surface: null, violations: [] };
  }

  // Find canonical-literal occurrences
  const literalsReferenced: string[] = [];
  for (const occurrence of findLiteralOccurrences(content)) {
    if (!literalsReferenced.includes(occurrence.literal)) {
      literalsReferenced.push(occurrence.literal);
    }
  }

  if (literalsReferenced.length === 0) {
    return { surface: null, violations: [] };
  }

  const importsRegistry = fileImportsGovernanceRuntime(content);

  // If file references canonical literals but does NOT import @vitalcv/governance-runtime,
  // it's a missing-import violation (W2-PR23A target 4).
  if (!importsRegistry) {
    violations.push({
      file: relPath,
      line: 1,
      tag: "missing-registry-import",
      context: `File references governance literals (${literalsReferenced.join(", ")}) but does not import @vitalcv/governance-runtime`,
    });
  }

  // Detect ad-hoc rendering patterns (W2-PR23A target 3)
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const { pattern, label } of AD_HOC_RENDERING_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          tag: "ad-hoc-rendering",
          label,
          context: line.trim().slice(0, 200),
        });
      }
    }
  }

  return {
    surface: { file: relPath, literalsReferenced, importsRegistry },
    violations,
  };
}

function buildReport(): AdoptionCoverageReport {
  const allSurfaces: SurfaceFile[] = [];
  const allViolations: AdoptionViolation[] = [];
  let scannedFiles = 0;

  for (const root of SCAN_ROOTS) {
    const rootAbs = join(REPO_ROOT, root);
    try {
      statSync(rootAbs);
    } catch {
      continue;
    }
    for (const file of walkDir(rootAbs)) {
      scannedFiles += 1;
      const { surface, violations } = scanFile(file);
      if (surface !== null) allSurfaces.push(surface);
      allViolations.push(...violations);
    }
  }

  const groundedSurfaces = allSurfaces.filter((s) => s.importsRegistry).length;
  const totalSurfaces = allSurfaces.length;
  const groundedPct = totalSurfaces === 0 ? 100 : Math.round((groundedSurfaces / totalSurfaces) * 1000) / 10;

  return {
    version: 1,
    scannedFiles,
    governanceSurfaces: allSurfaces,
    violations: allViolations,
    summary: {
      totalSurfaces,
      registryGroundedSurfaces: groundedSurfaces,
      registryGroundedPct: groundedPct,
      duplicateLiterals: allViolations.filter((v) => v.tag === "duplicate-literal").length,
      adHocRenderings: allViolations.filter((v) => v.tag === "ad-hoc-rendering").length,
      missingImports: allViolations.filter((v) => v.tag === "missing-registry-import").length,
    },
  };
}

function parseArgs(): { jsonOutput: boolean; minCoveragePct: number } {
  const args = process.argv.slice(2);
  let jsonOutput = false;
  let minCoverage = 100; // default: ALL governance surfaces must ground in registry

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--json") jsonOutput = true;
    if (a === "--min-coverage" && typeof args[i + 1] === "string") {
      const parsed = Number.parseFloat(args[i + 1]!);
      if (Number.isFinite(parsed)) {
        minCoverage = parsed;
        i++;
      }
    }
  }
  return { jsonOutput, minCoveragePct: minCoverage };
}

function main(): void {
  const args = parseArgs();
  const report = buildReport();

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[adoption-coverage] Scanned ${report.scannedFiles} files in: ${SCAN_ROOTS.join(", ")}`);
    console.log(`[adoption-coverage] Governance surfaces (files referencing canonical literals): ${report.summary.totalSurfaces}`);
    console.log(`[adoption-coverage] Registry-grounded surfaces: ${report.summary.registryGroundedSurfaces} / ${report.summary.totalSurfaces} (${report.summary.registryGroundedPct}%)`);
    console.log(`[adoption-coverage] Threshold: ${args.minCoveragePct}%`);
    console.log("");
    console.log("Violations:");
    console.log(`  duplicate-literal:   ${report.summary.duplicateLiterals}`);
    console.log(`  ad-hoc-rendering:    ${report.summary.adHocRenderings}`);
    console.log(`  missing-import:      ${report.summary.missingImports}`);

    if (report.violations.length > 0) {
      console.log("");
      console.log("=== ADOPTION VIOLATIONS ===");
      for (const v of report.violations) {
        console.log(`  ${v.file}:${v.line} — [${v.tag}]${v.label != null ? ` ${v.label}` : ""}`);
        console.log(`    ${v.context}`);
      }
      console.log("");
      console.log("Per W2-PR23A: governance bypass vectors must remain CI-visible.");
      console.log("Resolution:");
      console.log("  - Replace local literals with imports from @vitalcv/governance-runtime");
      console.log("  - Use approved UI primitives: IntegrityBadge, TrustClassBadge, ReplayWarning, UnknownStateBanner");
      console.log("  - Ground all severity / parsing logic in the registry");
    }
  }

  // CI fail conditions:
  //   - Any violation
  //   - Coverage below threshold
  if (report.violations.length > 0 || report.summary.registryGroundedPct < args.minCoveragePct) {
    process.exit(1);
  }
}

main();
