import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Banned-label regression gate — wave-ui/verified-label-sweep.
 *
 * CLAUDE.md (truth contract) bans the bare word "Verified" as a status label.
 * The follow-up wave-10a/docs-status audit found ~20 surfaces still rendering
 * it as a badge, tile, ternary, or stat label. This test walks the
 * relevant source roots and fails on any future regression.
 *
 * What this catches:
 *   - Any quoted bare-Verified literal in source — e.g. `'Verified'`, `"Verified"`,
 *     `` `Verified` ``. Catches badge labels, ternaries, status maps, etc.
 *   - Any raw JSX text node of `>Verified<`. Catches `<span>Verified</span>`,
 *     `<dt>Verified</dt>`, etc.
 *
 * What this does NOT catch (and that's intentional):
 *   - Past-tense uses inside larger strings, e.g. `'Last confirmed'`,
 *     `'3 Verified'`, `'No verified items'` — these don't read as a bare
 *     status label.
 *   - References inside `__tests__/`, the build-time `_archive/`, generated
 *     `.d.ts` types, or the issuer-verification statusCopy comments
 *     (which document the rule).
 *
 * Allowlist: add `file:line` entries when a future case is provably safe.
 * Today the list is empty. Keep it empty whenever you can — each new entry
 * weakens the institutional guarantee.
 */

const REPO_ROOTS = [
  path.resolve(__dirname, '..', 'components'),
  path.resolve(__dirname, '..', 'app'),
  path.resolve(__dirname, '..', 'design-system'),
];

const EXCLUDED_DIR_NAMES = new Set(['__tests__', 'node_modules', 'dist', '.next']);
const EXCLUDED_PATH_SUBSTRINGS = [
  path.sep + '_archive' + path.sep,
  path.sep + 'lib' + path.sep + 'issuer-verification' + path.sep + 'statusCopy.ts',
];

const ALLOWED: ReadonlySet<string> = new Set<string>([
  // file:line entries — add with a comment justifying the exception.
]);

// Two banned forms: a literal quoted `Verified` (matches '', "", or ``) and a
// JSX text node `>Verified<`. The literal-quote check rejects badge labels,
// ternary returns, and status maps; the JSX-text check rejects raw render text.
const QUOTED_BARE_PATTERN = /(['"`])Verified\1/;
const JSX_TEXT_PATTERN = />Verified</;

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

interface Hit {
  file: string;
  line: number;
  text: string;
  reason: 'quoted' | 'jsx-text';
}

function findHits(): Hit[] {
  const files: string[] = [];
  for (const root of REPO_ROOTS) walk(root, files);

  const hits: Hit[] = [];
  for (const file of files) {
    const contents = fs.readFileSync(file, 'utf8');
    const lines = contents.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      const lineNumber = i + 1;
      const rel = path.relative(path.resolve(__dirname, '..', '..', '..'), file);
      const key = `${rel}:${lineNumber}`;
      if (ALLOWED.has(key)) continue;
      if (QUOTED_BARE_PATTERN.test(text)) {
        hits.push({ file: rel, line: lineNumber, text: text.trim(), reason: 'quoted' });
      } else if (JSX_TEXT_PATTERN.test(text)) {
        hits.push({ file: rel, line: lineNumber, text: text.trim(), reason: 'jsx-text' });
      }
    }
  }
  return hits;
}

describe('banned-verified-label regression gate', () => {
  it('no bare "Verified" labels render in apps/web components, app, or design-system', () => {
    const hits = findHits();
    if (hits.length > 0) {
      const report = hits
        .map((h) => `  ${h.file}:${h.line}  [${h.reason}]  ${h.text}`)
        .join('\n');
      throw new Error(
        `Found ${hits.length} bare "Verified" label site(s). ` +
          `Use a contextual phrase ('Source-confirmed', 'Issuer-confirmed', ` +
          `'Identity confirmed by issuer', 'High-confidence tier', 'Last confirmed', ` +
          `etc.) per CLAUDE.md truth contract.\n${report}`,
      );
    }
    expect(hits).toEqual([]);
  });
});
