# Open PR Triage · 2026-05-07

92 open PRs as of `gh pr list` snapshot 2026-05-07. Each is classified by what's required to land it.

**Inputs:** `gh pr list` JSON dump (mergeable + mergeStateStatus per PR), `docs/ops/code-red-final-verification-2026-05-07.md`, branch metadata, recent commits on `origin/main` (`27d5d6cf`).

## Class definitions

| Class | Definition |
|---|---|
| **merge-after-Codex** | Clean diff against `origin/main`, no conflicts, ready for `codex exec` SAFE verdict + `gh pr merge`. The merge hook requires SAFE in transcript (CLAUDE.md). |
| **rebase-needed** | Conflicts against `origin/main` (`mergeable=CONFLICTING`, `mergeStateStatus=DIRTY`) OR known schema overlaps with already-landed Code Red PRs. |
| **superseded** | The PR's content was either landed under a different PR number during Code Red OR a structurally newer PR replaces it. |
| **close** | Stale, exploratory, or replaced by a different approach. Recommend close-with-comment (no merge attempt). |
| **founder-decision-required** | The PR proposes a direction (architecture, copy, naming, vendor stance) the founder must decide before merge. Not a code-quality issue. |

## Sources of conflict (already known)

The Code Red push (27 merges, 2026-05-05 → 2026-05-07) created merge debt for older PRs:

