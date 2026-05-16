---
playbook_id: institutional-onboarding-sequence
version: 1
replay_safe: true
fail_closed: true
schema: vitalcv.playbook.v1
---

# Institutional Onboarding Sequence

Tenant onboarding sequence for an institutional partner — the procedural arc
from `tenant_provisioned` to first revocation. Emits four named metrics into
the playbook lineage manifest that together score onboarding clarity.

## Preconditions

- gate: pilot-institutional-rollout:GREEN
  ttl: 24h
  on_missing: STOP
- gate: tenant-isolation-canary:GREEN
  ttl: 72h
  on_missing: STOP
- gate: partner-onboarding-sheet-signed:GREEN
  ttl: forever
  on_missing: STOP

## Onboarding metrics

The four metrics that this playbook captures into the lineage manifest are:

| Metric | Type | Source evidence row | Null rule |
|---|---|---|---|
| `time_to_first_credential` | duration_seconds | wall-clock from `tenant_provisioned` to first `credential_issued` with `is_test: false` | null if no production credential has been issued |
| `reviewer_handoff_count` | integer | count of `reviewer_handoff` evidence rows under this tenant | 0 if none observed |
| `first_revocation_at` | iso_timestamp | wall-clock of the first `revocation_issued` evidence row | null if no revocation has been issued |
| `evidence_rows_captured` | integer | count of all evidence rows captured under this onboarding session | 0 if session has produced no rows |

The metrics are written into the manifest at session-close, not at observation
time. A counter without a captured source row is itself an audit failure.

## Steps

1. step_id: kickoff_session
   action: Open an onboarding session row for the tenantId via `scripts/tenant/onboarding-session-open.mjs --tenant=<id>`; emit `onboarding_session_opened`.
   verification: Session row visible with `state: open`; tenantId echoed by the script.
   evidence_capture: onboarding_session_opened
   recovery: Close the session via `onboarding-session-close.mjs --session=<id> --reason=aborted`; capture `onboarding_session_aborted`.
   ambiguity_branch: If a prior open onboarding session exists for this tenant, stop and read the prior session to its close before opening a new one.
   on_failure: escalate to partner-success

2. step_id: introduce_reviewer_roster
   action: Walk the partner through the reviewer surface and capture the first reviewer's signed-in session; emit `reviewer_first_signin`.
   verification: A `reviewer_first_signin` row exists for an accountId that appears in the tenant's seeded roster.
   evidence_capture: reviewer_first_signin
   recovery: If the wrong reviewer signed in, suspend the session via `reviewer-suspend.mjs --account=<id>` and capture `reviewer_session_suspended`; do not delete the original signin row.
   ambiguity_branch: If the signed-in account does not appear in the seeded roster, stop and treat this as a roster-drift event; do not retroactively add the reviewer.
   on_failure: escalate to compliance-lead

3. step_id: issue_first_test_credential
   action: Walk the partner through issuing a test credential; emit `credential_issued` with `is_test: true`.
   verification: A `credential_issued` row with `is_test: true` exists for the tenantId.
   evidence_capture: credential_issued
   recovery: Mark the test credential withdrawn via `credential-withdraw.mjs --credential=<id>`; capture `credential_withdrawn`.
   ambiguity_branch: If the partner attempts to issue a non-test credential at this step, stop and revert to the test path; production credentials are not permitted during onboarding step 3.
   on_failure: escalate to partner-success

4. step_id: reviewer_handoff_drill
   action: Walk the partner's reviewers through at least one explicit handoff (reviewer A passes a request to reviewer B); emit `reviewer_handoff` per handoff observed.
   verification: At least one `reviewer_handoff` row exists for the tenantId; each row names both the from-account and the to-account.
   evidence_capture: reviewer_handoff
   recovery: Mark a misrouted handoff invalid via `reviewer-handoff-invalidate.mjs --row=<id>`; capture `reviewer_handoff_invalidated`.
   ambiguity_branch: If only one reviewer is available on the partner side, stop and reschedule the drill; a handoff from reviewer A to reviewer A is not a handoff.
   on_failure: escalate to partner-success

5. step_id: issue_first_production_credential
   action: Permit the partner to issue the first non-test credential; emit `credential_issued` with `is_test: false`.
   verification: A `credential_issued` row with `is_test: false` exists; `time_to_first_credential` is computed and written into the onboarding session metrics.
   evidence_capture: credential_issued
   recovery: irreversible: production-credential-recovery-gate:OPEN
   ambiguity_branch: If the partner has not completed step 4 within the agreed window, stop and re-run step 4; do not issue a production credential without a recorded reviewer handoff drill.
   on_failure: escalate to compliance-lead

6. step_id: revocation_drill
   action: Walk the partner through a single revocation on a test credential to confirm the revocation surface works; emit `revocation_issued` and capture `first_revocation_at`.
   verification: A `revocation_issued` row exists for a credential under this tenantId; `first_revocation_at` is populated in the session metrics.
   evidence_capture: revocation_issued
   recovery: Re-run the drill on a fresh test credential if the first revocation does not resolve; do not delete the prior revocation row.
   ambiguity_branch: If the partner is uncertain about which credential to revoke, stop and seed a dedicated test credential for the drill; do not revoke a production credential as a drill.
   on_failure: escalate to partner-success

