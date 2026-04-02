# Consolidated Migration Plan — 2026-04-02

## Problem
Production database is behind the Prisma schema. Code expects columns/tables that don't exist in production.

## Symptom
All NPI ingest fails with `The column 'explanation' does not exist in the current database.`

## Pending Migrations (in order)

### 1. `20260322180000_canonical_schema_s1_s5` — New tables
Creates: `vcv_credentials`, `vcv_education_records`, `vcv_organization_contexts`, `vcv_org_context_subjects`, `vcv_org_context_status_events`, `vcv_user_entity_claims`

### 2. `20260322190000_wave_m1_m3_truth_engine` — Column additions
Alters: `vcv_credentials` (7 cols), `bundle_share_events` (7 cols)

### 3. `20260323010000_m3_receipt_traceability_hardening` — Column additions
Alters: `claim_records` (explanation, freshness_window_hours), `verification_receipt_records` (8 cols)

### 4. `20260324140000_wave_c60_c61_geospatial` — New tables
Creates: `institutions`, `provider_locations`, `geographic_boundaries`, `provider_boundary_assignments` + indexes

## Recommended Action

Run Prisma migrate deploy (applies all pending in order):
```bash
cd ~/vitalcv/apps/api/backend && npx prisma migrate deploy
```

Or via Railway:
```bash
railway run --service vitalcv-api "cd apps/api/backend && npx prisma migrate deploy"
```

## Risk Assessment
- All additions are new tables or nullable columns — **zero data loss risk**
- No drops, no renames, no type changes
- `IF NOT EXISTS` not used in all migrations — run in single transaction
- Safe for production if applied during low-traffic window

## Verification After Migration
```bash
curl -s -X POST "https://delightful-essence-production.up.railway.app/api/identity/1003000126/ingest" \
  -H "Content-Type: application/json" -d '{}' | python3 -m json.tool | grep '"status"'
```

Expected: `"status":"OK"` instead of `"status":"FAILED"`
