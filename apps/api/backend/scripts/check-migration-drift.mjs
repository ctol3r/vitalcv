#!/usr/bin/env node
/**
 * check-migration-drift.mjs — fail when schema.prisma declares a model that no
 * migration ever creates (Seal W0.0).
 *
 * WHY: the migration chain silently lost the ability to rebuild the database.
 * 18 models — including `applications`, the marketplace's core table — existed
 * only because production was built with `prisma db push`. Nothing caught it:
 * backend-tests also uses `db push`, so its ephemeral DB is built from the
 * schema and every table exists; only Railway's preflight replays the chain,
 * and no migration had referenced a drifted table until one finally did and
 * died with `relation "applications" does not exist`.
 *
 * This check is cheap, needs no database, and runs in CI on every PR.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(backendRoot, 'prisma/schema.prisma');
const migrationsDir = join(backendRoot, 'prisma/migrations');

const schema = readFileSync(schemaPath, 'utf8');

// model Name { ... @@map("table_name") } → physical table name
const models = new Map();
for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const [, name, body] = match;
  const mapped = body.match(/@@map\("([^"]+)"\)/);
  models.set(name, mapped ? mapped[1] : name);
}

const created = new Set();
if (existsSync(migrationsDir)) {
  for (const entry of readdirSync(migrationsDir)) {
    const sqlPath = join(migrationsDir, entry, 'migration.sql');
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?([\w.]+)"?/gi)) {
      created.add(m[1].split('.').pop());
    }
  }
}

const missing = [...models.entries()]
  .filter(([, table]) => !created.has(table))
  .map(([model, table]) => ({ model, table }))
  .sort((a, b) => a.table.localeCompare(b.table));

if (missing.length > 0) {
  console.error(
    `\nMIGRATION DRIFT — ${missing.length} model(s) in schema.prisma are never CREATEd by any migration.\n` +
      `A fresh database (CI preflight, local dev, disaster recovery) cannot be rebuilt from the chain.\n`,
  );
  for (const { model, table } of missing) console.error(`  - model ${model} → table "${table}"`);
  console.error(
    `\nFix: add a migration that creates them (use CREATE TABLE IF NOT EXISTS so existing\n` +
      `databases are a no-op). Do NOT resolve this with \`prisma db push\` — that is what\n` +
      `caused the drift.\n`,
  );
  process.exit(1);
}

console.log(`Migration drift check: PASS — all ${models.size} models are created by the migration chain.`);
