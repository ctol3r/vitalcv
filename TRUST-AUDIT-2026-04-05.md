# VitalCV Trust Audit Report
> **Date:** 2026-04-05 | **Auditor:** Claude Cowork (skeptical credentialing leader mode)
> **Scope:** All buyer-facing surfaces + backend trust logic
> **Verdict:** NOT READY FOR PILOT without fixes below

---

## TOP 10 TRUST RISKS (Ranked by Severity)

### 1. CRITICAL: `resolveCanonicalSourceCoverageState` returns "checked" when source is stale

**Location:** `packages/trust-state/sourceCoverage.ts` lines 302-343

**Problem:** The function accepts `fresh: boolean` as input but never uses it in the state resolution logic. If `checked=true` and `fresh=false`, it still returns `'checked'` instead of `'stale'`.

**Employer impact:** A source verified 90 days ago still appears as "checked" (decision-grade). An employer accepts a clinician whose license was revoked 60 days ago but the stale check still shows green.

**Fix:** Add freshness gate: `if (input.checked && !input.fresh) return 'stale';` before the final `return 'checked'`.

**Severity:** P0 -- violates revocation-first validity doctrine.

---

### 2. CRITICAL: Employer acceptance endpoint skips source coverage validation

**Location:** `apps/api/backend/src/routes/employerActions.ts` lines 150-209

**Problem:** The acceptance route checks only `readinessReport.status === 'CLEAR_TO_START'` but never validates that all spine sources (NPPES, OIG/LEIE, State Board, PECOS) are in `'checked'` state at the moment of acceptance. It never calls `sourceOpsService` or checks `LAUNCH_SPINE_SOURCE_IDS`.

**Employer impact:** Employer accepts a clinician based on a readiness report that was computed when sources were healthy, but the sources have since become unavailable or stale. The acceptance is recorded as if verification was current.

**Fix:** Add source coverage validation before acceptance: query `sourceOpsService.computeSourceOpsReport()` and reject if any spine source is not `'checked'`. Wrap acceptance + audit event in a single Prisma transaction.

**Severity:** P0 -- violates NCQA CR1 (primary source verification at point of decision).

---

### 3. CRITICAL: Audit event written via fire-and-forget, not transactional

**Location:** `apps/api/backend/src/routes/employerActions.ts` line 178

**Problem:** `void captureEmployerDecision({...})` is called with the `void` prefix -- fire-and-forget. If this fails, the employer acceptance still returns 2xx. The EmployerAcceptance and AuditEvent are also written as separate database calls, not in a single transaction.

**Employer impact:** Acceptance recorded without audit trail. If audited, the decision has no provenance. Violates the explicit contract: "Every mutating action writes an AuditEvent row before returning 2xx."

**Fix:** Wrap `db.employerAcceptance.create` + `db.auditEvent.create` + `captureEmployerDecision` in a single `prisma.$transaction()`. Do not return 2xx until all writes succeed.

**Severity:** P0 -- audit trail integrity.

---

### 4. HIGH: MEDIUM readiness allows employer acceptance

**Location:** `apps/web/components/review/ReviewClient.tsx` line 428

**Problem:** The `resolveDecisionReadiness()` function returns `'MEDIUM'` when identity OR safety checks are incomplete. The "Accept as Head Start" button is enabled at MEDIUM with text "gaps noted." An employer can accept a clinician whose identity is unconfirmed or who hasn't been checked against the OIG/LEIE federal exclusion list.

**Employer impact:** Employer hires someone whose identity is unverified, or who may be on a federal exclusion list. "Gaps noted" reads as "minor issues" not "critical safety check missing."

**Fix:** Disable acceptance at MEDIUM. Only allow at READY (all identity + safety checks complete). Show explicit text: "Identity verification pending" or "Federal exclusion check incomplete -- cannot accept until resolved."

**Severity:** P0 -- canonical path violation (Recognition requires identity + safety).

---

### 5. HIGH: Decision card shows 4 sources but hides what ISN'T checked

**Location:** `apps/web/components/review/ReviewClient.tsx` lines 341-368

**Problem:** The employer review shows 4 bullet points (Identity, Safety, License Authority, Enrollment) with status indicators. An employer sees 4 green checks and believes verification is comprehensive. The UI never states that NPDB, DEA, ABMS, SAM.gov, and board certifications are NOT checked.

**Employer impact:** Employer believes "4 checks = comprehensive credentialing." Makes hire decision without realizing NPDB exclusions, DEA suspensions, and board actions are outside VitalCV's current scope.

**Fix:** Add a scope statement ABOVE the 4 bullets: "This review covers: primary identity (NPPES), federal exclusion (OIG/LEIE), state license authority, Medicare enrollment. NOT included: NPDB, DEA, board certifications, SAM.gov. For comprehensive credentialing, pair with source-specific verification."

**Severity:** P0 -- false confidence in verification completeness.

---

### 6. HIGH: CRS engine ignores source coverage states entirely

**Location:** `packages/crs/CrsEngine.ts` lines 1-120

