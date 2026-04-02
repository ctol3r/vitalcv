# Migration: Add `explanation` column to `claim_records`

## Priority: P0 — Wedge Blocker

All NPI ingest is failing on production with:
```
Invalid `prisma.claimRecord.create()` invocation:
The column `explanation` does not exist in the current database.
```

This blocks the entire wedge: NPI → readiness → passport.

## Root Cause

Prisma schema includes `explanation String?` on `ClaimRecord` model (added in migration `20260323010000_m3_receipt_traceability_hardening`), but this migration has not been applied to the production database.

## SQL (single statement — safe to run on live DB)

```sql
ALTER TABLE claim_records ADD COLUMN IF NOT EXISTS explanation TEXT;
```

## Verification

After running:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'claim_records' AND column_name = 'explanation';
```

Expected: `explanation | text`

## Impact

- **Zero data loss**: adds nullable column with no default
- **Zero downtime**: `IF NOT EXISTS` is safe for concurrent execution
- **Unblocks**: all 12 source pipelines (NPPES, OIG, PECOS, etc.)

## How to Apply

### Option A: Direct SQL (fastest)
```bash
psql $DATABASE_URL -c "ALTER TABLE claim_records ADD COLUMN IF NOT EXISTS explanation TEXT;"
```

### Option B: Prisma migrate
```bash
cd apps/api/backend && npx prisma migrate deploy
```

### Option C: Railway CLI
```bash
railway run --service vitalcv-api "npx prisma migrate deploy"
```

## Status
- [ ] SQL written
- [ ] Applied to production
- [ ] Verified with test NPI ingest
