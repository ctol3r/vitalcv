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

  const roles: Record<string, string | string[]> = existsSync(ROLES)
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

  /** Effective (cascade-winning) value for a token. */
  const effective = (t: string) => byToken.get(t)![byToken.get(t)!.length - 1].value;
  /** Tokens in a `--vt-<family>-…` family, sorted. */
  const family = (f: string) => tokens.filter((t) => t.startsWith(`--vt-${f}-`));
  /** px magnitude of a length value, for ordering ladders by size not alphabet. */
  const px = (v: string): number => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return Number.POSITIVE_INFINITY;
    return v.trim().endsWith('rem') ? n * 16 : n;
  };
  /** A scale reads as a ladder, so order it by magnitude. */
  const bySize = (list: string[]) =>
    [...list].sort((a, b) => px(effective(a)) - px(effective(b)) || a.localeCompare(b));

  /**
   * EC-20 conflict candidates.
   *
   * Several EC-20 rows are LOCKED at "None" or at a narrow range, yet tokens
   * implementing the forbidden treatment are declared. This section reports the
   * pairing — locked rule beside the tokens that contradict it — and
   * deliberately does NOT adjudicate.
   *
   * Why not adjudicate: some of these legitimately serve scoped islands (ops
   * surfaces, `.mz`, the wave-1505 island) where the public-register rules do
   * not apply. Declaring them defects would be overclaiming. Declaring them
   * fine would be underclaiming. Measuring them is the honest option, and it is
   * the one thing no human currently does by hand.
   */
  const CONFLICTS: Array<{ row: string; rule: string; fams: string[]; extra?: string[] }> = [
    { row: 'Glass treatment', rule: '**None.** Solid surfaces everywhere; no blur halos', fams: ['glass'] },
    { row: 'Card grammar', rule: 'Solid hairline-ruled panels, radius 0–3px, **no shadows**', fams: ['shadow'] },
    {
      row: 'Corner-radius philosophy + pill policy',
      rule: 'Near-sharp **0–3px** on panels and instruments; **pills retired**',
      fams: ['radius', 'shape'],
    },
    {
      row: 'Typography — display / body / mono faces',
      rule: '**Geist** for display and body; **Geist Mono** for machine facts',
      fams: [],
      extra: tokens.filter((t) => t.startsWith('--vt-font') && /fraunces|georgia|serif/i.test(effective(t))),
    },
  ];
  const conflicts = CONFLICTS.map((c) => ({
    ...c,
    hits: [...c.fams.flatMap(family), ...(c.extra ?? [])],
  })).filter((c) => c.hits.length > 0);
  const documented = tokens.filter((t) => typeof roles[t] === 'string').length;

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
  // ── Refero-shaped sections ────────────────────────────────────────────────
  // Document SHAPE adopted from the `styles.refero.design` corpus (see the
  // 2026-08-09 addendum in docs/design/ui-ux-inspiration-repository). No
  // catalogued brand's values are used — only the idea that an agent-facing
  // design doc groups tokens by what they DO, states fallbacks explicitly,
  // gives radius per element, and ends with a quick reference it can act on.

  const fonts = tokens.filter((t) => t.startsWith('--vt-font'));
  if (fonts.length) {
    L.push('## Tokens — Typography');
    L.push('');
    L.push('Fallback chains are shown in full: the substitute is what a reader actually sees when');
    L.push('the primary face has not loaded, so it is part of the design, not an implementation detail.');
    L.push('');
    L.push('| Token | Primary | Fallback chain |');
    L.push('|---|---|---|');
    for (const t of fonts) {
      const v = effective(t);
      const inner = v.match(/var\(\s*(--[a-z0-9-]+)\s*,\s*(.+)\)\s*$/i);
      const primary = inner ? `\`${inner[1]}\`` : '—';
      const chain = inner ? inner[2] : v;
      L.push(`| \`${t}\` | ${primary} | \`${chain.trim()}\` |`);
    }
    L.push('');
  }

  const spacing = bySize(family('spacing'));
  const radius = bySize([...family('radius'), ...family('shape')]);
  if (spacing.length || radius.length) {
    L.push('## Tokens — Spacing & Shapes');
    L.push('');
    if (spacing.length) {
      const px = spacing
        .map((t) => effective(t))
        .map((v) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v)))
        .filter((n) => Number.isFinite(n) && n > 0);
      const gcd = (a: number, b: number): number => (b < 0.001 ? a : gcd(b, a % b));
      const base = px.length ? Math.round(px.reduce((a, b) => gcd(a, b))) : 0;
      if (base > 0) L.push(`**Base unit:** ${base}px (derived — the GCD of the declared ladder)`);
      L.push('');
      L.push('| Token | Value |');
      L.push('|---|---|');
      for (const t of spacing) L.push(`| \`${t}\` | \`${effective(t)}\` |`);
      L.push('');
    }
    if (radius.length) {
      L.push('### Radius, per element');
      L.push('');
      L.push('| Token | Value |');
      L.push('|---|---|');
      for (const t of radius) L.push(`| \`${t}\` | \`${effective(t)}\` |`);
      L.push('');
    }
  }

  L.push('## EC-20 conflict candidates');
  L.push('');
  if (conflicts.length === 0) {
    L.push('None. No declared token contradicts a locked EC-20 row.');
  } else {
    L.push('Locked EC-20 rows, beside tokens that implement the treatment they forbid.');
    L.push('');
    L.push('**This section measures; it does not adjudicate.** Some of these legitimately serve');
    L.push('scoped islands (ops surfaces, `.mz`, the wave-1505 island) where the public-register');
    L.push('rules do not apply. Calling them defects would overclaim; calling them fine would');
    L.push('underclaim. Resolving each is a design decision — this file only makes them visible.');
    L.push('');
    for (const c of conflicts) {
      L.push(`### ${c.row}`);
      L.push('');
      L.push(`**EC-20 (LOCKED):** ${c.rule}`);
      L.push('');
      L.push('| Token | Effective value |');
      L.push('|---|---|');
      for (const t of c.hits) L.push(`| \`${t}\` | \`${effective(t)}\` |`);
      L.push('');
    }
  }

  L.push('## Agent Prompt Guide');
  L.push('');
  L.push('For an agent about to build or change a VitalCV surface. Read this before the token');
  L.push('table — the table says what exists, this says what to do.');
  L.push('');
  const guide: string[] = Array.isArray(roles._agent_guide) ? roles._agent_guide : [];
  if (guide.length === 0) {
    L.push('— *(no guide entries yet; add `_agent_guide` to `docs/design/design-md-roles.json`)*');
  } else {
    for (const line of guide) L.push(`- ${line}`);
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
    const role = typeof roles[token] === 'string' ? roles[token] : '— *(role not documented)*';
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