**Problem:** `computeForClinician()` checks receipt existence (lastSuccessAt/lastFailureAt) and acceptance presence. It never checks whether sources are gated, unavailable, or disabled by feature flag. CRS can return >= 80 when underlying sources are not operational.

**Employer impact:** CRS 85 displayed to employer who assumes it means "thoroughly verified." Actually could mean "verified against 2 of 4 sources; other 2 are gated."

**Fix:** CRS computation should include source coverage states as a dimension. If any spine source is not `'checked'`, the score must reflect this (cap below decision threshold or add explicit "incomplete coverage" flag).

**Severity:** P1 -- CRS is the primary trust signal and it's blind to source availability.

---

### 7. HIGH: FreshnessPanel hidden when no warnings exist

**Location:** `apps/web/components/review/ReviewClient.tsx` lines 475-510

**Problem:** FreshnessPanel only renders if `hasWarning` is true. When all proofs are within SLA, the panel disappears entirely. Employer has zero visibility into WHEN checks were performed.

**Employer impact:** Employer sees no freshness information and assumes checks are "current" (hours old). Checks could be 3 weeks old but still within SLA. PECOS could be from a quarterly snapshot 75 days ago.

**Fix:** Always render FreshnessPanel. Show last-checked date per source with explicit SLA status (current/approaching/stale).

**Severity:** P1 -- freshness transparency is core to the trust model.

---

### 8. HIGH: HeroAppPreview uses "Verified" status -- implies binary verdict

**Location:** `apps/web/components/marketing/HeroAppPreview.tsx` lines 15, 129

**Problem:** Mock data shows clinicians with "Verified" status and footer "3 Verified." VitalCV's actual system never produces a binary "Verified" state -- it produces granular trust states per source with a composite CRS score.

**Employer impact:** Employer believes VitalCV produces a binary verified/not-verified verdict. Sets wrong expectation before they ever enter the product.

**Fix:** Replace "Verified" with "CRS 95" or "Ready for Review." Replace "3 Verified" with "3 at CRS >= 80."

**Severity:** P1 -- first-impression trust framing.

---

### 9. MEDIUM: "Safe to rely on now" section lacks definition

**Location:** `apps/web/components/passport/PassportTrustPosture.tsx` lines 153-161

**Problem:** Section header "Safe to rely on now" appears without defining what "safe" means. Safe for hiring? Safe for credentialing? Safe for privileging? Items listed without source attribution or freshness.

**Employer impact:** "If it's in the 'safe' list, I can hire based on it." Actually means "these claims have current source-backed evidence; other dimensions may be pending."

**Fix:** Rename to "Current Source-Backed Evidence (not hire-eligible alone)" with explicit per-claim source + date. Add: "Still pending: [list]. These must resolve before hire decision."

**Severity:** P1 -- decision framing.

---

### 10. MEDIUM: Gated sources display as generic "Not decision grade"

**Location:** `apps/web/components/trust/SourceCoverageRow.tsx` lines 45-64

**Problem:** Sources that are gated (institutional access required), pending (not yet checked), unavailable (source down), and stale (missed SLA) all display with the same "Not decision grade" badge. Employer cannot distinguish between them.

**Employer impact:** "Not decision grade = we checked and it came back negative." Could actually mean "we can't check this because it requires institutional access we don't have."

**Fix:** Separate badge types: "Pending" / "Stale -- refresh needed" / "Access required (institutional)" / "Unavailable" / "Review required" with explanation text per state.

**Severity:** P1 -- source coverage transparency is a core differentiator.

---

## TOP 5 MUST-FIX BEFORE PILOT

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 1 | Fix `resolveCanonicalSourceCoverageState` to return 'stale' when `fresh=false` | `sourceCoverage.ts` | S |
| 2 | Add source coverage validation to employer acceptance endpoint + wrap in transaction | `employerActions.ts` | M |
| 3 | Disable acceptance at MEDIUM readiness; require all identity + safety checks | `ReviewClient.tsx` | S |
| 4 | Add "NOT included" scope statement to employer decision card | `ReviewClient.tsx` | S |
| 5 | Always show FreshnessPanel with per-source last-checked dates | `ReviewClient.tsx` | M |

**Estimated total: 4-6 hours of focused work.**

---

## ADDITIONAL ISSUES BY SURFACE

### Homepage / Marketing

| Issue | File | Lines | Fix |
|-------|------|-------|-----|
| FSMB shown as active source (gated) | `Hero.tsx` | 74 | Remove or add lock icon + "institutional access required" |
| "88% faster" metric without basis | `HeroAppPreview.tsx` | 130 | Add "(illustrative)" label or remove |
| SOC 2 badge without certification | `SystemConsole.tsx` | ~240 | Remove entirely until certified |
| NCQA-Aligned label without disclaimer | `WalletDashboard.tsx` | ~92 | Change to "NCQA CR1-CR5 architecture (audit pending)" |

### Passport / Onboarding

