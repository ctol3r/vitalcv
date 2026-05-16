# Institutional Deployment Playbooks — W2-PR114A

**Wave:** W2-PR114A — Institutional Deployment Playbooks
**Date:** 2026-05-10
**Scope:** The *human-followable* layer that sits on top of the deployment-lineage + rollout-survivability + certification primitives. A playbook is a procedure an operator (or a partner SE running an institutional rollout) follows step-by-step. This track asks: are those procedures *replay-safe, ambiguity-preserving, recovery-reconstructable, fail-closed, longitudinally visible*, and do they emit lineage the same way the infrastructure does — or do they collapse into operator folklore the first time a rollout half-applies?
**Companion to:** [deployment-survivability](deployment-survivability.md), [deploy-canonicality](deploy-canonicality.md), [governance-collapse-survivability](governance-collapse-survivability.md), [escalation-explainability](escalation-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md).

---

## What this track answers

The platform's deployment *infrastructure* trail is now strong: `config-hash.mjs` is deterministic, `lineage.mjs` emits a content-addressed manifest per deploy, `chaos.mjs` proves five C-DEPLOY-* failure modes fail closed, and `replay-manifest.mjs` reconstructs the chain. The *procedural* trail — what a human actually does when they run a pilot rollout, when a tenant onboards, when a deploy half-applies and they have to recover — has been folklore: a Notion page, a Slack thread, an "ask Chris" pointer. That is the layer this wave hardens.

The track introduces an institutional playbook spine that mirrors the deployment lineage spine on six sub-properties:

- **Playbook integrity:** every playbook template carries frontmatter (`playbook_id`, `version`, `replay_safe`, `fail_closed`) and a fixed section schema. A deterministic digest (`playbookSetHash`) is computed over the sorted, hashed contents of every template. Re-running on the same source emits the same digest.
- **Ambiguity preservation:** every decision point in a playbook step must have an explicit `ambiguity_branch:` annotation naming what to do when the operator does not know. The default branch is *stop and escalate*, never *assume and proceed*. The validator rejects steps without an ambiguity branch.
- **Recovery reconstructability:** every step that mutates state must have a `recovery:` annotation that names the reverse operation and the evidence row that confirms reversal. A step with no inverse must be flagged as *irreversible* and require an explicit pre-step gate.
- **Fail-closed deployment guidance:** every `## Preconditions` block names the gates that must read GREEN. If any precondition is missing, partial, or stale (older than its TTL), the playbook STOPS — the validator rejects any playbook that lacks a STOP semantic in its preconditions.
- **Institutional onboarding measurability:** onboarding sequences emit named metrics (`time_to_first_credential`, `reviewer_handoff_count`, `first_revocation_at`, `evidence_rows_captured`) into the playbook lineage manifest. Counters with no clock or no captured row are themselves an audit failure.
- **Deployment lineage longitudinality:** each playbook *execution* (or playbook-set update) emits a `vitalcv.playbook-lineage.v1` manifest into `.playbook-lineage/`. The manifest carries `previousManifestId` pointers and an optional `deploymentManifestId` cross-link to the matching `vitalcv.deployment-lineage.v1` entry. A reader three months later can answer "which playbook revision drove which deploy?" without log archaeology.

Each sub-property is scored on the same four questions used across the operational tracks:

1. **Coherent** — does the playbook surface tell the same story as its infrastructure peer?
2. **Survivable** — does the playbook stay honest when a step half-applies, a partner SE drops off mid-rollout, or a manifest write is lost?
3. **Understandable** — can an operator three months later reconstruct what was actually run?
4. **Runtime-honest** — does the playbook's claim of what got deployed match the deployment manifest it cross-links?

🟢 / 🟡 / 🟠 / 🔴.

---

## P.1 Playbook integrity

**Surface:** [`scripts/deploy/playbooks/playbook-hash.mjs`](../../scripts/deploy/playbooks/playbook-hash.mjs) walks every `.md` under [`docs/deployment/playbooks/templates/`](../../docs/deployment/playbooks/templates), sorts by relative path, computes a per-file SHA-256, and emits a final `playbookSetHash` = SHA-256 of the concatenated `path\thash\n` lines.

**Template schema (`vitalcv.playbook.v1`):**

