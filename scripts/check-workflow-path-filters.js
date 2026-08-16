#!/usr/bin/env node

/**
 * A REQUIRED status check must actually report on a pull request to main.
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
 * ---------------------------------------------------------------------------
 * THIS GATE ASSERTS THE CLOSURE, NOT THE MECHANISM.
 *
 * Until 2026-08-11 it asserted only the mechanism it was born from — "no
 * `paths:` key under `pull_request:`" — which left the same incident reachable
 * through doors it did not watch. Both were proven by injection against
 * origin/main at 2c39eb33e on 2026-08-10, and BOTH left this script exit 0:
 *
 *   1. Delete the `pull_request:` block from ci.yml entirely. Three required
 *      contexts ("Web Quality", "Web E2E (Playwright)", "Web E2E (real auth)")
 *      then have no trigger that fires on a PR at all. Same outcome as #806:
 *      every PR to main blocked forever. Old gate: PASSED.
 *   2. Narrow that trigger to `branches: [develop]`. The workflow exists, has a
 *      `pull_request` trigger, carries no path filter — and still never reports
 *      on a PR to main. Old gate: PASSED.
 *
 * So the question this script now answers, for every name in REQUIRED_CHECKS,
 * is the one branch protection actually asks: WILL THIS CONTEXT REPORT ON A
 * PULL REQUEST TO MAIN? That closure has five parts, each of which alone is
 * enough to block every PR:
 *
 *   a. Exactly one workflow job produces the name. Two jobs sharing a display
 *      name produce two same-named check runs on one SHA and the required
 *      context resolves to whichever reported last — the masking hazard the
 *      anti-workaround note below already warned about, now enforced rather
 *      than described. Zero producers means the name is a typo or the job was
 *      renamed, and branch protection is waiting on a check that cannot exist.
 *   b. That workflow has a `pull_request` (or `pull_request_target`) trigger.
 *   c. The trigger carries no `paths:` / `paths-ignore:` (the original rule).
 *   d. Its `branches:` include the literal `main` (and `branches-ignore:` does
 *      not exclude it).
 *   e. Its `types:` include `synchronize`, or are absent. Omitting synchronize
 *      means the check reports on the PR's first SHA and never again — every
 *      later push leaves the required context missing on the new head.
 *
 * NOTE the rule stays narrow where it was narrow: path-filtering is FINE for a
 * workflow that is not a required check (several do it, legitimately, to save
 * CI minutes), and `paths:` under `push:` is always fine because push filtering
 * cannot affect a PR's check runs. Only the required set is constrained.
 *
 * There is also an anti-workaround: do NOT satisfy this by adding a companion
 * workflow on `paths-ignore` that reports the same job name. `paths` and
 * `paths-ignore` are not exact complements, so a PR touching both sides
 * satisfies BOTH and produces two check runs sharing one name — which can mask
 * a real failure behind an always-green stub. Rule (a) now rejects that
 * outright.
 *
 * DEPENDENCY-FREE ON PURPOSE. The `check-workflow-contract` job runs bare
 * `node` after `actions/setup-node` with no install step, so this file may not
 * require anything outside node core — hence the small YAML reader below rather
 * than js-yaml. It is a real indentation parser, not a line scanner, and it
 * FAILS CLOSED: any construct it cannot read with confidence throws, because a
 * workflow file this gate cannot parse is a workflow file it cannot vouch for.
 *
 * Self-proving: `node scripts/check-workflow-path-filters.js --self-test` runs
 * the closure evaluator over in-memory fixtures that each carry one of the
 * defects above, and fails if any defect goes uncaught. It also runs the
 * branch-protection classifier over injected `gh` runners — no token, no
 * network — proving each failure mode (absent protection, insufficient scope,
 * missing binary, malformed response, containment drift) gets its own distinct
 * verdict. CI runs it.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const workflowDir = path.join(repoRoot, '.github/workflows');

/**
 * Required status checks on `main`, as configured in branch protection.
 *
 * This list is committed because CI's default GITHUB_TOKEN cannot read branch
 * protection. It is kept honest in ONE direction by the reconciliation below:
 * every name here must be produced by some workflow job, so a renamed job fails
 * this check instead of silently dropping out of coverage.
 *
 * THE OTHER DIRECTION IS NOT FULLY COVERED IN CI. A check that is required in
 * branch protection but missing from this list is invisible here — the lint
 * would happily pass while that check went path-filtered and started blocking
 * every PR. That is the exact bug this script exists to prevent, so run
 *
 *   node scripts/check-workflow-path-filters.js --verify-protection
 *
 * whenever branch protection changes. Reading classic protection needs a token
 * with admin scope (rulesets are readable with the default token), which is why
 * the full both-direction comparison is opt-in rather than a gate.
 *
 * What IS always-on — every default and --report run, including CI — is the
 * EXISTENCE assertion: a protection object (classic protection or a branch
 * ruleset) must exist on main at all. It needs only default-token reads. An
 * unprotected main makes every entry in this list decorative — "required" is a
 * property of the protection object, and with no object, nothing is required.
 *
 * Verify by hand with:
 *   gh api repos/:owner/:repo/branches/main/protection \
 *     --jq '.required_status_checks.contexts[]'
 */
const REQUIRED_CHECKS = [
  'SCA — critical-only gate',
  'Rust SCA — critical-only gate',
  'Web E2E (Playwright)',
  'Web Quality',
  'check-design-lint',
  // Promoted to required 2026-07-26, after each ran green on unrelated PRs.
  // Names are the literal check-run names GitHub recorded on #881 — branch
  // protection matches on the exact string, and a typo blocks every PR forever.
  'check-copy-source-liveness',
  'check-workflow-contract',
  // Same promotion, founder-directed. Both had to be de-filtered first (this
  // PR) — #882 added the two above without needing that because neither was
  // path-filtered to begin with.
  'axe WCAG 2.2 AA',
  'check-public-claims',
  // 2026-08-02 hardening: live branch protection had silently drifted BEHIND
  // this list (only 5 of the 9 entries above were actually required on main).
  // Live protection was re-synced and extended to every gate that runs on ALL
  // PRs; names are the literal check-run names GitHub recorded on #1029.
  'Web E2E (real auth)',
  'Identity-header trust ratchet',
  'Canonical Source Adapter Gate',
  'check-route-guards',
  // Requires the de-filtered pull_request trigger this PR ships in
  // backend-tests.yml. Added to live protection only after this merges.
  'Backend Tests (Postgres)',
];