7. step_id: close_session
   action: Close the onboarding session via `onboarding-session-close.mjs --session=<id> --reason=complete`; emit the four metrics into the playbook lineage manifest.
   verification: Session row state is `closed`; manifest contains `time_to_first_credential`, `reviewer_handoff_count`, `first_revocation_at`, and `evidence_rows_captured`; null-rule applied where appropriate.
   evidence_capture: onboarding_session_closed
   recovery: Reopen the session via `onboarding-session-reopen.mjs --session=<id> --reason=<text>`; capture `onboarding_session_reopened`; the closure row is preserved.
   ambiguity_branch: If a metric reads as null at close but the operator believes it should be populated, stop and read the source evidence feed directly; do not hand-edit the metric into the manifest.
   on_failure: escalate to deployment-lead

## Recovery

- failure_mode: session_left_open
  triggers: Onboarding session exists with `state: open` and no activity for the last 7 days
  procedure:
    1. Read the source evidence feed to confirm no in-flight activity.
    2. Close the session with `reason: timed_out`.
    3. Capture `onboarding_session_timed_out`.
    4. If a partner reopens after timeout, run `onboarding-session-reopen.mjs` and capture `onboarding_session_reopened`.
  evidence_capture: onboarding_session_timed_out

- failure_mode: metric_source_missing
  triggers: At session close, a metric's source evidence row is missing (e.g., `reviewer_handoff_count` reads as null when step 4 ran)
  procedure:
    1. Halt the close.
    2. Read the source service's audit feed directly.
    3. If the row exists in source but not in the rollup, escalate to principal-eng — the rollup pipeline is the failure.
    4. If the row is genuinely missing in source, re-run the step that should have emitted it.
  evidence_capture: metric_source_investigation_opened

- failure_mode: roster_drift_during_onboarding
  triggers: A reviewer signs in whose accountId is not on the seeded roster
  procedure:
    1. Suspend the reviewer's session.
    2. Capture `reviewer_session_suspended`.
    3. Cross-check the partner's licensure list before considering re-add.
    4. If re-adding, run a fresh roster import and capture `reviewer_roster_amended` — never inline-patch the seeded roster row.
  evidence_capture: reviewer_session_suspended

## Escalation

- level: 1
  role: partner-success
  contact: partner-success rotation pointer in `docs/ops/launch-blockers.md`
  trigger: kickoff failure, reviewer drill schedule conflict, revocation drill ambiguity

- level: 2
  role: compliance-lead
  contact: compliance pointer in `docs/ops/launch-blockers.md`
  trigger: roster drift, production credential timing question, revocation on a production credential as a drill

- level: 3
  role: principal-eng
  contact: principal-eng pointer in `docs/ops/launch-blockers.md`
  trigger: metric source missing in source feed; rollup pipeline failure; session reopen after a closed-on-evidence row

## Evidence Capture

- row_id: onboarding_session_opened
  source: onboarding-session service audit feed
  retention: 7 years
- row_id: onboarding_session_aborted
  source: onboarding-session service audit feed
  retention: 7 years
- row_id: reviewer_first_signin
  source: session-management service audit feed
  retention: 7 years
- row_id: reviewer_session_suspended
  source: session-management service audit feed
  retention: 7 years
- row_id: credential_issued
  source: issuer chain audit feed
  retention: 7 years
- row_id: credential_withdrawn
  source: issuer chain audit feed
  retention: 7 years
- row_id: reviewer_handoff
  source: reviewer-handoff service audit feed
  retention: 7 years
- row_id: reviewer_handoff_invalidated
  source: reviewer-handoff service audit feed
  retention: 7 years
- row_id: revocation_issued
  source: revocation service audit feed
  retention: 7 years
- row_id: onboarding_session_closed
  source: onboarding-session service audit feed
  retention: 7 years
- row_id: onboarding_session_reopened
  source: onboarding-session service audit feed
  retention: 7 years
- row_id: onboarding_session_timed_out
  source: onboarding-session service audit feed
  retention: 7 years
- row_id: metric_source_investigation_opened
  source: incident-tracker audit feed
  retention: 7 years
- row_id: reviewer_roster_amended
  source: roster-import service audit feed
  retention: 7 years

## Ambiguity Branches

- decision: kickoff_with_prior_open_session
  if_unsure: stop
  never: open a second onboarding session for the same tenantId while a prior session is open; the prior session must close (or time out) first.

- decision: reviewer_not_in_seeded_roster
  if_unsure: stop
  never: retroactively add a reviewer to the seeded roster row; amendments must come through a fresh roster import.

- decision: which_credential_to_revoke_for_drill
  if_unsure: escalate
  never: revoke a production credential as a drill; the drill is on a test credential only.

- decision: how_to_handle_null_metric_at_close
  if_unsure: stop
  never: hand-edit a null metric into the manifest; if a metric reads null but should not, the rollup pipeline is the bug to investigate.
