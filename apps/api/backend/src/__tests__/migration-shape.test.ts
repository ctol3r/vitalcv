/**
 * migration-shape.test.ts
 *
 * Hardens the cutover runbook contract: scans every Prisma migration
 * SQL file under apps/api/backend/prisma/migrations/ and asserts that
 * NO migration contains a destructive DROP statement.
 *
 * Truth contracts:
 *   - No `DROP TABLE`, `DROP COLUMN`, `DROP CONSTRAINT`, `DROP INDEX`,
 *     or `DROP SCHEMA` statement may appear in any migration on main.
 *   - Destructive operations require a separate signed-off PR with an
 *     opt-in waiver comment (`-- migration-shape:allow-drop reason: ...`).
 *   - The migrations directory must exist and contain at least one
 *     migration (sanity check that we are scanning the right tree).
 */
// Jest globals (describe/it/expect) are provided ambiently by the
// backend's jest config; matches the pattern used by every other
// test file under apps/api/backend/src/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'prisma', 'migrations');

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; rx: RegExp }> = [
  { name: 'DROP TABLE',      rx: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN',     rx: /\bDROP\s+COLUMN\b/i },
  { name: 'DROP CONSTRAINT', rx: /\bDROP\s+CONSTRAINT\b/i },
  { name: 'DROP INDEX',      rx: /\bDROP\s+INDEX\b/i },
  { name: 'DROP SCHEMA',     rx: /\bDROP\s+SCHEMA\b/i },
  { name: 'TRUNCATE',        rx: /\bTRUNCATE\b/i },
];

const ALLOW_DROP_MARKER = /--\s*migration-shape:\s*allow-drop\s+reason:/i;

interface MigrationFile {
  migrationName: string;
  filePath: string;
  contents: string;
}

function listMigrationSqlFiles(): MigrationFile[] {
  if (!statSync(MIGRATIONS_DIR, { throwIfNoEntry: false })) {
    return [];
  }
  const result: MigrationFile[] = [];
  for (const entry of readdirSync(MIGRATIONS_DIR)) {
    const dirPath = join(MIGRATIONS_DIR, entry);
    const dirStat = statSync(dirPath, { throwIfNoEntry: false });
    if (!dirStat?.isDirectory()) continue;
    const sqlPath = join(dirPath, 'migration.sql');
    const sqlStat = statSync(sqlPath, { throwIfNoEntry: false });
    if (!sqlStat?.isFile()) continue;
    result.push({
      migrationName: entry,
      filePath: sqlPath,
      contents: readFileSync(sqlPath, 'utf-8'),
    });
  }
  return result;
}

describe('migration shape — no destructive DROPs without explicit waiver', () => {
  const migrations = listMigrationSqlFiles();

  it('migrations directory exists and contains at least one migration', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('no migration contains a forbidden DROP/TRUNCATE statement (without an explicit waiver)', () => {
    const violations: string[] = [];

    for (const migration of migrations) {
      const hasWaiver = ALLOW_DROP_MARKER.test(migration.contents);
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (!pattern.rx.test(migration.contents)) continue;
        if (hasWaiver) continue;
        violations.push(`${migration.migrationName}: contains ${pattern.name}`);
      }
    }

    if (violations.length > 0) {
      // Format the failure so the runbook can be cited from the test output.
      throw new Error(
        `Destructive statements found without "-- migration-shape:allow-drop reason: ..." waiver:\n  ${violations.join('\n  ')}\n\nSee docs/ops/db-migrate-cutover-runbook.md.`,
      );
    }
    expect(violations).toEqual([]);
  });
});