// ---------------------------------------------------------------------------
// A small, fail-closed YAML reader for GitHub Actions workflow files.
//
// Supports the subset workflows are written in: block mappings, block
// sequences (including the compact `- key: value` form), single-line flow
// collections, quoted and plain scalars, block scalars (`|`, `>`) consumed
// opaquely, and comments. Anything else — anchors, aliases, tags, complex
// keys, multi-line flow collections, tab indentation, multi-document files —
// throws rather than being guessed at.
// ---------------------------------------------------------------------------

class YamlError extends Error {}

const indentOf = (text) => text.match(/^ */)[0].length;
const isSkippable = (text) => text.trim() === '' || /^\s*#/.test(text);

/** Drop a trailing `# comment`, respecting quotes. */
function stripComment(s) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inSingle) {
      if (c === "'") {
        if (s[i + 1] === "'") i++;
        else inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (c === '\\') i++;
      else if (c === '"') inDouble = false;
      continue;
    }
    if (c === "'") inSingle = true;
    else if (c === '"') inDouble = true;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

/** Index of the closing quote of the quoted run starting at `start`. */
function quoteEnd(s, start) {
  const q = s[start];
  for (let i = start + 1; i < s.length; i++) {
    if (q === "'" && s[i] === "'") {
      if (s[i + 1] === "'") i++;
      else return i;
    } else if (q === '"') {
      if (s[i] === '\\') i++;
      else if (s[i] === '"') return i;
    }
  }
  return -1;
}

function unquote(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if (s[0] === "'" && s.length > 1 && quoteEnd(s, 0) === s.length - 1) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s[0] === '"' && s.length > 1 && quoteEnd(s, 0) === s.length - 1) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s === 'null' || s === 'Null' || s === 'NULL' || s === '~') return null;
  if (s === 'true' || s === 'True' || s === 'TRUE') return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  return s;
}

class Reader {
  constructor(raw, file) {
    this.file = file;
    this.lines = raw.split('\n').map((text, i) => ({ text, no: i + 1 }));
    this.i = 0;
  }

  fail(message, lineNo) {
    throw new YamlError(`${this.file}${lineNo ? `:${lineNo}` : ''}: ${message}`);
  }

  /** Next line that carries structure, or null. Skips blanks and comments. */
  peek() {
    while (this.i < this.lines.length && isSkippable(this.lines[this.i].text)) this.i++;
    if (this.i >= this.lines.length) return null;
    const line = this.lines[this.i];
    if (/^\s*\t/.test(line.text)) this.fail('tab indentation is not valid YAML', line.no);
    if (/^---\s*$/.test(line.text)) this.fail('multi-document YAML is not supported', line.no);
    return line;
  }
}

const isSequenceItem = (body) => /^-(\s|$)/.test(body);

