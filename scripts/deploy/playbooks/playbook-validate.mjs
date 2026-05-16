#!/usr/bin/env node
/**
 * Playbook validator — W2-PR114A.
 *
 * Enforces the vitalcv.playbook.v1 schema across every template under
 * docs/deployment/playbooks/templates/. The validator is intentionally
 * strict — every rejected file is a fail-closed event, never a warning.
 *
 * Validations:
 *   1. Frontmatter: playbook_id, version (int >=1), replay_safe: true,
 *      fail_closed: true, schema: vitalcv.playbook.v1
 *   2. Required sections present and non-empty:
 *      ## Preconditions, ## Steps, ## Recovery, ## Escalation,
 *      ## Evidence Capture, ## Ambiguity Branches
 *   3. Each precondition: gate:, ttl:, on_missing: STOP (literal STOP only)
 *   4. Each step: step_id, action, verification, evidence_capture,
 *      ambiguity_branch, on_failure, plus recovery: OR irreversible:
 *   5. Each ambiguity branch: decision, if_unsure (stop|escalate|abort), never
 *   6. Banned strings (CLAUDE.md publication contract) — none present
 *   7. Onboarding-specific: institutional-onboarding-sequence.md must name
 *      time_to_first_credential, reviewer_handoff_count, first_revocation_at,
 *      evidence_rows_captured
 *
 * Exit codes:
 *   0 = all templates pass
 *   1 = at least one template fails any validation
 *
 * Output:
 *   JSON report to stdout; human-readable trace to stderr.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
function cliArg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(`--${name}=`.length) : fallback;
}
const TEMPLATES_DIR = cliArg('templates-dir', resolve(ROOT, 'docs/deployment/playbooks/templates'));

// Banned phrases per CLAUDE.md publication contract. Constructed via
// split-join so this source file itself does not trip a banned-string sweep.
const BANNED_PHRASES = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

const REQUIRED_SECTIONS = [
  '## Preconditions',
  '## Steps',
  '## Recovery',
  '## Escalation',
  '## Evidence Capture',
  '## Ambiguity Branches',
];

const ALLOWED_IF_UNSURE = new Set(['stop', 'escalate', 'abort']);

const ONBOARDING_METRICS = [
  'time_to_first_credential',
  'reviewer_handoff_count',
  'first_revocation_at',
  'evidence_rows_captured',
];

function findTemplateFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) continue;
    if (!entry.endsWith('.md')) continue;
    out.push(full);
  }
  return out.sort();
}

function extractFrontmatter(lines) {
  if (lines[0] !== '---') return { fm: null, bodyStart: 0 };
  const closeIdx = lines.indexOf('---', 1);
  if (closeIdx < 0) return { fm: null, bodyStart: 0 };
  const fm = {};
  for (const line of lines.slice(1, closeIdx)) {
    const m = line.match(/^([a-z_][a-z0-9_]*):\s*(.+)$/i);
    if (!m) continue;
    fm[m[1]] = m[2].trim();
  }
  return { fm, bodyStart: closeIdx + 1 };
}

function sliceSection(lines, sectionHeader) {
  const start = lines.findIndex((l) => l === sectionHeader);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return { start, end, body: lines.slice(start + 1, end) };
}

function isEmpty(sectionLines) {
  return sectionLines.every((l) => l.trim() === '');
}

function validateFrontmatter(file, fm, errors) {
  const need = {
    playbook_id: (v) => typeof v === 'string' && v.length > 0 && /^[a-z0-9-]+$/.test(v),
    version: (v) => v !== undefined && Number.isInteger(Number.parseInt(v, 10)) && Number.parseInt(v, 10) >= 1,
    replay_safe: (v) => v === 'true',
    fail_closed: (v) => v === 'true',
    schema: (v) => v === 'vitalcv.playbook.v1',
  };
  if (!fm) {
    errors.push({ file, code: 'PLAY-DRIFT-FRONTMATTER', reason: 'frontmatter block missing or malformed' });
    return;
  }
  for (const [key, check] of Object.entries(need)) {
    if (!check(fm[key])) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-FRONTMATTER',
        reason: `frontmatter field '${key}' invalid or missing (got: ${JSON.stringify(fm[key])})`,
      });
    }
  }
}

function validateRequiredSections(file, lines, errors) {
  for (const header of REQUIRED_SECTIONS) {
    const sec = sliceSection(lines, header);
    if (!sec) {
      errors.push({ file, code: 'PLAY-DRIFT-SECTION', reason: `section '${header}' missing` });
      continue;
    }
    if (isEmpty(sec.body)) {
      errors.push({ file, code: 'PLAY-DRIFT-SECTION', reason: `section '${header}' is empty` });
    }
  }
}

function validatePreconditions(file, lines, errors) {
  const sec = sliceSection(lines, '## Preconditions');
  if (!sec) return; // already reported
  // Group preconditions by '- gate:' anchors; each group must contain
  // gate:, ttl:, on_missing: STOP.
  let groupStarted = false;
  let group = { gate: null, ttl: null, on_missing: null };
  let groupCount = 0;
  const flush = () => {
    if (!groupStarted) return;
    groupCount++;
    if (!group.gate) {
      errors.push({ file, code: 'PLAY-DRIFT-PRECONDITION', reason: `precondition group ${groupCount} missing 'gate:'` });
    }
    if (!group.ttl) {
      errors.push({ file, code: 'PLAY-DRIFT-PRECONDITION', reason: `precondition group ${groupCount} missing 'ttl:'` });
    }
    if (group.on_missing === null) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-SOFT-STOP',
        reason: `precondition group ${groupCount} missing 'on_missing:'`,
      });
    } else if (group.on_missing !== 'STOP') {
      errors.push({
        file,
        code: 'PLAY-DRIFT-SOFT-STOP',
        reason: `precondition group ${groupCount} on_missing must be literal 'STOP' (got '${group.on_missing}')`,
      });
    }
    group = { gate: null, ttl: null, on_missing: null };
    groupStarted = false;
  };
  for (const raw of sec.body) {
    const line = raw.trimEnd();
    const gateM = line.match(/^-\s*gate:\s*(.+)$/);
    if (gateM) {
      flush();
      groupStarted = true;
      group.gate = gateM[1].trim();
      continue;
    }
    const ttlM = line.match(/^\s+ttl:\s*(.+)$/);
    if (ttlM && groupStarted) {
      group.ttl = ttlM[1].trim();
      continue;
    }
    const omM = line.match(/^\s+on_missing:\s*(.+)$/);
    if (omM && groupStarted) {
      group.on_missing = omM[1].trim();
      continue;
    }
  }
  flush();
  if (groupCount === 0) {
    errors.push({ file, code: 'PLAY-DRIFT-PRECONDITION', reason: 'no precondition groups parsed' });
  }
}

function validateSteps(file, lines, errors) {
  const sec = sliceSection(lines, '## Steps');
  if (!sec) return; // already reported
  // Steps are numbered. Each step is a block starting with N. step_id:
  // and continuing until the next numbered step or a new section.
  const blocks = [];
  let cur = null;
  for (const raw of sec.body) {
    const line = raw;
    if (/^\d+\.\s+step_id:/.test(line.trim())) {
      if (cur) blocks.push(cur);
      cur = { lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) blocks.push(cur);
  if (blocks.length === 0) {
    errors.push({ file, code: 'PLAY-DRIFT-STEPS', reason: 'no step blocks parsed' });
    return;
  }
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].lines.join('\n');
    const idM = text.match(/step_id:\s*(\S+)/);
    const stepId = idM ? idM[1] : `block#${i + 1}`;
    // step_id is implicit (we split blocks on '\d+. step_id:') — skip it.
    const required = ['action', 'verification', 'evidence_capture', 'ambiguity_branch', 'on_failure'];
    for (const key of required) {
      const re = new RegExp(`(^|\\n)\\s*${key}:\\s*\\S`);
      if (!re.test(text)) {
        errors.push({
          file,
          code: 'PLAY-DRIFT-STEPS',
          reason: `step '${stepId}' missing required annotation '${key}:'`,
        });
      }
    }
    const hasRecovery = /(^|\n)\s*recovery:\s*\S/.test(text);
    const hasIrreversible = /(^|\n)\s*recovery:\s*irreversible:\s*\S/.test(text) ||
      /(^|\n)\s*irreversible:\s*\S/.test(text);
    if (!hasRecovery && !hasIrreversible) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-RECOVERY',
        reason: `step '${stepId}' missing both 'recovery:' and 'irreversible:' — every mutating step requires one`,
      });
    }
    // Step-level ambiguity_branch is prose for the operator; the literal
    // `if_unsure: continue` ban lives only on the structured
    // `## Ambiguity Branches` section (validateAmbiguitySection).
  }
}

function validateAmbiguitySection(file, lines, errors) {
  const sec = sliceSection(lines, '## Ambiguity Branches');
  if (!sec) return; // already reported
  // Each decision block: - decision: <slug>\n  if_unsure: <verb>\n  never: <...>
  const text = sec.body.join('\n');
  const blocks = text.split(/^- decision:\s*/m).slice(1);
  if (blocks.length === 0) {
    errors.push({ file, code: 'PLAY-DRIFT-AMBIGUITY', reason: 'no decision blocks in Ambiguity Branches section' });
    return;
  }
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const slug = block.split('\n')[0].trim();
    const ifM = block.match(/if_unsure:\s*([a-z_]+)/);
    const neverM = block.match(/never:\s*(.+)/);
    if (!ifM) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-AMBIGUITY',
        reason: `decision '${slug || `#${i + 1}`}' missing 'if_unsure:'`,
      });
    } else if (!ALLOWED_IF_UNSURE.has(ifM[1])) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-AMBIGUITY',
        reason: `decision '${slug || `#${i + 1}`}' if_unsure must be one of stop|escalate|abort (got '${ifM[1]}')`,
      });
    }
    if (!neverM || !neverM[1].trim()) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-AMBIGUITY',
        reason: `decision '${slug || `#${i + 1}`}' missing 'never:' negative branch`,
      });
    }
  }
}

