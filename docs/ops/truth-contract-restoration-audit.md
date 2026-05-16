# Truth-Contract Restoration Audit
**Wave:** Wave 1 — Truth-Contract Restoration  
**Date:** 2026-05-07  
**Baseline:** `origin/main` @ `bf654a94`  
**Authority:** CLAUDE.md, openclaw-governance-hardening.md  
**Scope:** apps/web/app, apps/web/components, apps/web/lib  
**Method:** `grep -rn` across all non-archived non-test .tsx/.ts files  

---

## Preflight Classification

Wave 1 is **GUARDED**:
- No schema changes
- No auth changes
- No RBAC changes
- Only copy and structural demo markers
- Maximum 10 files

---

## Violation Inventory

### Category 1 — Unsupported Vendor Claims

Unsupported vendors appear in public-facing UI as if they are integrated sources. These are the highest-severity violations because they imply capability that does not exist.

| ID | File | Line | Violation | Category | Severity |
|---|---|---|---|---|---|
| V-01 | `apps/web/app/HomePageClient.tsx` | 76 | T3 tier example lists `NPDB` — NPDB is not integrated | unsupported_claim | BLOCKING |
| V-02 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 108 | `SAM.gov check in progress.` rendered as status in a non-structurally-labeled demo | unsupported_claim | BLOCKING |
| V-03 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 110 | `ABMS certification verified.` — ABMS not integrated; "verified" is overclaim | unsupported_claim + fake_certainty | BLOCKING |
| V-04 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 129 | `SAM.gov clear. No active exclusions.` — SAM.gov not integrated | unsupported_claim | BLOCKING |
| V-05 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 131 | `ABMS certification verified.` — repeated | unsupported_claim + fake_certainty | BLOCKING |
| V-06 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 132 | `DEA registration active.` — DEA not integrated | unsupported_claim | BLOCKING |
| V-07 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 150 | `SAM.gov clear.` — repeated | unsupported_claim | BLOCKING |
| V-08 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 152 | `ABMS certification verified.` — repeated | unsupported_claim | BLOCKING |
| V-09 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 165 | `NPDB` in source name filter | unsupported_claim | HIGH |
| V-10 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 172,176 | `NPDB` in filter logic | unsupported_claim | HIGH |
| V-11 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 182 | `NPDB: No adverse actions reported.` — NPDB not integrated | unsupported_claim | BLOCKING |
| V-12 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 281,282 | `SAM.gov check in progress...` and `NPDB query submitted...` in seed data | unsupported_claim | BLOCKING |
| V-13 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | 284 | `ABMS certification verified.` — seed data | unsupported_claim | BLOCKING |

---

### Category 2 — Fake Source Freshness

PECOS is presented as a "Live" source with daily updates. PECOS is a quarterly snapshot — not daily, not live.

| ID | File | Line | Violation | Category | Severity |
|---|---|---|---|---|---|
| V-14 | `apps/web/app/HomePageClient.tsx` | 51 | `chip: 'Live', freshness: 'Updated daily'` for PECOS — PECOS is a quarterly snapshot | misleading_readiness | CRITICAL |

---

### Category 3 — Unsupported Compliance Claims

"Conforms to NCQA CR §3" implies formal certification compliance. VitalCV is architecturally aligned but not NCQA-certified.

| ID | File | Line | Violation | Category | Severity |
|---|---|---|---|---|---|
| V-15 | `apps/web/app/HomePageClient.tsx` | 371 | `Conforms to NCQA CR §3, W3C VC 2.0, OpenID4VCI` — "Conforms to" implies formal certification | unsupported_compliance | CRITICAL |
| V-16 | `apps/web/app/HomePageClient.tsx` | 418 | Footer: `Delegated credential verification infrastructure · NCQA CR §3 · §4.2` — implies compliance | unsupported_compliance | CRITICAL |

---

### Category 4 — "Instantly" / Guaranteed Implication Language

"Instantly" implies zero-latency, no-friction verification. VitalCV checks take time and are not instant.