/** `key:` / `"key":` at the head of a line body, with the rest of the line. */
function splitKey(body, reader, line) {
  if (body.startsWith('?')) reader.fail('complex mapping keys are not supported', line.no);
  if (body[0] === '"' || body[0] === "'") {
    const end = quoteEnd(body, 0);
    if (end < 0) reader.fail('unterminated quoted key', line.no);
    const after = body.slice(end + 1).trimStart();
    if (!after.startsWith(':')) reader.fail('expected ":" after quoted key', line.no);
    return { key: String(unquote(body.slice(0, end + 1))), rest: stripComment(after.slice(1)).trim() };
  }
  const m = body.match(/^([^:#]+?):(\s|$)/);
  if (!m) reader.fail(`not a "key: value" line: ${JSON.stringify(body)}`, line.no);
  return { key: m[1].trim(), rest: stripComment(body.slice(m[1].length + 1)).trim() };
}

const looksLikeKey = (body) =>
  /^[^:#\s][^:#]*?:(\s|$)/.test(body) ||
  ((body[0] === '"' || body[0] === "'") && /^\s*:/.test(body.slice(Math.max(quoteEnd(body, 0), 0) + 1)));

function parseNode(reader, indent) {
  const line = reader.peek();
  if (!line) return null;
  const ind = indentOf(line.text);
  if (ind < indent) return null;
  if (ind > indent) reader.fail(`unexpected indentation (expected ${indent}, saw ${ind})`, line.no);
  return isSequenceItem(line.text.slice(ind))
    ? parseSequence(reader, indent)
    : parseMapping(reader, indent);
}

function parseMapping(reader, indent) {
  const map = {};
  for (;;) {
    const line = reader.peek();
    if (!line) break;
    const ind = indentOf(line.text);
    if (ind < indent) break;
    if (ind > indent) reader.fail(`unexpected indentation (expected ${indent}, saw ${ind})`, line.no);
    const body = line.text.slice(ind);
    if (isSequenceItem(body)) break;
    const { key, rest } = splitKey(body, reader, line);
    reader.i++;
    map[key] = parseValue(reader, indent, rest, line);
  }
  return map;
}

function parseSequence(reader, indent) {
  const items = [];
  for (;;) {
    const line = reader.peek();
    if (!line) break;
    const ind = indentOf(line.text);
    if (ind < indent) break;
    if (ind > indent) reader.fail(`unexpected indentation (expected ${indent}, saw ${ind})`, line.no);
    const body = line.text.slice(ind);
    if (!isSequenceItem(body)) break;

    const after = body.slice(1);
    const contentIndent = ind + 1 + (after.length - after.trimStart().length);
    const content = stripComment(after).trim();
    reader.i++;

    if (content === '') {
      const next = reader.peek();
      items.push(next && indentOf(next.text) > ind ? parseNode(reader, indentOf(next.text)) : null);
      continue;
    }
    if (/^[|>]/.test(content)) {
      items.push(blockScalar(reader, ind, content, line));
      continue;
    }
    if (looksLikeKey(content)) {
      const { key, rest } = splitKey(content, reader, line);
      const map = { [key]: parseValue(reader, contentIndent, rest, line) };
      items.push(Object.assign(map, parseMapping(reader, contentIndent)));
      continue;
    }
    items.push(inlineValue(content, reader, line));
  }
  return items;
}

function parseValue(reader, keyIndent, rest, keyLine) {
  if (rest === '') {
    const next = reader.peek();
    if (!next) return null;
    const ind = indentOf(next.text);
    if (ind > keyIndent) return parseNode(reader, ind);
    if (ind === keyIndent && isSequenceItem(next.text.slice(ind))) return parseSequence(reader, ind);
    return null;
  }
  if (/^[|>]/.test(rest)) return blockScalar(reader, keyIndent, rest, keyLine);
  return inlineValue(rest, reader, keyLine);
}

/** Consume a `|` / `>` block as an opaque string — shell, JSON, anything. */
function blockScalar(reader, ownerIndent, header, keyLine) {
  if (!/^[|>][-+]?\d?$/.test(header)) {
    reader.fail(`unsupported block scalar header ${JSON.stringify(header)}`, keyLine.no);
  }
  const out = [];
  while (reader.i < reader.lines.length) {
    const { text } = reader.lines[reader.i];
    if (text.trim() === '') {
      out.push('');
      reader.i++;
      continue;
    }
    if (indentOf(text) <= ownerIndent) break;
    out.push(text);
    reader.i++;
  }
  return out.join('\n');
}

function inlineValue(s, reader, line) {
  if (/^[&*]\S/.test(s)) reader.fail('YAML anchors and aliases are not supported', line.no);
  if (s.startsWith('!')) reader.fail('YAML tags are not supported', line.no);
  if (s[0] === '[' || s[0] === '{') return parseFlow(s, reader, line);
  return unquote(s);
}

/** Single-line flow collection. Multi-line flow is rejected, not guessed. */
function parseFlow(s, reader, line) {
  let i = 0;
  const fail = (why) => reader.fail(`${why} in flow collection ${JSON.stringify(s)}`, line.no);
  const skipWs = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };

  function value() {
    skipWs();
    if (i >= s.length) fail('unexpected end');
    if (s[i] === '[') return collection(']');
    if (s[i] === '{') return collection('}');
    if (s[i] === '"' || s[i] === "'") {
      const end = quoteEnd(s, i);
      if (end < 0) fail('unterminated quote');
      const raw = s.slice(i, end + 1);
      i = end + 1;
      return unquote(raw);
    }
    const start = i;
    while (i < s.length && !/[,\]}:]/.test(s[i])) i++;
    return unquote(s.slice(start, i));
  }

  function collection(close) {
    const isMap = close === '}';
    i++; // opening bracket
    const out = isMap ? {} : [];
    skipWs();
    if (s[i] === close) {
      i++;
      return out;
    }
    for (;;) {
      const v = value();
      if (isMap) {
        skipWs();
        if (s[i] !== ':') fail('expected ":"');
        i++;
        out[String(v)] = value();
      } else {
        out.push(v);
      }
      skipWs();
      if (s[i] === ',') {
        i++;
        continue;
      }
      if (s[i] === close) {
        i++;
        return out;
      }
      fail(i >= s.length ? 'unterminated (multi-line flow is not supported)' : 'expected "," or close');
    }
  }

  const out = value();
  skipWs();
  if (i !== s.length) fail('trailing content');
  return out;
}

function parseWorkflow(raw, file) {
  const reader = new Reader(raw, file);
  const first = reader.peek();
  if (!first) return {};
  // A leading `---` is legal; peek() rejects it, so drop one here.
  if (/^---\s*$/.test(reader.lines[reader.i].text)) reader.i++;
  return parseNode(reader, 0) ?? {};
}

// ---------------------------------------------------------------------------
// Workflow model
// ---------------------------------------------------------------------------

/** `on:` survives as the string key "on" here — this reader never folds it. */
function triggersOf(doc) {
  const on = doc?.on ?? doc?.On ?? doc?.ON;
  if (on == null) return {};
  if (typeof on === 'string') return { [on]: {} };
  if (Array.isArray(on)) return Object.fromEntries(on.map((e) => [String(e), {}]));
  if (typeof on === 'object') {
    return Object.fromEntries(Object.entries(on).map(([k, v]) => [k, v ?? {}]));
  }
  return {};
}

const asList = (v) => (v == null ? null : Array.isArray(v) ? v.map(String) : [String(v)]);

/**
 * Does a GitHub branch-filter glob match the literal ref `main`?
 *
 * `*` matches within a path segment, `**` across segments — so `main/**` does
 * NOT match the bare ref `main`. Character classes are treated literally, which
 * can only produce a false FAIL (loud), never a false pass (silent).
 */
function globMatchesMain(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`).test('main');
}

/**
 * Would a trigger with these filters fire for a pull request targeting main?
 * Patterns are evaluated in order and `!` negations override earlier matches,
 * as GitHub does. A list of only negations leaves nothing included — fail
 * closed.
 */
function reportsOnMain(branches, branchesIgnore) {
  if (branchesIgnore) return !branchesIgnore.some((p) => globMatchesMain(String(p)));
  if (!branches) return true;
  let included = false;
  for (const raw of branches) {
    const p = String(raw);
    const negated = p.startsWith('!');
    if (globMatchesMain(negated ? p.slice(1) : p)) included = !negated;
  }
  return included;
}

/** Every job's check-run display name, with the file and job that produce it. */
function jobProducers(doc, file) {
  const jobs = doc?.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return [];
  return Object.entries(jobs)
    .filter(([, job]) => job == null || typeof job === 'object')
    .map(([key, job]) => ({
      file,
      jobKey: key,
      name: String(job?.name ?? key),
      job: job ?? {},
      doc,
    }));
}

// ---------------------------------------------------------------------------
// The closure: will each required context report on a pull request to main?
// ---------------------------------------------------------------------------

/**
 * @param {{file: string, raw: string}[]} files
 * @param {string[]} requiredChecks
 * @returns {{problems: string[], rows: {name: string, where: string, status: string}[]}}
 */
function evaluate(files, requiredChecks) {
  const problems = [];
  const producers = new Map();

  for (const { file, raw } of files) {
    let doc;
    try {
      doc = parseWorkflow(raw, file);
    } catch (err) {
      // A workflow this gate cannot read is a workflow it cannot vouch for.
      problems.push(
        `${file}: could not be parsed, so its triggers cannot be checked — ${
          err instanceof YamlError ? err.message : String(err?.message ?? err)
        }`,
      );
      continue;
    }
    for (const producer of jobProducers(doc, file)) {
      if (!producers.has(producer.name)) producers.set(producer.name, []);
      producers.get(producer.name).push(producer);
    }
  }

  const rows = [];

  for (const name of requiredChecks) {
    const found = producers.get(name) ?? [];

    if (found.length === 0) {
      // Preserved from the original reconciliation, which only ever ran this
      // direction: a required name no workflow produces means branch
      // protection and this repo have drifted apart.
      problems.push(
        `REQUIRED_CHECKS names "${name}", which no workflow job produces. ` +
          'Either the job was renamed (branch protection now blocks every PR) ' +
          'or this list is stale — fix whichever is wrong.',
      );
      rows.push({ name, where: '—', status: 'NO JOB PRODUCES IT' });
      continue;
    }

    if (found.length > 1) {
      problems.push(
        `required check "${name}" is produced by ${found.length} jobs ` +
          `(${found.map((f) => `${f.file}:${f.jobKey}`).join(', ')}). ` +
          'Same-named check runs on one SHA resolve to whichever reported last, ' +
          'so a real failure can hide behind an always-green twin.',
      );
      rows.push({ name, where: found.map((f) => f.file).join(' + '), status: 'PRODUCED BY >1 JOB' });
      continue;
    }

    const { file, jobKey, job, doc } = found[0];
    const triggers = triggersOf(doc);
    const prEvent = triggers.pull_request != null ? 'pull_request' : 'pull_request_target';
    const pr = triggers.pull_request ?? triggers.pull_request_target;

    if (pr == null) {
      problems.push(
        `${file}: required check "${name}" has no \`pull_request\` trigger ` +
          `(events: ${Object.keys(triggers).join(', ') || 'none'}). ` +
          'A workflow that never runs on a PR never creates its check run, so the PR blocks forever.',
      );
      rows.push({ name, where: file, status: 'NO pull_request TRIGGER' });
      continue;
    }

    const opts = typeof pr === 'object' && !Array.isArray(pr) ? pr : {};
    const paths = asList(opts.paths);
    const pathsIgnore = asList(opts['paths-ignore']);
    const branches = asList(opts.branches);
    const branchesIgnore = asList(opts['branches-ignore']);
    const types = asList(opts.types);

    if (paths || pathsIgnore) {
      problems.push(
        `${file}: required check "${name}" is path-filtered on ${prEvent} ` +
          `(${prEvent} → ${paths ? 'paths' : 'paths-ignore'}). ` +
          'A skipped workflow never creates its check run, so the PR blocks forever.',
      );
      rows.push({ name, where: file, status: `PATH-FILTERED (${paths ? 'paths' : 'paths-ignore'})` });
      continue;
    }

    if (branches && branchesIgnore) {
      problems.push(
        `${file}: required check "${name}" sets both \`branches\` and \`branches-ignore\` on ` +
          `${prEvent}. GitHub rejects that combination, so the workflow never runs and the check never reports.`,
      );
      rows.push({ name, where: file, status: 'branches + branches-ignore' });
      continue;
    }

    if (!reportsOnMain(branches, branchesIgnore)) {
      const filter = branchesIgnore
        ? `branches-ignore: ${JSON.stringify(branchesIgnore)}`
        : `branches: ${JSON.stringify(branches)}`;
      problems.push(
        `${file}: required check "${name}" restricts ${prEvent} to ${filter}, which does not ` +
          'include `main`. The workflow exists and carries no path filter, and still never reports ' +
          'on a PR to main — so the PR blocks forever.',
      );
      rows.push({ name, where: file, status: 'BRANCHES EXCLUDE main' });
      continue;
    }

    if (types && !types.includes('synchronize')) {
      problems.push(
        `${file}: required check "${name}" limits ${prEvent} to types ${JSON.stringify(types)}, ` +
          'which omits `synchronize`. The check then reports on the PR\'s first SHA and never again — ' +
          'every later push leaves the required context missing on the new head.',
      );
      rows.push({ name, where: file, status: 'types OMIT synchronize' });
      continue;
    }

    if (job?.strategy?.matrix != null) {
      problems.push(
        `${file}: required check "${name}" (job \`${jobKey}\`) runs under a matrix, so GitHub names ` +
          'its check runs "' +
          name +
          ' (<matrix values>)" — the bare context branch protection waits on is never created.',
      );
      rows.push({ name, where: file, status: 'MATRIX RENAMES THE CHECK' });
      continue;
    }

    if (typeof job?.uses === 'string') {
      problems.push(
        `${file}: required check "${name}" (job \`${jobKey}\`) calls a reusable workflow, so its check ` +
          'runs report as "<caller job> / <called job>" — the bare context branch protection waits on ' +
          'is never created.',
      );
      rows.push({ name, where: file, status: 'REUSABLE WORKFLOW RENAMES THE CHECK' });
      continue;
    }

    rows.push({
      name,
      where: file,
      status: `${prEvent} branches=${branches ? branches.join(',') : '(all)'} paths=none types=${
        types ? types.join(',') : '(default)'
      }`,
    });
  }

  return { problems, rows };
}

