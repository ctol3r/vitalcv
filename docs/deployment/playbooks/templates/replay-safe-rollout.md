---
playbook_id: replay-safe-rollout
version: 1
replay_safe: true
fail_closed: true
schema: vitalcv.playbook.v1
---

# Replay-Safe Rollout Guidance

Standalone guidance to keep an institutional rollout *replay-safe end-to-end*.
A rollout is replay-safe when a reader three months later can reconstruct
exactly which gates fired, which manifests landed, and which evidence rows
captured each transition — without log archaeology.

This playbook is referenced from the pilot rollout, the recovery playbook, and
the escalation map. It is the standalone *contract* for what replay-safety
means in operational practice.

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

1. step_id: anchor_to_deployment_manifest
   action: Record the current `manifestId` from `.deployment-lineage/latest.json` into the rollout's planning doc before any step that mutates state.
   verification: The manifestId in the planning doc matches `replay-manifest.mjs` output at rollout start.
   evidence_capture: rollout_anchored
   recovery: Re-anchor by reading the current latest manifest and capturing a new `rollout_anchored` row; the prior row is not deleted, it is superseded.
   ambiguity_branch: If two manifestIds are visible (e.g., a deploy landed mid-anchor), stop and wait 10 minutes; re-anchor against whichever manifest replays clean.
   on_failure: escalate to deployment-lead

2. step_id: anchor_to_playbook_set
   action: Record the current `playbookSetHash` from `.playbook-lineage/latest.json` into the same planning doc.
   verification: The playbookSetHash in the planning doc matches `playbook-hash.mjs` output at rollout start.
   evidence_capture: playbook_set_anchored
   recovery: Re-anchor against the current playbook lineage manifest; the prior row is superseded, not deleted.
   ambiguity_branch: If the playbook set has been updated mid-rollout (digest moves), stop and confirm with deployment-lead whether to continue on the old digest or to restart against the new one.
   on_failure: escalate to deployment-lead

3. step_id: capture_evidence_per_step
   action: For every rollout step that mutates state, confirm an evidence row was captured before moving to the next step.
   verification: Audit feed contains the named evidence row within the per-step TTL.
   evidence_capture: step_evidence_confirmed
   recovery: If the row does not appear, do not proceed; re-run the step or escalate.
   ambiguity_branch: If the row appears with the correct slug but the linked entityId is wrong, stop and treat the row as a forged-evidence event; escalate to principal-eng.
   on_failure: escalate to principal-eng

4. step_id: replay_check_at_phase_close
   action: At the close of each rollout phase, run `scripts/deploy/replay-manifest.mjs` and confirm `DRIFT-CODE-CLEAN` or `DRIFT-CODE-SHA`.
   verification: The replay report's `code` field is one of the two clean codes; any other code stops the rollout.
   evidence_capture: phase_replay_checked
   recovery: irreversible: replay-drift-investigation-open
   ambiguity_branch: If the replay returns `DRIFT-CODE-SHA` but the rollout team did not intentionally deploy, stop and escalate to deployment-lead; an unannounced SHA change is itself a drift signal.
   on_failure: escalate to principal-eng

5. step_id: emit_phase_close_lineage
   action: Emit a playbook lineage manifest with `--link-deploy` at the close of each phase to cross-link the playbook revision with the deployment manifest.
   verification: New manifest visible under `.playbook-lineage/`; `deploymentManifestId` field is populated; replayer confirms the manifest matches sources.
   evidence_capture: phase_closure_emitted
   recovery: Emit a fresh manifest on the same source state; the prior manifest is preserved in lineage, the new one is appended.
   ambiguity_branch: If the deployment manifest pointer is null at phase close, stop — the cross-link is the load-bearing piece of replay-safety.
   on_failure: escalate to deployment-lead

## Recovery

- failure_mode: manifest_drift_mid_rollout
  triggers: Replay returns a drift code other than CLEAN or SHA mid-rollout
  procedure:
    1. Halt all forward steps in the rollout.
    2. Run `replay-manifest.mjs --json` and capture the full report.
    3. Open a replay-drift investigation, attach the report, page principal-eng.
    4. Do not resume until the investigation closes with an explicit GO from principal-eng.
  evidence_capture: replay_drift_investigation_opened

- failure_mode: playbook_digest_moved_mid_rollout
  triggers: `playbookSetHash` differs between anchor and phase-close
  procedure:
    1. Halt all forward steps.
    2. Diff the two playbook revisions; capture the diff into the planning doc.
    3. Deployment-lead decides: continue on the anchored digest (treating the new one as a follow-on) or restart against the new digest.
    4. Whichever choice, emit `playbook_digest_decision_captured`.
  evidence_capture: playbook_digest_decision_captured

- failure_mode: evidence_row_missing_at_phase_close
  triggers: Audit feed lacks an expected evidence row at phase close
  procedure:
    1. Halt the phase close.
    2. Read the source service's audit feed directly (not via cache) to confirm the row is genuinely absent vs. lag.
    3. If genuinely absent, re-run the step that should have emitted it; if still absent, escalate to principal-eng — a service that fails to emit evidence is a fail-closed event.
  evidence_capture: evidence_emission_recovery_attempted

## Escalation

- level: 1
  role: deployment-lead
  contact: ops-rotation pointer in `docs/ops/launch-blockers.md`
  trigger: anchor mismatch, playbook digest move, or replay-SHA drift without a planned deploy

- level: 2
  role: compliance-lead
  contact: compliance pointer in `docs/ops/launch-blockers.md`
  trigger: evidence row appears with wrong entityId or other forged-evidence signal

- level: 3
  role: principal-eng
  contact: principal-eng pointer in `docs/ops/launch-blockers.md`
  trigger: any replay drift code other than CLEAN or SHA; evidence emission failure at the service layer

## Evidence Capture

- row_id: rollout_anchored
  source: rollout planning doc + planning service audit feed
  retention: 7 years
- row_id: playbook_set_anchored
  source: rollout planning doc + planning service audit feed
  retention: 7 years
- row_id: step_evidence_confirmed
  source: rollout planning service audit feed
  retention: 7 years
- row_id: phase_replay_checked
  source: rollout planning service audit feed
  retention: 7 years
- row_id: phase_closure_emitted
  source: playbook lineage manifest emitter
  retention: 7 years
- row_id: replay_drift_investigation_opened
  source: incident-tracker audit feed
  retention: 7 years
- row_id: playbook_digest_decision_captured
  source: rollout planning service audit feed
  retention: 7 years
- row_id: evidence_emission_recovery_attempted
  source: rollout planning service audit feed
  retention: 7 years

## Ambiguity Branches

- decision: which_manifest_to_anchor_against
  if_unsure: stop
  never: anchor against `latest.json` when a deploy is visibly in flight; wait for the deploy to settle and re-read.

- decision: whether_to_continue_after_digest_move
  if_unsure: escalate
  never: silently continue on the new playbook digest without capturing the digest-move decision row; an undocumented digest move erases replay-safety.

- decision: whether_replay_sha_drift_is_planned
  if_unsure: stop
  never: assume a SHA drift is a teammate's planned deploy; confirm by reading the deployment-lineage chain, not by asking in chat.

- decision: how_to_react_to_a_missing_evidence_row
  if_unsure: stop
  never: proceed on the assumption that the row will land later; a row that has not landed at phase close is operationally absent.
