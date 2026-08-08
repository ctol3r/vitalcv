# Branches pending deletion (2026-08-08)

Deletion is blocked for the sessions that created these (HTTP 403 on
`git push --delete`, with no delete-branch tool available and the REST token
gated). This list exists so an operator with branch-delete rights can finish
the job in one pass.

## Tier-S closure (193)

193 remote branches whose only open PR was closed in the Tier-S batch — see
`docs/ops/merge-ledger.md` for the execution receipt.

```
a11y/homepage-main-landmark
codex/add-apply-to-job-backend-route
codex/add-clinician-readiness-summary-and-feedback-collector
codex/add-compliance-evidence-export-api
codex/add-compliance-export-endpoint
codex/add-credential-formats-for-vc-issuance
codex/add-early-adopter-flows-and-metrics
codex/add-employer-readiness-apis
codex/add-employer-risk-intelligence-api
codex/add-job-signal-events-api
codex/add-matcha-ui-integration-to-dashboard
codex/add-notification-orchestration-system
codex/add-public-verification-endpoint
codex/add-readiness-breakdown-and-feedback-endpoints
codex/add-referral-endpoint-for-credentials
codex/add-renewal-automation-engine-features
codex/add-system-health-status-api
codex/add-trust-ledger-auditing-components
codex/add-trust-ledger-with-merkle-roots
codex/add-trusted-issuer-verification-function
codex/add-vitalcv-ats-adapters
codex/add-world-id-verification-middleware
codex/build-/on-history-endpoint
codex/create-issuer-model-and-service
codex/create-renewal-tasks-and-calendar-api
codex/create-trust-graph-model-and-api
codex/define-psl-schema-and-store
codex/define-revocation-reason-codes-and-sla
codex/emit-consent-receipt-on-share
codex/implement-backend-for-issuance-and-verification
codex/implement-backend-for-pulse-and-discover
codex/implement-credential-lifecycle-engine
codex/implement-delegated-credential-attestations
codex/implement-job-application-submission-and-logging
codex/implement-matcha-api-logic
codex/implement-pulse-system-event-stream
codex/sign-credential-with-ed25519-and-log-events
codex/upgrade-verifier-logic-for-dids
codex/wave-04
codex/wire-up-backend-matching-logic
docs/board-100-sprint-1
docs/clerk-auth-gate-diagnostics
docs/codebase-map-2026-05-18
docs/completion-board-product-truth-reset
docs/founder-demo-smoke-checklist
docs/identity-vendor-foundation
docs/pilot-packet-skeleton
docs/pr431-visual-system-port-triage
docs/security-compliance-delta-1
docs/state-map-pr-triage-2026-05-07
docs/trust-persist-1-inventory
feat/canonical-provenance-navigation
feat/clinician-onboarding-wire
feat/conflict-resolution
feat/crs-licensure-cap
feat/crs-licensure-cap-rim
feat/db-migrate-cutover
feat/decision-ui
feat/demo-passport-seed
feat/design-trust-surfaces-canon-v1
feat/employer-accept-audit-event-visibility
feat/framer-website-shell
feat/god-3-knowledge-inbox
feat/hybrid-loader
feat/institutional-intake-momentum
feat/institutional-trust-primitives
feat/integration-wave-41-confidence
feat/integration-wave-44-roi
feat/interoperability-rehearsal-infrastructure
feat/lead-capture-wire
feat/manual-audit-bundle
feat/matuschak-provenance-panes
feat/oig-confidence-semantics
feat/pilot-demonstration-compression
feat/pilot-deployment-kit
feat/policy-decision-persistence
feat/ship-knowledge-inbox-clean
feat/source-health-remediation-hints
feat/trust-integration-coherence
feat/upload-cv
feat/verifier-invitations
feat/verifier-rbac
feature/ai-knowledge-inbox-agent
feature/apply-with-vcv-core-loop
feature/daily-use-utility
feature/holder-loop-from-salvage
feature/holder-loop-lock
feature/pilot-intake-operator-handoff
feature/repo-harvest-salvage-map
feature/static-role-routes
feature/wave14-graph-substrate
fix/conversion-unblock
fix/post-pr157-smoke-test-fixes
fix/prisma-contract-fragmentation
fix/truth-constrained-operationalization
fix/well-known-dynamic-host
ops/local-demo-operator
ops/vercel-exit-emergency
pr/acceptance-graph
purity-guard-helpers
release/live-100-usable
truth/cleanup-2-passport-wording-v2
vercel/react-server-components-cve-vu-3lwysa
vercel/react-server-components-cve-vu-f7qoj8
w2-pr127a/institutional-simplicity-compression
w2-pr134a/production-acceptance
w2-pr44a/credential-lifecycle
w2-pr80a/institutional-deployment-templates
w2/pr57a-human-ai-integrity
warranty-clean-pr
wave-2f/smoke-hero-routes
wave-3a/release-checklist
wave-3b/route-map
wave-3f/banned-strings-gate
wave-4b/stripe-foundation
wave-4e/pwa-shell
wave-4f/db-migration-baseline
wave-5a/signup-gate
wave-5b/doc-upload
wave-5c/cross-tenant-reuse
wave-w2-pr124a/safe-audit-convergence
wave-w2-pr60a/economic-trust
wave-w2/pr140a-ecosystem-readiness
wave-w2/pr144a-activation-readiness
wave-w2/pr46a-apply-with-vcv
wave/activate1-pr379a-webv2-security-headers
wave/anon-write-extinction
wave/audit-chain-actor-hardening
wave/auth1-pr271a-activation-flow-audit
wave/b16-convergence-final
wave/build-artifact-verification
wave/canonical-route-map
wave/crypto1-pr316a-webv2-jwks
wave/crypto1-stack-audit
wave/degraded-state-renderer
wave/demo-spine-openevidence-execution
wave/design-trust-state-console
wave/design-truth-boundary
wave/docs-verifier-quickstart
wave/durability1-pr345a-schema
wave/enterprise1-pr339a-signed-export-envelope
wave/enterprise1-status-audit
wave/go-live-1-pr416a-status-route
wave/harden-pilot-ops-events-401
wave/launch-readiness-final
wave/merge-readiness-audit
wave/openevidence-data-injection-demo-spine
wave/ops-env-example-templates
wave/ops-pg-dump-backup
wave/ops-signing-keypair-script
wave/passport-proxy-shape-fix
wave/pilot-onboarding-readiness
wave/prod2-pr304a-clerk-oauth-runbook
wave/production-promotion-protocol
wave/replay-identity-w10
wave/replay-survivability-w14
wave/run-lineage-visibility
wave/runtime-channels
wave/scaffold-web-v2-sandbox
wave/structured-cors-rejection-and-replay-actor-state
wave/survival-stop-bleeding
wave/trust-convergence-p0-p2
wave/trust-primitives-adoption
wave/trust-primitives-lane-b
wave/truth-contract-restoration-1
wave/verifier-continuity-completion
wave/verify-clerk-env-in-build
wave/verify-runtime-w9
wave/w2-pr1-rbac-foundation
wave/w2-pr133a-replay-integrity
wave/w2-pr143a-freeze-verification
wave/w2-pr153a-activation-audit
wave/w2-pr154a-governance-stewardship
wave/w2-pr157a-covenant-finalization
wave/w2-pr159a-ecosystem-activation
wave/w2-pr162a-runtime-activation
wave/w2-pr166a-ignition-validation
wave/w2-pr169a-activation-runbook
wave/w2-pr170a-production-seal
wave/w2-pr172a-operational-activation
wave/w2-pr17a-governance-operationalization
wave/w2-pr1a-fail-closed
wave/w3-pr176a-institutional-hero
wave/w3-pr200a-wallet-reality
wave/w3-pr209a-passport-runtime-audit
wave/w3-pr210a-passport-replay-lineage
wave/w3-pr212a-backend-replay-lineage
wave/w3-pr213a-backend-passport-lineage-wire
wave/w4-pr216a-dashboard-hydration
wave/w4-pr248a-proof-manifest-visibility
wave/w4-pr249a-wire-manifest-panel
wave/w5-pr256a-web-v2-clerk-signin
wave/well-known-w9
```

## Other (1)

Not part of the Tier-S batch — recorded here so one cleanup pass covers
everything rather than leaving a stray behind.

```
claude/stale-janitor
```

`claude/stale-janitor` @ `503ed3a3f` was created in error while building the
stale janitor: the work was pushed there before being moved onto its designated
branch. It has no pull request, and the commit it carries is an **older** copy
of the janitor than what landed — it predates both the ref-keyed concurrency fix
and the enforce-by-default flip. Nothing exists only on this branch; deleting it
loses nothing.

Ironic but worth stating plainly: this is exactly the kind of orphan the janitor
in `.github/workflows/stale-janitor.yml` cannot clean up. That workflow acts on
open pull requests and deletes a head branch only when it closes one, so a
branch with no PR is invisible to it. Bare-branch hygiene remains a manual sweep.