function loadWorkflows(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => ({ file: f, raw: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

// ---------------------------------------------------------------------------
// Branch-protection verification.
//
// Two modes share this machinery, and both return { failures, lines } instead
// of printing, so main() can order failures before any success line and the
// self-tests can drive them with injected runners:
//
//   * ALWAYS-ON (default and --report — the mode CI runs): assert that a
//     protection object EXISTS on main at all: classic protection
//     (`.protected == true` on the branch) or a non-empty branch ruleset.
//     Needs only default-token reads.
//   * --verify-protection: additionally read the live required contexts and
//     compare against REQUIRED_CHECKS. Containment (every entry here must be
//     live-required) and the reverse direction (every live-required context
//     must be listed here) fail distinctly. Classic protection needs admin
//     scope; a rulesets-only repo is read through `rules/branches/main`
//     instead, which the default token can see.
//
// Failure classification is explicit because the previous version attributed
// EVERY failure — including GitHub's "Branch not protected" 404, which means
// no protection object exists — to token scope, printing an operator hint over
// a live incident. GitHub returns 404 from the protection endpoint only when
// there is no protection object; insufficient scope is a 403 with different
// stderr. The 404 path issues confirming default-token reads so "unreadable"
// is disproven in the same output.
// ---------------------------------------------------------------------------

const PROTECTION_ENDPOINT = 'repos/:owner/:repo/branches/main/protection';
const BRANCH_ENDPOINT = 'repos/:owner/:repo/branches/main';
const RULES_ENDPOINT = 'repos/:owner/:repo/rules/branches/main';

/**
 * The real `gh` runner. cwd is pinned to the repo root so gh resolves the
 * `:owner/:repo` placeholders from this checkout's remote, no matter where the
 * caller ran `node` from.
 */
function ghRunner(args) {
  const { execFileSync } = require('node:child_process');
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: repoRoot,
  });
}

/** HTTP status from gh's stderr, e.g. "gh: Branch not protected (HTTP 404)". */
function httpStatusOf(err) {
  const m = String(err?.stderr ?? '').match(/\(HTTP (\d{3})\)/);
  return m ? Number(m[1]) : null;
}

const ghErrorText = (err) => String(err?.stderr || err?.message || err).trim();

/** GET one endpoint as parsed JSON; a structured error instead of a throw. */
function ghRead(run, endpoint) {
  let out;
  try {
    out = run(['api', endpoint]);
  } catch (err) {
    return { ok: false, status: httpStatusOf(err), code: err?.code ?? null, error: ghErrorText(err) };
  }
  try {
    return { ok: true, data: JSON.parse(out) };
  } catch {
    return {
      ok: false,
      status: null,
      code: 'BAD_JSON',
      error: `unparseable response from \`gh api ${endpoint}\`: ${JSON.stringify(String(out).slice(0, 200))}`,
    };
  }
}

/** One distinct message per failure mode — never a catch-all scope hint. */
function describeReadFailure(endpoint, r) {
  if (r.code === 'ENOENT') {
    return (
      `the \`gh\` CLI is not installed or not on PATH (ENOENT while reading ${endpoint}). ` +
      'Cannot verify branch protection — failing closed.'
    );
  }
  if (r.status === 403) {
    return (
      `HTTP 403 reading ${endpoint}: the token cannot read it, so the protection state is UNKNOWN. ` +
      'This is an operator/token problem, not evidence that protection exists or is absent. ' +
      'Re-run with a token that can read branch protection (classic protection needs repo admin; ' +
      'rulesets are readable with the default token).'
    );
  }
  if (r.code === 'BAD_JSON') {
    return `${r.error} — failing closed.`;
  }
  return `could not read ${endpoint} (${r.error || 'unknown error'}) — failing closed.`;
}

function absentProtectionFailure(evidence) {
  return (
    'main has NO branch protection: no protection object exists — absent-protection state, not a ' +
    'scope problem. Every entry in REQUIRED_CHECKS is currently unenforced; nothing blocks a merge ' +
    'that fails all of them. Restore protection (docs/ops/github-security-controls-2026-08-02.md ' +
    'has the 14-context PATCH) before trusting any green PR.\n' +
    `    Evidence: ${evidence}`
  );
}

/** Required-check contexts declared by branch rulesets. */
function rulesetContexts(rules) {
  const out = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (rule?.type !== 'required_status_checks') continue;
    for (const check of rule?.parameters?.required_status_checks ?? []) {
      if (check?.context != null) out.push(String(check.context));
    }
  }
  return out;
}

