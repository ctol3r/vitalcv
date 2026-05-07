# Truth-Contract Restoration Audit · Wave 1 · 2026-05-07

Inventory of every truth-contract violation reachable from a user-routable surface in `apps/web`. Read-only sweep against `origin/main @ 27d5d6cf`. Each row carries the exact phrase, the file path, the risk classification, and the recommended wording.

**Method:** grep-sweep across `apps/web/{app,components,lib}` for the eleven CLAUDE.md banned strings, bare `>Verified<` / `>VERIFIED<` rendered labels, unsupported vendor names (NPDB / DEA / ABMS / SAM.gov / Doximity), "instantly" / "real-time" overclaim wording, and certification claims. Each hit was traced through the render graph to determine whether it reaches a user-routable surface.

**Key finding:** the Code Red truth-contract enforcement held on the new design surfaces (`/file`, `/roi`, `/inbox`, `/activation`, `/autopilot`, `/dossier`, `/contact`, `/pricing`, `/for/*`, `/status`) — sweep returned zero bare `>Verified<` hits. The violations that remain are concentrated on (a) two confirmed-routable surfaces from older PRs and (b) orphaned / archive-only components.

---

## A. Confirmed routable (in scope this PR)

| # | Phrase | File | Line | Why risky | Recommended wording | Severity | Category |
|---|---|---|---|---|---|---|---|
| A1 | `<dt>Verified</dt>` (bare term) | `apps/web/app/clinician/research/page.tsx` | 60 | Bare "Verified" definition-list term on the `/clinician/research` route. Sibling terms are `Candidates`, `Match pending review`, `User-entered` — `Verified` alone breaks the semantic-qualifier rule (CLAUDE.md §banned, doctrine §2.7). The `<dd>` already self-disclaims ("0 (none — verification is a separate wave)") but the term itself is still bare. | `Source-verified` (parallels `User-entered` semantically; preserves grid alignment) | P0 | misleading trust state |
| A2 | `<p>Verified</p>` (bare term) | `apps/web/components/wallet/WalletPassport.tsx` | 360 | Bare "Verified" heading above a `verifiedAt` timestamp. Rendered on `/holder` (confirmed via `apps/web/app/holder/page.tsx:167`). Heading names a status, not the timestamp it precedes. | `Source-confirmed at` (matches the data semantic — timestamp of source confirmation, not a status badge) | P0 | misleading trust state |

## B. Out-of-scope but tracked (NOT in this PR — reasons listed)

### B.1 Orphan or archive-only components

Verified by render-graph trace (`grep -rln 'from.*<Component>' apps/web/app`). These components contain banned wording but are **not reachable by a user** — they are imported only from `_archive/*` (Next.js underscore-private folders, not routed) or have zero consumers in `apps/web/app`.

| Phrase | File | Reason out of scope |
|---|---|---|
| `<div>VERIFIED</div>` | `apps/web/components/hero/SandboxHero.tsx:129` | Zero consumers in `apps/web/app` |
| `<span>Verified</span>` | `apps/web/components/clinician/SelectiveDisclosureModal.tsx:249` | Only consumer is `WalletDashboard` which itself has zero consumers |
| `Reduce hiring cycles ... instantly` | `apps/web/components/employer/EmployerDashboard.tsx:819` | Only consumer is `_archive/verifier/home/page.tsx` (private folder) |
| `instant credential transmission` | `apps/web/components/holder/DailyUtilityLoop.tsx:11` | Only consumer is `_archive/wave119/clinician/dashboard/page.tsx` (private folder) |
| `Scan to verify credentials instantly` | `apps/web/components/clinician/FocusModeQR.tsx:76` | Zero consumers |
| `Share verified credentials instantly` | `apps/web/components/employer/ApplyWidgetConfig.tsx:185` | Zero consumers |
| `unlock instant offers` (×2) | `apps/web/components/prequalify/PrequalifyModal.tsx:65, 245` | Zero consumers |
| `Validate instantly` | `apps/web/components/marketing/AcceptanceNetwork.tsx:43` | Zero consumers in `apps/web/app` |
| `See the product working in real time` | `apps/web/components/marketing/HomeSections.tsx:336` | Zero consumers in `apps/web/app` |
| `verified: [{label: 'CA Medical License' ... 'DEA Registration' ... 'Board Certification (ABEM)'}]` | `apps/web/components/marketing/ReadinessDemo.tsx:25-79` | Zero consumers in `apps/web/app` |
| `EmployerReviewDashboard` SAM.gov / DEA / ABMS claims | `apps/web/components/sandbox/EmployerReviewDashboard.tsx:108-181` | Consumer is `SandboxApp` which has zero consumers in `apps/web/app` |

**Recommended follow-up PR:** `chore: delete unused legacy components OR archive trees` — separate scope, separate PR. This wave's discipline is to fix the user-reachable surfaces only. Deleting unused code is a different concern.

### B.2 `_archive/wave119/` trees

`apps/web/app/_archive/wave119/about/page.tsx:48` ("real time" claims), `_archive/wave119/compare/vitalcv-vs-manual-credentialing/page.tsx:20` ("Instant credentialing verification"), and ~95 other archive pages contain banned wording. **Per Next.js App Router convention, folders prefixed with `_` are private folders and are not routable.** No user reaches these surfaces.