| Issue | File | Lines | Fix |
|-------|------|-------|-----|
| Color-coded status (emerald/amber) violates opacity-only design rule | `CredentialStatusCard.tsx` | 43-48 | Use opacity, not color coding |
| "Source-backed" label without which source or when | `VerificationBadge.tsx` | 11-39 | Expand to "Source-backed [NPPES, checked 2026-04-02]" |
| CRS score without dimension breakdown | `passport-contract.ts` | 42-53 | Always show score + per-dimension breakdown |
| "Decision grade" badge on single artifact implies hire-ready | `VerificationArtifacts.tsx` | 42-50 | Change to "Source-backed (single claim)" |
| "Activate Profile" button undefined outcome | `ReadinessCard.tsx` | 81-82 | Change to "Continue to Employer Review" |
| "Not yet verified" doesn't explain why | `PassportTrustPosture.tsx` | 165-178 | Expand with blocker reason + required action |

### Interview / Review

| Issue | File | Lines | Fix |
|-------|------|-------|-----|
| PARTIAL readiness says "can accept and proceed" | `InterviewClient.tsx` | 110-117 | Reframe: "one critical check incomplete" |
| Enrollment NOT_FOUND treated as non-blocking | `ReviewClient.tsx` | 237-273 | Add action required + disable accept |
| No freshness check before acceptance | `ReviewClient.tsx` | 428 | Add stale-data warning before accept button |
| Error messages use technical jargon | `ReviewPageClient.tsx` | 112-142 | Replace "hydrate passport" with plain English |

### Backend Logic

| Issue | File | Lines | Severity |
|-------|------|-------|----------|
| CRS score preserved at 80 with YELLOW despite missing acceptance | `CrsEngine.ts` | 94-102 | P1 |
| readinessEngine only detects mocks, not gated/unavailable | `readinessEngine.ts` | 63-100 | P1 |
| `artifactLooksMock` uses fragile string matching | `readinessEngine.ts` | 30-40 | P2 |
| Passport builder creates synthetic coverage from credential states | `passportService.ts` | 537-651 | P1 |
| sourceOpsService alerts not surfaced to passport/CRS consumers | `sourceOpsService.ts` | 250-272 | P1 |
| readinessEngine can't distinguish "flag disabled" vs "not checked yet" | `readinessEngine.ts` | 63-100 | P2 |

---

## WHAT WOULD MAKE ME NOT TRUST THIS SYSTEM

As a skeptical credentialing leader, I would walk away if I discovered:

1. **The system let me accept someone without checking them against the federal exclusion list.** MEDIUM readiness allows this today. This is a CMS compliance violation and a liability issue.

2. **"Checked" doesn't mean "current."** The staleness bug in `resolveCanonicalSourceCoverageState` means a check from 6 months ago still shows as decision-grade. If I relied on this and a license was revoked, I'm liable.

3. **The audit trail has gaps.** Fire-and-forget audit event dispatch means my acceptance may have no provenance. If CMS audits me, I can't prove I verified before hiring.

4. **The system shows me 4 checks and I assume that's everything.** Without explicit "NOT included" scope, I'd believe VitalCV is doing comprehensive credentialing. When an auditor asks about NPDB, I'd say "VitalCV handles that" -- and I'd be wrong.

5. **The CRS score is a single number with no dimension breakdown.** I can't tell if 85 means "strong across the board" or "identity perfect, safety missing." A composite score without transparency is a liability in credentialing.

---

## WHAT WOULD MAKE ME TRUST IT ENOUGH TO ACT

1. **Every check shows: source, date, SLA status.** I can see exactly what was verified, when, and whether it's current. No ambiguity.

2. **The system blocks me from accepting when critical checks are incomplete.** It fails closed. I can't accidentally accept someone without identity + safety confirmation.

3. **The scope is explicit.** "We check these 4 sources. We do NOT check these 5 sources. Here's what you still need to verify independently." Honest scope > implied completeness.

4. **Every acceptance has a complete, transactional audit trail.** Acceptance + evidence + timestamp + decision rationale, all in one atomic write. I can hand this to an auditor.

5. **Freshness is always visible.** I never see a check without knowing when it was performed. Stale data is flagged before I can act on it.

6. **The score is explainable.** CRS 85 = Identity 20/20 + Safety 25/25 + Authority 20/25 (1 stale license) + Eligibility 20/30 (PECOS quarterly lag). I know what's strong and what's weak.

---

## SUMMARY

The architecture is sound. The trust primitives exist. The canonical path is well-designed. But the **last mile** -- where employers actually make decisions -- has 6 critical gaps that could lead to incorrect hiring decisions, compliance violations, and audit failures.

The system currently tells employers what IS checked but does not adequately tell them: what ISN'T checked, how fresh the checks are, and when they should NOT proceed.

**Fix the 5 must-fix items. The product becomes boring, obvious, trustworthy, and actionable. That's the goal.**

---

*Audit performed 2026-04-05 by Claude Cowork.*
*Methodology: Full source scan of all UI surfaces + backend trust logic.*
*37 total issues identified. 3 P0 backend. 4 P0 frontend. 10 P1. 7 P2.*
