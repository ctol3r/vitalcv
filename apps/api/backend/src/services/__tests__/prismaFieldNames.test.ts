/**
 * No Prisma query may address a column by its DATABASE name.
 *
 * `@map("hospital_affiliation")` means the Prisma field is `hospitalAffiliation`
 * and the database column is `hospital_affiliation`. Passing the column name to
 * `select`, `by`, `where` or `orderBy` is always wrong, and Prisma rejects it at
 * runtime with `PrismaClientValidationError` before it touches the database.
 *
 * Four call sites shipped with exactly this defect and one of them —
 * `GET /api/intelligence/feed` — returned 500 in production. TypeScript would
 * have caught all four instantly, because Prisma's generated types are precise;
 * every one of the four files carried `@ts-nocheck`.
 *
 * That is the real lesson, and it is why this file also pins the `@ts-nocheck`
 * removal. The type checker is the durable guard here. This test is the backstop
 * for the case where someone reaches for `@ts-nocheck` again.
 */
import fs from 'node:fs';
import path from 'node:path';

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const SCHEMA = path.resolve(__dirname, '../../../prisma/schema.prisma');

/** model -> { dbColumn: prismaField } for every `@map`'d field. */
function mappedColumnsByModel(): Map<string, Map<string, string>> {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const models = new Map<string, Map<string, string>>();
  let current: string | null = null;

  for (const line of schema.split('\n')) {
    const modelStart = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelStart) {
      current = modelStart[1];
      models.set(current, new Map());
      continue;
    }
    if (line.trim() === '}') {
      current = null;
      continue;
    }
    if (!current) continue;

    const field = /^\s*(\w+)\s+\S+.*@map\("([^"]+)"\)/.exec(line);
    if (field && field[1] !== field[2]) {
      models.get(current)!.set(field[2], field[1]);
    }
  }
  return models;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      sourceFiles(full, acc);
    } else if (entry.name.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

/** The body of a `prisma.<model>.<op>({ … })` call, brace-matched. */
function callBodies(text: string): Array<{ model: string; body: string; index: number }> {
  const out: Array<{ model: string; body: string; index: number }> = [];
  const re = /prisma[A-Za-z]*\.(\w+)\.(findMany|findFirst|findUnique|groupBy|aggregate|count)\s*\(\{/g;

  for (let m = re.exec(text); m; m = re.exec(text)) {
    const model = m[1][0].toUpperCase() + m[1].slice(1);
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ model, body: text.slice(m.index + m[0].length, i), index: m.index });
  }
  return out;
}

describe('Prisma queries address fields by their Prisma name, never the database column', () => {
  const models = mappedColumnsByModel();
  const files = sourceFiles(BACKEND_ROOT);

  it('parsed the schema', () => {
    expect(models.size).toBeGreaterThan(50);
  });

  it('finds no mapped column name used as a query key', () => {
    const offences: string[] = [];

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const { model, body, index } of callBodies(text)) {
        const mapped = models.get(model);
        if (!mapped || mapped.size === 0) continue;

        for (const [column, field] of mapped) {
          const asKey = new RegExp(`[{\\s,]${column}\\s*:`);
          const asString = new RegExp(`'${column}'|"${column}"`);
          if (asKey.test(body) || asString.test(body)) {
            const line = text.slice(0, index).split('\n').length;
            offences.push(
              `${path.relative(BACKEND_ROOT, file)}:${line} — ${model} query uses '${column}', should be '${field}'`,
            );
          }
        }
      }
    }

    expect(offences).toEqual([]);
  });
});

describe('the files that hid this defect stay type-checked', () => {
  // Each of these carried `@ts-nocheck`, which is the only reason four invalid
  // Prisma queries compiled. Re-adding it to any of them re-opens the hole.
  const PREVIOUSLY_UNCHECKED = [
    'services/predictions/predictionEngineService.ts',
    'services/intelligence/providerIntelligenceService.ts',
    'services/intelligence/graphRagEvaluator.ts',
    'services/geospatial/geospatialMaterializationService.ts',
  ];

  // Matches the DIRECTIVE — a comment whose content is the pragma — not the
  // string. These files now discuss `@ts-nocheck` in prose explaining why it
  // was removed, and a bare substring match fails on its own documentation.
  const DIRECTIVE = /^\s*(?:\/\/|\/\*)\s*@ts-nocheck\b/m;

  it.each(PREVIOUSLY_UNCHECKED)('%s has no @ts-nocheck directive', (relative) => {
    const text = fs.readFileSync(path.join(BACKEND_ROOT, relative), 'utf8');
    expect(text).not.toMatch(DIRECTIVE);
  });

  it('the directive matcher actually matches a directive', () => {
    // Otherwise the four assertions above pass by never matching anything.
    expect('// @ts-nocheck\nconst a = 1;').toMatch(DIRECTIVE);
    expect('/* @ts-nocheck */').toMatch(DIRECTIVE);
    expect(' * ...this file carried `@ts-nocheck` once').not.toMatch(DIRECTIVE);
  });
});
