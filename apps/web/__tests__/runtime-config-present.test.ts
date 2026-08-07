import { readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The production image must contain `next.config.mjs` — and everything it
 * imports.
 *
 * This is the guard for a failure mode that produced a *green* PR, a correct
 * SHA in `/api/version`, and a setting that did nothing.
 *
 * `headers()`, `redirects()` and `rewrites()` are resolved during `next build`
 * and baked into `.next/routes-manifest.json`, so they keep working with no
 * config file present — which hid its absence completely, since the security
 * headers and the `/api/*` no-store rules all ship from that manifest.
 *
 * Server OPTIONS are not baked. `next start` reads them from the config at
 * boot; with no file it uses DEFAULTS. `poweredByHeader` defaults to `true`,
 * so #1048 set it to `false`, merged, deployed — and production went on
 * sending `x-powered-by: Next.js` on every page and every 404.
 *
 * Asserting the Dockerfile is what this guard has to do. A test asserting the
 * config VALUE (the one #1048 shipped) passes whether or not the file ever
 * reaches the running server — it reads the repo, not the image. The bug lives
 * in the gap between those two, so the guard has to close that gap.
 *
 * ---
 *
 * #1052 shipped that COPY line. This guard went green and STAYED green through
 * the next incident, because it only asked whether `next.config.mjs` appeared
 * in a COPY — never whether the modules it imports did.
 *
 * `next.config.mjs` is not self-contained. It does
 *   import { getSecurityHeadersForNext } from './security-headers.mjs';
 * and that sibling was not copied, so `next start` died at boot with
 *   Cannot find module '/app/apps/web/security-headers.mjs'
 * The container never answered `/api/health`, the healthcheck burned its retry
 * window, and the deploy was marked FAILED. Thirteen consecutive Railway web
 * deploys failed the same way; production froze on the last image that booted
 * (`bdbfbca1e`) for ~2.5h while `main` moved six commits ahead. #1058 fixed it
 * with one more COPY line.
 *
 * CI structurally cannot catch this class of bug on its own. `next build` runs
 * in the build stage with the whole repo checked out, so every sibling module
 * is present there and the build is always green. Only the runtime image is
 * missing the file, and it surfaces solely as a healthcheck timeout — no
 * failing test, no stack trace in any check. That is why the assertion has to
 * be against the Dockerfile TEXT: it is the only artifact that describes what
 * the runtime image actually contains.
 *
 * So this guard walks the transitive local-import closure of `next.config.mjs`
 * and requires every file in it to land in the final stage. Adding a new
 * relative import to the config now fails here until the COPY exists.
 */

/** `apps/web`. */
const WEB_DIR = join(__dirname, '..');
/** Repo root — the directory that becomes `/app` inside the image. */
const REPO_ROOT = join(WEB_DIR, '..', '..');
/** Where the repo is rooted in the container (`WORKDIR /app` in `base`). */
const IMAGE_ROOT = '/app';

const ENTRY_CONFIG = join(WEB_DIR, 'next.config.mjs');

const dockerfile = readFileSync(join(WEB_DIR, 'Dockerfile'), 'utf8');

// ---------------------------------------------------------------------------
// Import-closure side: what does next.config.mjs need at boot?
// ---------------------------------------------------------------------------

/**
 * Every shape an import specifier reaches us in. Bare specifiers
 * (`@sentry/nextjs`) are matched here and filtered out below — they resolve
 * from `node_modules`, which the runtime stage copies wholesale.
 */
const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bfrom\s*['"]([^'"]+)['"]/g, //          import x from 'y' / export * from 'y'
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // await import('y')
  /\bimport\s+['"]([^'"]+)['"]/g, //         import 'y'  (side effect)
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('y')
];

/**
 * Drop whole-line comments before scanning. A commented-out import must not
 * invent a COPY requirement — this guard fails the build, so a false positive
 * is not a cheap mistake. Line-granular rather than a general comment stripper
 * because the naive regex for that eats `https://` inside string literals.
 */
function withoutCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !(
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      );
    })
    .join('\n');
}

/** Relative specifiers only — `./x.mjs`, `../y.js`. */
function relativeSpecifiers(source: string): string[] {
  const code = withoutCommentLines(source);
  const found = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    // Fresh lastIndex per call: these are module-level /g regexes.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      const specifier = match[1];
      if (specifier.startsWith('.')) found.add(specifier);
    }
  }
  return [...found].sort();
}

/**
 * Node's ESM resolution requires the extension, but this also covers the
 * extension-less and directory-index forms so a `.js`/`.cjs` sibling added
 * later still resolves rather than reading as "broken import".
 */
const RESOLUTION_SUFFIXES = [
  '',
  '.mjs',
  '.js',
  '.cjs',
  '/index.mjs',
  '/index.js',
  '/index.cjs',
];

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = base + suffix;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not a file at that path — try the next candidate.
    }
  }
  return null;
}

