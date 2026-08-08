#!/usr/bin/env node

/**
 * Every pull_request-triggered workflow must declare a concurrency group keyed
 * on the ref, with cancellation guarded OFF main.
 *
 * The incident (2026-08-06, ~16:55–19:00 UTC): with 216 open PRs and a dozen
 * gates firing on every push, superseded runs from earlier pushes were never
 * cancelled and saturated the hosted runner pool. Both prod monitors starved —
 * Source Health Probe run 31126333926 (#2344) and Release verify #398 sat 15
 * minutes with runner_id 0 ("The job was not acquired by Runner of type hosted
 * even after multiple attempts") and were then failed by the service. The
 * monitors reported prod regressions that were actually infrastructure
 * failures. Only 7 of 23 workflows declared any concurrency at the time.
 *
 * The invariant, for every workflow with a `pull_request` / `pull_request_target`
 * trigger:
 *
 *   concurrency:
 *     group: <anything unique per workflow>-${{ github.ref }}
 *     cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
 *
 * - The group must contain `${{ github.ref }}` so a new push to a PR (or
 *   branch) coalesces with the stale run for the same ref, and only that ref.
 * - cancel-in-progress must be EXACTLY the main-guard expression, never a bare
 *   `true` — a bare `true` cancels superseded push runs on main too, losing
 *   check runs on intermediate main SHAs. The guard is required even for
 *   workflows whose triggers can never produce a main ref today: it is inert
 *   there (PR refs are `refs/pull/N/merge`), and it keeps the workflow safe if
 *   someone later adds a `push: main` trigger.
 *
 * Deliberately OUT of scope: workflows with no pull_request trigger — the
 * deploys (deploy-api, deploy-web) and prod monitors (release-verify,
 * deploy-health-probe, source-health-probe) make prod-safety concurrency
 * decisions (singleton groups, cancel-in-progress: false) that this pool-
 * hygiene rule must not second-guess, and push-only pipelines (monorepo.yml)
 * mostly run on main where cancellation is forbidden anyway. If a genuine
 * exception to the invariant ever appears, add an explicit allowlist here with
 * the justification next to it — do not widen the rule.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const workflowDir = path.join(repoRoot, '.github/workflows');

const indentOf = (line) => line.match(/^\s*/)[0].length;

/** Lines with comments and blanks removed — enough structure for this check. */
function significantLines(raw) {
  return raw.split('\n').filter((l) => !/^\s*#/.test(l) && l.trim() !== '');
}

/** Does the workflow have a pull_request / pull_request_target trigger? */
function hasPullRequestTrigger(raw) {
  const lines = significantLines(raw);
  const onIdx = lines.findIndex((l) => /^on:/.test(l));
  if (onIdx === -1) return false;

  // Flow style: `on: [push, pull_request]` or `on: pull_request`
  const inline = lines[onIdx].replace(/^on:/, '');
  if (/\bpull_request(_target)?\b/.test(inline)) return true;

  for (let i = onIdx + 1; i < lines.length; i++) {
    if (indentOf(lines[i]) === 0) break;
    if (/^\s+pull_request(_target)?:/.test(lines[i])) return true;
  }
  return false;
}

/** The top-level `concurrency:` block's lines, or null if absent. */
function concurrencyBlock(raw) {
  const lines = significantLines(raw);
  const idx = lines.findIndex((l) => /^concurrency:\s*$/.test(l));
  if (idx === -1) return null;
  const block = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (indentOf(lines[i]) === 0) break;
    block.push(lines[i]);
  }
  return block;
}

const REF_IN_GROUP = /\$\{\{\s*github\.ref\s*\}\}/;
const MAIN_GUARD = /^\$\{\{\s*github\.ref\s*!=\s*'refs\/heads\/main'\s*\}\}$/;

const files = fs
  .readdirSync(workflowDir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ file: f, raw: fs.readFileSync(path.join(workflowDir, f), 'utf8') }));

const problems = [];
let inScope = 0;

for (const { file, raw } of files) {
  if (!hasPullRequestTrigger(raw)) continue;
  inScope++;

  const block = concurrencyBlock(raw);
  if (block === null) {
    problems.push(
      `${file}: pull_request-triggered but declares no top-level concurrency block. ` +
        'Superseded runs from earlier pushes will hold runners and starve the pool.',
    );
    continue;
  }

  const groupLine = block.find((l) => /^\s*group:/.test(l));
  if (!groupLine || !REF_IN_GROUP.test(groupLine)) {
    problems.push(
      `${file}: concurrency group must contain \${{ github.ref }} so a new push ` +
        `coalesces with the stale run for the same ref (got: ${groupLine ? groupLine.trim() : 'no group'}).`,
    );
  }

  const cancelLine = block.find((l) => /^\s*cancel-in-progress:/.test(l));
  const cancelValue = cancelLine
    ? cancelLine.replace(/^\s*cancel-in-progress:/, '').trim()
    : null;
  if (cancelValue === null || !MAIN_GUARD.test(cancelValue)) {
    problems.push(
      `${file}: cancel-in-progress must be exactly ` +
        `\${{ github.ref != 'refs/heads/main' }} — a superseded PR run must be ` +
        `cancelled, a push run on main must never be (got: ${cancelValue ?? 'nothing'}).`,
    );
  }
}

if (problems.length > 0) {
  console.error('Workflow concurrency check FAILED:\n');
  for (const p of problems) console.error(`  - ${p}\n`);
  process.exitCode = 1;
} else {
  console.log(
    `Workflow concurrency check passed — ${inScope} pull_request-triggered ` +
      'workflows, all ref-keyed with cancellation guarded off main.',
  );
}