```yaml
---
playbook_id: <stable-slug>           # e.g., pilot-institutional-rollout
version: <integer>                   # monotonic; never decrement
replay_safe: true                    # literal true; false fails the validator
fail_closed: true                    # literal true; false fails the validator
schema: vitalcv.playbook.v1
---

## Preconditions
- gate: <gate-id>                    # e.g., deployment-survivability:GREEN
  ttl: <duration>                    # e.g., 24h
  on_missing: STOP
- ...

## Steps
1. step_id: <slug>
   action: <imperative>
   verification: <observable signal>
   evidence_capture: <evidence_row_id or none>
   recovery: <reverse op + evidence row>     # or `irreversible: <gate>`
   ambiguity_branch: <what to do if unsure>  # default: escalate to <role>
   on_failure: <escalation target>

## Recovery
- failure_mode: <slug>
  triggers: <observable>
  procedure: <ordered list>
  evidence_capture: <evidence_row_id>

## Escalation
- level: 1 | 2 | 3
  role: <role-slug>
  contact: <pointer; never a phone number>
  trigger: <observable>

## Evidence Capture
- row_id: <slug>
  source: <observable>
  retention: <duration>
- ...

## Ambiguity Branches
- decision: <slug>
  if_unsure: <stop | escalate | abort>
  never: <action that must NOT be taken>
```

| Question | Answer |
|---|---|
| Coherent | 🟢 — frontmatter is fixed; sections are fixed; the validator rejects any deviation. Every step has a named verification, evidence capture, recovery, and ambiguity branch. |
| Survivable | 🟢 — `playbookSetHash` is recomputed from source on every CI run; tamper, missing file, or unreadable section trips the gate. |
| Understandable | 🟡 — operators get markdown they can read, but cross-playbook flow (e.g., when does rollout escalate into recovery?) lives in `## Escalation` cross-references rather than a graph. |
| Runtime-honest | 🟢 — every claim a playbook makes about gate readiness is a *reference* to an existing CI gate name, not a re-assertion. The playbook cannot lie about a gate it does not control. |

**Verdict:** 🟢 OPERATIONALLY COHERENT (with 🟡 on cross-playbook graph).

---

## P.2 Ambiguity preservation

**Surface:** [`scripts/deploy/playbooks/playbook-validate.mjs`](../../scripts/deploy/playbooks/playbook-validate.mjs) requires every step block to contain a non-empty `ambiguity_branch:` and a non-empty `## Ambiguity Branches` section enumerating at least one `decision:` with an `if_unsure:` value of `stop`, `escalate`, or `abort`. **`if_unsure: continue` is rejected unconditionally.**

**Branch contract:** for every decision in a playbook, the operator is told exactly two things:

1. What to do **if unsure** (stop / escalate / abort — never *guess*, *assume*, *proceed-with-care*).
2. What action they **must NOT take**, even if it seems reasonable, when they are unsure.

The negative branch (`never:`) is load-bearing — it is the line that prevents a confident operator from working around the stop signal. Example from the pilot rollout template:

> decision: partner_signoff_uncertain
> if_unsure: escalate
> never: backfill the partner signoff field from a verbal confirmation; the row must originate from the partner's own evidence capture.

| Question | Answer |
|---|---|
| Coherent | 🟢 — `if_unsure` is one of three named values, parser-enforced; `never:` is required, parser-enforced. |
| Survivable | 🟢 — a playbook that drifts toward `if_unsure: continue` fails the validator before merge; CI catches the regression. |
| Understandable | 🟢 — operators see the same two-line pattern (`if_unsure:` + `never:`) at every decision; there is no implicit ambiguity to learn. |
| Runtime-honest | 🟢 — the playbook never claims an action is safe to "interpret"; the only branches it offers are STOP / ESCALATE / ABORT. |

**Verdict:** 🟢 AMBIGUITY-PRESERVING.

---

## P.3 Recovery reconstructability

**Surface:** every step that mutates state carries a `recovery:` annotation. The validator rejects steps without one *unless* the step declares `irreversible: <gate-id>`, in which case a pre-step gate is required to fire first. The dedicated [`templates/deployment-recovery.md`](../../docs/deployment/playbooks/templates/deployment-recovery.md) playbook owns the cross-cutting recovery scenarios that don't belong to a single rollout step.

**Reversal evidence:** every recovery action names the evidence row that confirms the reversal landed. The replay manifest carries `playbookManifests[].hash` so a reviewer reading three months later can resolve "what was the recovery procedure as of manifestId X" → exact bytes.

**Irreversible operations (named explicitly, not euphemized):**

- Tenant deletion / data purge — gate: `tenant-deletion-precheck:GREEN`, role: principal-eng.
- Audit-event truncation — *prohibited*; the recovery playbook documents this as a never-do, not a procedure.
- Production key rotation — gate: `key-rotation-window:OPEN`, role: security-lead.

