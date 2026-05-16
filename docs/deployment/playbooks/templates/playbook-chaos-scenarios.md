---
playbook_id: playbook-chaos-scenarios
version: 1
replay_safe: true
fail_closed: true
schema: vitalcv.playbook.v1
---

# Playbook Chaos Scenarios

Tabletop chaos scenarios operators run *before* a live institutional rollout.
Each scenario synthesizes a realistic failure mode and exercises the rollout
team's ability to follow the recovery path without improvising. The scenarios
intentionally mirror the CI-enforced `C-PLAY-*` modes — a tabletop drill that
passes is direct evidence that the team can follow the same playbook the
gate enforces.

## Preconditions

- gate: deployment-playbook-gate:GREEN
  ttl: 24h
  on_missing: STOP
- gate: rollout-team-tabletop-window:OPEN
  ttl: window-bound
  on_missing: STOP

## Steps

1. step_id: scenario_C_PLAY_1_tampered_template
   action: Introduce a deliberate single-character change in a non-active copy of a playbook template (kept in `/tmp`, never under `docs/deployment/playbooks/`), and ask the team to identify the drift via `playbook-hash.mjs` against the active set.
   verification: The team captures the per-file hash mismatch, identifies the tampered file, and routes to recovery (replace the file from git) without inventing a third path.
   evidence_capture: tabletop_scenario_run
   recovery: Discard the tampered copy; do not commit. The drill is over when the team has captured a `tabletop_scenario_run` row naming the scenario id.
   ambiguity_branch: If the team is uncertain whether the file is genuinely tampered or there's a hashing bug, stop and run `playbook-hash.mjs` twice; non-determinism is itself the failure mode.
   on_failure: escalate to deployment-lead