/** Both directions, failing distinctly: containment first, then reverse drift. */
function compareContexts(live, via) {
  const failures = [];
  for (const c of REQUIRED_CHECKS.filter((c) => !live.includes(c))) {
    failures.push(
      `CONTAINMENT failure: "${c}" is in REQUIRED_CHECKS but NOT required on main (read via ${via}). ` +
        'The committed list claims a guarantee that does not exist — nothing blocks a merge that fails this check.',
    );
  }
  for (const c of live.filter((c) => !REQUIRED_CHECKS.includes(c))) {
    failures.push(
      `DRIFT: "${c}" is REQUIRED on main (read via ${via}) but missing from REQUIRED_CHECKS, ` +
        'so this lint is not guarding it against path-filtering — the blind spot this script exists to close.',
    );
  }
  if (failures.length > 0) return { failures, lines: [] };
  return {
    failures,
    lines: [
      `Protection matches REQUIRED_CHECKS — ${live.length} contexts (read via ${via}); ` +
        'containment and the reverse direction both hold.',
    ],
  };
}

/**
 * ALWAYS-ON existence assertion: does any protection object exist on main?
 * Uses only default-token-readable endpoints; any read failure fails closed.
 */
function assertProtectionExists({ run = ghRunner } = {}) {
  const branch = ghRead(run, BRANCH_ENDPOINT);
  if (!branch.ok) return { failures: [describeReadFailure(BRANCH_ENDPOINT, branch)], lines: [] };

  const rules = ghRead(run, RULES_ENDPOINT);
  if (!rules.ok) return { failures: [describeReadFailure(RULES_ENDPOINT, rules)], lines: [] };
  if (!Array.isArray(rules.data)) {
    return {
      failures: [`unexpected shape from ${RULES_ENDPOINT} (expected an array) — failing closed.`],
      lines: [],
    };
  }

  if (branch.data?.protected === true) {
    return {
      failures: [],
      lines: [`Branch protection exists on main (classic protection: ${BRANCH_ENDPOINT} reports protected=true).`],
    };
  }
  if (rules.data.length > 0) {
    return {
      failures: [],
      lines: [`Branch protection exists on main via rulesets (${rules.data.length} rule(s) on ${RULES_ENDPOINT}).`],
    };
  }
  return {
    failures: [
      absentProtectionFailure(
        `${BRANCH_ENDPOINT} → protected=${JSON.stringify(branch.data?.protected ?? null)}; ` +
          `${RULES_ENDPOINT} → 0 rules. Both default-token reads succeeded — the state is readable, and it is absent.`,
      ),
    ],
    lines: [],
  };
}

/**
 * --verify-protection: full comparison of REQUIRED_CHECKS against the live
 * required contexts, from classic protection or, failing that, from rulesets.
 */