interface ImportClosure {
  /** Absolute paths, entry file first. */
  files: string[];
  unresolved: Array<{ from: string; specifier: string }>;
}

function localImportClosure(entry: string): ImportClosure {
  const seen = new Set<string>();
  const unresolved: ImportClosure['unresolved'] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const specifier of relativeSpecifiers(readFileSync(file, 'utf8'))) {
      const resolved = resolveLocalImport(file, specifier);
      if (resolved === null) {
        unresolved.push({ from: file, specifier });
        continue;
      }
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }

  return { files: [...seen], unresolved };
}

const closure = localImportClosure(ENTRY_CONFIG);

/** Repo-relative, POSIX — `apps/web/security-headers.mjs`. */
function repoRelative(absolute: string): string {
  return relative(REPO_ROOT, absolute).split(sep).join('/');
}

/** The path the file must occupy inside the image. */
function imagePath(absolute: string): string {
  return posix.join(IMAGE_ROOT, repoRelative(absolute));
}

// ---------------------------------------------------------------------------
// Dockerfile side: what does the final stage actually put in the image?
// ---------------------------------------------------------------------------

interface Stage {
  name: string;
  parent: string;
  lines: string[];
}

/** Join `\`-continued instructions so a wrapped COPY parses as one line. */
const logicalLines = dockerfile.replace(/\\\r?\n\s*/g, ' ').split('\n');

function parseStages(): Stage[] {
  const stages: Stage[] = [];
  for (const line of logicalLines) {
    const from = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i.exec(line.trim());
    if (from) {
      stages.push({
        name: (from[2] ?? '').toLowerCase(),
        parent: from[1].toLowerCase(),
        lines: [],
      });
      continue;
    }
    if (stages.length > 0) stages[stages.length - 1].lines.push(line);
  }
  return stages;
}