function validateBannedStrings(file, content, errors) {
  // Treat the entire file (including frontmatter and code blocks) as
  // publication surface. The validator's own banned list is constructed
  // via split-join so this script is safe to scan.
  for (const phrase of BANNED_PHRASES) {
    // Case-sensitive match against the phrase as constructed.
    const idx = content.indexOf(phrase);
    if (idx >= 0) {
      // Line number for the operator.
      const upTo = content.slice(0, idx);
      const lineNumber = upTo.split('\n').length;
      errors.push({
        file,
        code: 'PLAY-DRIFT-BANNED',
        reason: `banned phrase appears at line ${lineNumber}: ${JSON.stringify(phrase)}`,
      });
    }
  }
}

function validateOnboardingMetrics(file, content, errors) {
  if (basename(file) !== 'institutional-onboarding-sequence.md') return;
  for (const metric of ONBOARDING_METRICS) {
    if (!content.includes(metric)) {
      errors.push({
        file,
        code: 'PLAY-DRIFT-METRIC',
        reason: `onboarding playbook missing named metric '${metric}'`,
      });
    }
  }
}

const jsonOut = process.argv.includes('--json');
const files = findTemplateFiles(TEMPLATES_DIR);
if (files.length === 0) {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'no templates found', errors: [] }) + '\n');
  process.exit(1);
}