**Recommended follow-up PR:** `chore: delete _archive/wave119` — explicitly out of scope per `openclaw-pr-scope-rules.md` §1 (one concern per PR) and §2 (max 5 files for copy/docs).

### B.3 Catalog drift (W1.3 — separate audit wave)

| Phrase | File | Notes |
|---|---|---|
| `{ key: 'dea', label: 'DEA', description: 'If prescribing controlled substances.' }` | `apps/web/lib/catalog/credentialCatalog.ts:26, 38, 50` | DEA listed as in-scope catalog item; per CLAUDE.md DEA is not integrated. **Audit P1 finding W1.3 — its own surgical PR.** |
| `OIG exclusions screening. NPDB requires separate institutional access.` | `apps/web/lib/catalog/credentialCatalog.ts:29` | NPDB referenced; per CLAUDE.md NPDB is not integrated. **Same W1.3 scope.** |

### B.4 Anti-overclaim copy (correctly written, leave alone)

The following hits are explicitly anti-overclaim disclaimers and **must not be modified** — they are doing the right thing:

| File | Phrase | Why kept |
|---|---|---|
| `apps/web/lib/source-health/unavailableLane.ts:26-27, 35-36` | `'real-time'`, `'real time'`, `'hipaa compliant'`, `'soc2 certified'` | Banned-string detection list — these are the patterns the file scans against |
| `apps/web/lib/trust/trust-container-view.ts:56-57` | `/legally accepted/gi`, `/risk transferred/gi` | CI gate regex patterns |
| `apps/web/lib/source-health/README.md:37, 44, 45` | `real-time`, `hipaa compliant`, `soc2 certified` | Documentation describing the ban |
| `apps/web/app/onboarding/page.tsx:12, 34` | `does not complete credentialing` | Anti-overclaim user-facing disclaimer |
| `apps/web/lib/commercial/{onboardingFoundation,selfServeSignupFoundation}.ts` | `does not complete credentialing` | Same — anti-overclaim |
| `apps/web/app/pilot/page.tsx:50` | `not the real-time enrollment portal` | Pilot page "limitation honesty" — gold standard per audit |
| `apps/web/components/hero/LiveTrustConsole.tsx:338, 342` | `Not a real-time OIG feed`, `Not the real-time PECOS portal` | Anti-overclaim disclaimer |
| `apps/web/components/proof/trust-types.ts:81` | `source: 'ABMS / Specialty Board'` | Type-level value; consumer `SuperbrainInsights.tsx:85` correctly says `not connected (ABMS access required)`. The label-string itself in the type-table is acceptable when paired with the anti-overclaim consumer. |
| `apps/web/lib/roi/roiData.ts:13` | `no banned overclaim copy is used (no "automatically verified", ...)` | JSDoc listing what the module does NOT do |

---

## Categories used (per task brief)

| Category | A1 | A2 |
|---|---|---|
| fake certainty | | |
| unsupported integration | | |
| unsupported compliance | | |
| **misleading trust state** | ✅ | ✅ |
| demo ambiguity | | |
| unsupported production implication | | |
| misleading readiness | | |
| semantic inconsistency | (partial — bare term breaks the parallel with `User-entered`) | |

---

## Severity scale

- **P0** — phrase is rendered to a confirmed-routable user surface and violates a literal CLAUDE.md ban or the doctrine's §2.7 "no bare Verified" rule. **Fix this PR.**
- **P1** — phrase exists in a routable surface but is contextualized by anti-overclaim copy nearby (e.g., catalog drift). **Fix in a follow-up scoped PR (W1.3).**
- **P2** — phrase exists only in orphan / archive components. **Fix via deletion in a separate `chore:` PR.**

---

## Scope lock for the implementation phase

**Files to change:**
- `apps/web/app/clinician/research/page.tsx` (one word, one line)
- `apps/web/components/wallet/WalletPassport.tsx` (one phrase, one line)
- `apps/web/__tests__/truth-contract-verified-labels.test.ts` (new test file)

**Files NOT to change (adjacent but out of scope):**
- `apps/web/lib/catalog/credentialCatalog.ts` — W1.3 scope
- `apps/web/components/{marketing,hero,sandbox}/*` — orphaned, separate PR
- `apps/web/app/_archive/**` — private-folder, separate PR
- `apps/web/lib/source-health/{unavailableLane.ts,README.md}` — anti-overclaim, must not modify
- `apps/web/lib/trust/trust-container-view.ts` — CI gate regex, must not modify
- All schema, migration, auth, RBAC, audit, persistence files

**Domain:** copy/UX (single domain).

**Test requirements:** new vitest file asserting the two fixed surfaces no longer contain bare `>Verified<` rendered text, and a regression-guard sweep across `apps/web/{app/clinician,components/wallet}` that the eleven CLAUDE.md banned strings remain absent in product code.

**Codex audit focus:** copy/truth audit must verify the new wording preserves UX clarity, does not weaken existing anti-overclaim disclaimers, and does not inadvertently reintroduce a banned-string variant.

**Blast radius if wrong:** visible wording change on `/clinician/research` and `/holder`. Revert is `gh pr revert <pr-number>`.
