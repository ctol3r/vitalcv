#!/usr/bin/env node
/**
 * Rust SCA gate — Software Composition Analysis for the Cargo dependency trees.
 * Companion to scripts/security/audit-gate.mjs (which covers pnpm only).
 *
 * Why this exists: `pnpm audit` cannot see Rust dependencies at all, so every
 * Cargo.lock in the repo had zero SCA coverage. GitHub Dependabot was raising
 * critical alerts against them that no CI job could ever surface.
 *
 * Policy: FAIL ONLY ON CRITICAL (CVSS base score >= 9.0), matching the pnpm
 * gate. Lower severities are reported and non-blocking.
 *
 * Advisories with no CVSS vector cannot be scored. They are reported under
 * "unscored" and do NOT block — a RUSTSEC advisory without a CVSS is usually
 * an unmaintained-crate notice. They still need manual triage; the summary
 * calls them out so they cannot rot silently.
 *
 * Accepted-risk exceptions live in scripts/security/cargo-audit-ignores.json,
 * each with an owner and a revisit condition, and must also be justified in
 * docs/security/dependency-remediation.md. Same bar as the pnpm gate's
 * `pnpm.auditConfig.ignoreGhsas`: build-time / non-deploy-path, not fixable by
 * an upgrade, owner-signed, documented.
 *
 * Fails CLOSED: if cargo-audit is missing, cannot run, or emits output we
 * cannot parse, exit 2. A gate that cannot evaluate must not report "clean".
 *
 * Usage (requires `cargo install cargo-audit --locked`):
 *   node scripts/security/cargo-audit-gate.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const IGNORE_FILE = path.join(HERE, 'cargo-audit-ignores.json');
const CRITICAL_THRESHOLD = 9.0;

/* ---------------------------------------------------------------- CVSS v3.1 */

// cargo-audit reports `advisory.cvss` as a vector string, not a score, so we
// compute the base score ourselves. Formula: FIRST CVSS v3.1 specification,
// section 8.1. Validated in apps/web/__tests__/cargo-audit-gate.test.ts against
// published scores (e.g. CVE-2023-26489 wasmtime => 9.9).
const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR_U: { N: 0.85, L: 0.62, H: 0.27 },
  PR_C: { N: 0.85, L: 0.68, H: 0.5 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
};

// CVSS v3.1 "Roundup": round to 1 decimal, always upward, using integer math
// to avoid float artifacts (spec appendix A).
function roundup(x) {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}

export function cvssBaseScore(vector) {
  if (typeof vector !== 'string' || !vector.startsWith('CVSS:3')) return null;
  const m = Object.fromEntries(
    vector
      .split('/')
      .slice(1)
      .map((p) => p.split(':'))
      .filter((p) => p.length === 2),
  );
  const changed = m.S === 'C';
  const av = W.AV[m.AV];
  const ac = W.AC[m.AC];
  const pr = (changed ? W.PR_C : W.PR_U)[m.PR];
  const ui = W.UI[m.UI];
  const c = W.CIA[m.C];
  const i = W.CIA[m.I];
  const a = W.CIA[m.A];
  if ([av, ac, pr, ui, c, i, a].some((v) => v === undefined)) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = changed
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  if (impact <= 0) return 0;
  const exploitability = 8.22 * av * ac * pr * ui;
  const raw = changed
    ? Math.min(1.08 * (impact + exploitability), 10)
    : Math.min(impact + exploitability, 10);
  return roundup(raw);
}

/* -------------------------------------------------------------- discovery */