| ID | File | Line | Violation | Category | Severity |
|---|---|---|---|---|---|
| V-17 | `apps/web/components/marketing/AcceptanceNetwork.tsx` | 43 | `Validate instantly` | misleading_readiness | HIGH |
| V-18 | `apps/web/components/employer/ApplyWidgetConfig.tsx` | 185 | `Share verified credentials instantly. No paperwork required.` | misleading_readiness + fake_certainty | HIGH |
| V-19 | `apps/web/components/clinician/FocusModeQR.tsx` | 76 | `Scan to verify credentials instantly` | misleading_readiness | HIGH |
| V-20 | `apps/web/components/employer/EmployerDashboard.tsx` | 819 | `making confident decisions on...NPPES signals instantly` (fragment) | misleading_readiness | MEDIUM |

---

### Category 5 — Gated Source Presented as Live

Nursys requires institutional access (`REAL_NURSYS_ENABLED=true`). It must not appear as a confirmed, live, or in-progress check.

| ID | File | Line | Violation | Category | Severity |
|---|---|---|---|---|---|
| V-21 | `apps/web/components/marketing/LedgerTicker.tsx` | 19 | `Nursys: License Standing Confirmed` — implies a real Nursys check ran and confirmed | misleading_readiness | BLOCKING |
| V-22 | `apps/web/components/marketing/BentoGrid.tsx` | 123 | `const sources = ['NPPES', 'CA-BRN', 'OIG/LEIE', 'Nursys']` — Nursys listed alongside live sources without gating indicator | misleading_readiness | HIGH |

---

### Category 6 — Demo Surfaces Without Structural Demo Markers

EmployerReviewDashboard renders simulated CHECKED results (SAM.gov clear, ABMS verified, DEA active) without a structural marker that the surface is simulation-only. A viewer cannot distinguish this from a real verification.

| ID | File | Violation | Category | Severity |
|---|---|---|---|---|
| V-23 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | No structural `_demo` flag, no visible simulation banner; renders as-if real | demo_ambiguity | BLOCKING |

---

## Clean (Confirmed Not Violations)

These appeared in the scan but are acceptable:

| File | Why it's OK |
|---|---|
| `apps/web/components/review/EmployerCockpit.tsx:238–246` | Lists NPDB, SAM.gov, ABMS in a **"Not included in this review"** section — this is honest disclosure, not an overclaim |
| `apps/web/components/simulation/TrustEngineTerminal.tsx` | Internal comments explicitly warn that NPDB is not integrated; Nursys shown as gated |
| `apps/web/components/marketing/LedgerTicker.tsx:9` | Comment disavows NPDB/DEA/SAM.gov |
| `apps/web/components/marketing/BentoGrid.tsx:13` | Comment explicitly says NOT integrated |
| `apps/web/app/clinician/import/professional/page.tsx` | Explicitly states "planned entry points, not live integrations" |
| `apps/web/components/clinician/WalletDashboard.tsx` | `NCQA-Aligned` in methodologyVersion string — internal technical version label, not a public certification claim |
| `apps/web/components/proof/trust-types.ts` | ABMS in source definition is internal catalog metadata, not public copy |

---

## Wave 1 Scope Decision

**In scope (fix now):** V-01 through V-23  
**Files to change:** 7 product files + 1–2 test files  
**Not in scope (defer):** EmployerDashboard V-20 (fragment — low visibility, medium severity), WalletDashboard NCQA-Aligned (internal version string)

### Files targeted in Wave 1:

