---
playbook_id: pilot-institutional-rollout
version: 1
replay_safe: true
fail_closed: true
schema: vitalcv.playbook.v1
---

# Pilot Institutional Rollout

Primary rollout playbook for a new pilot institution (hospital, health system,
or licensed-provider org). Drives the first 30 days from contract-sign to first
production credential. Every step is replay-safe and fail-closed.

## Preconditions

- gate: deployment-survivability:GREEN
  ttl: 24h
  on_missing: STOP
- gate: rollout-survivability:GREEN
  ttl: 24h
  on_missing: STOP
- gate: deployment-certification:GREEN
  ttl: 24h
  on_missing: STOP
- gate: tenant-isolation-canary:GREEN
  ttl: 72h
  on_missing: STOP
- gate: partner-contract-signed:GREEN
  ttl: forever
  on_missing: STOP

## Steps

1. step_id: provision_tenant
   action: Run `scripts/tenant/provision.mjs --partner=<slug>` to create the tenant row and emit the `tenant_provisioned` evidence row.
   verification: `tenant_provisioned` evidence row visible in audit feed within 60s; tenantId echoed by the script.
   evidence_capture: tenant_provisioned
   recovery: Run `scripts/tenant/teardown.mjs --tenant=<id>` and capture `tenant_torn_down` evidence row; the teardown is allowed only inside the first 24h window before any credential is issued.
   ambiguity_branch: If the partner slug is ambiguous (two contracts in flight) escalate to deployment-lead before running provision; do not invent a slug.
   on_failure: escalate to deployment-lead

2. step_id: seed_reviewer_roster
   action: Import the partner's reviewer roster from the signed onboarding sheet into the tenant; emit `reviewer_roster_seeded`.
   verification: Reviewer count in `reviewer_roster_seeded` row equals the signed sheet count; cross-tenant sweep returns zero rows for this tenantId.
   evidence_capture: reviewer_roster_seeded
   recovery: Run `scripts/tenant/reviewer-roster-clear.mjs --tenant=<id>` and capture `reviewer_roster_cleared`; permitted only before any reviewer has signed in.
   ambiguity_branch: If the partner sheet is unsigned, undated, or names a reviewer not on the partner's licensure list, stop and escalate to compliance-lead before importing.
   on_failure: escalate to compliance-lead

3. step_id: enable_partner_review_surface
   action: Flip the `PILOT_REVIEW_SURFACE` flag on for this tenantId via the lineage-tracked flag emitter; emit `review_surface_enabled`.
   verification: A subsequent deployment-lineage manifest contains this flag in `featureFlags`; the partner can load `/issuer/review/<requestId>` for a known test request.
   evidence_capture: review_surface_enabled
   recovery: Flip the flag off and emit `review_surface_disabled`; the flag flip is itself a lineage-emitting event.
   ambiguity_branch: If a deployment manifest does not appear within 10 minutes of the flag flip, stop and escalate; do not assume the flip propagated.
   on_failure: escalate to deployment-lead

4. step_id: partner_signoff
   action: Capture the partner's review of the first test credential and their explicit signoff into the `partner_signoff_captured` evidence row.
   verification: Evidence row carries the partner's account id and the test credential id; the row is signed by the partner's account, not by the deployment-lead.
   evidence_capture: partner_signoff_captured
   recovery: Mark the prior signoff invalid via `partner-signoff-invalidate.mjs --row=<id>`; the invalidation itself emits an evidence row and a new signoff must follow.
   ambiguity_branch: If the partner gives verbal signoff but has not yet signed in the surface, stop and ask the partner to sign in; do not transcribe verbal confirmation into the row.
   on_failure: escalate to partner-success

5. step_id: first_production_credential
   action: Permit issuance of the first non-test credential; the issuance itself runs through the existing issuer chain and emits the standard credential evidence rows.
   verification: A `credential_issued` evidence row appears for the tenantId with `is_test: false`; the linked deployment manifest's `configHash` matches the current source.
   evidence_capture: credential_issued
   recovery: irreversible: tenant-deletion-precheck:GREEN
   ambiguity_branch: If the partner has not completed step 4 within the agreed window (default 72h), stop and re-run step 4; do not issue a production credential on a stale or implied signoff.
   on_failure: escalate to compliance-lead