/** Resolve `raw` against `workdir` the way Docker does, without trailing slash. */
function containerPath(workdir: string, raw: string): string {
  const joined = raw.startsWith('/') ? raw : posix.join(workdir, raw);
  const normalized = posix.normalize(joined);
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

/**
 * WORKDIR a stage starts with. Stages inherit it through `FROM`, which is the
 * only reason `COPY … ./apps/web/` in the runtime stage means `/app/apps/web`:
 * `base` sets `WORKDIR /app` and `runtime` is `FROM base`. Reading the literal
 * `./` as relative to `/` would silently pass every assertion below.
 */
function inheritedWorkdir(stages: Stage[], stageName: string, depth = 0): string {
  if (depth > 16) return '/';
  const stage = stages.find((s) => s.name === stageName);
  // Not a local stage — an external base image like `node:22-alpine`.
  if (!stage) return '/';
  const workdirs = stage.lines
    .map((line) => /^WORKDIR\s+(\S+)/i.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null);
  if (workdirs.length > 0) return containerPath('/', workdirs[workdirs.length - 1][1]);
  return inheritedWorkdir(stages, stage.parent, depth + 1);
}

interface Copy {
  /** Source as written, resolved to an absolute container path. */
  source: string;
  /** Destination as written, resolved to an absolute container path. */
  destination: string;
  /** Docker treats a trailing `/` as "this is a directory". */
  destinationIsDir: boolean;
  text: string;
}

/** COPY instructions in the final (runtime) stage only. */
function runtimeCopies(): Copy[] {
  const stages = parseStages();
  const runtime = stages[stages.length - 1];
  expect(runtime, 'Dockerfile has no FROM stage').toBeDefined();

  let workdir = inheritedWorkdir(stages, runtime.parent);
  const copies: Copy[] = [];

  for (const line of runtime.lines) {
    const trimmed = line.trim();

    const workdirDirective = /^WORKDIR\s+(\S+)/i.exec(trimmed);
    if (workdirDirective) {
      workdir = containerPath(workdir, workdirDirective[1]);
      continue;
    }

    if (!/^COPY\s/i.test(trimmed)) continue;
    // Drop the instruction and any `--from=` / `--chown=` flags.
    const args = trimmed.split(/\s+/).slice(1).filter((a) => !a.startsWith('--'));
    if (args.length < 2) continue;

    const rawDestination = args[args.length - 1];
    for (const rawSource of args.slice(0, -1)) {
      copies.push({
        source: containerPath(workdir, rawSource),
        destination: containerPath(workdir, rawDestination),
        destinationIsDir: rawDestination.endsWith('/'),
        text: trimmed,
      });
    }
  }

  return copies;
}

/**
 * Where `target` (an absolute container path) ends up in the image under this
 * COPY, or null if this COPY does not carry it.
 *
 * Both Docker forms matter here: a file source lands under `dest/` by its own
 * basename, while a DIRECTORY source copies its *contents* into dest — which
 * is why a whole-directory COPY legitimately covers a file inside it.
 */
function landingPath(copy: Copy, target: string): string | null {
  if (target === copy.source) {
    return copy.destinationIsDir
      ? posix.join(copy.destination, posix.basename(copy.source))
      : copy.destination;
  }
  if (target.startsWith(copy.source + '/')) {
    return posix.join(copy.destination, target.slice(copy.source.length + 1));
  }
  return null;
}

/** A file is present in the image only if some COPY lands it at its own path. */
function copyCarrying(target: string): Copy | undefined {
  return runtimeCopies().find((copy) => landingPath(copy, target) === target);
}

// ---------------------------------------------------------------------------

describe('the runtime image carries the runtime config', () => {
  it('copies next.config.mjs into the final stage', () => {
    expect(
      copyCarrying(imagePath(ENTRY_CONFIG)),
      'apps/web/next.config.mjs is not COPYed into the runtime stage — `next start` ' +
        'will boot on default server options (poweredByHeader, and anything else ' +
        'read at runtime rather than baked into .next).',
    ).toBeDefined();
  });

  it('copies every local module next.config.mjs imports, transitively', () => {
    const imported = closure.files.filter((file) => file !== ENTRY_CONFIG);

    for (const file of imported) {
      const target = imagePath(file);
      expect(
        copyCarrying(target),
        `${repoRelative(file)} is imported by next.config.mjs (directly or ` +
          'transitively) but is NOT COPYed into the Dockerfile\'s final stage.\n\n' +
          '`next start` loads next.config.mjs at boot and will die with\n' +
          `  Cannot find module '${target}'\n` +
          'The container then never answers /api/health, the healthcheck times ' +
          'out, and the deploy is marked FAILED — leaving production frozen on ' +
          'the last image that booted while main moves ahead.\n\n' +
          'CI cannot catch this: `next build` runs in the build stage with the ' +
          'whole repo checked out, so the file is always present there. Only ' +
          'the runtime image lacks it.\n\n' +
          'Fix — add to the final stage of apps/web/Dockerfile:\n' +
          `  COPY --from=build ${target} ./${posix.dirname(repoRelative(file))}/`,
      ).toBeDefined();
    }
  });

  it('resolves every relative import in the closure to a real file', () => {
    // An unresolvable relative specifier means the assertion above silently
    // skipped a file. It also means the config cannot load at all.
    const broken = closure.unresolved.map(
      ({ from, specifier }) => `${repoRelative(from)} imports '${specifier}'`,
    );
    expect(
      broken,
      `unresolvable relative import(s):\n  ${broken.join('\n  ')}`,
    ).toEqual([]);
  });

  it('still copies the build output it needs alongside it', () => {
    // Sanity: if this stage stopped copying .next, the assertions above would
    // be meaningless — a guard has to fail for the right reason.
    const copies = runtimeCopies();
    expect(copies.some((c) => c.text.includes('.next'))).toBe(true);
    expect(copies.some((c) => c.text.includes('package.json'))).toBe(true);
  });
});

describe('the guard can see what it claims to see', () => {
  // The assertions above are only as good as the two parsers behind them. Both
  // fail OPEN — a broken import scanner yields an empty closure and a broken
  // Dockerfile scanner yields no COPYs to contradict, and either way the suite
  // goes green while checking nothing. These pin the mechanism.

  it('extracts relative specifiers and ignores bare packages', () => {
    const fixture = [
      "import { withSentryConfig } from '@sentry/nextjs';",
      "import { getSecurityHeadersForNext } from './security-headers.mjs';",
      "import './side-effect.mjs';",
      "export { a } from '../shared/a.js';",
      "const m = await import('./dynamic.mjs');",
      "const c = require('./legacy.cjs');",
      "// import { ignored } from './commented-out.mjs';",
      " * import { ignored } from './jsdoc-mention.mjs';",
    ].join('\n');

    expect(relativeSpecifiers(fixture)).toEqual([
      '../shared/a.js',
      './dynamic.mjs',
      './legacy.cjs',
      './security-headers.mjs',
      './side-effect.mjs',
    ]);
  });

  it('reads the config through the same scanner, not a hard-coded list', () => {
    // Not asserting WHICH files: inlining security-headers.mjs would be a
    // legitimate refactor. Asserting the scanner actually read the entry file
    // — a closure that lost its entry is a closure that checks nothing.
    expect(closure.files).toContain(ENTRY_CONFIG);
  });

  it('resolves runtime-stage destinations against the inherited WORKDIR', () => {
    // `COPY … ./apps/web/` only means `/app/apps/web` because the runtime
    // stage inherits `WORKDIR /app` from `base`. Reading `./` as `/` would
    // make every landing-path comparison above pass vacuously.
    const copies = runtimeCopies();
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.every((c) => c.destination.startsWith(IMAGE_ROOT))).toBe(true);
    expect(copies.every((c) => c.source.startsWith(IMAGE_ROOT))).toBe(true);
  });
});
