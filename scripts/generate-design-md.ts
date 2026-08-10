/**
 * generate-design-md.ts — emit DESIGN.md from the token files themselves.
 *
 * ## Why this is generated and not written
 *
 * VitalCV has no DESIGN.md, and `AGENTS.md` — the file a coding agent actually
 * reads — states no token, face, or scale. An agent asked to build UI has
 * nothing single to read. The obvious fix is to write one; the obvious fix is
 * wrong.
 *
 * The repo already carries the failure mode. `--vt-*` tokens are declared
 * across SIX files with no documented precedence, and the canonical
 * `DESIGN_SYSTEM.md` specifies a three-file architecture
 * (`01-primitives → 02-semantic → 03-themes`) that exists only under
 * `design-handoff/` and was never shipped to `apps/web`. A hand-written
 * DESIGN.md would become the seventh place values live and the second doc
 * describing an architecture nobody built.
 *
 * So this script owns the FACTS — which tokens exist, where they are declared,
 * which declaration wins, and where declarations collide — read from the CSS on
 * every run. Prose that cannot be derived (what a token is FOR) lives in a
 * sidecar and is merged in. `design-md-freshness.test.ts` regenerates and
 * diffs, so the document cannot quietly drift from the code it describes.
 *
 * What it deliberately does NOT do: restate governance. Brand decisions live in
 * the Experience Constitution (EC-20) and component architecture in wave-1505.
 * DESIGN.md points at both and repeats neither, because a third copy of a
 * locked decision is how the 1505-vs-EC-20 conflict happened in the first place.
 *
 * Usage:  node --experimental-strip-types scripts/generate-design-md.ts [--check]
 *         --check exits 1 if the committed DESIGN.md is stale.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const WEB = join(REPO, 'apps/web');
const GLOBALS = join(WEB, 'app/globals.css');
const OUT = join(REPO, 'DESIGN.md');
const ROLES = join(REPO, 'docs/design/design-md-roles.json');

interface Decl {
  token: string;
  value: string;
  file: string;
  selector: string;
  /** Index in the resolved cascade order; higher wins. */
  order: number;
}

/**
 * Cascade order, read from the real `@import` list rather than assumed. Later
 * imports win at equal specificity, so this list IS the precedence — and it is
 * the single fact most missing from the repo today.
 */
function importOrder(): string[] {
  const css = readFileSync(GLOBALS, 'utf8');
  const order: string[] = ['app/globals.css'];
  for (const m of css.matchAll(/@import\s+'([^']+)'/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // package imports declare no --vt-*
    order.push(relative(WEB, join(WEB, 'app', spec)));
  }
  return order;
}

