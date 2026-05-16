---
playbook_id: deployment-recovery
version: 1
replay_safe: true
fail_closed: true
schema: vitalcv.playbook.v1
---

# Deployment Recovery

Recovery procedures for half-applied deploys, broken rollback chains, lineage
orphans, and the irreversible-operation guard rails. Every recovery step
reverses to a named evidence row or names the gate that must open before the
irreversible operation runs.

## Preconditions

- gate: deployment-survivability:GREEN
  ttl: 24h
  on_missing: STOP
- gate: deployment-playbook-gate:GREEN
  ttl: 24h
  on_missing: STOP
- gate: audit-replay-clean:GREEN
  ttl: 24h
  on_missing: STOP

## Steps

1. step_id: triage_drift_code
   action: Run `scripts/deploy/replay-manifest.mjs --json` and read the `code` field; route on the value.
   verification: The report's `code` field is one of `DRIFT-CODE-CLEAN`, `DRIFT-CODE-SHA`, `DRIFT-CODE-CONFIG`, `DRIFT-CODE-LOCK`, `DRIFT-CODE-ORPHAN`, `DRIFT-CODE-TAMPER`.
   evidence_capture: drift_triage_captured
   recovery: The triage itself is read-only; no reversal needed. A re-run captures a fresh triage row.
   ambiguity_branch: If the report does not parse, treat as DRIFT-CODE-TAMPER and escalate to principal-eng; do not interpret the failure mode from log lines alone.
   on_failure: escalate to principal-eng

2. step_id: route_on_drift_code
   action: For each non-clean drift code, follow the named recovery branch (CONFIG → re-emit lineage; LOCK → rebuild dependencies; ORPHAN → repair chain; TAMPER → quarantine manifest).
   verification: The recovery branch's terminal evidence row appears for the drift code routed.
   evidence_capture: drift_recovery_routed
   recovery: The route itself is metadata; the underlying recovery branch is the operation. A miscategorized route is re-routed by capturing a fresh `drift_recovery_routed` row that supersedes the prior one.
   ambiguity_branch: If two drift codes are present at once (e.g., LOCK and CONFIG), stop and escalate to principal-eng; do not batch-route, address one at a time.
   on_failure: escalate to principal-eng

3. step_id: repair_lineage_chain
   action: When the drift code is ORPHAN (previousManifestId points to absent file), restore the absent manifest from CI artifact retention into `.deployment-lineage/`.
   verification: Replayer re-run returns CLEAN or SHA after the absent file is restored.
   evidence_capture: lineage_chain_repaired
   recovery: If the absent manifest cannot be restored from artifact, capture `lineage_chain_unrecoverable` and escalate to principal-eng — the chain has a permanent break and the policy decision lives at that escalation level.
   ambiguity_branch: If the artifact archive shows the manifest exists but has a hash that does not match the orphan reference, stop and treat as TAMPER, not ORPHAN.
   on_failure: escalate to principal-eng

4. step_id: quarantine_tampered_manifest
   action: When the drift code is TAMPER, move the tampered file out of `.deployment-lineage/` into `.deployment-lineage/quarantine/` preserving the original filename.
   verification: The quarantine directory contains the moved file with timestamp; `latest.json` no longer points to the tampered manifest.
   evidence_capture: manifest_quarantined
   recovery: Quarantine is forward-only; a tampered manifest does not return to the active chain. If the move was performed in error, restore from artifact retention rather than moving the quarantined file back.
   ambiguity_branch: If multiple manifests in the same directory carry the same `manifestId`, stop and treat the entire directory as suspect; do not pick the "newer" one.
   on_failure: escalate to principal-eng

5. step_id: forward_rollback
   action: When the recovery needs to revert a prior deploy, run `scripts/deploy/lineage.mjs --rollback-of=<manifestId>` to emit a new manifest with `rollbackOf` set; the prior manifests stay in place.
   verification: New manifest visible under `.deployment-lineage/` with `rollbackOf` populated; chain reads `prior → rolled-back → rollback-manifest` and replays clean.
   evidence_capture: forward_rollback_emitted
   recovery: A rollback's reversal is itself a forward operation — emit another lineage manifest. Rollbacks never erase the rolled-back manifest.
   ambiguity_branch: If the manifestId to roll back to is not present in the chain (orphan), stop and run step 3 first; rolling back to an absent manifest is itself an orphan event.
   on_failure: escalate to deployment-lead

