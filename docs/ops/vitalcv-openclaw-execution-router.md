# VitalCV OpenClaw Execution Router
**Authority:** CLAUDE.md  
**Updated:** 2026-05-07  
**Role:** Orchestration, planning, and routing layer

---

## Section F — Operational Safety Rules (Mandatory)

These rules apply to every agent in every session without exception.

---

### F.1 — Never Trust a Single Model

No single agent's output is authoritative on its own for any consequential action.

| Action | Required verification |
|---|---|
| Merge a PR | Codex SAFE in transcript |
| Claim a feature is live | grep or read the actual file |
| Assert a test passes | vitest output in the current session |
| Assert a banned string is absent | git diff grep in the current session |
| Claim a completion board % | evidence from merged code on origin/main |
| Assert a route returns 200 | smoke test output (not assumption) |

---

### F.2 — Never Merge Without Codex SAFE

```
If Codex verdict is absent → PR does not merge.
If Codex verdict is FAIL → PR does not merge until violations are fixed and Codex re-runs.
If a "feature-dev:code-reviewer" subagent gave a review → does NOT satisfy the merge gate.
If OpenClaw says "looks good" → does NOT satisfy the merge gate.
If Claude Desktop says "SAFE" → does NOT satisfy the merge gate.
Only: codex exec output containing the literal word SAFE satisfies the gate.
```

---

### F.3 — Never Let Agents Rewrite Truth Doctrine

These files may only be modified by the founder:
- `CLAUDE.md`
- `MASTER_PROMPT.md`
- `ANTIGRAVITY.md` (if present)
- `Canon.md` (if present)
- `CRED0_DOCTRINE.md` (if present)

Agents may PROPOSE changes by writing a note to `docs/ops/doctrine-change-proposals.md`. No agent may apply the change.

---

### F.4 — Never Auto-Merge Prisma Changes

Prisma schema changes and migration SQL are founder-gated. No agent may:
- Run `prisma migrate` without explicit "approved" in the current session from the founder
- Auto-approve a PR that contains schema.prisma changes
- Generate migration SQL as part of a routine wave (migration SQL is a separate, reviewed artifact)

---

### F.5 — Never Allow Unsupported Claims in Merged Code

Any file that reaches `origin/main` must be free of:
- Claims about sources not actually integrated (NPDB, DEA, ABMS, SAM.gov, Doximity)
- Certification claims not yet earned (SOC 2, NCQA, HIPAA compliant)
- All CLAUDE.md banned strings
- Bare "Verified" status labels
- Demo data presented without structural disclaimer

