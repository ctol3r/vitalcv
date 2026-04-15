# VitalCV Release Gate Report — 2026-04-01

**Auditor:** Claude Cowork (Hyperdetailed QA / Release Gatekeeper)
**Scope:** Mega-Wave Steps 1.2–3 (Baseline Recon, Wave 16: Source Health, Wave 17: Buyer Surface)
**North Star:** Time to Start (TTS)
**Branch under review:** `main` (production)

---

## RECON & BASELINE — CONDITIONAL PASS

### Verdict: `CONDITIONAL PASS`

OpenClaw's baseline recon correctly identified the core wedge files and produced a structurally accurate status map across the repo. The repo structure, route inventory, and source integration files are all accounted for.

### Findings

**Correctly identified:**
- All 4 launch-spine source integrations (NPPES, OIG/LEIE, PECOS, STATE_BOARD) and their adapters, services, and routes
- The employer/review/passport route surfaces and their API endpoints
- The pilot-ops internal tooling (`/internal/pilot-ops`, SourceHealthPanel, diagnostics)
- Wave 180 (Identity/Workspace Graph) and Wave Wallet as designed-but-unmerged

**Scope creep flagged in existing marketing copy (not in OpenClaw's map):**
- "Free Specialty Job Board", "MATCHA — AI Career Matching", "Clinic Capacity Intelligence" appear in platform sections — none exist in the codebase
- Full SDK ecosystem (`@vitalcv/verifier-sdk`, `@vitalcv/issuer-sdk`, `@vitalcv/wallet-sdk`) documented as if feature-complete — only `wallet-sdk` is specified for Wave Wallet
- Drop-in widget at `cdn.vitalcv.com` referenced — URL does not resolve
- 3-tier partner program with "30% reseller margins" and "deal registration portal" — zero BD infrastructure exists

**Missing from OpenClaw's recon:**
- No audit of the `/partners` and `/investors` pages, which contain hardcoded `DEMO_METRICS` (12,847 credentials, 284 verifiers) without "illustrative" labels — this is a **P0 investor-facing credibility risk**
- The `/demo` route target from HeroSection.tsx was not traced to confirm it resolves

---

## WAVE 16 (SOURCE HEALTH) — CONDITIONAL GO

### Verdict: `CONDITIONAL GO`

The source health infrastructure is architecturally sound. The canonical state machine, operator statuses, freshness SLA tracking, and degraded-state handling are all properly implemented. An operator running a silent pilot can determine whether an upstream source is broken, stale, or gated.

### What passes

**Canonical state coverage (9/9):** `checked`, `stale`, `pending`, `gated`, `unavailable`, `accessRequired`, `reviewRequired`, `notDecisionGrade`, `previewOnly` — all defined in `packages/trust-state/sourceCoverage.ts` with strict resolution order and normalization aliases.

**4 launch-spine sources explicitly tracked:**
- `NPPES_API` — identity anchor
- `OIG_LEIE` — exclusion/sanctions
- `PECOS_PUBLIC` — Medicare enrollment
- `STATE_BOARD` — licensure

All four are in `LAUNCH_SPINE_SOURCE_IDS` and are individually monitored with per-source freshness SLAs.

**Operator spine status (4 levels):** `HEALTHY` → `DEGRADED` (≥3 consecutive failures) → `STALE` (missed freshness SLA) → `CRITICAL` (source unavailable). Escalation logic in `sourceOpsService.ts` is deterministic with no ambiguous intermediate states.

**Graceful degradation path:**
- Backend timeout → `/api/internal/source-health` returns `{ error: "Backend unreachable." }` with HTTP 502
- Upstream non-OK → proxied error message or `"Source health unavailable."`
- UI fallback → SourceHealthPanel renders rose-colored error card with "Source health unavailable" text
- No raw 500 error strings leak to the operator

**Freshness tracking:** `lastSuccessAt`, `lastFailureAt`, `consecutiveFailures`, and `freshnessWindowHours` are all tracked per source. The `isSourceHealthFresh()` function computes freshness correctly with age-in-hours calculation.

**Alert system:** Four alert types generated in `sourceOpsService.ts`:
- `STALE:` Decision-grade source missed freshness SLA
- `FAILURE:` Source has ≥3 consecutive failures
- `MISMATCH:` Spine source has feature flag disabled
- `UNIMPLEMENTED:` Flag-enabled but no ingestion handler

### Required fixes before full GO

| # | Severity | Issue | Location | Fix |
|---|----------|-------|----------|-----|
| W16-1 | P1 | **No operator remediation hints.** When a source goes `DEGRADED` or `CRITICAL`, the panel shows the state label and failure count but never tells the operator *what to do*. Example: "Check connector logs", "Verify API credentials", "Contact upstream provider". | `SourceHealthPanel.tsx`, `PilotDiagnosticsPanel.tsx` | Add a `remediation: string` field to `SourceHealthEntry` and render it below the state badge when `operatorStatus !== 'HEALTHY'`. |
| W16-2 | P2 | **Timestamp display is relative-only.** The panel shows "3h ago" but never the absolute ISO timestamp. During an incident, operators need exact times for correlation with external logs. | `SourceHealthPanel.tsx` line 46–58 | Add `title={isoDate}` attribute to the relative-time `<span>` so hover reveals the absolute timestamp (as `SourceCoverageTag.tsx` already does). |
| W16-3 | P2 | **"Access required" and "Gated" states have no operator alert.** The alert system generates warnings for `STALE`, `FAILURE`, `MISMATCH`, and `UNIMPLEMENTED` but NOT for sources stuck in `accessRequired` or `gated`. A spine source that requires institutional credentials and has never been checked should surface an operator alert. | `sourceOpsService.ts` | Add a `GATED` alert: `"GATED: Spine source ${name} requires institutional access and has never produced a decision-grade result."` |
| W16-4 | P3 | **PilotDiagnosticsPanel does not poll.** It fetches once on mount but never refreshes. During an active pilot, the diagnostics panel will show stale information unless the operator manually reloads the page. | `PilotDiagnosticsPanel.tsx` | Add the same `POLL_INTERVAL_MS` pattern used in `SourceHealthPanel.tsx`. |

### Mapping to the 5 canonical states

| Required State | Implementation | Render Location | Status |
|----------------|----------------|-----------------|--------|
| "Last checked [timestamp]" | `lastSuccessAt` → `formatAge()` → "Xh ago" | SourceHealthPanel, SourceOpsPanel | ⚠️ Relative only — needs absolute on hover |
| "Pending" | `coverageState === 'pending'` | Badge: gray zinc | ✅ |
| "Stale" | `coverageState === 'stale'` | Badge: amber | ✅ |
| "Access required" | `coverageState === 'accessRequired'` | Badge: sky blue | ✅ |
| "Degraded / Unavailable" | `coverageState === 'unavailable'` → spine `CRITICAL`; `operatorStatus === 'DEGRADED'` for failures | Badge: rose (unavailable), amber (degraded) | ✅ |

---

## WAVE 17 (BUYER SURFACE) — NO-GO

### Verdict: `NO-GO`

The buyer surface has the right structural bones — the `/employers` directory, `/review` entry point, and `RequestReviewPanel` conversion flow all exist and function. But the marketing copy contains **overclaim violations** that directly conflict with the TTS-only discipline, and the homepage hero speaks to a trust infrastructure pitch rather than a buyer's operational pain.

### What passes

**Conversion path clarity:** The buyer has two clean entry points:
1. `/review` → "Request a passport review" → `/review/request` → NPI input → review context created → shareable link generated → open review surface. This is a **well-designed, single-action funnel**.
2. `/employers/[slug]` → "Employer review" → `/review`. Clear secondary path from directory.

**TTS language present in the right places:**
- `/employers/[slug]` stat card: **"Time to start"** with `employer.timeToStart` value ✅
- `/review` landing: **"Review a source-backed readiness snapshot before making a hiring decision."** ✅
- HeroSection.tsx: **"audit-ready credential artifacts that cut onboarding from months to days"** ✅
- HomeSections.tsx Step 2: **"Source-backed readiness snapshot"** ✅

**RequestReviewPanel** is operationally clean: NPI input → context creation → shareable link → audit trail recording. No overclaim. No distracting secondary flows.

### Overclaim violations requiring removal

These are **NO-GO blockers**. Each must be fixed before this wave can merge.

| # | Severity | Verbatim String | File | Line | Violation | Required Change |
|---|----------|----------------|------|------|-----------|-----------------|
| W17-1 | **P0** | `"VitalCV is the cryptographic trust infrastructure for healthcare. We automate primary source verification, anchor it to a zero-trust ledger, and continuously monitor compliance — so you can hire instantly."` | `Hero.tsx` | 133–136 | **"anchor it to a zero-trust ledger"** — implies distributed/immutable ledger. No blockchain or ledger system is integrated in production. **"hire instantly"** — overclaims speed; actual TTS is days, not instant. | Replace with: `"VitalCV automates primary source verification and generates audit-ready credential packets — so you can start clinicians in days, not months."` |
| W17-2 | **P0** | `"Zero-Trust Credentialing Infrastructure"` | `Hero.tsx` | 122 | Eyebrow pill positions VitalCV as infrastructure for infrastructure buyers, not credentialing ops buyers. Dilutes the TTS wedge message. | Replace with: `"Source-Backed Credentialing"` or `"Faster Credentialing Starts"` |
| W17-3 | **P1** | `"Clinician identity graph: NPI → readiness → portable trust packet"` | `HomeSections.tsx` | 307 | **"graph"** — implies graph database/knowledge graph technology. This is a data flow description, not a graph product. Buyer will not understand this term; YC reviewer will question it. | Replace with: `"Clinician identity chain: NPI → readiness → portable credential packet"` |
| W17-4 | **P1** | `"HIPAA-compliant audit ledger with continuous license monitoring"` | `HomeSections.tsx` | 309 | **"ledger"** — same overclaim as W17-1. The codebase uses audit log tables, not a ledger. Also, hero badge says **"HIPAA"** while compliance badges say **"HIPAA-aligned"** — inconsistent and the former implies certification that doesn't exist. | Replace with: `"HIPAA-aligned audit trail with continuous license monitoring"` |
| W17-5 | **P1** | `"Querying CA-BRN primary source…"` and `"Querying Nursys (state board network)…"` | `Hero.tsx` | 16, 20 | Terminal simulation shows state board queries succeeding. The code comment on line 11 says *"Gated: Nursys (institutional access)"* — meaning this source is NOT live without institutional credentials. Showing a green checkmark for a gated source is **false representation**. | Either (a) change terminal line to show `⚠ Nursys — institutional access required` with amber styling, or (b) remove Nursys lines entirely and show only NPPES + OIG/LEIE (which are confirmed live). |
| W17-6 | **P2** | `['SOC 2', 'HIPAA', 'NCQA', 'ES256']` trust badges | `Hero.tsx` | 159 | **SOC 2** badge implies completed SOC 2 audit. **NCQA** badge implies NCQA certification. Neither has occurred. ES256 is a signing algorithm, not a trust certification — confusing to buyers. | Remove SOC 2 and NCQA badges. Replace with `"HIPAA-aligned"` and `"W3C VC"` or remove entirely until certifications are real. |
| W17-7 | **P2** | `"Request a Demo"` → `/verifier` | `Hero.tsx` | 142 | Primary buyer CTA links to `/verifier` which is an internal verifier portal, not a demo request form or Calendly link. A credentialing director clicking "Request a Demo" expects to schedule a call, not land in a technical portal. | Route to a proper demo request form (e.g., RequestPilotForm or Calendly) or rename CTA to match destination. |

### Additional buyer surface issues (non-blocking but should be tracked)

| # | Issue | Detail |
|---|-------|--------|
| W17-8 | `/employers` directory has no buyer value proposition | Page is a directory listing with operational copy ("This page stays scoped to the current employer directory…"). A credentialing director arriving here sees no reason to stay. Needs a headline about TTS reduction. |
| W17-9 | Homepage speaks to clinicians in the "How It Works" section | Steps 1-3 ("Enter your NPI", "Source-backed readiness snapshot", "Portable across employers") are clinician-facing. Buyer needs a parallel "How It Works for Employers" section. |
| W17-10 | `/review/request` is auth-gated | Unauthenticated employers see "Sign in to request a review" — cannot demo the review flow without an account. This blocks live demo walkthroughs. |

---

## OVERALL VERDICT

### `BLOCKED PENDING FIXES`

The source health layer (Wave 16) is architecturally ready and needs only P1/P2 polish. The buyer surface (Wave 17) has **7 copy violations** (2x P0, 3x P1, 2x P2) that must be resolved before any buyer-facing deployment or investor demo.

### Fix priority order

1. **W17-1 + W17-2** (P0): Hero.tsx copy rewrite — remove "ledger", "infrastructure", "hire instantly"
2. **W17-5** (P1): Hero.tsx terminal — stop showing green checkmarks for gated sources
3. **W17-3 + W17-4** (P1): HomeSections.tsx — remove "graph" and "ledger" from build signals
4. **W17-6** (P2): Hero.tsx — remove SOC 2 / NCQA badges until certifications exist
5. **W17-7** (P2): Hero.tsx — fix "Request a Demo" CTA destination
6. **W16-1** (P1): Add operator remediation hints to SourceHealthPanel
7. **W16-3** (P2): Add GATED alert to sourceOpsService alert system

### Estimated effort

- P0 copy fixes (W17-1, W17-2): **S** — string replacements in 1 file
- P1 terminal fix (W17-5): **S** — modify TERMINAL_LINES array
- P1 copy fixes (W17-3, W17-4): **S** — string replacements in 1 file
- P2 badge/CTA fixes (W17-6, W17-7): **S** — badge array edit + href change
- P1 operator hints (W16-1): **M** — requires backend field addition + frontend render
- P2 gated alert (W16-3): **S** — add conditional in alert generation loop

**Total blocking work: ~2 hours of string-level changes.**
The architecture is sound. The execution gap is entirely in messaging discipline.

---

*Report generated 2026-04-01 by Claude Cowork acting as Release Gatekeeper.*
*All findings verified by direct file reads against `main` branch.*
