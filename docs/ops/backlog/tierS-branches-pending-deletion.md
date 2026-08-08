# Branches pending deletion (2026-08-08)

> **Status 2026-08-08: still pending. The 403 is an AGENT-SANDBOX policy, not a
> GitHub restriction — try from a human workstation first.**
>
> **Corrected 2026-08-08 (second revision).** Two earlier diagnoses in this file
> were wrong. The first blamed the automation's credential. The second — which
> replaced it — blamed a repo-wide GitHub ruleset and sent an operator to
> loosen **Settings → Rules → Rulesets**. Both were wrong, and the second was
> worse than useless: it prescribed weakening a real guardrail to fix something
> that guardrail was not causing. If *Restrict deletions* was relaxed on the
> strength of that advice, **consider putting it back.**
>
> ### What the 403 actually is
>
> `git push origin --delete` from inside a Claude Code agent sandbox is
> intercepted by the agent HTTP proxy, which rejects ref deletions without
> forwarding them. GitHub never sees the request. Evidence, from
> `GIT_CURL_VERBOSE=1` on a delete push:
>
> | | ref advertisement (`GET /info/refs`) | delete (`POST /git-receive-pack`) |
> |---|---|---|
> | `X-Github-Request-Id` | **present** | **absent** |
> | round trip | ~300 ms | **28 ms** |
> | result | 200 | 403, `Content-Type: application/x-git-receive-pack-result` |
>
> The GET reaches GitHub and returns GitHub's headers. The POST is answered in
> 28 ms by something carrying **no GitHub headers at all**, in a synthesised
> git-protocol envelope. Non-delete pushes through that same `git-receive-pack`
> endpoint succeed constantly — twelve landed the same day this was written —
> so the proxy is not blocking receive-pack; it inspects the payload and refuses
> **deletions** specifically. That is a deliberate agent-safety policy.
>
> ### Why the earlier "every seat, including the founder's" claim was unfounded
>
> That claim rested on a sweep that failed. But the sweep was run from an agent
> session behind this same proxy, so it could only ever have demonstrated the
> proxy's policy — never GitHub's. No human-workstation attempt was ever
> recorded. The observation that the branch count *rose* from 919 to 939 during
> the sweep is consistent with the same thing: the deletes never reached GitHub
> while ordinary pushes did.
>
> ### What to actually do
>
> 1. **From a human workstation, outside any agent sandbox**, try one:
>    `git push origin --delete claude/expo-wave-results`
> 2. If it succeeds — the expected outcome — the proxy was always the blocker.
>    Run the script below for the rest; no settings change is needed, and
>    *Restrict deletions* can stay on.
> 3. Only if it **also** fails from a human workstation does the GitHub-ruleset
>    theory apply. In that case check **Settings → Rules → Rulesets** for a
>    ruleset targeting all refs (`~ALL` or `**`) with **Restrict deletions**
>    enabled, and prefer narrowing its target or adding a bypass actor over
>    disabling the rule.
>
> **Do not diagnose this from inside an agent session again.** Every deletion
> path available there fails identically regardless of cause, so the environment
> cannot distinguish "GitHub forbids this" from "the sandbox forbids this". That
> ambiguity is what produced both previous wrong answers. The distinguishing
> test is the one above, and it has to be run outside.
>
> ### The janitor's `deletions-blocked` counter is not evidence — yet
>
> `.github/workflows/stale-janitor.yml` runs on GitHub Actions runners, which do
> **not** sit behind the agent proxy, so it is the one existing mechanism that
> could settle the GitHub-side question independently. It has not, and its
> output is easy to misread. The enforcing scheduled run of 2026-08-08T05:11Z
> reported:
>
> ```
> summary: marked=0 closed=0 revived=0 exempt=0 deletions-blocked=0 (enforce=true)
> ```
>
> `closed=0` means it closed no PR, and the janitor deletes a head branch *only*
> when it closes one — so **zero deletions were attempted**, and
> `deletions-blocked=0` reflects that rather than a successful deletion. Do not
> cite it as proof that Actions can delete refs. The first enforcing run that
> actually closes a stale PR will produce the real datapoint; until then that
> counter is uninformative in both directions.
>
> The list is at **207** (196 original + 11 merged-PR branches added 2026-08-08).
> The command below re-derives it and re-checks open PRs at run time, so it is
> safe whenever it runs.

## Deleting these, once the restriction is lifted

````bash
set -euo pipefail
git fetch origin main

git show origin/main:docs/ops/backlog/tierS-branches-pending-deletion.md \
  | awk '/^```$/{f=!f;next} f' | grep . | sort -u > /tmp/todelete.txt

# never touch a branch an open PR uses as head or base
gh pr list --state open --limit 300 --json headRefName,baseRefName \
  --jq '.[] | .headRefName, .baseRefName' | sort -u > /tmp/inuse.txt
comm -12 /tmp/todelete.txt /tmp/inuse.txt > /tmp/hazard.txt
if [ -s /tmp/hazard.txt ]; then
  echo "ABORT — still in use by an open PR:"; cat /tmp/hazard.txt; exit 1
fi
if grep -qxE 'main|master|develop' /tmp/todelete.txt; then
  echo "ABORT — protected branch in list"; exit 1
fi

xargs -n 50 git push origin --delete < /tmp/todelete.txt