| # | File | Violations fixed |
|---|---|---|
| 1 | `apps/web/app/HomePageClient.tsx` | V-01, V-14, V-15, V-16 |
| 2 | `apps/web/components/sandbox/EmployerReviewDashboard.tsx` | V-02 through V-13, V-23 |
| 3 | `apps/web/components/marketing/AcceptanceNetwork.tsx` | V-17 |
| 4 | `apps/web/components/employer/ApplyWidgetConfig.tsx` | V-18 |
| 5 | `apps/web/components/clinician/FocusModeQR.tsx` | V-19 |
| 6 | `apps/web/components/marketing/LedgerTicker.tsx` | V-21 |
| 7 | `apps/web/components/marketing/BentoGrid.tsx` | V-22 |
| 8 | `apps/web/__tests__/truth-contract-wave1.test.ts` | New — truth verification tests |

---

## Exact Wording Changes

### HomePageClient.tsx

**V-01:** T3 tier example  
`NPPES · OIG/LEIE · PECOS · NPDB.` → `NPPES · OIG/LEIE · PECOS.`

**V-14:** PECOS freshness  
`{ code: 'PECOS', ... chip: 'Live', freshness: 'Updated daily' }` → `chip: 'Gated', freshness: 'Quarterly snapshot'`  
(PECOS is not a real-time API — it's a quarterly CMS data release)

**V-15:** Conforms to claim  
`Conforms to NCQA CR §3, W3C VC 2.0, OpenID4VCI` →  
`Architecturally aligned with W3C VC 2.0 and OpenID4VCI`  
(NCQA CR §3 removed — we do not hold NCQA certification)

**V-16:** Footer  
`Delegated credential verification infrastructure · NCQA CR §3 · §4.2` →  
`Delegated credential verification infrastructure · W3C VC 2.0 · OpenID4VCI`

### EmployerReviewDashboard.tsx

**V-02 through V-13, V-23:**  
Replace all SAM.gov, NPDB, ABMS, DEA with honest alternatives:
- `SAM.gov check in progress.` → `Federal exclusion check (access required — not yet integrated)`
- `ABMS certification verified.` → `Board certification (not yet integrated — direct PSV required)`  
- `DEA registration active.` → `DEA registration (not yet integrated — direct verification required)`
- `NPDB query submitted...` → Remove from seed data or replace with: `Adverse actions (not yet integrated)`
- Add structural `SIMULATION_MODE = true` constant at top and render a banner: `⚠ Simulation data — not real verification results`

### AcceptanceNetwork.tsx

**V-17:**  
`Validate instantly` → `Validate on demand`

### ApplyWidgetConfig.tsx

**V-18:**  
`Share verified credentials instantly. No paperwork required.` →  
`Share source-backed credential packets. Structured, auditable, no paper forms.`

### FocusModeQR.tsx

**V-19:**  
`Scan to verify credentials instantly` → `Scan to review credential evidence`

### LedgerTicker.tsx

**V-21:**  
`{ hash: 'evt:e573…01', event: 'Nursys: License Standing Confirmed', accent: ... }` →  
`{ hash: 'evt:e573…01', event: 'State Board: Access gated (institutional credential required)', accent: ... }`  
(Nursys cannot show as "Confirmed" — it requires REAL_NURSYS_ENABLED=true)

### BentoGrid.tsx

**V-22:**  
`const sources = ['NPPES', 'CA-BRN', 'OIG/LEIE', 'Nursys']` →  
`const sources = ['NPPES', 'OIG/LEIE', 'State Board (gated)']`  
(CA-BRN is not a canonical source name; Nursys needs gated label)

---

## Intentionally Deferred

| ID | File | Reason |
|---|---|---|
| V-20 | `EmployerDashboard.tsx:819` | "instantly" is in a fragment of a longer sentence; medium severity; fix in Wave 2 |
| — | `WalletDashboard.tsx` NCQA-Aligned | Internal methodologyVersion string, not a public certification claim |
| — | `HeroAppPreview.tsx` bare `status: 'Verified'` | Isolated demo component — visible in marketing context; investigate if structurally labeled in parent; defer to Wave 2 |

---

## Risk Classification for Wave 1

**Overall classification: GUARDED**  
No auth changes. No schema changes. No CRS changes. No source adapter changes.  
Maximum 8 files. All changes are copy or structural demo marker.  
Standard Codex three-audit required.