// Auto-discover every Cargo.lock so a newly added crate is covered without
// anyone remembering to update this list.
function findLockfiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'target' || e.name === '.git') continue;
      findLockfiles(path.join(dir, e.name), out);
    } else if (e.name === 'Cargo.lock') {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/* ------------------------------------------------------------------- audit */

function auditLockfile(lockfile) {
  try {
    return execFileSync('cargo', ['audit', '--file', lockfile, '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // cargo-audit exits non-zero whenever it finds anything — expected. Only a
    // missing stdout means it genuinely failed to run.
    if (err && err.stdout && String(err.stdout).trim()) return err.stdout.toString();
    console.error(`Rust SCA gate: \`cargo audit --file ${lockfile}\` could not run.`);
    console.error(String((err && err.stderr) || (err && err.message) || err));
    console.error('Install it with: cargo install cargo-audit --locked');
    process.exit(2);
  }
}

function loadIgnores() {
  if (!fs.existsSync(IGNORE_FILE)) return new Map();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(IGNORE_FILE, 'utf8'));
  } catch (err) {
    console.error(`Rust SCA gate: ${IGNORE_FILE} is not valid JSON (fail-closed).`);
    console.error(String(err));
    process.exit(2);
  }
  const list = Array.isArray(parsed?.ignore) ? parsed.ignore : null;
  if (!list) {
    console.error(`Rust SCA gate: ${IGNORE_FILE} must contain an "ignore" array (fail-closed).`);
    process.exit(2);
  }
  return new Map(list.filter((e) => e && e.id).map((e) => [e.id, e]));
}

/* -------------------------------------------------------------------- main */

// Everything below runs only when this file is executed directly. The unit
// tests import `cvssBaseScore`, and an import must never shell out to
// cargo-audit — on a runner without it installed the fail-closed exit(2) would
// take the whole test process down.
function main() {
  const ignores = loadIgnores();
  const lockfiles = findLockfiles(REPO_ROOT).sort();

  if (lockfiles.length === 0) {
    console.log('Rust SCA gate: no Cargo.lock found — nothing to audit.');
    process.exit(0);
  }

  const blocking = [];
  const suppressed = [];
  const unscored = [];
  const lower = [];

  for (const lockfile of lockfiles) {
    const rel = path.relative(REPO_ROOT, lockfile);
    const raw = auditLockfile(lockfile);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(`Rust SCA gate: could not parse cargo-audit JSON for ${rel} (fail-closed).`);
      console.error(raw.slice(0, 800));
      process.exit(2);
    }

    const vulns = data?.vulnerabilities?.list;
    if (!Array.isArray(vulns)) {
      console.error(`Rust SCA gate: unexpected cargo-audit shape for ${rel} (fail-closed).`);
      process.exit(2);
    }

    for (const v of vulns) {
      const adv = v?.advisory ?? {};
      const id = adv.id ?? '(unknown)';
      const score = cvssBaseScore(adv.cvss);
      const entry = {
        id,
        lockfile: rel,
        package: v?.package?.name ?? adv.package ?? '(unknown)',
        version: v?.package?.version ?? '',
        score,
        title: adv.title ?? '',
        patched: v?.versions?.patched ?? adv.patched ?? [],
      };
      if (score === null) unscored.push(entry);
      else if (score >= CRITICAL_THRESHOLD) {
        // Keep the ignore metadata in its own field — spreading it over `entry`
        // would let the ignore file's own `package`/`id` keys clobber the facts
        // cargo-audit actually reported.
        if (ignores.has(id)) suppressed.push({ ...entry, accepted: ignores.get(id) });
        else blocking.push(entry);
      } else lower.push(entry);
    }
  }

  const fmt = (e) =>
    `    ${e.id}  ${e.package}@${e.version}  ` +
    `${e.score === null ? 'unscored' : `CVSS ${e.score}`}  [${e.lockfile}]\n` +
    `      ${e.title}` +
    (e.patched?.length ? `\n      patched in: ${e.patched.join(', ')}` : '');

  console.log(
    `\nRust dependency advisories across ${lockfiles.length} Cargo.lock file(s) → ` +
      `blocking-critical=${blocking.length}  suppressed-critical=${suppressed.length}  ` +
      `unscored=${unscored.length}  lower=${lower.length}\n`,
  );

  if (lower.length) {
    console.log(`  ${lower.length} advisory(ies) below critical (non-blocking):`);
    for (const e of lower) console.log(fmt(e));
    console.log('');
  }

  if (unscored.length) {
    console.log(
      `  ${unscored.length} advisory(ies) carry no CVSS vector and cannot be scored — ` +
        'non-blocking, but they need manual triage:',
    );
    for (const e of unscored) console.log(fmt(e));
    console.log('');
  }

  if (suppressed.length) {
    console.log(
      `  Note: ${suppressed.length} critical advisory(ies) suppressed via ` +
        'scripts/security/cargo-audit-ignores.json (accepted risk — see ' +
        'docs/security/dependency-remediation.md):',
    );
    for (const e of suppressed) {
      console.log(fmt(e));
      console.log(
        `      accepted by ${e.accepted.owner} on ${e.accepted.added}\n` +
          `      revisit: ${e.accepted.revisit}`,
      );
    }
    console.log('');
  }

  if (blocking.length) {
    console.error(`✗ ${blocking.length} critical advisory(ies) in the Rust dependency tree:\n`);
    for (const e of blocking) console.error(fmt(e));
    console.error(
      '\n  Fix by upgrading the affected crate, or — if it is genuinely not on a ' +
        'deploy path and cannot be upgraded — add a documented entry to ' +
        'scripts/security/cargo-audit-ignores.json and ' +
        'docs/security/dependency-remediation.md.\n',
    );
    process.exit(1);
  }

  console.log('✓ No unaccepted critical advisories in the Rust dependency tree.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
