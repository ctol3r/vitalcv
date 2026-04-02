#!/usr/bin/env bash
# =============================================================================
# VitalCV — Prisma P3005 Baseline Fix
# Generated: 2026-04-02
#
# PURPOSE:
#   Railway production DB already has all tables applied.
#   Prisma does not yet have a _prisma_migrations history table, so it
#   raises P3005 ("database schema is not empty").
#   This script marks all 42 existing migrations as "applied" (baseline),
#   then runs migrate deploy to confirm a clean state.
#
# SAFETY GUARANTEES:
#   - Does NOT run migrate reset
#   - Does NOT drop or recreate any tables
#   - Does NOT modify migration files
#   - Does NOT introduce new migrations
#   - Only writes rows to the _prisma_migrations shadow table
#
# HOW TO RUN:
#   cd apps/api/backend
#   bash docs/ops/prisma-baseline-fix.sh
#
# PREREQUISITES:
#   - DATABASE_URL must be set (or present in .env)
#   - pnpm / npx must be available
#   - Run from the monorepo root OR from apps/api/backend
# =============================================================================

set -euo pipefail

# ── Resolve working directory ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../../apps/api/backend" 2>/dev/null || echo ".")"

# If we're already in apps/api/backend, stay here
if [[ -f "prisma/schema.prisma" ]]; then
  BACKEND_DIR="$(pwd)"
fi

echo "▶ Working directory: $BACKEND_DIR"
cd "$BACKEND_DIR"

# ── Confirm schema.prisma is present ─────────────────────────────────────────
if [[ ! -f "prisma/schema.prisma" ]]; then
  echo "❌ prisma/schema.prisma not found. Run from apps/api/backend."
  exit 1
fi

# ── Step 1: Mark all 42 migrations as applied ─────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  STEP 1 — Baselining 42 migrations (resolve --applied)"
echo "═══════════════════════════════════════════════════════"
echo ""

MIGRATIONS=(
  "000_init"
  "20260215000000_wave8_9"
  "20260215100000_wave10_11_artifact_snapshot"
  "20260216000001_wave12_13_pilot_org"
  "20260216100000_wave14_15_monitoring_truststate"
  "20260217000000_wave22_23_pilot_plan"
  "20260217100000_wave32_verifier_onboarding"
  "20260219000000_wave33_verifier_funnel_metrics"
  "20260220000001_wave26_27_multitenant"
  "20260222000000_wave34_artifact_merkle"
  "20260230000000_wave35_deterministic_lifecycle"
  "20260301000000_wave36_issuer_registry_transparency_log"
  "20260302000000_waveO_Q_multi_tenant_federation_monitoring"
  "20260304000000_waveU_V_W_cross_check_pipeline"
  "20260305000000_waveX_Y_Z_integrations_forecast_dashboard"
  "20260306000000_wave2a_provider_verification_artifact"
  "20260307000000_add_psv_window_and_eventlog"
  "20260308000000_add_user_auth_rbac"
  "20260309000000_wave126_persistence_migration"
  "20260310000000_wave196_production_hardening"
  "20260311000000_wave198_npi_did_binding"
  "20260312000000_wave199_sd_jwt_issuer_persistence"
  "20260312100000_wave227_opportunities"
  "20260314000000_wave259_revocation_propagation_engine"
  "20260314000000_wave269_verifier_decision_outbox"
  "20260314001000_wave259_authority_graph_tables"
  "20260314010000_wave270_identity_substrate_hardening"
  "20260314020000_wave271_watchtower"
  "20260314030000_verification_artifact_status_list_index_fix"
  "20260314110000_wave272_graph_runtime"
  "20260315113000_wave_c18_c20_intelligence_engine"
  "20260315140000_wave_c41_c44_investigator_framework"
  "20260315170000_wave_c49_c51_action_prediction_engine"
  "20260315183000_wave_c45_c48_storyline_engine_core"
  "20260322000000_apply_fix_bundle_share_event"
  "20260322120000_shape_of_truth_provider_decision_state"
  "20260322160000_entity_role_model"
  "20260322170000_passkey_ownership"
  "20260322180000_canonical_schema_s1_s5"
  "20260322190000_wave_m1_m3_truth_engine"
  "20260323010000_m3_receipt_traceability_hardening"
  "20260324140000_wave_c60_c61_geospatial"
)

TOTAL=${#MIGRATIONS[@]}
COUNT=0

for migration in "${MIGRATIONS[@]}"; do
  COUNT=$((COUNT + 1))
  echo "  [$COUNT/$TOTAL] Marking as applied: $migration"
  npx prisma migrate resolve --applied "$migration" --schema prisma/schema.prisma
done

echo ""
echo "✅ All $TOTAL migrations marked as applied."

# ── Step 2: Run migrate deploy to confirm clean state ─────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  STEP 2 — Running migrate deploy (should be a no-op)"
echo "═══════════════════════════════════════════════════════"
echo ""

npx prisma migrate deploy --schema prisma/schema.prisma

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ BASELINE COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Expected final state:"
echo "  - _prisma_migrations table exists with 42 rows"
echo "  - All migrations show status: applied"
echo "  - migrate deploy reports: 'No pending migrations to apply'"
echo "  - P3005 error eliminated"
echo ""