## Recovery

- failure_mode: half_applied_flag_flip
  triggers: `review_surface_enabled` evidence row present but no subsequent deployment-lineage manifest within 10 minutes
  procedure:
    1. Run `scripts/deploy/replay-manifest.mjs --path=.deployment-lineage/latest.json` and confirm the latest manifest pre-dates the flag flip.
    2. Flip the flag off via the lineage-tracked emitter; capture `review_surface_disabled`.
    3. Re-run from step 3 (`enable_partner_review_surface`).
  evidence_capture: review_surface_disabled

- failure_mode: reviewer_roster_drift
  triggers: A reviewer signs in whose account id is absent from the `reviewer_roster_seeded` row
  procedure:
    1. Suspend the reviewer's session via `scripts/tenant/reviewer-suspend.mjs --account=<id>`.
    2. Capture `reviewer_session_suspended`.
    3. Cross-check the partner's licensure list before re-adding.
  evidence_capture: reviewer_session_suspended

- failure_mode: signoff_replay_mismatch
  triggers: `partner_signoff_captured` exists but the linked test credential id no longer resolves
  procedure:
    1. Invalidate the signoff via `partner-signoff-invalidate.mjs --row=<id>`.
    2. Capture `partner_signoff_invalidated`.
    3. Re-issue the test credential and request a fresh signoff from the partner's account.
  evidence_capture: partner_signoff_invalidated

## Escalation

- level: 1
  role: deployment-lead
  contact: ops-rotation pointer in `docs/ops/launch-blockers.md`
  trigger: any STOP in the playbook fires, or any verification step fails

- level: 2
  role: compliance-lead
  contact: compliance pointer in `docs/ops/launch-blockers.md`
  trigger: roster drift, signoff replay mismatch, or any reviewer / partner identity ambiguity

- level: 3
  role: principal-eng
  contact: principal-eng pointer in `docs/ops/launch-blockers.md`
  trigger: irreversible-step gate request, lineage chain orphan, or replay drift code other than CLEAN / SHA

## Evidence Capture

- row_id: tenant_provisioned
  source: tenant-provisioning service audit feed
  retention: 7 years
- row_id: reviewer_roster_seeded
  source: roster-import service audit feed
  retention: 7 years
- row_id: review_surface_enabled
  source: lineage-tracked flag emitter
  retention: 7 years
- row_id: review_surface_disabled
  source: lineage-tracked flag emitter
  retention: 7 years
- row_id: partner_signoff_captured
  source: partner-review surface audit feed
  retention: 7 years
- row_id: credential_issued
  source: issuer chain audit feed
  retention: 7 years
- row_id: tenant_torn_down
  source: tenant-provisioning service audit feed
  retention: 7 years
- row_id: reviewer_roster_cleared
  source: roster-import service audit feed
  retention: 7 years
- row_id: reviewer_session_suspended
  source: session-management service audit feed
  retention: 7 years
- row_id: partner_signoff_invalidated
  source: partner-review surface audit feed
  retention: 7 years

## Ambiguity Branches

- decision: partner_slug_uncertain
  if_unsure: escalate
  never: invent a partner slug from a verbal cue or an inbox subject line; the slug must originate from the signed contract.

- decision: reviewer_identity_uncertain
  if_unsure: stop
  never: import a reviewer whose name does not appear verbatim on the partner's licensure list; phonetic matches and email-prefix matches are not licensure evidence.

- decision: partner_signoff_uncertain
  if_unsure: escalate
  never: backfill the partner signoff field from a verbal confirmation; the row must originate from the partner's own evidence capture.

- decision: production_credential_timing_uncertain
  if_unsure: stop
  never: issue a production credential on the assumption that the partner has signed off; the `partner_signoff_captured` row must exist and resolve to the current test credential id.
