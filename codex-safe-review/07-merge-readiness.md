# W228-C6 — Merge Readiness Report

**Date:** 2026-06-21 · **Branch:** `wave/career-evidence-network-alignment`

---

## 1. The four merge conditions

| Condition | Met? | Basis |
|---|---|---|
| Architecture coherent | ✅ | linear DAG, no cycles, single external dep, one adapter seam (01, 02) |
| No critical risks | ✅ | only medium *operational* items (route tests, branch scoping); no architectural blocker (06) |
| No broken invariants | ✅ | every doctrine invariant test-enforced (03 §4, 06 §1) |
| No trust violations | ✅ | decisionGrade⇔checked, monotonic trust, gated-stays-gated, honest absence — all tested |

**On architecture/safety grounds, the stack passes all four conditions.**

## 2. Success-criteria answers

1. **Is the stack coherent?** Yes — strict `types→collection→graph→trust→timeline` layering, no duplication beyond one trivial trust-delta helper.
2. **Is the stack safe?** Yes — pure transforms, no persistence, no PHI, every invariant under test.
3. **Is the stack mergeable?** Yes, **conditionally** — see §3.
4. **Is the stack extensible?** Yes — facade + adapter seam; Mobility/Network/Recognition plug in without touching the package.
5. **What must be fixed before Wave 230+?** §4.

## 3. Pre-merge conditions (operational, not architectural)

These are **process** gates, not code defects:

1. **Codex SAFE verdict — MANDATORY (not yet obtained).** Per doctrine, `gh pr merge` is hook-blocked without a real `codex exec` SAFE verdict (implementation/diff/copy audits) in the transcript. This package exists to enable that pass. **This is the gating item.**
2. **Commit the work.** The entire stack is currently **untracked/uncommitted**. It must be committed (logically grouped) before review/merge.
3. **Scope the branch (important).** `wave/career-evidence-network-alignment` currently conflates **two unrelated bodies of work**:
   - **This stack** (mergeable): `packages/domain-evidence/`, `apps/web/lib/evidence/`, `apps/web/lib/packet/`, the evidence/graph/timeline/packet routes + tests, the `employer-proof-packet-pdf.tsx` extension, `docs/wave2*`, `codex-safe-review/`.
   - **Pre-existing WIP (not produced this session):** `M CLAUDE.md`, `DOCTRINE.md`, `MASTER_PROMPT.md`, `README.md`, `HomePageClient.tsx`, `page.tsx`, `TrustConsentModal.tsx`, `Navbar.tsx`, `AuditProofViewer.tsx`, plus worktree dirs and `docs/launch/`, `scripts/check-public-claims.ts`.
   **Recommendation:** commit and review the Career Evidence stack as its own unit; treat the pre-existing WIP separately (it predates this session and should not ride in on a SAFE review of this stack). Do not assume the WIP is part of this feature.
4. **CI build green.** `dist/` is gitignored (like `trust-state`), so CI must run `pnpm turbo run build --filter @vitalcv/web` to prebuild the new workspace dep, then `pnpm typecheck` + `pnpm lint` + `next build`. Locally verified: package build, both typechecks (0 errors), `check:claims`, ESLint — all green; full `next build` not run locally (CI gate).

## 4. Recommended before building Wave 230+ (not merge-blocking)

| Item | Why | Effort |
|---|---|---|
| 4 API route smoke tests | only real coverage gap (03 §2) — handler wiring untested | ~1 unit |
| Extract shared `trustDelta(node)` helper | removes the one logic duplication (02 §1) | ~0.3 unit |
| 2 dimension assertions (mobility/institutional) + training/revoked adapter fixtures | close low-severity coverage | ~0.3 unit |

## 5. Verdict

> **The Career Evidence stack is coherent, safe, and architecturally mergeable. It is NOT yet merge-ready operationally** because (a) it has no Codex SAFE verdict, (b) it is uncommitted, and (c) it is entangled with unrelated pre-existing branch WIP that must be separated.

**Path to merge:** commit + scope the stack → run CI build → obtain Codex SAFE on this package → `gh pr merge`. The recommended hardening in §4 is best done *after* SAFE (changing code right before an independent audit is counterproductive) or folded into the SAFE remediation if Codex flags it.

**Do not develop Wave 230+ features on top until the stack is committed and SAFE-reviewed** — the unmerged stack is already five waves deep; extending it further increases audit surface and merge risk.
