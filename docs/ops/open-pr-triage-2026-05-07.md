# Open PR Triage — 2026-05-07

**Baseline commit:** `bf654a94`  
**Branch:** `origin/main`  
**Classification labels:**
- **merge after Codex** — clean or near-clean; Codex SAFE required before merge
- **rebase needed** — conflicts detected; rebase + Codex required
- **superseded** — content already on main or replaced by later PR
- **close** — stale, contaminated (workspace metadata), wrong base, or banned semantics
- **founder decision required** — touches Prisma schema or migration SQL

---

## Group A: Merge After Codex

| PR# | Title (abbrev) | Classification | Reason | Depends On |
|---|---|---|---|---|
| #276 | ROI Console v2 | merge after Codex | 20 files, apps/web only; no schema touch; clean scope | None |
| #272 | OIG three-way semantics | merge after Codex | 3 files, packages/source-adapters only; critical correctness fix for OIG/LEIE lane | None |
| #269 | Confidence Doctrine v2 | merge after Codex | File count unknown; doctrine update; verify no banned strings before merge | None |
| #267 | CRS licensure cap rim | merge after Codex | 7 files; packages/crs; depends on #266 being merged first | #266 |
| #266 | CRS licensure cap engine | merge after Codex | 3 files; packages/crs only; no schema touch | None |
| #250 | Demo passport seed | merge after Codex | 6 files; demo data; no schema touch | None |
| #249 | A11y homepage main landmark | merge after Codex | 2 files; accessibility fix; small scope | None |
| #248 | Verifier invitations | merge after Codex | 11 files; invitation lifecycle; verify `invitationSystemLive: false` preserved | None |
| #239 | Document upload foundation | merge after Codex | 6 files; upload foundation; no schema touch | None |
| #238 | Signup gate + magic-link recovery | merge after Codex | 6 files; auth flow; verify no banned strings | None |
| #237 | DB migration baseline docs | merge after Codex | 5 files; docs only; MERGEABLE (GitHub API) | None |
| #236 | PWA service worker | merge after Codex | 5 files; PWA installability; no schema touch | None |
| #233 | Stripe foundation collectsPayment:false | merge after Codex | 6 files; payment foundation; `collectsPayment: false` must be preserved | None |
| #231 | Identity vendor foundation docs | merge after Codex | 5 files; docs only | None |
| #225 | Banned-strings CI gate | merge after Codex | 1 file; CI gate; directly addresses known violations on main — high priority | None |
| #224 | Route map CI gate | merge after Codex | 4 files; CI gate | None |
| #223 | Release checklist CI gate | merge after Codex | 2 files; CI gate | None |
| #244 | Hero route smoke CI | merge after Codex | 3 files; CI only | None |
| #246 | Export bundle route | merge after Codex | 5 files; same branch as #245; merge together | #245 |
| #245 | CV upload | merge after Codex | 5 files; same branch as #246; merge together | None |
| #190 | Passport copy cleanup | merge after Codex | 2 files; copy fix; verify not superseded by more recent passport work | None |

---

## Group B: Rebase Needed

| PR# | Title (abbrev) | Classification | Reason | Depends On |
|---|---|---|---|---|
| #247 | Policy decision persistence + schema.prisma | rebase needed | CONFLICTING (GitHub API); touches Prisma schema → also **founder decision required** | None |
| #243 | Verifier RBAC middleware.ts | rebase needed | CONFLICTING (GitHub API); middleware.ts conflict likely with Clerk middleware changes | None |
| #240 | Cross-tenant PSV reuse block | rebase needed | CONFLICTING (GitHub API); PSV in-memory path may have shifted under PR-C/PR-F merges | None |
| #230 | /status compliance evidence | rebase needed | CONFLICTING (GitHub API); likely superseded by `5d530f13` — verify content before rebasing; may be close candidate | None |

---

## Group C: Founder Decision Required

| PR# | Title (abbrev) | Classification | Reason | Depends On |
|---|---|---|---|---|
| #247 | Policy decision persistence + schema.prisma | rebase needed + **founder decision required** | Modifies `schema.prisma`; any schema change requires founder sign-off before merge | None |
| #251 | DB migrate cutover runbook | **founder decision required** | 5 files including migration SQL; no code changes but sets migration path — founder must approve cutover timing | #247 |

---

## Group D: Superseded

| PR# | Title (abbrev) | Classification | Reason | Depends On |
|---|---|---|---|---|
| #212 | Board 100% sprint docs | superseded | Board docs replaced by BOARD-SCHEMA-3 revision | — |
| #206 | Security board delta docs | superseded | Security board content folded into completion board | — |
| #181 | Board truth reset docs | superseded | Board reset content superseded by current board | — |
| #41 | (pre-Jan wave) | superseded | MERGEABLE per GitHub API but pre-architecture; base may be correct — review before close | — |
| #46/#45 | Vercel CVE bot PRs (Next 15.2.8) | superseded | Next 15.2.8 already on main | — |

---

## Group E: Close

| PR# | Title (abbrev) | Classification | Reason | Depends On |
|---|---|---|---|---|
| #165/#164/#163 | Knowledge inbox triplicates | close | 89 files each including worktree metadata; three copies of same content; contaminated | — |
| #161 | LIVE-100 omnibus | close | 65 files including worktree metadata; contaminated | — |
| #159 | Apply VCV | close | 100+ files including `.claude/scheduled_tasks.lock`; contaminated | — |
| #158 | Trust warranty | close | 11 files including Hardhat contracts; blockchain/smart contract scope not in VitalCV stack | — |
| #156 | Acceptance graph labs | close | 7 files; labs/experimental; no clear merge target | — |
| #153 | Pilot intake | close | 30 files; stale pilot intake content | — |
| #134/#133 | Wave 13/14 omnibus | close | 100 files; workspace metadata contaminated | — |
| #132 | Wave 13 employer explainability | close | 5 files; stale pre-architecture wave content | — |
| #131 | Hybrid loader | close | 10 files; pre-architecture | — |
| #129/#128/#127/#126/#125/#124 | Pre-April omnibus | close | 100 files each; all pre-architecture | — |
| #42/#40 | Pre-January waves | close | Stale; wrong base | — |
| #39/#38/#37/#36/#35/#34/#33 | December 2025 Codex waves | close | 5+ months stale; pre-architecture; wrong base | — |

---

## Count by Classification

| Classification | Count |
|---|---|
| merge after Codex | 21 |
| rebase needed | 4 |
| founder decision required | 2 (overlap with rebase needed) |
| superseded | 5 |
| close | ~24 (counting triplicates and numbered omnibus PRs individually) |

**Total tracked:** ~56 PR entries (some PRs carry dual labels)

---

## Merge Priority Order (within "merge after Codex")

1. **#225** — Banned-strings CI gate (blocks ongoing copy violations from merging)
2. **#272** — OIG three-way semantics (correctness fix; unblocks OIG_LEIE_ENABLED path)
3. **#266 → #267** — CRS engine + rim (sequential dependency)
4. **#238** — Signup gate (Tier 2 blocker)
5. **#248** — Verifier invitations (Tier 2 blocker)
6. **#244** — Hero smoke CI (CI hardening)
7. **#249** — A11y landmark (quick win, 2 files)
8. Remaining in any order after CI gates are solid