function verifyAgainstProtection({ run = ghRunner } = {}) {
  const prot = ghRead(run, PROTECTION_ENDPOINT);

  if (prot.ok) {
    const rsc = prot.data?.required_status_checks;
    const contexts = Array.isArray(rsc?.contexts)
      ? rsc.contexts.map(String)
      : Array.isArray(rsc?.checks)
        ? rsc.checks.map((c) => String(c?.context))
        : null;
    if (contexts == null) {
      return {
        failures: [
          'branch protection exists on main but carries no required_status_checks — every entry in ' +
            'REQUIRED_CHECKS is unenforced. Failing closed.',
        ],
        lines: [],
      };
    }
    return compareContexts(contexts, 'classic branch protection');
  }

  if (prot.status === 404) {
    // GitHub 404s this endpoint ONLY when no classic protection object exists;
    // scope problems are a 403. Disprove "unreadable" in the same output with
    // two default-token reads, then decide: rulesets-only repo, or truly
    // unprotected.
    const branch = ghRead(run, BRANCH_ENDPOINT);
    const rules = ghRead(run, RULES_ENDPOINT);
    if (!branch.ok || !rules.ok || !Array.isArray(rules.data)) {
      const details = [
        branch.ok ? null : describeReadFailure(BRANCH_ENDPOINT, branch),
        rules.ok ? null : describeReadFailure(RULES_ENDPOINT, rules),
        rules.ok && !Array.isArray(rules.data) ? `unexpected shape from ${RULES_ENDPOINT} (expected an array)` : null,
      ].filter(Boolean);
      return {
        failures: [
          `${PROTECTION_ENDPOINT} returned HTTP 404 and the confirming default-token reads ALSO failed, ` +
            'so the absent-protection diagnosis cannot be confirmed — failing closed.\n    ' +
            details.join('\n    '),
        ],
        lines: [],
      };
    }
    if (rules.data.length > 0) {
      // Rulesets-only repo: classic protection absent, but rules exist. Read
      // the required checks from the rules and compare those. An empty context
      // set here fails containment for every listed check — accurately.
      return compareContexts(
        rulesetContexts(rules.data),
        `branch rulesets (${PROTECTION_ENDPOINT} 404s; ${RULES_ENDPOINT} carries the rules)`,
      );
    }
    if (branch.data?.protected === true) {
      return {
        failures: [
          `inconsistent protection state: ${BRANCH_ENDPOINT} reports protected=true, but ` +
            `${PROTECTION_ENDPOINT} returns 404 and ${RULES_ENDPOINT} is empty — cannot determine ` +
            'the required-check set; failing closed.',
        ],
        lines: [],
      };
    }
    return {
      failures: [
        absentProtectionFailure(
          `${PROTECTION_ENDPOINT} → HTTP 404 ("Branch not protected"); ` +
            `${BRANCH_ENDPOINT} → protected=${JSON.stringify(branch.data?.protected ?? null)}; ` +
            `${RULES_ENDPOINT} → 0 rules. The confirming reads succeeded — the state is readable, and it is absent.`,
        ),
      ],
      lines: [],
    };
  }

  // 403, ENOENT, network failure, malformed response — each gets its own text.
  return { failures: [describeReadFailure(PROTECTION_ENDPOINT, prot)], lines: [] };
}

// ---------------------------------------------------------------------------
// Self-test: prove the gate has teeth, without a test framework or a dependency.
//
// Each fixture carries exactly one defect that has blocked, or could block,
// every PR to main. `expect: null` means the fixture must be accepted.
// ---------------------------------------------------------------------------
const SELF_TEST_CASES = [
  {
    label: 'clean: pull_request on main',
    expect: null,
    files: [{ file: 'ok.yml', raw: 'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n' }],
  },
  {
    label: 'clean: bare pull_request, no branch filter',
    expect: null,
    files: [{ file: 'ok.yml', raw: 'on:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n' }],
  },
  {
    label: 'clean: pull_request_target on main',
    expect: null,
    files: [{ file: 'ok.yml', raw: 'on:\n  pull_request_target:\n    branches:\n      - main\njobs:\n  gate:\n    name: Gate\n' }],
  },
  {
    label: 'clean: wildcard branches match main',
    expect: null,
    files: [{ file: 'ok.yml', raw: "on:\n  pull_request:\n    branches: ['*']\njobs:\n  gate:\n    name: Gate\n" }],
  },
  {
    label: 'clean: types listing synchronize',
    expect: null,
    files: [
      {
        file: 'ok.yml',
        raw: 'on:\n  pull_request:\n    branches: [main]\n    types: [opened, synchronize, reopened]\njobs:\n  gate:\n    name: Gate\n',
      },
    ],
  },
  {
    label: 'clean: paths under push only',
    expect: null,
    files: [
      {
        file: 'ok.yml',
        raw: "on:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n    paths:\n      - 'apps/**'\njobs:\n  gate:\n    name: Gate\n",
      },
    ],
  },
  {
    label: 'clean: job name survives a run block containing YAML-looking text',
    expect: null,
    files: [
      {
        file: 'ok.yml',
        raw:
          'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n    steps:\n      - run: |\n' +
          '          cat <<EOF\n          on:\n            pull_request:\n              paths:\n                - x\n          jobs:\n            fake:\n              name: Gate\n          EOF\n',
      },
    ],
  },
  {
    // Injection 1, proven against origin/main 2c39eb33e on 2026-08-10.
    label: 'defect: pull_request trigger deleted entirely',
    expect: /has no `pull_request` trigger/,
    files: [{ file: 'bad.yml', raw: 'on:\n  push:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n' }],
  },
  {
    // Injection 2, same proof run.
    label: 'defect: pull_request narrowed to another branch',
    expect: /does not include `main`/,
    files: [{ file: 'bad.yml', raw: 'on:\n  pull_request:\n    branches: [develop]\njobs:\n  gate:\n    name: Gate\n' }],
  },
  {
    label: 'defect: branches glob cannot match the bare ref main',
    expect: /does not include `main`/,
    files: [{ file: 'bad.yml', raw: "on:\n  pull_request:\n    branches: ['main/**']\njobs:\n  gate:\n    name: Gate\n" }],
  },
  {
    label: 'defect: main excluded by a later negation',
    expect: /does not include `main`/,
    files: [{ file: 'bad.yml', raw: "on:\n  pull_request:\n    branches: ['**', '!main']\njobs:\n  gate:\n    name: Gate\n" }],
  },
  {
    label: 'defect: branches-ignore excludes main',
    expect: /does not include `main`/,
    files: [{ file: 'bad.yml', raw: 'on:\n  pull_request:\n    branches-ignore: [main]\njobs:\n  gate:\n    name: Gate\n' }],
  },
  {
    label: 'defect: path-filtered pull_request (the original rule)',
    expect: /is path-filtered/,
    files: [
      {
        file: 'bad.yml',
        raw: "on:\n  pull_request:\n    branches: [main]\n    paths:\n      - 'apps/web/**'\njobs:\n  gate:\n    name: Gate\n",
      },
    ],
  },
  {
    label: 'defect: paths-ignore on pull_request',
    expect: /is path-filtered/,
    files: [
      {
        file: 'bad.yml',
        raw: "on:\n  pull_request:\n    branches: [main]\n    paths-ignore:\n      - 'docs/**'\njobs:\n  gate:\n    name: Gate\n",
      },
    ],
  },
  {
    label: 'defect: types omit synchronize, so later pushes never report',
    expect: /omits `synchronize`/,
    files: [
      {
        file: 'bad.yml',
        raw: 'on:\n  pull_request:\n    branches: [main]\n    types: [opened]\njobs:\n  gate:\n    name: Gate\n',
      },
    ],
  },
  {
    label: 'defect: two workflows produce the same check name',
    expect: /produced by 2 jobs/,
    files: [
      { file: 'a.yml', raw: 'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n' },
      { file: 'b.yml', raw: "on:\n  pull_request:\n    paths:\n      - '**'\njobs:\n  stub:\n    name: Gate\n" },
    ],
  },
  {
    label: 'defect: two jobs in one workflow share a check name',
    expect: /produced by 2 jobs/,
    files: [
      {
        file: 'a.yml',
        raw: 'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n  gate2:\n    name: Gate\n',
      },
    ],
  },
  {
    label: 'defect: no job produces the required name',
    expect: /no workflow job produces/,
    files: [{ file: 'a.yml', raw: 'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Renamed\n' }],
  },
  {
    label: 'defect: matrix renames the check run',
    expect: /runs under a matrix/,
    files: [
      {
        file: 'bad.yml',
        raw: 'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n    strategy:\n      matrix:\n        node: [20, 22]\n',
      },
    ],
  },
  {
    label: 'defect: reusable workflow renames the check run',
    expect: /calls a reusable workflow/,
    files: [
      {
        file: 'bad.yml',
        raw: 'on:\n  pull_request:\n    branches: [main]\njobs:\n  gate:\n    name: Gate\n    uses: ./.github/workflows/other.yml\n',
      },
    ],
  },
  {
    label: 'fails closed: unparseable workflow is not silently vouched for',
    expect: /could not be parsed/,
    files: [{ file: 'bad.yml', raw: 'on:\n  pull_request:\n    branches: &anchor [main]\njobs:\n  gate:\n    name: Gate\n' }],
  },
];