| Question | Answer |
|---|---|
| Coherent | 🟢 — every step has either `recovery:` or `irreversible:` — there is no third state. |
| Survivable | 🟢 — irreversible steps cannot execute without an open pre-step gate; the gate name is content-addressed so a renamed gate is a hash change. |
| Understandable | 🟡 — operators see a recovery line per step but the cross-step dependency graph (recovery A must run before recovery B) is implicit in ordering; a dedicated graph is out of scope for this wave. |
| Runtime-honest | 🟢 — recovery procedures name observable signals (evidence rows, manifest IDs), not subjective states like "if it looks rolled back." |

**Verdict:** 🟢 RECONSTRUCTABLE (with 🟡 on multi-step recovery graphing).

---

## P.4 Fail-closed deployment guidance

**Surface:** every playbook's `## Preconditions` block is the first thing the operator reads. Each precondition is a triple: `gate: <gate-id>`, `ttl: <duration>`, `on_missing: STOP`. The validator rejects any precondition with `on_missing: WARN`, `on_missing: CONTINUE`, or `on_missing:` absent. There is no soft-stop in this layer.

**Stop semantics:** a STOP is not a request to ask the operator to consider; it is the playbook's instruction that execution halts at this line. The line that follows STOP must be either an escalation cross-reference or an explicit `## Recovery` block — the playbook is forbidden from continuing past STOP without one of those two doorways.

| Question | Answer |
|---|---|
| Coherent | 🟢 — every precondition reads with the same shape; STOP is the only failure verb. |
| Survivable | 🟢 — chaos mode `C-PLAY-3` proves removing the STOP semantic breaks the validator; the regression is caught at PR time. |
| Understandable | 🟢 — operators don't have to guess what STOP means; the next line tells them exactly which door to walk through. |
| Runtime-honest | 🟢 — preconditions reference real CI gates; the playbook cannot claim readiness for a gate that does not exist. |

**Verdict:** 🟢 FAIL-CLOSED.

---

## P.5 Institutional onboarding measurability

**Surface:** the [`templates/institutional-onboarding-sequence.md`](../../docs/deployment/playbooks/templates/institutional-onboarding-sequence.md) playbook emits four named counters into the playbook lineage manifest:

| Metric | Type | What it measures |
|---|---|---|
| `time_to_first_credential` | duration (seconds) | wall-clock from `tenant_provisioned` evidence row to first non-test credential issued |
| `reviewer_handoff_count` | integer | number of `reviewer_handoff` evidence rows observed during onboarding |
| `first_revocation_at` | ISO timestamp \| null | wall-clock of first revocation evidence row, or null if none yet |
| `evidence_rows_captured` | integer | total evidence rows captured under the onboarding playbook session |

Each metric has a defined source evidence row and a `null`-handling rule. A counter without a clock or a missing source row is itself an audit failure — `playbook-validate.mjs` rejects an onboarding playbook that names a metric without naming its evidence source.

| Question | Answer |
|---|---|
| Coherent | 🟢 — four metrics, each with type + source + null-rule; no free-form metrics permitted. |
| Survivable | 🟢 — metrics are captured into the manifest at session-end, not at observation time; lost log lines do not erase the recorded count. |
| Understandable | 🟡 — operators see the metrics in the manifest JSON; a UI surface that renders the onboarding score across tenants is a follow-on. |
| Runtime-honest | 🟢 — every metric is derived from an evidence row, not from operator self-report. |

**Verdict:** 🟢 MEASURABLE (with 🟡 on cross-tenant onboarding surface).

---

## P.6 Deployment lineage longitudinality

**Surface:** [`scripts/deploy/playbooks/playbook-lineage.mjs`](../../scripts/deploy/playbooks/playbook-lineage.mjs) emits a `vitalcv.playbook-lineage.v1` manifest into `.playbook-lineage/<sha>-<ts>.json` plus a `latest.json` pointer. Manifest fields:

```json
{
  "schema": "vitalcv.playbook-lineage.v1",
  "manifestId": "<sha256 of canonical body — manifestId excluded>",
  "playbookSetHash": "<sha256 from playbook-hash.mjs>",
  "playbookCount": 6,
  "playbookManifests": [
    { "playbookId": "pilot-institutional-rollout", "version": 1, "hash": "<sha256>" },
    ...
  ],
  "deploymentManifestId": "<id from .deployment-lineage/latest.json> | null",
  "gitSha": "<commit>",
  "operator": "<actor>",
  "buildTimestampUtc": "<ISO-8601>",
  "chaosFingerprint": "<sha256 of chaos verdicts> | CHAOS_NOT_RUN",
  "previousManifestId": "<id> | null",
  "metrics": {
    "time_to_first_credential": null,
    "reviewer_handoff_count": null,
    "first_revocation_at": null,
    "evidence_rows_captured": null
  }
}
```