6. step_id: irreversible_request
   action: When the recovery needs an irreversible operation (tenant deletion, audit truncation, production key rotation), open a pre-step gate request via `scripts/ops/irreversible-gate-request.mjs --gate=<name>`.
   verification: A gate-request row exists and the named gate's state is read GREEN by principal-eng before the irreversible step runs.
   evidence_capture: irreversible_gate_request_opened
   recovery: irreversible: irreversible-request-rescindable-only-before-execution
   ambiguity_branch: If the operator believes the irreversible step is the only option, stop and escalate; the gate exists exactly to slow this decision down.
   on_failure: escalate to principal-eng

## Recovery

- failure_mode: lineage_chain_unrecoverable
  triggers: An orphan reference where the absent manifest cannot be restored from artifact retention
  procedure:
    1. Open a permanent-break investigation in the incident tracker.
    2. Capture `lineage_chain_unrecoverable`.
    3. Principal-eng decides how to mark the chain (e.g., a "lineage seam" row that documents the break).
    4. Do not synthesize a replacement manifest; a synthesized manifest is itself a TAMPER event.
  evidence_capture: lineage_chain_unrecoverable

- failure_mode: rollback_to_orphan
  triggers: A rollback request names a manifestId that is not present in `.deployment-lineage/`
  procedure:
    1. Halt the rollback.
    2. Run step 3 (repair_lineage_chain) on the orphan.
    3. If the chain is repairable, re-attempt the rollback against the now-present manifest.
    4. If unrepairable, escalate to principal-eng and do not synthesize a substitute.
  evidence_capture: rollback_blocked_on_orphan

- failure_mode: chaos_fingerprint_mismatch_post_recovery
  triggers: After a recovery, the next lineage manifest's `chaosFingerprint` differs from the chaos verdict digest run in the same CI job
  procedure:
    1. Halt forward deploys.
    2. Re-run `scripts/deploy/chaos.mjs` and capture the fresh fingerprint.
    3. Re-emit the lineage manifest with the fresh fingerprint.
    4. If the mismatch persists, escalate to principal-eng — a forged chaos fingerprint is itself a TAMPER signal.
  evidence_capture: chaos_fingerprint_mismatch_captured

## Escalation

- level: 1
  role: deployment-lead
  contact: ops-rotation pointer in `docs/ops/launch-blockers.md`
  trigger: routine drift recovery (CONFIG, LOCK) where the route is unambiguous

- level: 2
  role: compliance-lead
  contact: compliance pointer in `docs/ops/launch-blockers.md`
  trigger: rollback that crosses a tenant boundary or affects a production credential's manifest

- level: 3
  role: principal-eng
  contact: principal-eng pointer in `docs/ops/launch-blockers.md`
  trigger: TAMPER, unrecoverable ORPHAN, irreversible-gate request, chaos fingerprint mismatch

## Evidence Capture

- row_id: drift_triage_captured
  source: replay-manifest tool output captured into incident tracker
  retention: 7 years
- row_id: drift_recovery_routed
  source: incident tracker
  retention: 7 years
- row_id: lineage_chain_repaired
  source: deployment-lineage directory + incident tracker
  retention: 7 years
- row_id: lineage_chain_unrecoverable
  source: incident tracker
  retention: 7 years
- row_id: manifest_quarantined
  source: deployment-lineage quarantine subdirectory + incident tracker
  retention: 7 years
- row_id: forward_rollback_emitted
  source: deployment-lineage emitter
  retention: 7 years
- row_id: irreversible_gate_request_opened
  source: ops gate-request service audit feed
  retention: 7 years
- row_id: rollback_blocked_on_orphan
  source: incident tracker
  retention: 7 years
- row_id: chaos_fingerprint_mismatch_captured
  source: incident tracker
  retention: 7 years

## Ambiguity Branches

- decision: which_drift_code_to_route_first
  if_unsure: stop
  never: batch-route two drift codes in one recovery; each code gets its own row and its own routing decision.

- decision: whether_to_synthesize_a_missing_manifest
  if_unsure: abort
  never: synthesize a replacement manifest under any circumstance; a synthesized manifest is operationally a TAMPER event.

- decision: whether_to_unquarantine_a_tampered_file
  if_unsure: abort
  never: move a quarantined manifest back into the active chain; restore from artifact retention if the quarantine was in error.

- decision: whether_an_irreversible_step_is_truly_necessary
  if_unsure: escalate
  never: run the irreversible step without an open pre-step gate row signed by principal-eng.