2. step_id: scenario_C_PLAY_2_banned_string_regression
   action: Introduce a deliberate banned-string regression in a `/tmp` copy of a template (use a phrase from CLAUDE.md's banned-string list) and ask the team to identify it via `playbook-validate.mjs`.
   verification: The validator reports the regression with the banned phrase named; the team identifies the file and discards the copy.
   evidence_capture: tabletop_scenario_run
   recovery: Discard the `/tmp` copy. The drill captures a `tabletop_scenario_run` row.
   ambiguity_branch: If the team is uncertain which phrase tripped the validator, stop and read the validator's full error block; do not interpret from a truncated log.
   on_failure: escalate to compliance-lead

3. step_id: scenario_C_PLAY_3_soft_stop
   action: Introduce a deliberate `on_missing: WARN` substitution in a `/tmp` copy and ask the team to identify it via the validator.
   verification: The validator reports the soft-stop regression; the team identifies the file and discards the copy.
   evidence_capture: tabletop_scenario_run
   recovery: Discard the `/tmp` copy. The drill captures a `tabletop_scenario_run` row.
   ambiguity_branch: If the team proposes "we can keep WARN if the next line is a recovery block", stop and remind them the validator does not accept WARN regardless of what follows.
   on_failure: escalate to deployment-lead

4. step_id: scenario_C_PLAY_4_ambiguity_erasure
   action: Introduce a deliberate `if_unsure: continue` in a `/tmp` copy and ask the team to identify it via the validator.
   verification: The validator reports the ambiguity-erasure regression; the team identifies the file and discards the copy.
   evidence_capture: tabletop_scenario_run
   recovery: Discard the `/tmp` copy. The drill captures a `tabletop_scenario_run` row.
   ambiguity_branch: If the team proposes "but the operator would know what to do", stop and remind them that the validator's contract is exactly to refuse that argument.
   on_failure: escalate to deployment-lead

5. step_id: scenario_C_PLAY_5_recovery_erasure
   action: Introduce a deliberate removal of a `recovery:` annotation on a mutating step (without adding `irreversible:`) in a `/tmp` copy.
   verification: The validator reports the recovery-erasure regression; the team identifies the file and discards the copy.
   evidence_capture: tabletop_scenario_run
   recovery: Discard the `/tmp` copy. The drill captures a `tabletop_scenario_run` row.
   ambiguity_branch: If the team proposes "the step is reversible by reading the audit feed, we don't need a `recovery:` line", stop and remind them the validator requires the explicit annotation regardless of operator knowledge.
   on_failure: escalate to deployment-lead

6. step_id: scenario_C_PLAY_6_lineage_tamper
   action: Introduce a deliberate forged `playbookSetHash` in a `/tmp` copy of a playbook lineage manifest and ask the team to identify it via `playbook-replay.mjs --path=<tmp-manifest>`.
   verification: The replayer reports the tamper; the team identifies the manifest and discards the copy.
   evidence_capture: tabletop_scenario_run
   recovery: Discard the `/tmp` copy. The drill captures a `tabletop_scenario_run` row.
   ambiguity_branch: If the team proposes "we can patch the manifest to match the new set hash", stop and remind them that a synthesized manifest is operationally a TAMPER event regardless of intent.
   on_failure: escalate to principal-eng

7. step_id: close_tabletop_window
   action: Close the tabletop window via `tabletop-window-close.mjs --scenarios-passed=<n> --scenarios-failed=<n>`; emit `tabletop_window_closed`.
   verification: The closure row carries the count of scenarios passed and failed; failure count is zero or escalation is captured.
   evidence_capture: tabletop_window_closed
   recovery: Reopen via `tabletop-window-reopen.mjs --reason=<text>`; capture `tabletop_window_reopened`.
   ambiguity_branch: If the team is uncertain whether to record a partial pass as a pass, stop and record it as a fail; the bar is the validator's bar, not the operator's confidence.
   on_failure: escalate to deployment-lead

## Recovery

- failure_mode: tabletop_scenario_failed
  triggers: A scenario's verification step does not pass — the team did not identify the synthesized drift, or routed it incorrectly
  procedure:
    1. Capture `tabletop_scenario_failed` with the scenario id and the team's response.
    2. Halt the tabletop window.
    3. Re-walk the playbook section the team missed and re-run the scenario.
    4. A second failure on the same scenario escalates to deployment-lead.
  evidence_capture: tabletop_scenario_failed

- failure_mode: tabletop_window_left_open
  triggers: Tabletop window has been open more than 7 days with no closure row
  procedure:
    1. Close the window with `reason: timed_out`.
    2. Capture `tabletop_window_timed_out`.
    3. The rollout window cannot open against a timed-out tabletop result.
  evidence_capture: tabletop_window_timed_out

## Escalation

- level: 1
  role: deployment-lead
  contact: ops-rotation pointer in `docs/ops/launch-blockers.md`
  trigger: a single scenario fails twice; tabletop window times out

- level: 2
  role: compliance-lead
  contact: compliance pointer in `docs/ops/launch-blockers.md`
  trigger: scenario C-PLAY-2 (banned-string regression) fails — the regression touches the publication contract

- level: 3
  role: principal-eng
  contact: principal-eng pointer in `docs/ops/launch-blockers.md`
  trigger: scenario C-PLAY-6 (lineage tamper) fails — the failure mode is the manifest-integrity contract itself

## Evidence Capture

- row_id: tabletop_scenario_run
  source: rollout planning service audit feed
  retention: 7 years
- row_id: tabletop_scenario_failed
  source: rollout planning service audit feed
  retention: 7 years
- row_id: tabletop_window_closed
  source: rollout planning service audit feed
  retention: 7 years
- row_id: tabletop_window_reopened
  source: rollout planning service audit feed
  retention: 7 years
- row_id: tabletop_window_timed_out
  source: rollout planning service audit feed
  retention: 7 years

## Ambiguity Branches

- decision: whether_partial_team_response_counts_as_a_pass
  if_unsure: stop
  never: record a partial response as a pass; the bar is the validator's bar, not the team's effort.

- decision: whether_a_scenario_failure_blocks_the_rollout_window
  if_unsure: escalate
  never: open a rollout window over a failed tabletop result; the failure is the signal that the team is not ready.

- decision: whether_a_chaos_copy_can_live_anywhere_other_than_tmp
  if_unsure: abort
  never: place a synthesized chaos copy under `docs/deployment/playbooks/`; the validator will trip on the next CI run and the chaos copy will be in lineage forever.

- decision: how_to_close_a_tabletop_window_with_mixed_results
  if_unsure: stop
  never: close with a manually-edited pass count; the count must match the captured `tabletop_scenario_run` and `tabletop_scenario_failed` rows.