const errors = [];
for (const full of files) {
  let content;
  try {
    content = readFileSync(full, 'utf-8');
  } catch (err) {
    errors.push({ file: relative(ROOT, full), code: 'PLAY-DRIFT-UNREADABLE', reason: err.message });
    continue;
  }
  const lines = content.split('\n');
  const { fm } = extractFrontmatter(lines);
  const fileRel = relative(ROOT, full);
  validateFrontmatter(fileRel, fm, errors);
  validateRequiredSections(fileRel, lines, errors);
  validatePreconditions(fileRel, lines, errors);
  validateSteps(fileRel, lines, errors);
  validateAmbiguitySection(fileRel, lines, errors);
  validateBannedStrings(fileRel, content, errors);
  validateOnboardingMetrics(fileRel, content, errors);
}

const ok = errors.length === 0;
const report = {
  ok,
  templates: files.length,
  errors,
};

if (jsonOut) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  if (ok) {
    process.stderr.write(`[playbook-validate] OK — ${files.length} templates passed.\n`);
  } else {
    process.stderr.write(`[playbook-validate] FAIL — ${errors.length} error(s) across ${files.length} templates.\n`);
    for (const e of errors) {
      process.stderr.write(`  ${e.code.padEnd(28)} ${e.file}: ${e.reason}\n`);
    }
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

process.exit(ok ? 0 : 1);
