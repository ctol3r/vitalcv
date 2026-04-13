# Database Migration Safety

This document defines the rules and process for safe database migrations.

## Core Rules

1. **Backward Compatible**: New migrations must work with old code
2. **Rollback Capable**: Every migration must have a down migration
3. **Non-Blocking**: Long-running migrations must be non-blocking
4. **Test First**: Never migrate production directly

## Migration Requirements

### Before Writing a Migration

1. Understand the data volume
2. Estimate migration time
3. Design the rollback strategy
4. Test locally on realistic data

### Migration Checklist

Every migration must:

- [ ] Have an up() method
- [ ] Have a down() method
- [ ] Be idempotent (can run multiple times safely)
- [ ] Handle edge cases (null values, missing columns)
- [ ] Not lock tables for > 1 second
- [ ] Tested on staging database
- [ ] Rollback tested on staging

## Migration Process

### 1. Write Migration

Location: `packages/core/src/db/migrations/YYYYMMDDHHMMSS-description.ts`

```typescript
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Migration logic
  await db.schema
    .alterTable('users')
    .addColumn('email_verified', 'boolean', (col) => col.defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Rollback logic
  await db.schema
    .alterTable('users')
    .dropColumn('email_verified')
    .execute();
}
```

### 2. Test Locally

```bash
# Run migration up
pnpm migrate:up

# Test application
pnpm dev

# Rollback
pnpm migrate:down
```

### 3. Deploy to Staging (Migration Only)

```bash
# Build migration package
pnpm build:db

# Deploy migration to staging
pnpm deploy:migration:staging
```

### 4. Verify Staging

- [ ] Migration ran successfully
- [ ] Data looks correct
- [ ] No errors in logs
- [ ] Application still works

### 5. Deploy Code Using New Schema

```bash
# Deploy application code to staging
pnpm deploy:staging
```

### 6. Verify Staging Again

- [ ] Application works with new schema
- [ ] New features work
- [ ] Old features still work
- [ ] No errors

### 7. Deploy to Production

```bash
# Deploy migration to production
pnpm deploy:migration:production

# Wait and verify

# Deploy application code
pnpm deploy:production
```

## Common Patterns

### Adding a Column (Non-Blocking)

```typescript
// Safe: Add column with default value
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('profile_complete', 'boolean', (col) => col.defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('profile_complete')
    .execute();
}
```

### Adding a Column (Blocking - Use Care)

```typescript
// NOT SAFE: Adding NOT NULL column without default
// This locks the table and copies all data

// INSTEAD: Use multiple migrations
// Migration 1: Add nullable column
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('phone', 'varchar(20)')
    .execute();
}

// Migration 2: Backfill data (non-blocking)
export async function up(db: Kysely<any>): Promise<void> {
  // Backfill in batches
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const users = await db
      .selectFrom('users')
      .select('id')
      .where('phone', 'is', null)
      .limit(batchSize)
      .offset(offset)
      .execute();

    if (users.length === 0) break;

    await db
      .updateTable('users')
      .set({ phone: 'unknown' })
      .where('id', 'in', users.map((u) => u.id))
      .execute();

    offset += batchSize;
  }
}

// Migration 3: Make column NOT NULL
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .alterColumn('phone', (col) => col.setNotNull())
    .execute();
}
```

### Renaming a Column

```typescript
// NOT SAFE: Renaming breaks old code

// INSTEAD: Create new column, migrate data, then drop old
// Migration 1: Add new column
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('email_address', 'varchar(255)')
    .execute();
}

// Migration 2: Migrate data
export async function up(db: Kysely<any>): Promise<void> {
  await db
    .updateTable('users')
    .set({ email_address: db.selectFrom('users').select('email') })
    .execute();
}

// Migration 3: Drop old column (after code is deployed)
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('email')
    .execute();
}
```

### Adding an Index

```typescript
// SAFE: Adding index is non-blocking (CONCURRENTLY)
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('idx_users_email')
    .on('users')
    .column('email')
    .execute();

  // In PostgreSQL, use CONCURRENTLY for large tables:
  await db.executeQuery(
    sql`CREATE INDEX CONCURRENTLY idx_users_email ON users(email)`
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_users_email')
    .execute();
}
```

### Changing Data Type

```typescript
// NOT SAFE: Direct type change can break

// INSTEAD: Create new column, migrate data, swap
// Migration 1: Add new column
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('age_new', 'integer')
    .execute();
}

// Migration 2: Migrate and validate data
export async function up(db: Kysely<any>): Promise<void> {
  await db
    .updateTable('users')
    .set({ age_new: db.cast('age', 'integer') })
    .execute();
}

// Migration 3: Drop old column (after code is deployed)
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('age')
    .execute();
}
```

## Rollback Process

If a migration causes issues:

### 1. Stop the Problem

```bash
# If migration is still running, kill it
# Check long-running queries
SELECT pid, query_start, query FROM pg_stat_activity
WHERE state != 'idle';

# Kill if necessary
SELECT pg_cancel_backend(<pid>);
```

### 2. Rollback Migration

```bash
# Run down migration
pnpm migrate:down

# Or manually rollback if up migration partially completed
```

### 3. Assess Impact

- Check application logs
- Verify data integrity
- Test application functionality

### 4. Fix and Re-Deploy

- Fix the issue in the migration
- Test thoroughly on staging
- Deploy to production again

## Migration Safety Checks

Before creating a PR for a migration:

### Performance Checks

```sql
-- Check table size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename = 'your_table';

-- Estimate row count
SELECT COUNT(*) FROM your_table;

-- Check existing indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'your_table';
```

### Lock Duration

```sql
-- Test migration on staging with a copy
CREATE TABLE your_table_test AS SELECT * FROM your_table;

-- Run migration and measure time
EXPLAIN ANALYZE ALTER TABLE your_table_test ADD COLUMN new_col text;
```

## Common Pitfalls

### ❌ DON'T

- Lock tables for long periods
- Add NOT NULL columns without defaults
- Rename columns directly
- Change column types directly
- Run migrations during peak hours
- Test migrations on production

### ✅ DO

- Use CONCURRENTLY for indexes
- Add columns with defaults first
- Create new columns, migrate data, drop old
- Use multiple migrations for complex changes
- Test on staging first
- Rollback on staging before deploying to production

## Emergency Rollback

If a migration causes production issues:

1. **Immediate**: Disable affected features via feature flags
2. **Short-term**: Roll back application code (works with old schema)
3. **Long-term**: Roll back migration if necessary

```bash
# Rollback application code
git revert <commit-hash>
pnpm deploy:production

# Then decide if migration needs rollback
# Down migrations are dangerous on production
# Only use if absolutely necessary
```

## Monitoring

After each migration:

1. Check PostgreSQL logs for errors
2. Monitor database performance metrics
3. Watch for slow queries
4. Verify application health

## Questions?

Ask in #engineering before creating complex migrations.

Remember: It's always better to ask than to break production.
