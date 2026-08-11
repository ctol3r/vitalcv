import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * EC-9 vocabulary ratchet — "Customer-facing language" (Retained INVARIANT).
 *
 * EC-9 bans a specific noun set from customer-facing copy. Today's enforcement,
 * `scripts/check-public-claims.ts`, covers the EC-3 banned *strings* — it does
 * not cover EC-9's *noun* list. That coverage boundary is why the homepage hero
 * reads "…a source-backed career readiness **packet** you can carry across
 * hiring" with every gate green.
 *
 * WHAT AN EARLIER VERSION GOT WRONG. It reported the missing
 * `scripts/copy-rules.json` as an unrecorded governance hole, and created it.
 * Both were errors of a stale constitution. `origin/main` already says the file
 * "does not exist yet", names `check-public-claims.ts` as today's enforcement,
 * says "until UX-16 lands, cite the script, not the JSON", and logs the gap
 * directly. Nothing was discovered, and the artifact UX-16 owns was briefly
 * squatted. The file was deleted; the noun list is inlined below so this gate
 * squats nothing.
 *
 * What survives is the measurement, which was not previously quantified:
 * **282 customer-visible occurrences across 134 files.** Retiring them is a
 * vocabulary wave — EC-9's approved replacement set is short and specific,
 * several existing uses are protected truth qualifiers, and the customer-language
 * inventory is founder-signed. That is not a cleanup, and it is emphatically not
 * something a copy pass should improvise.
 *
 * So this is a one-way ratchet, the same shape as the glass gate and the SCA gate:
 *
 *   - a NEW file introducing a banned noun   → FAIL
 *   - an EXISTING file's count going UP      → FAIL
 *   - a count going DOWN                     → PASS, and it says to re-baseline
 *                                              so the ratchet tightens
 *
 * Regenerate after a genuine reduction:
 *   UPDATE_EC9_BASELINE=1 pnpm exec vitest run __tests__/ec9-vocabulary-ratchet.test.ts
 *
 * WHY AN AST AND NOT A REGEX
 *   EC-9 bans these nouns *customer-facing*. It does not ban them as route
 *   names, component names, imports, or comments — `app/passport/`,
 *   `SharePacketModal`, and `graphEngine.ts` are lawful and must stay lawful. A
 *   source grep flags every one. This walks the TSX AST and inspects only JSX
 *   text nodes and user-visible attributes, so it sees roughly what a customer
 *   reads.
 *
 * WHAT THIS DOES NOT DO
 *   It reads static JSX. Copy assembled at runtime — template literals, i18n
 *   lookups, strings from a CMS or the database — is invisible to it, exactly as
 *   a runtime-built "VERIFIED" label was invisible to earlier copy scans. It
 *   stops the bleed in authored markup; it is not proof that no banned noun
 *   reaches a screen.
 */

const APP_ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'ec9-vocabulary.baseline.json');

/**
 * Inlined deliberately — see the note above. When UX-16 lands
 * `scripts/copy-rules.json`, this should read from it and this list should go.
 *
 * `receipt` is absent on purpose: EC-9 resolves it as an internal/audit concept
 * that stays lawful on audit and trust-center surfaces. The same noun is never
 * simultaneously banned and mandated.
 */
const rules = {
  ec9BannedCustomerFacingNouns: [
    'packet', 'packets', 'artifact', 'artifacts', 'lane', 'lanes',
    'evidence network', 'evidence networks', 'provenance', 'holder',
    'readiness score', 'passport', 'wallet', 'graph', 'trust tier',
    'dossier', 'credential object',
  ],
  exemptSurfaceSegments: [
    '_archive', 'stories', 'sandbox', 'admin', 'ops', 'internal',
    'trust-center', 'api', 'docs', 'dev',
  ],
  visibleAttributes: ['aria-label', 'placeholder', 'title', 'alt'],
};

const EXEMPT = new RegExp(`[\\\\/](${rules.exemptSurfaceSegments.join('|')})[\\\\/]`);
const VISIBLE = new Set(rules.visibleAttributes);
const MATCHERS = rules.ec9BannedCustomerFacingNouns.map((noun) => ({
  noun,
  re: new RegExp(`\\b${noun.replace(/ /g, '\\s+')}\\b`, 'i'),
}));

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (/node_modules|[\\/]\.next|[\\/]\.turbo/.test(full)) continue;
    if (entry.isDirectory()) walk(full, acc);
    else if (full.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

/** Count customer-visible banned nouns per file. */
function scan(): Record<string, number> {
  const counts: Record<string, number> = {};
  const files = [...walk(path.join(APP_ROOT, 'app')), ...walk(path.join(APP_ROOT, 'components'))];

  for (const file of files) {
    if (EXEMPT.test(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    let n = 0;
    const hit = (text: string) => {
      if (MATCHERS.some((m) => m.re.test(text))) n += 1;
    };

    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node)) {
        const t = node.text.trim();
        if (t) hit(t);
      }
      if (ts.isJsxAttribute(node) && node.name && VISIBLE.has(node.name.getText())) {
        const init = node.initializer;
        if (init && ts.isStringLiteral(init)) hit(init.text);
        else if (init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) {
          hit(init.expression.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    if (n > 0) counts[path.relative(APP_ROOT, file).split(path.sep).join('/')] = n;
  }
  return counts;
}

const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

describe('EC-9 vocabulary ratchet — customer-facing language', () => {
  const current = scan();

  if (process.env.UPDATE_EC9_BASELINE === '1') {
    const sorted = Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]]));
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  }

  const baseline: Record<string, number> = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  it('never bans a noun EC-9 keeps lawful on audit surfaces', () => {
    expect(rules.ec9BannedCustomerFacingNouns.length).toBeGreaterThan(0);
    expect(rules.ec9BannedCustomerFacingNouns).not.toContain('receipt');
  });

  it('introduces no banned noun in files that had none', () => {
    const introduced = Object.keys(current).filter((f) => !(f in baseline));
    expect(
      introduced,
      `New EC-9 banned nouns in ${introduced.length} file(s):\n  ${introduced.join('\n  ')}\n` +
        'EC-9 approved vocabulary: VitalCV · your profile · jobs · applying · next actions · ' +
        'work VitalCV handles · hiring · starting · Activity · Completed work.',
    ).toEqual([]);
  });

  it('increases the count in no existing file', () => {
    const grown = Object.keys(current)
      .filter((f) => f in baseline && current[f] > baseline[f])
      .map((f) => `${f}: ${baseline[f]} → ${current[f]}`);
    expect(grown, `EC-9 banned-noun count increased:\n  ${grown.join('\n  ')}`).toEqual([]);
  });

  it('does not increase the total', () => {
    expect(sum(current)).toBeLessThanOrEqual(sum(baseline));
  });

  it('reports reductions so the baseline can be tightened', () => {
    const cleared = Object.keys(baseline).filter((f) => !(f in current));
    const lowered = Object.keys(current).filter((f) => f in baseline && current[f] < baseline[f]);
    if (cleared.length || lowered.length) {
      console.info(
        `[ec9 ratchet] reduced: ${cleared.length} file(s) cleared, ${lowered.length} lowered, ` +
          `total ${sum(baseline)} → ${sum(current)}. ` +
          'Re-baseline with UPDATE_EC9_BASELINE=1 so the ratchet tightens.',
      );
    }
    expect(true).toBe(true);
  });
});
