# Database Migration Baseline

**Date documented:** 2026-05-03  
**Migration path:** `apps/api/backend/prisma/migrations/`  
**Total:** 47 date-based migration directories + 2 manual SQL files

All migrations below are applied in order by `prisma migrate deploy`. The migration lock file at `migration_lock.toml` enforces the PostgreSQL provider.

---

## Migration inventory

| # | Directory | Wave / Feature area |
|---|---|---|
| 1 | `000_init` | Initial schema |
| 2 | `20260215000000_wave8_9` | Wave 8–9 foundation |
| 3 | `20260215100000_wave10_11_artifact_snapshot` | Artifact snapshot |
| 4 | `20260216000001_wave12_13_pilot_org` | Pilot org tables |
| 5 | `20260216100000_wave14_15_monitoring_truststate` | Monitoring + trust state |
| 6 | `20260217000000_wave22_23_pilot_plan` | Pilot plan schema |
| 7 | `20260217100000_wave32_verifier_onboarding` | Verifier onboarding |
| 8 | `20260219000000_wave33_verifier_funnel_metrics` | Verifier funnel metrics |
| 9 | `20260220000001_wave26_27_multitenant` | Multi-tenant foundation |
| 10 | `20260222000000_wave34_artifact_merkle` | Artifact Merkle tree |
| 11 | `20260230000000_wave35_deterministic_lifecycle` | Deterministic lifecycle |
| 12 | `20260301000000_wave36_issuer_registry_transparency_log` | Issuer registry + transparency log |
| 13 | `20260302000000_waveO_Q_multi_tenant_federation_monitoring` | Federation monitoring |
| 14 | `20260304000000_waveU_V_W_cross_check_pipeline` | Cross-check pipeline |
| 15 | `20260305000000_waveX_Y_Z_integrations_forecast_dashboard` | Integrations + forecast |
| 16 | `20260306000000_wave2a_provider_verification_artifact` | Provider verification artifact |
| 17 | `20260307000000_add_psv_window_and_eventlog` | PSV window + event log |
| 18 | `20260308000000_add_user_auth_rbac` | User auth RBAC |
| 19 | `20260309000000_wave126_persistence_migration` | Persistence layer migration |
| 20 | `20260310000000_wave196_production_hardening` | Production hardening |
| 21 | `20260311000000_wave198_npi_did_binding` | NPI DID binding |
| 22 | `20260312000000_wave199_sd_jwt_issuer_persistence` | SD-JWT issuer persistence |
| 23 | `20260312100000_wave227_opportunities` | Opportunities schema |
| 24 | `20260314000000_wave259_revocation_propagation_engine` | Revocation propagation |
| 25 | `20260314000000_wave269_verifier_decision_outbox` | Verifier decision outbox |
| 26 | `20260314001000_wave259_authority_graph_tables` | Authority graph tables |
| 27 | `20260314010000_wave270_identity_substrate_hardening` | Identity substrate hardening |
| 28 | `20260314020000_wave271_watchtower` | Watchtower schema |
| 29 | `20260314030000_verification_artifact_status_list_index_fix` | Status list index fix |
| 30 | `20260314110000_wave272_graph_runtime` | Graph runtime |
| 31 | `20260315113000_wave_c18_c20_intelligence_engine` | Intelligence engine |
| 32 | `20260315140000_wave_c41_c44_investigator_framework` | Investigator framework |
| 33 | `20260315170000_wave_c49_c51_action_prediction_engine` | Action prediction engine |
| 34 | `20260315183000_wave_c45_c48_storyline_engine_core` | Storyline engine core |
| 35 | `20260322000000_apply_fix_bundle_share_event` | Bundle share event fix |
| 36 | `20260322120000_shape_of_truth_provider_decision_state` | Provider decision state |
| 37 | `20260322160000_entity_role_model` | Entity role model |
| 38 | `20260322170000_passkey_ownership` | Passkey ownership |
| 39 | `20260322180000_canonical_schema_s1_s5` | Canonical schema S1–S5 |
| 40 | `20260322190000_wave_m1_m3_truth_engine` | Truth engine M1–M3 |
| 41 | `20260323010000_m3_receipt_traceability_hardening` | Receipt traceability hardening |
| 42 | `20260324140000_wave_c60_c61_geospatial` | Geospatial |
| 43 | `20260418000000_acceptance_graph_learning_capsules` | Acceptance graph learning capsules |
| 44 | `20260419000000_decision_capsule_revocation_org` | Decision capsule revocation (org) |
| 45 | `20260420000000_decision_capsule_revocation_org_fields` | Decision capsule revocation (fields) |
| 46 | `manual_start_activation_graph.sql` | Manual: start activation graph |
| 47 | `manual_start_activation_sidecar.sql` | Manual: start activation sidecar |

---

## Deployment procedure

```bash
# Standard deploy (idempotent — skips already-applied migrations)
cd apps/api/backend
DATABASE_URL=<postgres-url> npx prisma migrate deploy
```

## Dry-run procedure

See `scripts/db-migrate-dry-run.sh` for the local dry-run script that checks migrations can be applied to a fresh ephemeral database without error.

## Production database requirements

A production Postgres connection is required (minimum: Postgres 15). Recommended options:
- **Neon** (serverless Postgres, Vercel-native integration)
- **Vercel Postgres** (managed, integrated with Vercel dashboard)
- **Supabase** (managed Postgres with dashboard UI)

Set `DATABASE_URL` as a Vercel environment variable (not a build-time env var) before enabling the `db-migrate-gate.yml` CI check.

## User action required

To activate the production DB migration gate:
1. Provision a Postgres 15+ instance (Neon recommended)
2. Set `DATABASE_URL` in Vercel environment (production + preview environments)
3. The `db-migrate-gate.yml` workflow will then run `prisma migrate deploy` on every PR touching schema files
