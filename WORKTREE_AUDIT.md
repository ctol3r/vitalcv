# Worktree Audit
Generated: 2026-05-13T20:45:00Z
Branch: wave-10a/docs-status

---

## Committed This Session (Meaningful Work)

| Commit | Domain | Files |
|---|---|---|
| `d384e3ff` | Passport trust posture expansion | passport-contract.ts, PassportWallet.tsx, PassportTrustPosture.tsx, TrustSummarySection.tsx, buildDegradedPassportStub.ts, status-language.ts |
| `4043f726` | API + verifier improvements | passport routes (3), ProvenanceStrip.tsx, ReceiptVerificationPane.tsx, EmployerCockpit.tsx, tests (3) |
| `8489333e` | Package exports + wallet SDK | package.json, wallet-sdk/index.ts |
| `af3245bd` | Build fix (TypeScript type) | verify/[npi]/page.tsx |

---

## Working Tree Classification

### Meaningful (committed above)
All meaningful work is committed. Zero meaningful unstaged changes remain.

### Untracked — GitHub Workflow Files
```
.github/openclaw-policy.yml
.github/workflows/adoption-flywheel-gate.yml
.github/workflows/api-hardening-gate.yml
.github/workflows/deployment-certification.yml
.github/workflows/deployment-playbook-gate.yml
.github/workflows/deployment-survivability.yml
.github/workflows/merge-verification-gate.yml
.github/workflows/onboarding-finalization-gate.yml
.github/workflows/rollout-survivability.yml
```
**Classification:** Generated CI gate workflows. These appear to be automation scaffolds. They are not committed to any branch. Safe to leave untracked — they don't affect deployment.

### Worktrees (107 total)
- **Primary:** `/Users/christoler/vitalcv` — wave-10a/docs-status ✅
- **In /private/tmp/:** ~100 Claude subagent worktrees from prior sessions
  - Examples: `vitalcv-anon-extinction`, `vitalcv-covenant`, `vitalcv-passport-proxy`, etc.
  - These are isolated branch checkouts, not uncommitted work
  - Their branches remain in git history but worktrees themselves are /tmp ephemeral
  - Safe to leave — they don't affect main or wave-10a/docs-status

### Stash Stack (5 entries)
All stash entries are labeled noise from prior Claude sessions:
- `GOD-3F-inherited-tree-noise`
- `live-100x-tree-noise`
- `profile-branch concurrent WIP (auto-flip debris)`
- `P0-wave1 WIP: ReviewClient...`
- `discarded-external-edit-partial-data-fields...`
**Classification:** Abandoned Claude agent debris. Safe to drop if needed. Not dropping automatically as they may contain recoverable work.

---

## Branch Topology

**Canonical branch:** `main` — `af3245bd` (latest push, includes all tonight's work)
**Working branch:** `wave-10a/docs-status` — in sync with main

**Notable local branches (not merged to main):**
- `board/prf-delta` — ahead 4, behind 95 — stale, has trust/display fixes
- `a11y/homepage-main-landmark` — accessibility fix, not merged
- Various `claude/*` branches — automated Claude commits, some merged, some not

**Verdict:** All meaningful tonight's work is on main. No stranded work.