// ---------------------------------------------------------------------------
// Protection-classifier self-tests: injected runners, no token, no network —
// so the CI --self-test step exercises them as-is. Each fixture reproduces one
// failure mode the old code collapsed into a single "needs admin scope" hint.
//
// `responses` maps endpoint → { stdout } for success, or
// { throw: true, stderr?, code?, message? } for a runner failure. `expect` is a
// regex the joined failures must match; `expect: null` means the fixture must
// be accepted, with `expectLine` matched against the success lines.
// ---------------------------------------------------------------------------

const protectionJson = (contexts) => JSON.stringify({ required_status_checks: { contexts } });
const rulesetJson = (contexts) =>
  JSON.stringify([
    {
      type: 'required_status_checks',
      ruleset_id: 1,
      parameters: { required_status_checks: contexts.map((context) => ({ context })) },
    },
  ]);

function stubRunner(responses) {
  return (args) => {
    const endpoint = args[1];
    const r = responses[endpoint];
    if (r == null) {
      const e = new Error(`self-test stub has no response for ${endpoint}`);
      e.stderr = e.message;
      throw e;
    }
    if (r.throw) {
      const e = new Error(r.message ?? 'gh failed');
      if (r.stderr != null) e.stderr = r.stderr;
      if (r.code != null) e.code = r.code;
      throw e;
    }
    return r.stdout;
  };
}

const HTTP_404 = { throw: true, stderr: 'gh: Branch not protected (HTTP 404)' };

