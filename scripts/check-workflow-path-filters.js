#!/usr/bin/env node

/**
 * A REQUIRED status check must never path-filter its `pull_request` trigger.
 *
 * The trap, which has now cost this repo three separate incidents (#806, fixed
 * in #811; design-lint again in #871): a path-filtered workflow is skipped
 * ENTIRELY on a PR touching none of its paths, so its check run is never
 * created. A required check that never reports leaves the PR permanently
 * unmergeable — `mergeable` stays MERGEABLE while `mergeStateStatus` sits at
 * BLOCKED, and `gh pr merge` refuses with "the base branch policy prohibits the
 * merge". Nothing in the UI says "this check was skipped"; it simply never
 * appears, which is why it keeps being rediscovered.
 *
 * The reasoning was already copied as prose into three workflow files. Prose is
 * documentation, not enforcement — hence this.
 *
 * NOTE the rule is deliberately narrow: path-filtering is FINE for a workflow
 * that is not a required check (8 currently do it, legitimately, to save CI
 * minutes), and `paths:` under `push:` is always fine because push filtering
 * cannot affect a PR's check runs. Only the required set is constrained.
 *
 * There is also an anti-workaround: do NOT satisfy this by adding a companion
 * workflow on `paths-ignore` that reports the same job name. `paths` and
 * `paths-ignore` are not exact complements, so a PR touching both sides
 * satisfies BOTH and produces two check runs sharing one name — which can mask
 * a real failure behind an always-green stub.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const workflowDir = path.join(repoRoot, '.github/workflows');

/**
 * Required status checks on `main`, as configured in branch protection.
 *
 * This list is committed because CI's default GITHUB_TOKEN cannot read branch
 * protection. It is kept honest by the reconciliation below: every name here
 * must be produced by some workflow job, so a renamed job fails this check
 * instead of silently dropping out of coverage. If you change branch
 * protection, change this list in the same PR.
 *
 * Verify with:
 *   gh api repos/ctol3r/vitalcv/branches/main/protection \
 *     --jq '.required_status_checks.contexts[]'
 */
const REQUIRED_CHECKS = [
  'SCA — critical-only gate',
  'Rust SCA — critical-only gate',
  'Web E2E (Playwright)',
  'Web Quality',
  'check-design-lint',
];

const indentOf = (line) => line.match(/^\s*/)[0].length;

/** Lines with comments and blanks removed — enough structure for this check. */
function significantLines(raw) {
  return raw.split('\n').filter((l) => !/^\s*#/.test(l) && l.trim() !== '');
}

/** Does this workflow put `paths:` / `paths-ignore:` under a PR trigger? */
function pullRequestPathFilters(raw) {
  const lines = significantLines(raw);
  const onIdx = lines.findIndex((l) => /^on:/.test(l));
  if (onIdx === -1) return [];

  const block = [];
  for (let i = onIdx + 1; i < lines.length; i++) {
    if (indentOf(lines[i]) === 0) break;
    block.push(lines[i]);
  }

  const found = [];
  for (let i = 0; i < block.length; i++) {
    const trigger = block[i].match(/^(\s*)(pull_request(?:_target)?):\s*$/);
    if (!trigger) continue;
    const triggerIndent = trigger[1].length;
    for (let j = i + 1; j < block.length; j++) {
      if (indentOf(block[j]) <= triggerIndent) break;
      const filter = block[j].match(/^\s*(paths|paths-ignore):/);
      if (filter) found.push(`${trigger[2]} → ${filter[1]}`);
    }
  }
  return found;
}

/** Job display names a workflow produces (`name:` at job level, else the key). */
function jobCheckNames(raw) {
  const names = [];
  const lines = significantLines(raw);
  const jobsIdx = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (jobsIdx === -1) return names;

  for (let i = jobsIdx + 1; i < lines.length; i++) {
    if (indentOf(lines[i]) === 0) break;
    const jobKey = lines[i].match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
    if (!jobKey) continue;
    let display = jobKey[1];
    for (let j = i + 1; j < lines.length; j++) {
      if (indentOf(lines[j]) <= 2) break;
      const n = lines[j].match(/^\s{4}name:\s*(.+)$/);
      if (n) {
        display = n[1].trim().replace(/^['"]|['"]$/g, '');
        break;
      }
    }
    names.push(display);
  }
  return names;
}

const files = fs
  .readdirSync(workflowDir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ file: f, raw: fs.readFileSync(path.join(workflowDir, f), 'utf8') }));

const problems = [];
const seenCheckNames = new Set();

for (const { file, raw } of files) {
  const names = jobCheckNames(raw);
  names.forEach((n) => seenCheckNames.add(n));

  const required = names.filter((n) => REQUIRED_CHECKS.includes(n));
  if (required.length === 0) continue;

  const filters = pullRequestPathFilters(raw);
  if (filters.length > 0) {
    problems.push(
      `${file}: required check ${required.map((r) => `"${r}"`).join(', ')} ` +
        `is path-filtered on pull_request (${filters.join('; ')}). ` +
        'A skipped workflow never creates its check run, so the PR blocks forever.',
    );
  }
}

// Keep the committed list honest: a required name no workflow produces means
// branch protection and this repo have drifted apart.
for (const name of REQUIRED_CHECKS) {
  if (!seenCheckNames.has(name)) {
    problems.push(
      `REQUIRED_CHECKS names "${name}", which no workflow job produces. ` +
        'Either the job was renamed (branch protection now blocks every PR) ' +
        'or this list is stale — fix whichever is wrong.',
    );
  }
}

if (problems.length > 0) {
  console.error('Workflow path-filter check FAILED:\n');
  for (const p of problems) console.error(`  - ${p}\n`);
  process.exitCode = 1;
} else {
  console.log(
    `Workflow path-filter check passed — ${REQUIRED_CHECKS.length} required checks, ` +
      'none path-filtered on pull_request.',
  );
}