**Cross-link:** `deploymentManifestId` is populated when `playbook-lineage.mjs --link-deploy` is run; absent the flag, it remains `null` (which is fine — the manifest stands alone and is still replay-verifiable). A reviewer reading three months later can join `.playbook-lineage/<id>.deploymentManifestId` to `.deployment-lineage/<deploymentManifestId>.json` to reconstruct "this playbook revision drove this deploy."

| Question | Answer |
|---|---|
| Coherent | 🟢 — manifest is content-addressed; canonical body excludes `manifestId`; chain via `previousManifestId`. |
| Survivable | 🟢 — chaos mode `C-PLAY-6` proves a tampered or orphaned manifest trips the replayer. |
| Understandable | 🟢 — the cross-link is a single field, not a graph; an operator can read it without tooling. |
| Runtime-honest | 🟢 — `playbookSetHash` is recomputed from current sources by the replayer; a renamed or rewritten template moves the digest. |

**Verdict:** 🟢 LONGITUDINALLY VISIBLE.

---

## Chaos modes (deploy-playbook layer)

Six chaos modes exercise the playbook gate; each must fail closed.

| Mode | Synthesized failure | Required verdict |
|---|---|---|
| `C-PLAY-1` | Tampered playbook content (per-file hash no longer matches) | validator exits 1 with `code: PLAY-DRIFT-TAMPER` |
| `C-PLAY-2` | Banned-string regression (CLAUDE.md banned phrase appears in a template) | validator exits 1 with `code: PLAY-DRIFT-BANNED` |
| `C-PLAY-3` | STOP semantic removed from preconditions | validator exits 1 with `code: PLAY-DRIFT-SOFT-STOP` |
| `C-PLAY-4` | Ambiguity branch removed (or `if_unsure: continue`) | validator exits 1 with `code: PLAY-DRIFT-AMBIGUITY` |
| `C-PLAY-5` | Step mutates state with no `recovery:` and no `irreversible:` | validator exits 1 with `code: PLAY-DRIFT-RECOVERY` |
| `C-PLAY-6` | Playbook lineage manifest tampered (`playbookSetHash` forged) | replayer exits 1 with `code: PLAY-DRIFT-MANIFEST` |

These are the deploy-playbook companions to:

- `C-DEPLOY-*` (deploy-layer chaos — config + lineage)
- `C-ROLL-*` (institutional rollout chaos — partial adoption)
- `C-CERT-*` (deployment certification chaos — evidence synthesis)

---

## Completion board

📊 **Deployment Playbook Board**

| Metric | Target | Notes |
|---|---|---|
| Rollout Repeatability % | 100% | every template carries the v1 schema; CI rejects deviation |
| Replay-Safe Guidance % | 100% | `playbookSetHash` deterministic across two consecutive CI runs |
| Recovery Procedure Fidelity % | 100% | every mutating step has `recovery:` or `irreversible:` — validator enforced |
| Institutional Onboarding Clarity % | 100% | four named metrics with named evidence sources |
| Deployment Playbook Maturity % | 100% | six chaos modes pass fail-closed; lineage manifest verifies |

---

## Final answers

### Strongest deployment-repeatability gain

The deterministic `playbookSetHash`. Before this wave, "did we run the same rollout we ran last quarter?" was answerable only by Notion archaeology. After: a content-addressed digest over six template files. Same digest → same procedure, byte-for-byte. A 12-character prefix on a deploy ticket is now enough to identify the procedure version. Repeatability is no longer an operator's memory; it is a hash.

### Strongest rollout-guidance gain

The forced ambiguity-branch contract (`if_unsure: stop|escalate|abort` + `never:`). Operator folklore drifts toward "proceed with care" when a confident partner SE is on the call; the validator now refuses any playbook that admits that branch. The two-line pattern (positive + negative) at every decision point is what makes the guidance survive a calm voice and a tight deadline.

### Biggest remaining deployment-operability risk

**Cross-playbook flow is implicit.** A single playbook is rigorous, but the transition from `pilot-institutional-rollout` → `deployment-recovery` → `rollout-escalation-map` is encoded only in `## Escalation` cross-references. An operator following the recovery playbook can read where they came from but cannot see the graph. The graph is a follow-on wave (call it W2-PR114B); the current gate enforces every node's correctness, not the edges. Risk profile: medium — every individual playbook is fail-closed, but multi-step rollout sequencing is still partly operator-mediated.

### Deployment playbook verdict

🟢 **GO** — six templates, all schema-conformant; validator enforces ambiguity, recovery, fail-closed, and banned-strings contracts; six chaos modes pass fail-closed; lineage manifest replays clean against current sources; cross-link to deployment lineage is wired but optional. The playbook layer now stands on the same footing as the infrastructure layer it documents.