const SELF_TEST_PROTECTION_CASES = [
  {
    label: 'protection: 404 + confirming reads → UNPROTECTED, not a scope problem',
    mode: 'verify',
    expect: /absent-protection state, not a scope problem/,
    responses: {
      [PROTECTION_ENDPOINT]: HTTP_404,
      [BRANCH_ENDPOINT]: { stdout: '{"name":"main","protected":false}' },
      [RULES_ENDPOINT]: { stdout: '[]' },
    },
  },
  {
    label: 'protection: 403 → explicit UNKNOWN/operator message, still a failure',
    mode: 'verify',
    expect: /protection state is UNKNOWN/,
    responses: {
      [PROTECTION_ENDPOINT]: { throw: true, stderr: 'gh: Resource not accessible by integration (HTTP 403)' },
    },
  },
  {
    label: 'protection: all 14 live contexts → pass',
    mode: 'verify',
    expect: null,
    expectLine: /matches REQUIRED_CHECKS — 14 contexts/,
    responses: { [PROTECTION_ENDPOINT]: { stdout: protectionJson([...REQUIRED_CHECKS]) } },
  },
  {
    label: 'protection: 13 of 14 live → CONTAINMENT failure, named check',
    mode: 'verify',
    expect: /CONTAINMENT failure: "Backend Tests \(Postgres\)"/,
    responses: { [PROTECTION_ENDPOINT]: { stdout: protectionJson(REQUIRED_CHECKS.slice(0, -1)) } },
  },
  {
    label: 'protection: extra live context absent from the list → DRIFT failure',
    mode: 'verify',
    expect: /DRIFT: "Extra Gate" is REQUIRED on main/,
    responses: { [PROTECTION_ENDPOINT]: { stdout: protectionJson([...REQUIRED_CHECKS, 'Extra Gate']) } },
  },
  {
    label: 'protection: malformed stdout → fail closed',
    mode: 'verify',
    expect: /unparseable response/,
    responses: { [PROTECTION_ENDPOINT]: { stdout: 'gh: something that is not JSON' } },
  },
  {
    label: 'protection: empty stdout → fail closed',
    mode: 'verify',
    expect: /unparseable response/,
    responses: { [PROTECTION_ENDPOINT]: { stdout: '' } },
  },
  {
    label: 'protection: gh missing (ENOENT) → fail closed, distinct message',
    mode: 'verify',
    expect: /`gh` CLI is not installed/,
    responses: { [PROTECTION_ENDPOINT]: { throw: true, code: 'ENOENT', message: 'spawnSync gh ENOENT' } },
  },
  {
    label: 'protection: rulesets-only repo → read from rules, compared, passing',
    mode: 'verify',
    expect: null,
    expectLine: /read via branch rulesets/,
    responses: {
      [PROTECTION_ENDPOINT]: HTTP_404,
      [BRANCH_ENDPOINT]: { stdout: '{"protected":false}' },
      [RULES_ENDPOINT]: { stdout: rulesetJson([...REQUIRED_CHECKS]) },
    },
  },
  {
    label: 'protection: rulesets-only, one check missing → CONTAINMENT failure',
    mode: 'verify',
    expect: /CONTAINMENT failure/,
    responses: {
      [PROTECTION_ENDPOINT]: HTTP_404,
      [BRANCH_ENDPOINT]: { stdout: '{"protected":false}' },
      [RULES_ENDPOINT]: { stdout: rulesetJson(REQUIRED_CHECKS.slice(1)) },
    },
  },
  {
    label: 'protection: 404 but confirming reads also fail → fail closed, not UNPROTECTED',
    mode: 'verify',
    expect: /cannot be confirmed — failing closed/,
    responses: {
      [PROTECTION_ENDPOINT]: HTTP_404,
      [BRANCH_ENDPOINT]: { throw: true, stderr: 'gh: something broke (HTTP 500)' },
      [RULES_ENDPOINT]: { throw: true, stderr: 'gh: something broke (HTTP 500)' },
    },
  },
  {
    label: 'existence: protected=false and zero rules → absent-protection failure',
    mode: 'existence',
    expect: /absent-protection state, not a scope problem/,
    responses: {
      [BRANCH_ENDPOINT]: { stdout: '{"protected":false}' },
      [RULES_ENDPOINT]: { stdout: '[]' },
    },
  },
  {
    label: 'existence: classic protection present → pass',
    mode: 'existence',
    expect: null,
    expectLine: /classic protection/,
    responses: {
      [BRANCH_ENDPOINT]: { stdout: '{"protected":true}' },
      [RULES_ENDPOINT]: { stdout: '[]' },
    },
  },
  {
    label: 'existence: rulesets present → pass',
    mode: 'existence',
    expect: null,
    expectLine: /via rulesets/,
    responses: {
      [BRANCH_ENDPOINT]: { stdout: '{"protected":false}' },
      [RULES_ENDPOINT]: { stdout: rulesetJson(['Web Quality']) },
    },
  },
  {
    label: 'existence: branch read fails → fail closed',
    mode: 'existence',
    expect: /failing closed/,
    responses: {
      [BRANCH_ENDPOINT]: { throw: true, stderr: 'gh: something broke (HTTP 500)' },
    },
  },
  {
    label: 'existence: 403 on the branch read → explicit UNKNOWN/operator message',
    mode: 'existence',
    expect: /protection state is UNKNOWN/,
    responses: {
      [BRANCH_ENDPOINT]: { throw: true, stderr: 'gh: Resource not accessible by integration (HTTP 403)' },
    },
  },
];

function selfTest() {
  let failures = 0;

  for (const testCase of SELF_TEST_CASES) {
    const { problems } = evaluate(testCase.files, ['Gate']);
    const joined = problems.join('\n');
    const ok = testCase.expect ? testCase.expect.test(joined) : problems.length === 0;
    if (!ok) failures++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${testCase.label}` +
        (ok ? '' : `\n       expected ${testCase.expect ?? '(no problems)'}, got: ${joined || '(none)'}`),
    );
  }

  for (const testCase of SELF_TEST_PROTECTION_CASES) {
    const run = stubRunner(testCase.responses);
    const result =
      testCase.mode === 'existence' ? assertProtectionExists({ run }) : verifyAgainstProtection({ run });
    const joined = result.failures.join('\n');
    const ok = testCase.expect
      ? testCase.expect.test(joined)
      : result.failures.length === 0 &&
        (!testCase.expectLine || testCase.expectLine.test(result.lines.join('\n')));
    if (!ok) failures++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${testCase.label}` +
        (ok
          ? ''
          : `\n       expected ${testCase.expect ?? `(no failures${testCase.expectLine ? ` + line ${testCase.expectLine}` : ''})`}, ` +
            `got failures: ${joined || '(none)'}; lines: ${result.lines.join(' | ') || '(none)'}`),
    );
  }

  const total = SELF_TEST_CASES.length + SELF_TEST_PROTECTION_CASES.length;
  console.log(
    `\n${total} self-test cases (${SELF_TEST_CASES.length} closure, ${SELF_TEST_PROTECTION_CASES.length} protection), ` +
      `${failures} failed. Each defect case blocks every PR to main if it reaches a required check.`,
  );
  if (failures > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }
  const dirFlag = process.argv.indexOf('--workflow-dir');
  const dir = dirFlag === -1 ? workflowDir : path.resolve(process.argv[dirFlag + 1]);
  const { problems, rows } = evaluate(loadWorkflows(dir), REQUIRED_CHECKS);

  if (process.argv.includes('--report')) {
    const w = Math.max(...rows.map((r) => r.name.length), 4);
    const w2 = Math.max(...rows.map((r) => r.where.length), 4);
    for (const r of rows) console.log(`${r.name.padEnd(w)}  ${r.where.padEnd(w2)}  ${r.status}`);
    console.log('');
  }

  // Protection is checked in every mode and its failures print FIRST: an
  // unprotected main invalidates everything below — the workflow contract is a
  // statement about REQUIRED checks, and with no protection object nothing is
  // required. No success line prints unless everything passed.
  const protection = process.argv.includes('--verify-protection')
    ? verifyAgainstProtection()
    : assertProtectionExists();

  if (protection.failures.length > 0) {
    console.error('Branch-protection verification FAILED:\n');
    for (const f of protection.failures) console.error(`  - ${f}\n`);
  }

  if (problems.length > 0) {
    console.error('Workflow contract check FAILED — a required check would not report on a PR to main:\n');
    for (const p of problems) console.error(`  - ${p}\n`);
  }

  if (protection.failures.length > 0 || problems.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(
    `Workflow contract check passed — ${REQUIRED_CHECKS.length} required checks, each produced by ` +
      'exactly one job in a workflow that reports on a pull request to main ' +
      '(pull_request trigger present, no path filter, branches include main, types include synchronize).',
  );
  for (const line of protection.lines) console.log(line);
}

if (require.main === module) main();

module.exports = {
  evaluate,
  parseWorkflow,
  reportsOnMain,
  REQUIRED_CHECKS,
  assertProtectionExists,
  verifyAgainstProtection,
};
