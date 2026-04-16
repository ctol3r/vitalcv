#!/usr/bin/env node
/**
 * enforcement-board-status.mjs
 *
 * Derives the status region of docs/ops/vitalcv-truth-enforcement-board.md
 * from filesystem reality + the hand-curated manifest at
 * docs/ops/enforcement-board.manifest.json.
 *
 * Status is NEVER stored; it is recomputed on every run.
 *
 * Usage:
 *   node scripts/ci/enforcement-board-status.mjs           # rewrite board
 *   node scripts/ci/enforcement-board-status.mjs --check   # CI mode: exit 1 on failure conditions
 *
 * Failure conditions (CI mode):
 *   - any row with severity=CRITICAL whose status != EXISTS
 *   - any driftCheck that triggered
 *
 * Assertion detection: for each row, read each listed test file and test every
 * assertionPattern (case-insensitive regex). EXISTS iff >=1 pattern matches in
 * >=1 file. STUB iff >=1 file exists but no patterns match. MISSING iff no
 * listed files exist on disk.
 *
 * Future upgrade path: replace regex scan with AST-aware check via ts-morph or
 * a Vitest test-id registry. Regex is chosen for zero-dependency CI boot.
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = path.join(ROOT, "docs/ops/enforcement-board.manifest.json");
const BOARD = path.join(ROOT, "docs/ops/vitalcv-truth-enforcement-board.md");
const BEGIN = "<!-- BEGIN GENERATED: enforcement-board-status -->";
const END = "<!-- END GENERATED: enforcement-board-status -->";

const MODE_CHECK = process.argv.includes("--check");

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function classifyRow(row) {
  const present = [];
  for (const rel of row.testFiles) {
    const abs = path.join(ROOT, rel);
    if (await fileExists(abs)) present.push(abs);
  }
  if (present.length === 0) return { status: "MISSING", evidence: null };

  const patterns = row.assertionPatterns.map((p) => new RegExp(p, "i"));
  for (const abs of present) {
    const src = await readFile(abs, "utf8");
    for (const re of patterns) {
      if (re.test(src)) {
        return { status: "EXISTS", evidence: `${path.relative(ROOT, abs)} matches /${re.source}/i` };
      }
    }
  }
  return { status: "STUB", evidence: `files present: ${present.map((p) => path.relative(ROOT, p)).join(", ")}; no assertion pattern matched` };
}

async function classifyDrift(check) {
  const abs = path.join(ROOT, check.forbiddenFilePresent);
  const triggered = await fileExists(abs);
  return { triggered, evidence: triggered ? `${check.forbiddenFilePresent} exists` : null };
}

function rollup(rows) {
  const tally = { CRITICAL: {}, HIGH: {}, MEDIUM: {} };
  for (const sev of Object.keys(tally)) {
    tally[sev] = { total: 0, EXISTS: 0, STUB: 0, MISSING: 0 };
  }
  for (const r of rows) {
    tally[r.severity].total++;
    tally[r.severity][r.status]++;
  }
  return tally;
}

function renderTable(rows) {
  const head = "| ID | Scenario | Severity | Status | Evidence |\n|---|---|---|---|---|";
  const body = rows.map((r) =>
    `| ${r.id} | ${r.scenario} | ${r.severity} | **${r.status}** | ${r.evidence ?? "—"} |`
  ).join("\n");
  return `${head}\n${body}`;
}

function renderDrift(driftResults) {
  if (driftResults.length === 0) return "_No drift checks defined._";
  const head = "| ID | Description | Severity | Triggered | Evidence |\n|---|---|---|---|---|";
  const body = driftResults.map((d) =>
    `| ${d.id} | ${d.description} | ${d.severity} | ${d.triggered ? "🚨 YES" : "no"} | ${d.evidence ?? "—"} |`
  ).join("\n");
  return `${head}\n${body}`;
}

function renderRollup(tally) {
  const rows = ["CRITICAL", "HIGH", "MEDIUM"].map((sev) => {
    const t = tally[sev];
    return `| ${sev} | ${t.total} | ${t.EXISTS} | ${t.STUB} | ${t.MISSING} |`;
  }).join("\n");
  return `| Severity | Total | EXISTS | STUB | MISSING |\n|---|---|---|---|---|\n${rows}`;
}

function renderBlock({ generatedAt, rows, driftResults, tally, failures }) {
  return [
    BEGIN,
    "",
    `> **Generated:** ${generatedAt} — derived from \`docs/ops/enforcement-board.manifest.json\` and filesystem state. Do not hand-edit this region; edit the manifest instead.`,
    "",
    "### Coverage Roll-Up",
    "",
    renderRollup(tally),
    "",
    "### Row Status",
    "",
    renderTable(rows),
    "",
    "### Drift Checks",
    "",
    renderDrift(driftResults),
    "",
    "### CI Verdict",
    "",
    failures.length === 0
      ? "✅ All CRITICAL rows EXISTS and no drift triggered."
      : "🚨 CI would fail:\n" + failures.map((f) => `- ${f}`).join("\n"),
    "",
    END,
  ].join("\n");
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

  const rows = [];
  for (const row of manifest.rows) {
    const { status, evidence } = await classifyRow(row);
    rows.push({ ...row, status, evidence });
  }

  const driftResults = [];
  for (const d of manifest.driftChecks ?? []) {
    const { triggered, evidence } = await classifyDrift(d);
    driftResults.push({ ...d, triggered, evidence });
  }

  const tally = rollup(rows);

  const failures = [];
  for (const r of rows) {
    if (r.severity === "CRITICAL" && r.status !== "EXISTS") {
      failures.push(`${r.id} (${r.scenario}) is ${r.status}, CRITICAL rows must be EXISTS`);
    }
  }
  for (const d of driftResults) {
    if (d.triggered) failures.push(`drift ${d.id}: ${d.description}`);
  }

  const block = renderBlock({
    generatedAt: new Date().toISOString(),
    rows, driftResults, tally, failures,
  });

  const board = await readFile(BOARD, "utf8");
  const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}`);
  const next = re.test(board)
    ? board.replace(re, block)
    : board.trimEnd() + "\n\n---\n\n## Generated Status Region\n\n" + block + "\n";

  if (!MODE_CHECK) {
    await writeFile(BOARD, next, "utf8");
    console.log(`Wrote ${path.relative(ROOT, BOARD)}`);
  }

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    rollup: tally,
    failures,
    drift_triggered: driftResults.filter((d) => d.triggered).map((d) => d.id),
  }, null, 2));

  if (MODE_CHECK && failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
