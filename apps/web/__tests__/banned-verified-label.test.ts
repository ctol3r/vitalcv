import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Banned-label regression gate — wave-ui/verified-label-sweep.
 *
 * CLAUDE.md (truth contract) bans the bare word "Verified" as a status label.
 * The follow-up wave-10a/docs-status audit found ~20 surfaces still rendering
 * it as a badge, tile, ternary, or stat label. This test walks the relevant
 * source roots and fails on any future regression.
 *
 * What this catches:
 *   - Any quoted bare-Verified literal in code — e.g. `'Verified'`,
 *     `"Verified"`, `` `Verified` ``. Catches badge labels, ternaries,
 *     status maps, etc.
 *   - Any same-line JSX text node `>Verified<`. Catches
 *     `<span>Verified</span>`, `<dt>Verified</dt>`, etc.
 *   - Any multi-line JSX text node where `Verified` is alone on its own
 *     line (preceded by a JSX-open line and followed by a JSX-close line).
 *   - Any "icon-prefix" JSX pattern where a line ends with `> Verified`
 *     or `/> Verified` (i.e. an icon element followed by bare-`Verified`
 *     text on the same line, then a closing tag on the next line).
 *
 * What this does NOT catch (intentionally):
 *   - Compound phrases — `'Cryptographically Verified'`,
 *     `'Primary Source Verified'`, `'Document Verified'`,
 *     `'Email confirmed'`, `'3 Verified'`, `'No verified items'`. These
 *     are not the bare status label.
 *   - References inside `__tests__/`, the build-time `_archive/`,
 *     generated `.d.ts` types, line/block comments, or the
 *     issuer-verification `statusCopy.ts` (which documents the rule).
 *
 * Allowlist: add `file:line` entries when a future case is provably safe.
 * Keep it empty whenever you can — each entry weakens the institutional
 * guarantee.
 */

const REPO_ROOTS = [
  path.resolve(__dirname, '..', 'components'),
  path.resolve(__dirname, '..', 'app'),
  path.resolve(__dirname, '..', 'design-system'),
  path.resolve(__dirname, '..', 'lib'),
];

const EXCLUDED_DIR_NAMES = new Set(['__tests__', 'node_modules', 'dist', '.next']);
const EXCLUDED_PATH_SUBSTRINGS = [
  path.sep + '_archive' + path.sep,
  // statusCopy.ts contains documentation comments asserting the rule.
  path.sep + 'lib' + path.sep + 'issuer-verification' + path.sep + 'statusCopy.ts',
];

const ALLOWED: ReadonlySet<string> = new Set<string>([
  // file:line entries — add with a comment justifying the exception.
]);

const QUOTED_BARE_PATTERN = /(['"`])Verified\1/;
const JSX_INLINE_PATTERN = />Verified</;
const JSX_AFTER_ELEMENT_PATTERN = /(?:>|\/>)\s+Verified\s*$/;
const JSX_BEFORE_ELEMENT_PATTERN = /^\s*Verified\s+</;

function shouldScanFile(filePath: string): boolean {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return false;
  if (filePath.endsWith('.d.ts')) return false;
  for (const sub of EXCLUDED_PATH_SUBSTRINGS) {
    if (filePath.includes(sub)) return false;
  }
  return true;
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.isFile()) {
      const full = path.join(dir, entry.name);
      if (shouldScanFile(full)) out.push(full);
    }
  }
}

/**
 * Strip `/* ... *​/` block comments and `//` line comments from source so
 * comment-only references to the rule (e.g. in docstrings) don't trip
 * the regex. This is a pragmatic strip, not a parser — it accepts that
 * the word "Verified" inside a template string with a `//` will be
 * stripped. That trade-off is fine: bare-label uses in template strings
 * are exactly what we want to ban.
 */
function stripComments(source: string): string {
  // Strip /* ... */ blocks first (non-greedy).
  const blockStripped = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, ' '),
  );
  // Then strip // line comments through end of line.
  return blockStripped.replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length));
}

interface Hit {
  file: string;
  line: number;
  text: string;
  reason: 'quoted' | 'jsx-inline' | 'jsx-standalone-line' | 'jsx-after-element' | 'jsx-before-element';
}

function isTsxFile(file: string): boolean {
  return file.endsWith('.tsx');
}

function findHits(): Hit[] {
  const files: string[] = [];
  for (const root of REPO_ROOTS) walk(root, files);

  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const hits: Hit[] = [];

  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const stripped = stripComments(original);
    const originalLines = original.split(/\r?\n/);
    const strippedLines = stripped.split(/\r?\n/);
    const tsx = isTsxFile(file);

    for (let i = 0; i < strippedLines.length; i++) {
      const codeLine = strippedLines[i];
      const reportLine = originalLines[i] ?? '';
      const lineNumber = i + 1;
      const rel = path.relative(repoRoot, file);
      const key = `${rel}:${lineNumber}`;
      if (ALLOWED.has(key)) continue;

      if (QUOTED_BARE_PATTERN.test(codeLine)) {
        hits.push({ file: rel, line: lineNumber, text: reportLine.trim(), reason: 'quoted' });
        continue;
      }
      if (tsx && JSX_INLINE_PATTERN.test(codeLine)) {
        hits.push({ file: rel, line: lineNumber, text: reportLine.trim(), reason: 'jsx-inline' });
        continue;
      }
      if (tsx && codeLine.trim() === 'Verified') {
        hits.push({ file: rel, line: lineNumber, text: reportLine.trim(), reason: 'jsx-standalone-line' });
        continue;
      }
      if (tsx && JSX_AFTER_ELEMENT_PATTERN.test(codeLine)) {
        hits.push({ file: rel, line: lineNumber, text: reportLine.trim(), reason: 'jsx-after-element' });
        continue;
      }
      if (tsx && JSX_BEFORE_ELEMENT_PATTERN.test(codeLine)) {
        hits.push({ file: rel, line: lineNumber, text: reportLine.trim(), reason: 'jsx-before-element' });
        continue;
      }
    }
  }
  return hits;
}

describe('banned-verified-label regression gate', () => {
  it('no bare "Verified" labels render anywhere in apps/web/{components,app,design-system,lib}', () => {
    const hits = findHits();
    if (hits.length > 0) {
      const report = hits
        .map((h) => `  ${h.file}:${h.line}  [${h.reason}]  ${h.text}`)
        .join('\n');
      throw new Error(
        `Found ${hits.length} bare "Verified" label site(s). ` +
          `Use a contextual phrase ('Source-confirmed', 'Issuer-confirmed', ` +
          `'Identity confirmed by issuer', 'High-confidence tier', 'Last confirmed', ` +
          `'Email confirmed', etc.) per CLAUDE.md truth contract.\n${report}`,
      );
    }
    expect(hits).toEqual([]);
  });
});