1. **Prisma schema** — PR #221 landed `IssuerRequest` + `ReceiptCandidate` with truth-contract CHECK constraints. Any open PR that adds a new model to `apps/web/prisma/schema.prisma` will conflict.
2. **Issuer persistence trio (#255 #256 #257 #258)** landed feature-flagged DB writers under `ISSUER_PERSISTENCE_ENABLED`. Any open PR touching the same review-surface files needs rebase.
3. **Banned-string + truth-contract enforcement** — Code Red enforced `>Verified<` removal and vendor-name removal across the new design surfaces. Older PRs that reintroduce bare `Verified` or unsupported vendor names will fail truth-contract review.

---

## Triage

### Class A — merge-after-Codex (W1 trust-restoration sequence)

These are the surgical wave-1 fixes from the recursive audit. Each isolated, each tested.

| PR | Branch | Title | Notes |
|---|---|---|---|
| **#266** | `feat/crs-licensure-cap` | feat(crs): cap CRS at L1 (45) when licensure cannot be sourced (W1.1) | YC-MVP frozen baseline preserved via opt-in dep; 6 tests pass; isolated 1-package change; pre-existing `BLOCKING_REASON_ORDER` `ACTIVE_DIVERGENCE` bug surfaced (NOT in scope) |
| **#267** | `feat/crs-licensure-cap-rim` | feat(readiness): propagate CRS licensure cap to backend + web rim (W1.1b) | Backend `passportService.ts` + web defense-in-depth helper + demo-fixture alignment + `data-licensure-state` attributes; 24 tests pass; NOT a dependency of #266 |
| **#272** | `feat/oig-confidence-semantics` | feat(oig): three-way confidence — no_match / possible_match / exact (W1.2) | `MatchConfidence` extended; OIG adapter rewrite; 8 tests pass; web `exclusionStatus` enum already supports `POSSIBLE_MATCH` so no UI changes; pre-existing `sha256Sync` bug surfaced (NOT in scope) |
| **#250** | `feat/demo-passport-seed` | feat(demo): seed Macie Miller PA-C demo passport on /passport/[DEMO_NPI] | Closes Browser-QA "20 of 28 boundaries not testable" P0; 5 tests; needs Codex SAFE |
| **#249** | `a11y/homepage-main-landmark` | fix(a11y): wrap homepage in `<main id="main-content">` | 1-test PR; pure structural a11y; no copy changes |

### Class A — merge-after-Codex (Code Red leftovers)

| PR | Branch | Title | Notes |
|---|---|---|---|
| **#252** | `feat/deploy-health-probe` | feat(ops): post-deploy source-health probe | landed in code-red doc as PR #252 — open list still shows it; **verify if already merged**, otherwise merge-after-Codex |
| **#251** | `feat/db-migrate-cutover` | feat(ops): DB migrate cutover runbook + dry-run + migration-shape gate | Docs + scripts only; CI workflow modification; 2 tests pass; surgical |
| **#244** | `wave-2f/smoke-hero-routes` | feat(ci): add hero-route smoke test script and workflow | pnpm version mismatch was amended in-place; ready to land |

### Class B — rebase-needed

| PR | Branch | Why | Path forward |
|---|---|---|---|
| **#247** | `feat/policy-decision-persistence` | `mergeable=CONFLICTING, state=DIRTY` — conflicts with #221's `apps/web/prisma/schema.prisma` (added the same boilerplate) | Rebase onto current main; remove `IssuerRequest`/`ReceiptCandidate` from this PR's schema (they're already there); keep only `PolicyReviewDecision` model addition |
| **#243** | `feat/verifier-rbac` | `mergeable=CONFLICTING, state=DIRTY` — likely conflicts with `apps/web/middleware.ts` and `apps/web/lib/auth/orgInvitations.ts` after Code Red touched the role-gating layer | Rebase; reapply `rbacEnforced = true as const` flip + `/api/verifier/*` middleware gate + 18 tests |
| **#240** | `wave-5c/cross-tenant-reuse` | `mergeable=CONFLICTING, state=DIRTY` — likely conflicts with #235 (cross-tenant reuse helpers landed in Code Red Wave A) | Re-evaluate scope: if #235 covers the helper, this PR may shrink to the wiring layer only; possibly close as superseded |
| **#230** | `wave-10a/docs-status` | `mergeable=CONFLICTING, state=DIRTY` — `/status` route was extended by #261 (public source-health panel) | Rebase; reconcile with #261's snapshot store; preserve compliance-evidence wiring |
| **#127** | `feature/daily-use-utility` | `mergeable=CONFLICTING, state=DIRTY` — month-old branch, schema + route layout heavily drifted | Rebase or close; founder-decision on whether the holder daily-use loop is still scope |
| **#246** | `feat/upload-cv` (PR #246 export-bundle) | head branch shared with #245; needs rebase OR split | Split commits into separate branches; `feat/upload-cv` should hold only #245's CV upload, `feat/export-bundle` should hold only #246's export bundle |
| **#245** | `feat/upload-cv` | shared branch with #246 | Same as above — split |

### Class B — rebase-needed (older, lower priority)

| PR | Branch | Why |
|---|---|---|
| **#239** | `wave-5b/doc-upload` | Document upload foundation. `/clinician/import` was modified by Code Red; needs reconciliation. |
| **#238** | `wave-5a/signup-gate` | Signup-gate touches `/signup` and `/sign-up/[[...sign-up]]` reconciliation; the dual-route situation is itself a launch blocker. |
| **#237** | `wave-4f/db-migration-baseline` | `mergeable=MERGEABLE, state=UNSTABLE` — likely CI-flake; surgical doc + CI gate; close-attempt with Codex |
| **#236** | `wave-4e/pwa-shell` | PWA service-worker shell; likely conflicts with index/manifest after Code Red landing pages |
| **#234**-merged-already? | per code-red doc landed under #234 — verify open list isn't stale |
| **#233** | `wave-4b/stripe-foundation` | Stripe checkout foundation (`collectsPayment: false`); founder-decision-required on payments scope |

### Class C — superseded

| PR | Branch | Why |
|---|---|---|
| **#226** | `wave-2a/sec-headers` | Open list shows it OPEN; code-red doc lists it as LANDED. **Verify with `gh pr view 226 --json state`** — if merged, close locally. Same risk: #226's CSP hotfix amended in-flight earlier in this session. |
| **#225** | `wave-3f/banned-strings-gate` | banned-strings CI gate. Code-red doc references the gate as already in `apps/web/lib/trust/trust-container-view.ts` (CI regex in production code). May be superseded by Code Red's enforcement model. |
| **#224** | `wave-3b/route-map` | Route-map CI gate. Possibly superseded by `code-red-final-verification` doc + the smoke workflow (#244 / #246). Founder-decision: keep both or pick one. |
| **#223** | `wave-3a/release-checklist` | Release checklist + CI gate. Possibly superseded by code-red verification doc. |
| **#212** | `docs/board-100-sprint-1` | "Map honest path to full completion" — predates the code-red close; the close itself is the new map. |
| **#206** | `docs/security-compliance-delta-1` | Security compliance delta after EV6 + crypto merges. Crypto merges referenced are in repo memory (`pr_b_crypto_decision`); doc may be stale. |
| **#190** | `truth/cleanup-2-passport-wording-v2` | Passport wording cleanup. Likely already absorbed into the broader Code Red banned-strings sweep. |
| **#181** | `docs/completion-board-product-truth-reset` | Completion-board reset; superseded by the code-red doc. |
| **#163** | `feature/ai-knowledge-inbox-agent` | AI Knowledge Inbox builder slice. PR #268 landed the inbox surface. Verify if this PR's scope is still distinct. |
| **#164** | `feat/god-3-knowledge-inbox` | Same as above — AI Knowledge Inbox foundation. Likely superseded by #268. |
| **#165** | `feat/ship-knowledge-inbox-clean` | Third inbox PR. Three-way overlap; only one should land. |
| **#161** | `release/live-100-usable` | Make canonical public shell live. The shell is live (status smoke passes 13×200). Likely superseded. |
| **#160** | `fix/post-pr157-smoke-test-fixes` | Followup to a long-merged PR. Verify if needed. |
| **#159** | `feature/apply-with-vcv-core-loop` | Apply with VitalCV. Founder-decision-required: is "apply" still a strategic surface vs the new `/contact?persona=` funnel? |
| **#158** | `warranty-clean-pr` | Trust Warranty / Risk Transfer wave. CLAUDE.md banned strings include "risk transferred". This PR may carry banned copy. Founder-decision-required + truth-contract review. |
| **#156** | `pr/acceptance-graph` | Acceptance-graph predictive routing. Speculative architecture; founder-decision. |
| **#153** | `feature/pilot-intake-operator-handoff` | Pilot intake. **Superseded by #259** (landed in Code Red Wave H). |

### Class D — close (recommend close-with-comment)

| PR | Branch | Why |
|---|---|---|
| **#46** | `vercel/react-server-components-cve-vu-3lwysa` | Vercel-bot draft, RSC CVE; Next 15 already on; verify CVE applicability and close if irrelevant |
| **#45** | `vercel/react-server-components-cve-vu-f7qoj8` | Duplicate of #46 — close one |
| **#134** | `feat/conflict-resolution` | Deterministic conflict-resolution engine. April 2026 wave; the canonical-path conflict semantics are now in domain-common per master prompt. Verify if anything still adds. |
| **#133** | `feature/wave14-graph-substrate` | Wave14 graph substrate + marketing surfaces. April; likely superseded by Code Red marketing landing pages. |
| **#132** | `fix/conversion-unblock` | Wave 13 employer explainability. April; likely superseded by Code Red employer surfaces (`/employer/worklist`, `/file`, `/roi`). |
| **#131** | `feat/hybrid-loader` | Instant-render provider identity via cache + SSR seed. SSR is now Next 15 default; cache layer needs trace. |
| **#129** | `feat/manual-audit-bundle` | Auto-start ingest stream for deep-linked NPI lookups. The home flow does this today; verify scope. |
| **#128** | `feat/decision-ui` | DecisionBlock UI + confidence primitives. PR #269 (Confidence Doctrine v2) is open and structurally newer. Likely superseded. |
| **#126** | `feature/holder-loop-from-salvage` | Holder UX salvage. April. Likely superseded. |
| **#125** | `feature/repo-harvest-salvage-map` | Salvage map. April. Likely superseded by code-red doc + this state-map. |
| **#124** | `feature/holder-loop-lock` | Lock the clinician adoption loop. April. Founder-decision. |

### Class E — founder-decision-required

| PR | Branch | Decision needed |
|---|---|---|
| **#276** | `feat/integration-wave-44-roi` | ROI Console v2 — duplicates existing `/roi` (PR #265, landed). Pick one direction; recommend close. |
| **#269** | `feat/integration-wave-41-confidence` | Confidence Doctrine v2 — categorical primitives + doctrine module. Architectural primitive add. Founder must approve the doctrine module's vocabulary before it lands. |
| **#231** | `docs/identity-vendor-foundation` | Identity vendor foundation doc. Names vendors; founder-decision on vendor stance. |
| **#233** | `wave-4b/stripe-foundation` | Foundation-tier Stripe checkout (`collectsPayment: false`). Strategic decision: does the project ship a payments surface now or after pilot conversion? |
| **#212** | `docs/board-100-sprint-1` | Path to 100% — superseded but if founder wants a forward map post-Code-Red, this could be the rebased base. |
| **#159** | `feature/apply-with-vcv-core-loop` | "Apply with VitalCV" — strategic surface? |
| **#158** | `warranty-clean-pr` | Trust Warranty + Risk Transfer copy. Banned-strings concern. |
| **#156** | `pr/acceptance-graph` | Predictive acceptance routing. Speculative architecture. |

---

## Quick-reference: open PRs by `mergeable` field

| Field | Count | What to do |
|---|---:|---|
| `MERGEABLE` + `UNSTABLE` | 1 (#237) | CI flake; rerun → Codex SAFE → merge |
| `CONFLICTING` + `DIRTY` | 5 (#127, #230, #240, #243, #247) | Rebase onto `27d5d6cf`; reapply core change; reduce schema overlap |
| `UNKNOWN` (most PRs) | ~86 | gh API hasn't computed; many will resolve to MERGEABLE on next gh poll. Triage by content (above) rather than by field. |

---

## Verification commands (locally reproducible)

```bash
# Confirm an "open" PR was actually closed by Code Red
gh pr view <NUMBER> --json state,mergedAt,mergeCommit

# Get current conflict status
gh pr view <NUMBER> --json mergeable,mergeStateStatus

# See diff against origin/main
gh pr diff <NUMBER>

# Three-pass Codex audit before merge (CLAUDE.md requirement)
codex exec --pr <NUMBER>  # implementation
codex exec --pr <NUMBER>  # diff safety
codex exec --pr <NUMBER>  # banned strings
# Each must produce literal "Codex verdict: SAFE" before gh pr merge
```