Enforcement: banned-strings CI gate (PR #225). Must be merged before subsequent PRs.

---

### F.6 — Never Silently Weaken Auditability

Every mutating API endpoint must:
- Write an `AuditEvent` row before returning 2xx
- Never swallow errors that would prevent audit event write
- Never return 2xx if the audit event write fails

Agents that introduce a new mutating endpoint without an audit event are introducing a silent auditability gap. Codex must catch this.

---

### F.7 — Never Blur Demo vs Real

Every surface that uses demo/fixture data must:
- Carry a structural marker (`_demo: true`, `recordedBy: 'demo'`, or a visible banner)
- Not render score badges, verification status, or trust tier indicators that imply a real computation
- Explicitly disclaim in any downloadable artifact that the data is illustrative

An agent that removes a demo marker without replacing it with real data is introducing fake certainty.

---

### F.8 — Never Let UI Imply Certainty Not Earned

A UI surface implies certainty when:
- It shows a green checkmark for a source that is `access_required` or `planned`
- It shows a score without disclosing the lanes it is computed from
- It shows "Verified" without a linked receipt
- It shows a time savings estimate without labeling it as estimated vs measured
- It shows a loading state that implies an active external check when none is in flight

Agents that introduce these patterns are introducing fake certainty. Codex copy/truth audit must catch this.

---

### F.9 — Always Preserve Evidence Provenance

Every piece of data that reaches the UI must carry:
- `source`: where it came from (e.g., `NPPES Registry`, `user_entered`)
- `confidence`: `high` / `medium` / `low` / `user_entered`
- `checkedAt`: when the source was queried
- `lifecycle`: `active` / `planned` / `unintegrated` / `demo_only` (from `LANE_LIFECYCLE`)

An agent that removes provenance metadata to simplify a component is breaking the evidence chain.

---

### F.10 — Always Preserve Source Freshness Semantics

The 9 canonical coverage states from `packages/trust-state/sourceCoverage.ts` must not be collapsed, merged, or renamed:
`checked | stale | pending | gated | unavailable | accessRequired | reviewRequired | notDecisionGrade | previewOnly`

An agent that maps `accessRequired` to `pending` is hiding a real distinction. Codex must catch this.

---

### F.11 — Always Preserve Tenant Boundaries

Cross-tenant PSV receipt reuse requires explicit consent.  
An agent that removes the `blocked_cross_tenant` gate is eliminating a trust boundary.  
This cannot be done in a routine wave — it requires explicit architectural review.

---

## Section G — Recommended Final Operating Stack

### The Stack

| Layer | Tool | Why |
|---|---|---|
| **Orchestration** | OpenClaw | Persistent context, memory, wave sequencing, task generation. Cannot build or merge — keeps the orchestration layer honest. |
| **Implementation** | Claude Code Terminal | Best-in-class for file-level code changes in a large repo. Worktree-aware. Can run builds and tests. Merge-gated. |
| **Verification** | Codex (`codex exec`) | Surgical, reproducible, three-audit format. The only tool that satisfies the merge gate. |
| **Synthesis** | Claude Desktop | Long context, strategic reasoning, doctrine writing, launch readiness review. Not an implementation engine. |
| **Research (conditional)** | Claude Browser | On-demand spec reading. Not a primary session tool. |

### Why This Stack is Optimal

1. **No redundancy.** Each tool has exactly one primary responsibility. The boundaries are enforced by CLAUDE.md, not by convention.

2. **Failure modes are contained.** If Claude Code Terminal makes an error, Codex catches it before merge. If Codex misses something, the banned-strings CI gate catches it. If a wave plan is wrong, Claude Desktop can review it before implementation starts.

3. **Auditability.** Every step produces a traceable artifact: OpenClaw → task package in `docs/ops/`, Claude Code Terminal → PR with test output, Codex → SAFE verdict in transcript, merge → git log. The full decision chain is reproducible.

4. **Truth integrity.** The separation of implementation (Claude Code Terminal) from verification (Codex) from planning (OpenClaw) from strategy (Claude Desktop) means no single agent can both introduce and approve a fake certainty violation.

5. **Scales with the team.** When a second engineer joins, they read `docs/ops/` and CLAUDE.md. The operating model is in the repo — not in anyone's head.

### What to Avoid

| Anti-pattern | Why it fails |
|---|---|
| OpenClaw writing product code | It lacks the runtime context to test; produces untestable changes |
| Claude Desktop as a bulk implementation engine | It hallucinates file paths in long sessions; blast radius is uncontrolled |
| Skipping Codex for "obvious" PRs | "Obvious" PRs are where banned strings and fake certainty slip through most often |
| Multiple agents working the same PR simultaneously | Context diverges; one agent's changes overwrite the other's |
| Cowork for VitalCV | Adds a third reasoning context without adding verification capability |
| Letting OpenClaw merge PRs | It has no access to the runtime state needed to verify a merge is safe |
| Using `codex exec` as an implementation tool | Codex is a verifier, not a builder; mixing roles undermines the merge gate |

### What Scales

- **OpenClaw memory + daily notes** grow with the project without adding cognitive overhead
- **Wave-structured docs in `docs/ops/`** give any agent instant context
- **Codex SAFE as a merge gate** stays effective regardless of team size
- **Banned-strings CI** is always on; no agent can bypass it
- **Knowledge Trust Graph** grows incrementally (add edges, never rewrite)

### Final Verdict on Stack Simplicity

The optimal VitalCV operating stack has exactly **four active tools:**

```
OpenClaw (orchestrate) → Claude Code Terminal (build) → Codex (verify) → merge
                                    ↑
               Claude Desktop (review, doctrine) — on demand, not in every flow
```

Every other tool is a conditional addition with a specific trigger. The default answer for any new tool proposal is: "what does it do that the existing four cannot?"
