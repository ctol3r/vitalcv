# VitalCV Start Agent — A1 (real tools and consented execution)

A0 built the kernel: it could plan, explain, and prepare. A1 makes the plan
*act* — the promise becomes real at the point where the agent says
*"Your profile is missing X. I found the source. I prepared the request.
Approve it?"* and then, on approval, actually does it.

The load-bearing idea: **the plan does not authorize anything; the consent
ledger does.** Approval is a durable, revocable event, and the proof that
authorizes an execution is minted by re-reading that ledger at the moment of
execution — not carried from the plan the clinician was looking at.

## What changed

```mermaid
flowchart LR
  subgraph plan [Plan]
    P[start-policy-v2<br/>granted consent ⇒ executable action]
  end
  subgraph consent [Consent ledger]
    L[(agent_consent_events<br/>append-only grant/revoke)]
    V[verifyAgentConsent<br/>re-reads AT execution]
  end
  subgraph exec [Execution service]
    G[7 fail-closed gates]
    R[Tool registry<br/>Level 3 requires ConsentProof<br/>scope must match]
  end
  subgraph canon [Canonical capabilities]
    T[POST /api/trust-state/:npi/refresh<br/>Level 2]
    S[POST /api/apply/share<br/>Level 3, server-resolved recipient]
  end
  E[(agent_events<br/>presented → completed/failed/blocked)]

  P --> G --> V --> L
  V -- ConsentProof --> R --> canon
  G --> E
  R --> E
```

### 1. Consent ledger (`lib/agent/consent/`)

`agent_consent_events` — append-only `granted`/`revoked` events, folded per
`(subjectRef, scope)`. Revocation is a state, re-grant is a new event
(distinct `event_hash`, because the hash covers the event id). Every write
pairs an `AuditEvent` in the same transaction. Consent writes are strict: a
write that does not persist reports failure and the route answers 503 —
never a phantom authorization.

Why a new table rather than extending the canonical `ConsentGrant`:
its content-addressed `grant_hash` makes grant → revoke → re-grant
structurally impossible, and its NOT NULL org/packet columns cannot be
filled at plan time. `ConsentGrant` stays the immutable **disclosure**
record for an exercised share; this ledger is the **authorization** layer.
Full reasoning in [docs/migrations/agent-consents.md](../migrations/agent-consents.md).

### 2. Consent-verified Level 3 (`tools/registry.ts`)

The A0 registry refused everything above Level 2. It now executes Level 3 —
but only with a `ConsentProof`, whose sole constructor is the store's
`verifyAgentConsent`. The registry re-validates the proof's shape and
requires its scope to equal the `consentScope` named in the invocation.
`human_only` remains never executable. Toolset version: `start-toolset-v2`.

### 3. Execution service (`lib/agent/execution/`)

Seven ordered, fail-closed gates, each producing a named refusal rather than
a silent no-op: action present in the freshly regenerated plan → not
human-only → VitalCV-owned → actionable status → **consent verified against
the ledger now** → a capability is wired → registry ceiling and scope match.
Categorical facts (whose decision this is) are stated before transient
status, so a clinician waiting on a hospital is told *that*, not "not
actionable".

Every attempt emits `agent_action_presented` and then exactly one terminal
event carrying owner, outcome, and elapsed time — the outcome chain the
learning loop consumes.

### 4. Real tools

The A0 input gaps are wired: opportunities (`GET /api/matcha/opportunities/:npi`),
the consent-ledger fold, and action history folded from telemetry (so
completed work stops being re-recommended and repeated failures pause across
sessions). Two executors: `trigger_source_refresh` (Level 2) and
`execute_apply_share` (Level 3), the latter passing `opportunityId` so the
**recipient is server-resolved by the canonical route** rather than asserted
by the agent.

### 5. `start-policy-v2` and the first real replay

The delta is exactly one behavior: a granted share consent surfaces the
prepared work as executable. v1 stays frozen for comparison, and
`start-bench-policy-replay.test.ts` proves the governed-promotion criteria —
v1 still passes everything it ever passed, v2 passes the full 27, v1 scores
0/2 on the new scenarios (strict improvement), and on all shared scenarios
both versions produce identical plans modulo the version stamp (no
collateral drift).

### 6. API

- `POST /api/agent/consent` — grant or revoke one scope. Subject from the
  session; client-supplied subjects/proofs refused; scope grammar enforced.
- `GET /api/agent/consent` — the current fold.
- `POST /api/agent/execute-action` — takes **only** an action id. Context is
  reassembled and the plan regenerated server-side, so a stale or forged
  client plan authorizes nothing. A refusal is a 200 with `executed: false`
  and a reason; transport/auth problems keep their own codes.

## Deployment prerequisite

The Level-3 share and the ownership read go through backend routes guarded by
`requireVerifiedClerkUserId`, which is a no-op returning 401 when
`CLERK_JWT_VERIFICATION=off`. In `off` mode execution degrades to an honest
recorded failure — never a fake success — but consented sharing will not
function until the backend runs `shadow` or `enforce`.

## Still not in scope

No chat UI or new product noun. No autonomous execution: every Level-3 run is
one clinician approval for one scope, and the agent never batches or infers
approval. No apply-on-your-behalf (`POST /api/apply/intents/:uri/submit`
requires an employer-issued intent the agent cannot mint). Employer-owned and
institution-owned steps remain human-only by contract. Daily loops,
deadlines, and source-refresh scheduling are A2.
