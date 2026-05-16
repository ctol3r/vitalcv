---
playbook_id: rollout-escalation-map
version: 1
replay_safe: true
fail_closed: true
schema: vitalcv.playbook.v1
---

# Rollout Escalation Map

The named escalation levels, roles, contacts, and triggers across the
institutional rollout. This playbook is referenced from every other playbook
in the set; updating an escalation target here propagates to all of them via
the `## Escalation` cross-references.

## Preconditions

- gate: deployment-playbook-gate:GREEN
  ttl: 24h
  on_missing: STOP
- gate: ops-rotation-known:GREEN
  ttl: 24h
  on_missing: STOP

## Steps

1. step_id: confirm_level_1_contact
   action: Read the deployment-lead rotation pointer from `docs/ops/launch-blockers.md` and confirm the on-call name resolves to a currently-on-rotation operator.
   verification: The named operator's status in the ops-rotation system reads "on rotation" or "primary" within the current window.
   evidence_capture: escalation_l1_confirmed
   recovery: If the rotation pointer resolves to no one (rotation gap), capture `escalation_l1_gap` and route to level 2 until the gap closes.
   ambiguity_branch: If the rotation pointer is stale, do not infer the current on-call from chat presence; stop and update the pointer.
   on_failure: escalate to level 2

2. step_id: confirm_level_2_contact
   action: Read the compliance-lead pointer from `docs/ops/launch-blockers.md` and confirm the named role-holder is reachable in the current window.
   verification: The named role-holder has acknowledged reachability for the current rollout window (acknowledgement is itself a captured row, not a verbal commitment).
   evidence_capture: escalation_l2_confirmed
   recovery: If the named role-holder is unreachable, capture `escalation_l2_gap` and route to level 3 for the duration of the gap.
   ambiguity_branch: If two compliance-leads are named (handoff in progress), stop and confirm which one owns the rollout window before proceeding.
   on_failure: escalate to level 3

3. step_id: confirm_level_3_contact
   action: Read the principal-eng pointer from `docs/ops/launch-blockers.md` and confirm the named principal-eng is reachable; principal-eng is the terminal escalation level — there is no level 4.
   verification: The named principal-eng has acknowledged the rollout window in writing (captured row).
   evidence_capture: escalation_l3_confirmed
   recovery: If principal-eng is unreachable, the rollout window pauses until reachability is re-established; capture `escalation_l3_gap` and hold.
   ambiguity_branch: If principal-eng is on PTO without a documented delegate, stop the rollout window; a principal-eng gap is a rollout-stopper, not a route-around opportunity.
   on_failure: pause rollout window

4. step_id: capture_window_acknowledgement
   action: Capture an `escalation_window_open` row at the start of every rollout window naming the L1 / L2 / L3 contacts and the window end time.
   verification: The row carries three named contacts, each cross-referenced to an account id, plus an ISO-8601 window end.
   evidence_capture: escalation_window_open
   recovery: Close the window early via `escalation_window_close --reason=<text>`; capture the close row.
   ambiguity_branch: If a contact has changed mid-window (mid-shift rotation), do not silently update the open row; close the current window and open a new one.
   on_failure: escalate to deployment-lead

5. step_id: route_on_trigger
   action: When a trigger fires in any playbook, read the matching escalation entry in that playbook's `## Escalation` block and route to the named level; do not infer the level from the operator's seniority or the time of day.
   verification: The escalation row carries the playbook id, step id, level, and named contact; cross-references are explicit.
   evidence_capture: escalation_routed
   recovery: A misrouted escalation is corrected by capturing a fresh `escalation_routed` row; the prior row is preserved.
   ambiguity_branch: If the trigger does not map to a named escalation entry in the source playbook, stop and treat as a level-3 (principal-eng) event; do not invent a level mapping.
   on_failure: route to level 3

## Recovery

- failure_mode: rotation_gap_at_level_1
  triggers: Deployment-lead rotation pointer resolves to no one currently on rotation
  procedure:
    1. Capture `escalation_l1_gap`.
    2. Route all level-1 triggers to level 2 for the gap duration.
    3. Notify the ops-rotation owner to fill the gap.
    4. When the gap closes, capture `escalation_l1_gap_closed`.
  evidence_capture: escalation_l1_gap

- failure_mode: compliance_lead_unreachable
  triggers: Level-2 contact does not respond within the agreed window
  procedure:
    1. Capture `escalation_l2_gap`.
    2. Route the in-flight trigger to level 3.
    3. Hold further level-2 work until compliance-lead reachability is re-confirmed.
  evidence_capture: escalation_l2_gap

- failure_mode: principal_eng_unreachable
  triggers: Level-3 contact does not respond within the agreed window
  procedure:
    1. Capture `escalation_l3_gap`.
    2. Pause the rollout window — there is no level 4.
    3. Hold all forward steps until principal-eng reachability is re-established.
  evidence_capture: escalation_l3_gap

## Escalation

- level: 1
  role: deployment-lead
  contact: ops-rotation pointer in `docs/ops/launch-blockers.md`
  trigger: routine STOP in any playbook precondition, replay drift code other than CLEAN

- level: 2
  role: compliance-lead
  contact: compliance pointer in `docs/ops/launch-blockers.md`
  trigger: tenant boundary crossing, reviewer roster drift, partner-signoff ambiguity, revocation drill ambiguity

- level: 3
  role: principal-eng
  contact: principal-eng pointer in `docs/ops/launch-blockers.md`
  trigger: TAMPER drift, unrecoverable orphan, irreversible-gate request, chaos fingerprint mismatch, level-1 or level-2 gap that crosses the rollout window

## Evidence Capture

- row_id: escalation_l1_confirmed
  source: rollout planning service audit feed
  retention: 7 years
- row_id: escalation_l2_confirmed
  source: rollout planning service audit feed
  retention: 7 years
- row_id: escalation_l3_confirmed
  source: rollout planning service audit feed
  retention: 7 years
- row_id: escalation_l1_gap
  source: ops-rotation service audit feed
  retention: 7 years
- row_id: escalation_l1_gap_closed
  source: ops-rotation service audit feed
  retention: 7 years
- row_id: escalation_l2_gap
  source: ops-rotation service audit feed
  retention: 7 years
- row_id: escalation_l3_gap
  source: ops-rotation service audit feed
  retention: 7 years
- row_id: escalation_window_open
  source: rollout planning service audit feed
  retention: 7 years
- row_id: escalation_window_close
  source: rollout planning service audit feed
  retention: 7 years
- row_id: escalation_routed
  source: rollout planning service audit feed
  retention: 7 years

## Ambiguity Branches

- decision: which_level_to_route_to_for_an_unmapped_trigger
  if_unsure: escalate
  never: invent an escalation level for an unmapped trigger; default to level 3 and let principal-eng decide whether a lower level is appropriate.

- decision: whether_to_route_around_an_unreachable_lead
  if_unsure: stop
  never: silently re-route a level-2 trigger to a level-1 contact because the level-2 contact is slow; route up, not down.

- decision: whether_a_contact_change_mid_window_is_a_silent_update
  if_unsure: stop
  never: edit an open `escalation_window_open` row in place; close the window and open a new one.

- decision: whether_principal_eng_pto_can_be_routed_around
  if_unsure: abort
  never: continue a rollout window during an undocumented principal-eng PTO; the window pauses.