/** Every `--vt-*` declaration, with the selector block it sits in. */
function declarationsIn(fileRel: string, order: number): Decl[] {
  const abs = join(WEB, fileRel);
  if (!existsSync(abs)) return [];
  const css = readFileSync(abs, 'utf8');
  const out: Decl[] = [];
  let selector = '(file scope)';
  for (const raw of css.split('\n')) {
    const line = raw.trim();
    const sel = line.match(/^([^{};]+)\{\s*$/);
    if (sel) selector = sel[1].trim();
    const decl = line.match(/^(--vt-[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (decl) out.push({ token: decl[1], value: decl[2].trim(), file: fileRel, selector, order });
  }
  return out;
}

function main(): void {
  const order = importOrder();
  const decls = order.flatMap((f, i) => declarationsIn(f, i));

  const byToken = new Map<string, Decl[]>();
  for (const d of decls) {
    if (!byToken.has(d.token)) byToken.set(d.token, []);
    byToken.get(d.token)!.push(d);
  }

  const roles: Record<string, string> = existsSync(ROLES)
    ? JSON.parse(readFileSync(ROLES, 'utf8'))
    : {};

  /**
   * A collision is the same token given DIFFERENT values UNDER THE SAME
   * SELECTOR — one declaration silently overriding another.
   *
   * Grouping by token alone was the first, wrong, cut: it flagged 73 tokens,
   * but most were `html[data-theme='dark']` vs `light` vs `.mz`, which is what
   * theming IS. A document that cries wolf on every theme variant gets ignored,
   * which is worse than not having it. Theme variants are counted separately
   * below as coverage, not as defects.
   */
  const collisions: Array<{ token: string; decls: Decl[] }> = [];
  for (const [token, list] of byToken) {
    const bySelector = new Map<string, Decl[]>();
    for (const d of list) {
      if (!bySelector.has(d.selector)) bySelector.set(d.selector, []);
      bySelector.get(d.selector)!.push(d);
    }
    for (const [, sameSel] of bySelector) {
      if (new Set(sameSel.map((d) => d.value)).size > 1) {
        collisions.push({ token, decls: sameSel });
      }
    }
  }
  collisions.sort((a, b) => a.token.localeCompare(b.token));

  const themed = [...byToken.values()].filter(
    (l) => new Set(l.map((d) => d.selector)).size > 1,
  ).length;

  const tokens = [...byToken.keys()].sort();
  const documented = tokens.filter((t) => roles[t]).length;

  const fileCounts = order
    .map((f) => ({ f, n: decls.filter((d) => d.file === f).length }))
    .filter((x) => x.n > 0);

  const L: string[] = [];
  L.push('# VitalCV — DESIGN.md');
  L.push('');
  L.push('> **GENERATED — do not edit by hand.**');
  L.push('> `node --experimental-strip-types scripts/generate-design-md.ts`');
  L.push('> `design-md-freshness.test.ts` fails if this file drifts from the CSS.');
  L.push('');
  L.push('This file states **facts about the tokens as they are declared today**. It is written for');
  L.push('coding agents building VitalCV UI, and it is regenerated from the CSS so it cannot');
  L.push('describe an architecture nobody shipped.');
  L.push('');
  L.push('## Governance — this file is not the authority');
  L.push('');
  L.push('| Domain | Authority | This file |');
  L.push('|---|---|---|');
  L.push('| Brand decisions (type, palette, radius, motion, light/dark) | `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` **EC-20** | points, never restates |');
  L.push('| Component + token architecture | `design-handoff/claude-design-2026-07-12-wave1505/wave1505/DESIGN_SYSTEM.md` | points, never restates |');
  L.push('| Truth/copy contract, banned strings | `CLAUDE.md` + **EC-3** | points, never restates |');
  L.push('| Which tokens exist, where, and which wins | **here** | authoritative |');
  L.push('');
  L.push('Where wave-1505 and EC-20 disagree, **EC-20 wins**: 1505 is the architecture, its values');
  L.push('are superseded. Reading 1505 for values ships the wrong brand.');
  L.push('');
  L.push('## Cascade order (the precedence nobody had written down)');
  L.push('');
  L.push('Token files are `@import`ed by `app/globals.css` in this order. **Later wins** at equal');
  L.push('specificity, so this list is the precedence:');
  L.push('');
  L.push('| # | File | `--vt-*` declarations |');
  L.push('|---|---|---|');
  fileCounts.forEach(({ f, n }, i) => L.push(`| ${i + 1} | \`apps/web/${f}\` | ${n} |`));
  L.push('');
  L.push(`**${decls.length} declarations across ${fileCounts.length} files, ${tokens.length} distinct tokens.**`);
  L.push('');
  L.push('## Collisions — one declaration silently overriding another');
  L.push('');
  L.push('Same token, **same selector**, different value, in more than one file. Theme variants');
  L.push(`(\`[data-theme]\`, \`.mz\`, \`.dark\`) are not collisions — that is what theming is, and`);
  L.push(`**${themed} tokens** legitimately vary by selector.`);
  L.push('');
  if (collisions.length === 0) {
    L.push('None. No token is silently overridden at equal specificity.');
  } else {
    L.push(`**${collisions.length} tokens are silently overridden.** The winning value is the lowest row for`);
    L.push('each (latest import). Reported, not resolved — resolving them is a design decision, and');
    L.push('this file only measures.');
    L.push('');
    L.push('| Token | Value | Declared in | Selector | Wins? |');
    L.push('|---|---|---|---|---|');
    for (const { token, decls: ds } of collisions) {
      const winner = ds[ds.length - 1];
      for (const d of ds) {
        L.push(`| \`${token}\` | \`${d.value}\` | \`${d.file}\` | \`${d.selector}\` | ${d === winner ? '**yes**' : 'no'} |`);
      }
    }
  }
  L.push('');
  L.push('## Tokens');
  L.push('');
  L.push(`Role sentences come from \`docs/design/design-md-roles.json\`. **${documented} of ${tokens.length}**`);
  L.push('tokens have a documented role; the rest say so plainly rather than inventing one.');
  L.push('');
  L.push('| Token | Effective value | Declared in | Role |');
  L.push('|---|---|---|---|');
  for (const token of tokens) {
    const list = byToken.get(token)!;
    const winner = list[list.length - 1];
    const where = [...new Set(list.map((d) => d.file))].join(', ');
    const role = roles[token] ?? '— *(role not documented)*';
    L.push(`| \`${token}\` | \`${winner.value}\` | \`${where}\` | ${role} |`);
  }
  L.push('');

  const md = L.join('\n') + '\n';

  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== md) {
      console.error('DESIGN.md is stale. Run: node --experimental-strip-types scripts/generate-design-md.ts');
      process.exit(1);
    }
    console.log(`DESIGN.md is current (${tokens.length} tokens, ${collisions.length} collisions).`);
    return;
  }

  writeFileSync(OUT, md);
  console.log(`DESIGN.md written: ${tokens.length} tokens, ${decls.length} declarations, ${collisions.length} collisions, ${documented} roles documented.`);
}

main();