git fetch origin --prune
git ls-remote --heads origin | sed 's#.*refs/heads/##' | sort > /tmp/remote.txt
echo "remaining from list: $(comm -12 /tmp/todelete.txt /tmp/remote.txt | wc -l)"  # expect 0
````

(Fenced with four backticks on purpose — the script contains a literal
three-backtick sequence inside its `awk` pattern, which would otherwise close
this block early and scramble every fence below it.)

Verified at the time of writing: 196 names extracted cleanly, none matched a
protected branch, none intersected any open PR's head or base, and all 196 were
still present on the remote. **Now 207** — 11 merged-PR branches were appended
on 2026-08-08 and checked against the same four criteria. **Delete this file
once the remaining count is 0.**

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

## Other (3)

Not part of the Tier-S batch — recorded here so one cleanup pass covers
everything rather than leaving strays behind.

```
claude/stale-janitor
wave/2b-me-role-transport-auth
feat/g4-bidirectional-relationships
```

**`claude/stale-janitor`** @ `503ed3a3f` — created in error while building the
stale janitor: the work was pushed there before being moved onto its designated
branch. It has no pull request, and the commit it carries is an **older** copy
of the janitor than what landed, predating both the ref-keyed concurrency fix
and the enforce-by-default flip. Nothing exists only on this branch.

**`wave/2b-me-role-transport-auth`** — head of #506, closed 2026-08-08 by
founder instruction (the transport-auth gate parked on env rollout). The gate
itself is still wanted; it re-cuts from `docs/product/me-role-transport-auth.md`
when its preconditions are met, not from this branch.

**`feat/g4-bidirectional-relationships`** — head of #748, closed 2026-08-08.
The tree predates `docs/adr/0006-graph-backlinks-authz-consent.md` and adds the
public relationships endpoint with no authz or consent code anywhere in the
diff. G4 backlinks were never delivered and are still wanted, but they re-cut
against the ADR rather than porting this branch.

### Closed the same day WITHOUT leaving a branch

PRs #582 and #844 were also closed on 2026-08-08 and are deliberately absent:
Dependabot deletes its own head branch when its PR closes, and both
(`dependabot/npm_and_yarn/expo-notifications-57.0.3`,
`dependabot/npm_and_yarn/apps/marketing/next-15.5.21`) were verified gone from
the remote. Noted so nobody hunts for them and concludes the list is short.

## Merged-PR branches (11)

A different category from everything above, added 2026-08-08. Every other entry
in this file is the head of a **closed** PR or a branch with no PR at all. These
eleven are heads of PRs that **merged** — the Dependabot backlog pass and the
Expo SDK 53 → 57 wave. Their content is on `main`; only the refs survive.

```
claude/dependabot-backlog-triage-cjhums
claude/vite-6-4-3-supersede-852
claude/dependabot-ignore-expo-notifications-major
claude/expo-sdk-53-to-57-wave-plan
claude/mobile-ci-coverage
claude/fix-notification-trigger
claude/expo-sdk-54
claude/expo-sdk-55
claude/expo-sdk-56
claude/expo-sdk-57
claude/expo-wave-results
```

Each was verified merged by confirming its squash-merge commit is an ancestor of
`main` — `git merge-base --is-ancestor`, 11/11 — rather than by branch name or
PR state. Squash-merging means the branch tip itself is *not* an ancestor, so
`git branch --merged` will not list these and a tip-to-tip `git diff main..branch`
says nothing useful; the merge commit is the only reliable witness.

| Branch | PR | Merge commit |
|---|---|---|
| `claude/dependabot-backlog-triage-cjhums` | #1111 | `0b62fc04b` |
| `claude/vite-6-4-3-supersede-852` | #1128 | `d8174a3f6` |
| `claude/dependabot-ignore-expo-notifications-major` | #1135 | `16029f23c` |
| `claude/expo-sdk-53-to-57-wave-plan` | #1141 | `f2dc053ff` |
| `claude/mobile-ci-coverage` | #1143 | `1c5ba0037` |
| `claude/fix-notification-trigger` | #1144 | `75199350a` |
| `claude/expo-sdk-54` | #1167 | `655d56bcb` |
| `claude/expo-sdk-55` | #1172 | `c5a34645` |
| `claude/expo-sdk-56` | #1173 | `793340fa3` |
| `claude/expo-sdk-57` | #1176 | `cff3ea913` |
| `claude/expo-wave-results` | #1181 | `ae0681b8a` |

Checked against this file's own safety criteria before being added: all 11
present on the remote, none matching a protected name, none already listed, and
none used as head or base by any of the 16 open PRs.

**Why auto-delete does not cover them.** *Automatically delete head branches*
was enabled on 2026-08-08, after these merged. It fires on the merge event, so
it applies going forward and cannot reach back. This should be the last batch of
merged-PR branches that ever needs listing here.

### Why the janitor does not shrink this list

`.github/workflows/stale-janitor.yml` acts on open pull requests and deletes a
head branch only when it closes one, so a branch whose PR is already closed — or
that never had a PR at all — is invisible to it. Every entry above the
merged-PR section is in exactly that state, and the merged eleven are doubly
invisible: their PRs were never *closed*, they were *merged*. Bare-branch
hygiene remains a manual sweep.
