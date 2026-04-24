# VitalCV Credentialing Accuracy — Task Wave Bundle
**Date:** 2026-04-22  
**Source:** CREDENTIALING_EXECUTION_VALIDATION_2026-04-22.md  
**Total tasks:** 18 (7 P0 · 6 P1 · 5 P2)  
**Execution engines:** Claude Code (logic/data) · Cursor (UI/copy) · Codex (contract types/guards)

---

## Execution Order

```
WAVE A (P0 — This Week, ~12h total)
  A1 → A2 → A3 (sequential — shared file: sourceCatalog.ts)
  A4, A5, A6, A7 (independent — can run parallel after A1-A3)

WAVE B (P1 — Next Sprint, ~24h total)
  B1, B2 (independent)
  B3 (depends on B1 completion — Organization model change)
  B4 (depends on B1/B2 — blocker taxonomy additions)
  B5, B6 (independent)

WAVE C (P2 — Before Pilot Launch, ~32h total)
  C1, C2 (independent)
  C3 (depends on B1 — Organization model must exist)
  C4 (depends on B2 — PSVContracts work history types must exist)
  C5 (depends on A4 — LEIE source metadata must be updated first)
```

---

## WAVE A — P0 Critical Accuracy Fixes

### A1 — NPDB Self-Query: Fix 60-day → 45-day validity window

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/identity/sourceCatalog.ts`  
**Effort:** ~30 minutes  
**Risk if missed:** NCQA audit failure — files that proceed to committee on day 46+ carry expired NPDB evidence

---

**CLAUDE CODE PROMPT:**

```
You are fixing an NCQA compliance bug in VitalCV.

CONTEXT:
- File: apps/api/backend/src/services/identity/sourceCatalog.ts
- VitalCV uses a sourceCatalog to define each data source's refreshSlaHours.
- The NPDB (National Practitioner Data Bank) self-query validity period is currently set incorrectly.

REGULATORY FACT:
HRSA NPDB Guidebook (2025): A self-query result is valid for 45 days, NOT 60 days.
After 45 days, credentials committees must reject the file pending a new query.

TASK:
1. Find the NPDB source entry in SOURCE_CATALOG.
2. Find the refreshSlaHours value for NPDB.
3. If refreshSlaHours represents the self-query validity, it should be 45 * 24 = 1080 hours.
   If it is currently set to 60 * 24 = 1440 hours, correct it to 1080.
4. Add a JSDoc comment above the NPDB entry:
   // HRSA NPDB Guidebook (2025): self-query validity is 45 days (1,080 hours).
   // Widely misquoted as 60 days. Do not change without HRSA source.
5. Search the entire codebase for any other references to NPDB validity as 60 days
   (grep for: 1440, "60 days", "60-day" near "NPDB").
   Fix any found. List all files you changed.

CONSTRAINTS:
- TypeScript strict mode. Do not introduce type errors.
- Do not modify any other source entry.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

### A2 — CAQH Re-attestation: Fix 180-day → 120-day cycle

**Executor:** Claude Code  
**Files:** `packages/domain-common/psvPolicy.ts`, `packages/domain-common/psvContracts.ts`, any CAQH adapter  
**Effort:** ~1 hour  
**Risk if missed:** System accepts stale CAQH attestations as current evidence; false clean CRS scores

---

**CLAUDE CODE PROMPT:**

```
You are fixing a CAQH attestation cycle bug in VitalCV.

CONTEXT:
CAQH ProView re-attestation cycle is 120 days, NOT 180 days.
(Exception: Illinois providers have 180 days, but this is a state-specific edge case.)
VitalCV may currently use 180 days in PSV freshness rules or CAQH source configuration.

REGULATORY FACT:
CAQH User Guide (2024): "Providers must re-attest every 120 days to maintain Active status."
Between re-attestations, a license could be suspended, exclusion added, or board cert lapsed
without CAQH reflecting it. Treating CAQH as fresh beyond 120 days accepts potentially stale data.

TASK:
1. Search the codebase for CAQH-related freshness/maxAge values:
   grep -rn "CAQH\|caqh" packages/ apps/ --include="*.ts" | grep -i "180\|day\|maxAge\|second\|hour\|fresh"
2. Find all locations where 180 days (15552000 seconds, 4320 hours) or similar is used
   in context of CAQH attestation validity.
3. Change all CAQH freshness windows from 180 days to 120 days:
   - seconds: 10368000 → 10368000 is 120 days (120 * 24 * 3600)
   - hours: 2880 hours (120 * 24)
4. In the PSVFreshnessRule for CAQH (packages/domain-common/psvContracts.ts or psvPolicy.ts),
   if maxAgeSeconds is set for CAQH, it should be 10368000 (120 * 86400).
5. In sourceCatalog.ts, if CAQH has a refreshSlaHours, it should be 2880 (120 * 24).
6. Add a JSDoc comment wherever you change CAQH freshness:
   // CAQH User Guide (2024): re-attestation cycle is 120 days.
   // IL exception: 180 days — not implemented (edge case for future state-rule registry).
   // Do not change without updated CAQH documentation.
7. Search for any UI copy that says "6 months" or "180 days" in CAQH context — list if found.

CONSTRAINTS:
- TypeScript strict mode.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm --filter web build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

### A3 — PSV Window: Update 180-day → 120-day per NCQA 2025

**Executor:** Claude Code  
**Files:** `packages/domain-common/employmentContracts.ts`, `packages/domain-common/psvContracts.ts`, `packages/domain-common/psvPolicy.ts`, any AcceptancePolicy configuration  
**Effort:** ~2 hours  
**Risk if missed:** System is out of NCQA 2025 compliance from pilot day 1; any NCQA audit fails automatically

---

**CLAUDE CODE PROMPT:**

```
You are implementing the NCQA 2025 PSV window compliance update in VitalCV.

REGULATORY CHANGE:
NCQA Standards for Credentialing, effective July 1, 2025:
- CR 3 PSV Window: 180 days → 120 days (for NCQA Accreditation)
- CR 3 PSV Window: 120 days → 90 days (for NCQA CVO Certification)
VitalCV targets NCQA Accreditation. The correct window is 120 days.

This is a breaking compliance change. Any credentialing file using PSV evidence older than
120 days must be rejected as non-compliant, not just flagged.

TASK:
1. Search for all PSV window definitions across the codebase:
   grep -rn "psvWindow\|PSV_WINDOW\|psvWindowDays\|180\b" packages/ apps/ --include="*.ts"
2. For any PSV freshness window set to 180 days:
   - seconds: 15552000 → change to 10368000 (120 * 86400)
   - days: 180 → change to 120
   - hours: 4320 → change to 2880
3. Update the PSVPolicy default (if defined in psvPolicy.ts):
   If there is a DEFAULT_PSV_POLICY constant or similar, ensure its freshnessRules
   for all primary source checks use maxAgeSeconds = 10368000 (120 days).
4. In employmentContracts.ts, search for any psvWindowDays or verification window
   references. If a VerificationWindow type or constant exists, update to 120 days.
5. In AcceptancePolicy entries (if defined in domain-common), update:
   psvWindowDays: 180 → psvWindowDays: 120
6. Add a block comment wherever the value is set:
   // NCQA CR 3 (2025, effective July 1 2025): PSV window = 120 days (NCQA Accreditation).
   // CVO Certification requires 90 days — not the target standard for VitalCV pilot.
   // Do NOT revert to 180 days. Pre-2025 NCQA used 180; we are post-2025.
7. Search for any hardcoded text "180 days" or "6 months" in credential expiry context in
   apps/web (UI copy). List any found — do not change them (Cursor handles UI copy).

CONSTRAINTS:
- This change affects what CRS accepts as valid evidence. After this change,
  any test fixtures using evidence older than 120 days must be updated to be
  within 120 days (use relative dates like "now minus 100 days").
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm --filter web build — must pass.
- Run: pnpm tsc --noEmit — must pass.
- Run: pnpm test (or vitest run) in packages/domain-common — tests must pass.
  If tests fail due to the threshold change, update test fixtures to use
  evidence within the new 120-day window.
```

---

### A4 — Monthly Monitoring: Enforce 30-day OIG/LEIE/SAM cycle

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/sourceOpsService.ts`, `packages/trust-state/sourceCoverage.ts`  
**Effort:** ~1 hour  
**Risk if missed:** CMS audit exposure for pilot customers — ongoing monitoring SLA violation

---

**CLAUDE CODE PROMPT:**

```
You are implementing NCQA 2025 monthly ongoing monitoring enforcement in VitalCV.

REGULATORY CHANGE:
NCQA CR 6 (2025): Ongoing monitoring frequency changed from semi-annual to MONTHLY.
Specific sources requiring monthly monitoring: OIG/LEIE, SAM.gov, state license status.
The monitoring window is 30 days — a provider not re-checked in >30 days is NOT in
compliance for any NCQA-accredited organization.

TASK:
1. In apps/api/backend/src/services/identity/sourceCatalog.ts:
   Find the OIG_LEIE source entry.
   Ensure refreshSlaHours = 720 (30 days). If it is higher, reduce it.
   Find the SAM_GOV source entry.
   Ensure refreshSlaHours = 720 (30 days). If it is higher, reduce it.
   Add comment to both:
   // NCQA CR 6 (2025): ongoing monitoring monthly = 30 days max.
   // Previously semi-annual. Do not increase above 720h without regulatory approval.

2. In packages/trust-state/sourceCoverage.ts:
   Find the staleness threshold logic — the point at which a source transitions
   from 'checked' to 'stale' state.
   If there is a hardcoded threshold that controls OIG/LEIE or SAM staleness,
   it should be based on the source catalog refreshSlaHours (720h = 30 days).
   If the stale transition uses a different constant (e.g., 90 days, 180 days),
   replace it with a reference to SOURCE_CATALOG[sourceId].refreshSlaHours.
   The staleness calculation should be: isStale = (now - lastCheckedAt) > refreshSlaHours * 3600 * 1000

3. In apps/api/backend/src/services/sourceOpsService.ts:
   If there is a monitoring scheduler or SLA alert system:
   Ensure OIG/LEIE and SAM.gov alerts trigger when > 30 days since last check.
   If the alert threshold is configurable, default it to 30 days.

4. Search for any hardcoded "semi-annual", "biannual", "180 days", "6 months" in
   monitoring context — list all found (do not change if in UI copy).

CONSTRAINTS:
- Do not change NPPES refresh cadence (it is already daily — correct).
- Do not change PECOS (quarterly is acceptable for that source).
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

### A5 — LEIE Exclusion Gap: Surface Medicaid exclusion incompleteness

**Executor:** Claude Code + Cursor (copy)  
**Files:** `packages/psv/sources/oigLeie.ts`, any LEIE-related UI copy in `apps/web`  
**Effort:** ~2 hours  
**Risk if missed:** Employer hires state-Medicaid-excluded clinician; VitalCV CLEAR status is misleading

---

**CLAUDE CODE PROMPT (Claude Code):**

```
You are fixing a critical trust transparency gap in VitalCV's LEIE exclusion check.

PROBLEM:
The OIG LEIE (List of Excluded Individuals/Entities) is INCOMPLETE for state Medicaid exclusions.
Approximately 50% of state Medicaid exclusions never appear in the federal LEIE because states
have no legal obligation to report to OIG for state-only Medicaid programs.

Additionally: the CMS Preclusion List (42 CFR §§422.222, 423.120) is distinct from LEIE and
has no automated API feed. A provider can appear on the Preclusion List while showing CLEAR on LEIE.

CURRENT STATE (dangerous):
VitalCV likely surfaces "LEIE: CLEAR" as if it means "no exclusions." It does not.

TASK:
1. In packages/psv/sources/oigLeie.ts:
   a. Add a constant at the top of the file:
      // WARNING: LEIE incompleteness — see compliance note
      // LEIE does NOT include ~50% of state Medicaid-only exclusions.
      // SAM.gov + individual state Medicaid exclusion lists must also be checked.
      // CMS Preclusion List (42 CFR §§422.222, 423.120) is a SEPARATE check with no API feed.
      export const LEIE_COVERAGE_WARNING = {
        incompleteness: 'LEIE does not include ~50% of state Medicaid-only exclusions',
        additionalSourcesRequired: ['SAM_GOV', 'STATE_MEDICAID_EXCLUSION_LIST', 'CMS_PRECLUSION_LIST'],
        cmsPreclutionListNote: 'No automated API. Must be checked manually. 42 CFR §§422.222, 423.120',
      } as const;
   
   b. In the PSV check result metadata for LEIE, add a coverageNote field (or equivalent):
      If PSVCheckEvidence has a metadata field, add:
      metadata: {
        ...existing,
        coverageNote: 'Federal LEIE only. Does not include state Medicaid exclusions (~50% gap). Check SAM.gov and state Medicaid lists separately.',
      }

2. In packages/trust-state/sourceCoverage.ts or TrustStateResolver.ts:
   If there is logic that sets a combined "sanctions: CLEAR" when LEIE returns clean,
   add a comment:
   // LEIE CLEAR ≠ fully exclusion-free. State Medicaid exclusions not included.
   // A CLEAR here means: not on federal OIG exclusion list.
   Do NOT change the logic to block on LEIE alone — this is a metadata/transparency fix.

3. Search for any location in the codebase where "LEIE: CLEAR" or "excluded: false"
   is surfaced to the UI or employer packet without the incompleteness caveat.
   List the file locations — do not change them (Cursor handles UI copy).

CONSTRAINTS:
- Do NOT change the LEIE check from blocking to non-blocking. The check is correct.
- This is a metadata and coverage transparency fix only.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

**CURSOR PROMPT (follow-on, UI copy):**

```
Update LEIE-related UI copy in apps/web to reflect exclusion check scope.

FIND: Any UI component that shows "LEIE: Clear", "No exclusions found", "Exclusion check: passed",
or similar language that implies comprehensive exclusion verification.

CHANGE: Add a sub-label or tooltip under the LEIE status:
  Before: "OIG LEIE: Clear"
  After:  "OIG LEIE: Clear"
          Sub-label: "Federal exclusions only · State Medicaid exclusions checked separately"

If using a tooltip, the full text should be:
  "This checks the federal OIG exclusion list. State Medicaid programs maintain separate
   exclusion lists. VitalCV also checks SAM.gov. CMS Preclusion List is reviewed manually."

Use existing VitalCV CSS token system (bg-vt-*, body-sm, heading-sm classes).
Do not introduce new styling primitives.
```

---

### A6 — DEA Verification: Disclose source and remove implied real-time status

**Executor:** Claude Code  
**Files:** `packages/psv/sources/` (DEA adapter if exists), `apps/api/backend/src/services/identity/sourceCatalog.ts`  
**Effort:** ~3 hours  
**Risk if missed:** System implies real-time DEA verification capability it does not have; compliance misrepresentation

---

**CLAUDE CODE PROMPT:**

```
You are fixing DEA verification source disclosure in VitalCV.

CRITICAL FACT:
There is NO public DEA API. DEA registration verification uses one of:
  1. AMA Physician Profiles — monthly bulk update, 30-day lag possible
  2. Clinician-submitted certificate copy — requires OCR; point-in-time only
  3. Third-party resellers (Veridian, etc.) — monthly or quarterly data

Current risk: VitalCV may present DEA as "verified" without disclosing the verification source
and its freshness limitations. This is a compliance misrepresentation.

TASK:
1. In apps/api/backend/src/services/identity/sourceCatalog.ts:
   Find the DEA_REGISTRATION source entry (or equivalent).
   If it says accessPattern: 'REALTIME' or implies a live API — this is WRONG.
   Change to: accessPattern: 'BULK_FILE' or 'MANUAL_SUBMISSION'
   refreshSlaHours should be: 720 (30 days) if using AMA Profiles monthly update
   Add note:
   // DEA: No public API. Verification via AMA Physician Profiles (monthly),
   // certificate copy (OCR), or licensed third-party data.
   // refreshSlaHours reflects AMA Profiles monthly update cycle.
   // REAL-TIME DEA STATUS CANNOT BE VERIFIED. Do not claim otherwise.
   liveAvailable: false  // if this field exists

2. In packages/psv/sources/ — if a DEA source adapter exists:
   Find where the PSVCheckEvidence is created for DEA.
   Add a required verificationSource field to the metadata:
   metadata: {
     verificationSource: 'AMA_PROFILE' | 'CERTIFICATE_COPY' | 'THIRD_PARTY' | 'NOT_VERIFIED',
     dataRefreshDate: string,  // ISO 8601 date of source data (not today's date)
     note: 'No public DEA API. Verification currency limited to source data refresh date.',
   }
   If DEA source is a stub, add the metadata shape to the stub return value.

3. If PSVCheckResult.evidence.metadata does not support a verificationSource field,
   add it as an optional field in packages/domain-common/psvContracts.ts:
   interface PSVCheckEvidence {
     ...existing fields...
     verificationSource?: string;  // For sources with no real-time API
     dataRefreshDate?: string;     // ISO 8601 — when the underlying data was current
   }

4. Search the codebase for any string "DEA verified" or "DEA: active" or similar
   that implies real-time status. List all found — flag for Cursor to add disclosure copy.

CONSTRAINTS:
- TypeScript strict mode.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

### A7 — "Legally Only" Response: Escalate to REVIEW_REQUIRED

**Executor:** Claude Code  
**Files:** `packages/domain-common/psvContracts.ts`, work history verification logic in `apps/api/`  
**Effort:** ~2 hours  
**Risk if missed:** Work history passes verification when prior employer declines to comment on standing — credentialing integrity failure

---

**CLAUDE CODE PROMPT:**

```
You are implementing correct "legally only" employment response handling in VitalCV.

REGULATORY CONTEXT (TJC MS.06.01.05, NAMSS ICS):
When a prior employer responds to employment verification with ONLY dates of employment
and explicitly declines to comment on standing, reason for departure, or clinical performance —
this response pattern is called "legally only." TJC and NAMSS require this to be escalated
to committee review as a REVIEW_REQUIRED condition, NOT counted as a successful verification.

CURRENT RISK:
If VitalCV's work history verification records a "legally only" response as VERIFIED (because
the dates were confirmed), it is incorrectly treating a non-answer about clinical standing
as a positive verification. This is a credentialing integrity failure.

TASK:
1. In packages/domain-common/psvContracts.ts:
   Add a new PSVStatus value: LEGALLY_ONLY = 'LEGALLY_ONLY'
   This represents: "Identity/dates confirmed, but employer declined to comment on standing."
   It must be added to PSV_STATUS_VALUES alongside the existing values.
   
   Also add to PSVFinding (or a new type) a legallyOnlyResponse field:
   interface PSVFinding {
     ...existing...
     legallyOnlyResponse?: {
       datesConfirmed: boolean;
       standingDeclined: true;
       reason: string;  // e.g., "Prior employer cited legal counsel instruction"
     };
   }

2. In psvPolicy.ts evaluatePSV():
   Add a rule: any check with status === 'LEGALLY_ONLY' → decision = REVIEW
   regardless of other checks. This is non-negotiable per TJC.
   Add to reasons: "REVIEW REQUIRED: Prior employer provided dates only, declined
   to comment on standing. Per TJC MS.06.01.05, this requires committee review."

3. In apps/api/backend/ — find where work history verification results are recorded:
   (grep: "workHistory\|work_history\|EMPLOYMENT\|prior employer" in routes/services)
   If there is a handler that processes verification API responses or manual inputs:
   Add a LEGALLY_ONLY detection path:
   - If response contains: "legally only" | "dates only" | "declined to comment on
     clinical performance" | "no further comment" → set status to LEGALLY_ONLY
   - If parsed from a structured form: add a boolean field `declinesToCommentOnStanding`
     that, when true, sets status to LEGALLY_ONLY

4. Ensure LEGALLY_ONLY status causes:
   - CRS recomputation (CRS should reflect REVIEW_REQUIRED state, cap at 79)
   - AuditEvent written with action: 'LEGALLY_ONLY_RESPONSE_ESCALATED'
   - Employer dashboard surfaced with: "Work history verification at [Employer Name]
     returned a 'legally only' response. Committee review required per TJC MS.06.01.05."

CONSTRAINTS:
- LEGALLY_ONLY must be distinct from FLAG (which means potential match) and UNKNOWN (no data).
- TypeScript strict mode.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
- Write a unit test in packages/domain-common/__tests__/ that verifies:
  evaluatePSV with a LEGALLY_ONLY work history check → returns decision: REVIEW.
```

---

## WAVE B — P1 New Blockers & Actions

### B1 — StateRuleRegistry: Single source of truth for state-level rules

**Executor:** Claude Code (schema + data) · Cursor (integration)  
**Files:** New file: `packages/domain-common/stateRuleRegistry.ts`  
**Effort:** ~4 hours  
**Dependency:** None — standalone new package  

---

**CLAUDE CODE PROMPT:**

```
You are creating the StateRuleRegistry for VitalCV — a single source of truth for
state-specific credentialing rules that replaces scattered conditional logic.

BACKGROUND:
Multiple credentialing rules vary by state. Currently, state-specific logic is either:
(a) missing entirely, or (b) implemented as ad-hoc conditionals scattered in the codebase.
The StateRuleRegistry centralizes this into a typed, maintainable lookup table.

TASK:
Create packages/domain-common/stateRuleRegistry.ts with the following structure:

```typescript
/**
 * STATE RULE REGISTRY
 * 
 * Single source of truth for state-level credentialing rules.
 * Every state-specific conditional in VitalCV should reference this registry.
 * 
 * Sources: AMA, NCSBN, FSMB, AAPC, DEA Diversion Control, state NP/PA practice acts.
 * Last verified: 2026-04-22
 */

export interface StateCredentialingRules {
  /** Two-letter state code */
  stateCode: string;
  stateName: string;

  /** Is this state a member of the IMLC physician compact? */
  imlcMember: boolean;
  
  /** Is this state a member of the eNLC nursing compact? */
  enlcMember: boolean;
  
  /** Does this state require a separate Controlled Substance Registration (CSR)
   *  in addition to federal DEA registration for prescribers? */
  requiresStateCsr: boolean;
  
  /** What level of NP practice independence does this state allow?
   *  FULL = no supervision/collaboration required
   *  REDUCED = collaboration agreement required but no direct supervision
   *  RESTRICTED = supervision agreement required with physician involvement */
  npPracticeLevel: 'FULL' | 'REDUCED' | 'RESTRICTED';
  
  /** Does this state require a supervision agreement for PAs? */
  paRequiresSupervisoryAgreement: boolean;
  
  /** Typical new license processing days (non-compact) */
  typicalLicenseDaysMin: number;
  typicalLicenseDaysMax: number;
  
  /** Notes on special requirements */
  notes?: string;
}
```

Populate the registry for the following states (the highest-volume healthcare states
plus all IMLC/eNLC key cases):

IMLC NON-MEMBERS (hardcode these as imlcMember: false):
- CA (California), NY (New York), ID (Idaho) [Note: verify current status]

CSR-REQUIRING STATES (set requiresStateCsr: true):
- AL, AK, AZ, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD,
  MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI,
  SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, DC
  (All 50 states + DC currently require a state CSR — verify and set accordingly.
  Note: The CSR requirement varies by substance schedule. Include the most common
  interpretation: requires CSR for Schedule II-V prescribing.)

NP PRACTICE INDEPENDENCE:
- Full Practice (npPracticeLevel: 'FULL'): AK, AZ, CO, CT, DC, DE, HI, IA, ID, 
  ME, MD, MN, MT, ND, NH, NM, NV, OR, RI, SD, VT, WA, WY, WI + others
- Reduced Practice: many states — use 'REDUCED' as default if unsure
- Restricted Practice: AL, FL, GA, MI, MO, NC, OK, SC, TN, TX, VA + others

Export:
  export const STATE_RULES: Record<string, StateCredentialingRules> = { ... }
  export function getStateRules(stateCode: string): StateCredentialingRules | undefined
  export function requiresStateCsr(stateCode: string): boolean
  export function isImlcMember(stateCode: string): boolean
  export function isEnlcMember(stateCode: string): boolean
  export function getNpPracticeLevel(stateCode: string): 'FULL' | 'REDUCED' | 'RESTRICTED' | 'UNKNOWN'

Add stateRuleRegistry.ts to packages/domain-common/index.ts exports.

CONSTRAINTS:
- TypeScript strict mode. No any types.
- The registry should be immutable (Object.freeze or readonly).
- Populate all 50 states + DC with best available data; use notes field to flag
  uncertainty: notes: 'Verify: NP practice independence changed in 2024 — confirm current law.'
- Add a test file packages/domain-common/__tests__/stateRuleRegistry.test.ts:
  - Test getStateRules('CA') returns imlcMember: false
  - Test getStateRules('TX') returns npPracticeLevel: 'RESTRICTED'
  - Test getStateRules('OR') returns npPracticeLevel: 'FULL'
  - Test getStateRules('INVALID') returns undefined
- Run: pnpm tsc --noEmit — must pass.
```

---

### B2 — MB-03/MB-04: Add State CSR + Collaborative Agreement Blockers

**Executor:** Codex  
**Files:** Blocker taxonomy, `packages/domain-common/credentialingContracts.ts` or equivalent  
**Effort:** ~4 hours  
**Dependency:** B1 (StateRuleRegistry must exist to query state rules)  

---

**CODEX PROMPT:**

```
Add two new soft blockers to VitalCV's credentialing blocker taxonomy.

CONTEXT:
VitalCV uses a blocker taxonomy with hard blockers (HB-*) and soft blockers (SB-*).
Blockers are defined in packages/domain-common/ (credentialingContracts.ts or similar).
Each blocker has: id, type (HARD|SOFT|INFO), category, description, regulatoryBasis,
owner (CLINICIAN|EMPLOYER|SYSTEM|BOTH), and estimated resolution days.

NEW BLOCKERS TO ADD:

BLOCKER 1: MB-03 — State Controlled Substance Registration Missing
  id: 'MB-03'
  type: 'SOFT'
  category: 'licensure'
  description: 'State Controlled Substance Registration (CSR) is missing or expired for state of practice. Required for prescribers in this state in addition to federal DEA registration.'
  regulatoryBasis: 'State controlled substance acts; applicable to prescribers in 22+ states'
  owner: 'CLINICIAN'
  estimatedResolutionDaysMin: 7
  estimatedResolutionDaysMax: 45
  crsImpact: 'CAP_AT_79'  // blocks Start until waived by committee
  detectionLogic: 'stateRuleRegistry.requiresStateCsr(practitionerState) === true AND csr.status !== ACTIVE'
  actionRequired: 'File state CSR application immediately. Do not wait for DEA — DEA and state CSR are separate processes.'

BLOCKER 2: MB-04 — Collaborative/Supervision Agreement Missing (NP/PA)
  id: 'MB-04'
  type: 'SOFT'
  category: 'licensure'
  description: 'Collaborative practice agreement (NP) or supervision agreement (PA) is required in this state but has not been executed. This is a prerequisite to credentialing completion.'
  regulatoryBasis: 'State NP/PA practice acts; ~20 states require collaboration/supervision agreements'
  owner: 'BOTH'  // Clinician finds collaborating physician; employer executes agreement
  estimatedResolutionDaysMin: 7
  estimatedResolutionDaysMax: 30
  crsImpact: 'CAP_AT_79'
  detectionLogic: |
    (practitioner.role === 'NP' AND stateRuleRegistry.getNpPracticeLevel(state) !== 'FULL')
    OR (practitioner.role === 'PA' AND stateRuleRegistry.paRequiresSupervisoryAgreement(state) === true)
    AND collaborativeAgreement.status !== 'EXECUTED'
  actionRequired: 'NP: Identify collaborating physician and execute agreement before start date. PA: Supervising physician agreement required.'

WHERE TO ADD:
1. Find where existing blocker definitions live (grep for 'SB-01' or 'HB-01' in packages/domain-common/).
2. Add MB-03 and MB-04 in the same pattern.
3. Update any BlockerType union or enum to include 'MB-03' | 'MB-04'.
4. If there is a BlockerEvaluator or blocker detection function, add stub detection
   logic that calls the StateRuleRegistry (B1 must be complete first).
5. Ensure CRS computation engine respects these new blockers:
   If MB-03 or MB-04 is ACTIVE → CRS capped at 79 (same as other soft blockers).

CONSTRAINTS:
- TypeScript strict mode.
- Follow existing blocker definition pattern exactly — do not create new interfaces.
- Run: pnpm tsc --noEmit — must pass.
- Add unit tests: MB-03 fires for TX prescriber without CSR; MB-04 fires for TX NP without agreement.
```

---

### B3 — Committee Cutoff: Add to Organization model

**Executor:** Claude Code (backend) · Cursor (frontend alert)  
**Files:** `apps/api/backend/prisma/schema.prisma` (SQL plan only), `apps/api/backend/src/` (service + route), `apps/web/components/`  
**Effort:** ~6 hours  
**Dependency:** None — standalone addition  

---

**CLAUDE CODE PROMPT:**

```
You are adding committee meeting cadence tracking to VitalCV's Organization model.

CONTEXT:
Missing a credentials committee cutoff by one day costs 28–90 days of ISV slip
(the full interval to the next meeting). This is the most frequently preventable delay.

The system currently models committee review duration (7–30 days) but does not track
the actual committee meeting calendar per organization.

TASK:
1. SCHEMA PLAN (write to docs/migrations/, do NOT run prisma migrate):
   Write file: docs/migrations/2026-04-22-committee-cadence.sql
   Content: SQL ALTER TABLE statements to add to the Organization table:
   - committee_meeting_cadence: TEXT (values: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY')
   - next_committee_meeting_date: DATE (nullable)
   - committee_cutoff_days_before_meeting: INTEGER DEFAULT 5
   - committee_meeting_timezone: TEXT DEFAULT 'America/New_York'
   
   Include a CHECK constraint: committee_meeting_cadence IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY')

2. PRISMA SCHEMA COMMENT (do not run migration):
   In apps/api/backend/prisma/schema.prisma, add a comment block near the Organization model:
   // PENDING MIGRATION: docs/migrations/2026-04-22-committee-cadence.sql
   // Fields to add: committeeMeetingCadence, nextCommitteeMeetingDate, committeeCutoffDaysBeforeMeeting
   // Approve migration before applying.

3. TYPESCRIPT TYPES:
   In packages/domain-common/ or a new file, add:
   export interface CommitteeCadence {
     cadence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY';
     nextMeetingDate: string | null;  // ISO 8601 date
     cutoffDaysBeforeMeeting: number;  // default 5
     timezone: string;  // IANA timezone
   }
   
   export function getDaysUntilCutoff(cadence: CommitteeCadence, asOf?: Date): number | null
   export function isCommitteeCutoffImminent(cadence: CommitteeCadence, warningWindowDays?: number): boolean
   // warningWindowDays default = 5

4. ALERT LOGIC (apps/api/backend/src/services/):
   Create or extend a case management service to check:
   For every active credentialing case:
     daysUntilCutoff = getDaysUntilCutoff(org.committeeCadence)
     if daysUntilCutoff !== null && daysUntilCutoff <= 5 && case.status !== 'SUBMITTED_TO_COMMITTEE':
       emit alert: {
         type: 'COMMITTEE_CUTOFF_IMMINENT',
         caseId,
         daysUntilCutoff,
         message: `File due to committee in ${daysUntilCutoff} days. Submit now or wait ${cadence} for next meeting.`,
         severity: 'HIGH'
       }

5. API ROUTE:
   Add to employer org settings route (or create if missing):
   PATCH /api/organizations/:orgId/committee-cadence
   Body: { cadence, nextMeetingDate, cutoffDaysBeforeMeeting, timezone }
   Validates input; returns updated org.
   Writes AuditEvent: 'COMMITTEE_CADENCE_UPDATED'

CONSTRAINTS:
- Do NOT run prisma migrate. Write SQL plan only.
- TypeScript strict mode.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

### B4 — MB-07: NPDB Continuous Query enrollment action

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/`, `packages/domain-common/`  
**Effort:** ~3 hours  
**Dependency:** None  

---

**CLAUDE CODE PROMPT:**

```
You are adding NPDB Continuous Query (CQ) enrollment as an explicit action in VitalCV.

BACKGROUND:
NPDB Continuous Query is a $2.50/provider/year HRSA service that delivers real-time
alerts whenever a new adverse report is filed against a monitored provider.
Enrolling in CQ eliminates NPDB staleness between reappointments entirely.
For NCQA CR 6 (2025) monthly monitoring compliance, CQ enrollment is the most efficient solution.

TASK:
1. Add a new soft informational blocker type MB-07 in the blocker taxonomy:
   id: 'MB-07'
   type: 'INFO'  // informational — not a hard or soft block, but flagged for action
   category: 'monitoring'
   description: 'NPDB Continuous Query (CQ) not enrolled. Provider is monitored via periodic queries only, creating gaps between reappointments.'
   regulatoryBasis: 'NCQA CR 6 (2025): monthly monitoring. NPDB Continuous Query satisfies ongoing monitoring requirement for NPDB dimension.'
   owner: 'EMPLOYER'
   actionRequired: 'Enroll this provider in NPDB Continuous Query at $2.50/year. Eliminates staleness risk permanently.'
   estimatedResolutionDaysMin: 1
   estimatedResolutionDaysMax: 3
   crsImpact: 'NONE'  // informational only; does not cap CRS

2. Add an action type 'ENROLL_NPDB_CONTINUOUS_QUERY' to the action engine:
   Create or extend the action catalog with:
   {
     id: 'ENROLL_NPDB_CQ',
     title: 'Enroll in NPDB Continuous Query',
     owner: 'EMPLOYER',
     trigger: 'On Recognition — immediately when provider joins platform',
     cost: '$2.50/provider/year',
     externalUrl: 'https://www.npdb.hrsa.gov/ext/dataRequest/queryRequest.jsp',
     complianceNote: 'NCQA CR 6 (2025): satisfies ongoing monitoring for NPDB dimension',
     estimatedSetupDays: 1,
   }

3. In the passport or entity service, after a successful Recognition event:
   If organization.npdbContinuousQueryEnrolled !== true for this provider:
   Emit action recommendation: 'ENROLL_NPDB_CQ'
   Do NOT block — this is a recommendation, not a hard or soft block.

4. Add a field to the employer-facing passport packet:
   npdbContinuousQueryStatus: 'ENROLLED' | 'NOT_ENROLLED' | 'UNKNOWN'
   Surface in review packet as:
   "NPDB Continuous Query: [status] — Enroll to satisfy NCQA CR 6 monthly monitoring ($2.50/year)"

CONSTRAINTS:
- TypeScript strict mode.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

### B5 — Nursys e-Notify: Add enrollment action for RN/NP/LPN

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/`, action catalog  
**Effort:** ~2 hours  
**Dependency:** None  

---

**CLAUDE CODE PROMPT:**

```
You are adding Nursys e-Notify enrollment as an explicit action in VitalCV for nursing roles.

BACKGROUND:
Nursys e-Notify is a free NCSBN service that delivers near-real-time alerts when a nursing
license status changes (suspension, revocation, reinstatement) in any of the 41 eNLC compact
states + DC + Guam. For organizations hiring RNs, NPs, or LPNs, e-Notify enrollment is
the most efficient way to satisfy NCQA CR 6 monthly license monitoring for nursing staff.

TASK:
1. Add a new action type 'ENROLL_NURSYS_ENOTIFY' to the action catalog:
   {
     id: 'ENROLL_NURSYS_ENOTIFY',
     title: 'Enroll in Nursys e-Notify (nursing license monitoring)',
     owner: 'EMPLOYER',
     trigger: 'On Recognition — when role is RN, NP, LPN, or CRNA and practitioner state is eNLC member',
     cost: 'Free',
     externalUrl: 'https://www.nursys.com/NLV/NLVTerms.aspx',
     complianceNote: 'NCQA CR 6 (2025): satisfies ongoing license monitoring for nursing roles in eNLC states',
     estimatedSetupDays: 1,
     roleRequirement: ['RN', 'NP', 'LPN', 'CRNA'],
   }

2. After a successful Recognition event where practitioner.role is in ['RN', 'NP', 'LPN', 'CRNA']:
   If stateRuleRegistry.isEnlcMember(practitioner.practiceState) === true:
     Emit action recommendation: 'ENROLL_NURSYS_ENOTIFY'
   Note: B1 (StateRuleRegistry) must be complete before this can call isEnlcMember.
   If B1 is not yet merged, add a TODO comment and a stub: 
   // TODO: replace with stateRuleRegistry.isEnlcMember() after B1 merges
   const isEnlcMember = true; // stub — all 41 states currently in compact

3. Add nursysEnotifyStatus: 'ENROLLED' | 'NOT_ENROLLED' | 'UNKNOWN' to the
   employer-facing passport packet, same pattern as B4 NPDB CQ status field.

4. In the monitoring section of the pilot diagnostics panel (if it exists in apps/web):
   Flag when nursing role + eNLC state + e-Notify not enrolled.
   Surface as: "Nursys e-Notify not enrolled. Real-time license change alerts unavailable. Free enrollment: nursys.com"

CONSTRAINTS:
- TypeScript strict mode.
- Role check should use the existing practitioner role taxonomy — do not hardcode strings
  without checking what role values exist in the codebase first.
- Run: pnpm --filter @vitalcv/api build — must pass.
```

---

### B6 — Payor Enrollment Track: Decouple from CRS

**Executor:** Claude Code (data model) · Cursor (UI separation)  
**Files:** `apps/api/backend/src/`, `packages/domain-common/`, `apps/web/components/`  
**Effort:** ~5 hours  
**Dependency:** None — can run parallel  

---

**CLAUDE CODE PROMPT:**

```
You are decoupling payor enrollment tracking from the Credential Readiness Score (CRS) in VitalCV.

PROBLEM:
Payor enrollment (PECOS/Medicare, Medicaid, commercial payors) is an ISV factor but is NOT
a credentialing compliance dimension. Mixing it into CRS creates confusion about what the
score means and causes employers to misinterpret CRS < 100 as a credentialing problem
when the issue is actually billing enrollment (a separate administrative track).

CORRECT MODEL:
CRS measures: credential compliance readiness (NCQA CR 1–8, TJC, CMS CoP)
EnrollmentTrack measures: billing eligibility (PECOS, Medicaid, commercial payor panels)

These are parallel tracks. A clinician can have CRS ≥ 80 and be ready for temp privileges
while still having an active PECOS enrollment in progress. Both are important — they are not the same.

TASK:
1. In packages/domain-common/ — create a new type file enrollmentContracts.ts:

   export type PayorEnrollmentStatus = 
     'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
   
   export type PayorType = 'MEDICARE_PECOS' | 'MEDICAID' | 'COMMERCIAL' | 'TRICARE';
   
   export interface PayorEnrollmentRecord {
     payorType: PayorType;
     payorName: string;
     status: PayorEnrollmentStatus;
     submittedAt?: string;      // ISO 8601
     approvedAt?: string;       // ISO 8601
     estimatedProcessingDays: number;  // e.g., PECOS = 60, commercial = 64
     notes?: string;
   }
   
   export interface EnrollmentTrack {
     entityId: string;
     enrollments: PayorEnrollmentRecord[];
     criticalPathPayor: PayorType | null;  // the payor with longest remaining processing
     estimatedEnrollmentCompletionDate: string | null;  // ISO 8601
     isBillingEligible: boolean;  // true when at least one payor approved
     isFullyEnrolled: boolean;    // true when all required payors approved
   }

2. In the existing credentialing/passport service:
   If payor enrollment data is currently stored as part of CRS inputs or passport dimensions,
   move it OUT of CRS computation and into a separate EnrollmentTrack.
   CRS must not reference payor enrollment status.
   
   If payor enrollment is not yet tracked at all, add a stub:
   const enrollmentTrack: EnrollmentTrack = {
     entityId,
     enrollments: [],
     criticalPathPayor: 'MEDICARE_PECOS',
     estimatedEnrollmentCompletionDate: null,
     isBillingEligible: false,
     isFullyEnrolled: false,
   };

3. Add enrollmentTrack to the passport response (GET /api/passport/entity/:entityId).
   It should be a top-level field alongside crs, not inside it.

4. Search for any comment or note in the codebase suggesting PECOS is a CRS dimension.
   Add a comment: // PECOS enrollment is NOT a CRS dimension. See EnrollmentTrack.

CONSTRAINTS:
- If removing payor data from CRS changes existing CRS scores in tests, that is CORRECT.
  Update test fixtures to reflect the accurate model.
- TypeScript strict mode.
- Run: pnpm --filter @vitalcv/api build — must pass.
- Run: pnpm tsc --noEmit — must pass.
```

---

## WAVE C — P2 Pilot Launch Features

### C1 — IMLC/eNLC Fast-Path Routing

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/`, action engine, StateRuleRegistry (B1)  
**Effort:** ~4 hours  
**Dependency:** B1 (StateRuleRegistry)  

---

**CLAUDE CODE PROMPT:**

```
You are implementing IMLC and eNLC compact routing in VitalCV's action engine.

BACKGROUND:
- IMLC (Interstate Medical Licensure Compact): 41 states + DC + Guam. Reduces MD/DO new state
  license from 90–240 days to 14–42 days. CA and NY are NOT members.
- eNLC (Enhanced Nurse Licensure Compact): 41 states + DC + Guam. Reduces RN new state
  license from 14–90 days to 3–10 days.
These are the highest-impact ISV levers for multi-state clinician hiring.

TASK:
1. In the action engine, when a new state license is identified as required:
   For MD/DO practitioners:
     If stateRuleRegistry.isImlcMember(targetState) AND stateRuleRegistry.isImlcMember(homeState):
       Recommend: 'APPLY_VIA_IMLC' action
       TTS estimate: 14–42 days
       Message: "IMLC compact available. Apply via IMLC for fast-track license (14–42 days vs. 90–240 standard)."
     Else if targetState in ['CA', 'NY']:
       Surface: "IMLC compact NOT available for California/New York. Standard application required. 75–240 days."
       Action: 'APPLY_STANDARD_STATE_LICENSE'
   
   For RN/NP/LPN practitioners:
     If stateRuleRegistry.isEnlcMember(targetState):
       Recommend: 'APPLY_VIA_ENLC' action
       TTS estimate: 3–10 days
       Message: "eNLC compact available. Multi-state license activates on endorsement. Estimated 3–10 days."
     Else:
       Action: 'APPLY_STANDARD_NURSING_LICENSE'
       TTS estimate: 14–90 days

2. Add action types to action catalog:
   'APPLY_VIA_IMLC': { owner: 'CLINICIAN', estimatedDaysMin: 14, estimatedDaysMax: 42, cost: 'varies by state' }
   'APPLY_VIA_ENLC': { owner: 'CLINICIAN', estimatedDaysMin: 3, estimatedDaysMax: 10, cost: 'free in compact states' }
   'APPLY_STANDARD_STATE_LICENSE': { owner: 'CLINICIAN', estimatedDaysMin: 75, estimatedDaysMax: 240 }

3. Surface the compact detection in the passport and the TTS estimate.
   If IMLC/eNLC route detected: update estimatedLicensureDays to compact range.
   Always show the route chosen: "Licensure track: IMLC compact (14–42 days)"

CONSTRAINTS:
- B1 (StateRuleRegistry) must be complete and merged.
- TypeScript strict mode. Run: pnpm tsc --noEmit.
```

---

### C2 — Locum Tenens Fast-Track

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/`, ingest pipeline  
**Effort:** ~3 hours  
**Dependency:** None  

---

**CLAUDE CODE PROMPT:**

```
You are implementing locum tenens fast-track detection in VitalCV.

BACKGROUND:
Locum tenens clinicians often have a credential file already maintained by their staffing agency
(Envision, TeamHealth, AMN, etc.). When this file exists and is current, the facility only needs
to run facility-specific privileging — skipping the full PSV bundle, which takes 14–45 days.
This compresses locum TTS from 30–90 days to 7–21 days.

TASK:
1. Add employmentType field to the practitioner or case model:
   employmentType: 'EMPLOYED' | 'LOCUM_TENENS' | 'INDEPENDENT_CONTRACTOR' | 'VOLUNTEER'

2. When employmentType === 'LOCUM_TENENS' is detected:
   Query: Does this provider have a credential file from a known locum agency? 
   (This is a manual flag for now — future integration with agency credential systems)
   
   Add a flag to the credentialing case: locumAgencyFileOnFile: boolean
   
   If locumAgencyFileOnFile === true:
     Skip full PSV bundle (mark as AGENCY_VERIFIED)
     Verify currency of: license status, OIG/LEIE, NPDB only (3 checks vs. 14)
     Route to: facility-specific privileging only
     TTS estimate: 7–21 days
     Surface to employer: "Locum tenens agency file detected. Fast-track pathway available. TTS: 7–21 days."

3. Add 'LOCUM_FAST_TRACK' route to the case routing engine.
   Log AuditEvent when fast-track route is chosen:
   action: 'LOCUM_FAST_TRACK_ACTIVATED', reason: 'Agency credential file on file'

CONSTRAINTS:
- TypeScript strict mode. Run: pnpm tsc --noEmit. Run: pnpm --filter @vitalcv/api build.
```

---

### C3 — CMS Preclusion List: Manual flag workflow

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/routes/`, `apps/api/backend/src/services/`, `apps/web/components/`  
**Effort:** ~6 hours  
**Dependency:** B1 (Organization model changes from B3 inform context)  

---

**CLAUDE CODE PROMPT:**

```
You are implementing a manual CMS Preclusion List check workflow in VitalCV.

BACKGROUND:
The CMS Preclusion List (42 CFR §§422.222, 423.120) is distinct from the OIG LEIE.
A provider can appear on the Preclusion List while showing CLEAR on LEIE (if they were
reinstated to OIG but have an active PECOS re-enrollment bar, or vice versa).
There is NO automated API for the CMS Preclusion List.

This is a manual check that must be performed every credentialing cycle.

TASK:
1. Add a new PSV source type 'CMS_PRECLUSION_LIST' to the psvContracts.ts PSVSource enum.

2. Add a manual review action type to the action catalog:
   {
     id: 'CHECK_CMS_PRECLUSION_LIST',
     title: 'Check CMS Preclusion List',
     owner: 'SYSTEM_MANUAL',  // performed by MSO staff, not automated
     trigger: 'Every credentialing cycle (initial + reappointment)',
     externalUrl: 'https://www.cms.gov/files/zip/preclusion-list.zip',
     complianceNote: '42 CFR §§422.222, 423.120. Distinct from LEIE.',
     estimatedDays: 1,
     notes: 'Download monthly CMS file. Search by NPI and name. Document result.',
   }

3. Add a manual input endpoint:
   POST /api/employer-review/:entityId/preclusion-check
   Body: {
     status: 'NOT_LISTED' | 'LISTED' | 'UNABLE_TO_VERIFY',
     checkedAt: string,  // ISO 8601
     checkedBy: string,  // staff member name/ID
     notes?: string,
   }
   - Creates a PSVCheckResult for CMS_PRECLUSION_LIST source
   - If status === 'LISTED': triggers HARD_BLOCK (same level as OIG exclusion)
   - If status === 'NOT_LISTED': creates PSV receipt, TTL = 30 days (monthly CMS file)
   - If status === 'UNABLE_TO_VERIFY': triggers REVIEW_REQUIRED
   - Writes AuditEvent in all cases: action = 'CMS_PRECLUSION_LIST_CHECKED'

4. Surface in the employer review packet:
   cms_preclusion_list: {
     status: 'NOT_LISTED' | 'LISTED' | 'NOT_CHECKED' | 'UNABLE_TO_VERIFY',
     lastCheckedAt: string | null,
     nextCheckDue: string | null,  // 30 days from last check
   }
   
   If status === 'NOT_CHECKED': surface prominent alert:
   "CMS Preclusion List not yet checked for this provider.
    Required per 42 CFR §422.222. Check monthly CMS file before activating privileges."

CONSTRAINTS:
- TypeScript strict mode. Run: pnpm --filter @vitalcv/api build. Run: pnpm tsc --noEmit.
- The AuditEvent write is mandatory — never skip it for this action.
```

---

### C4 — PECOS 855R: Employer-change reassignment detection

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/`, ingest pipeline  
**Effort:** ~4 hours  
**Dependency:** A7 (work history verification types should be complete)  

---

**CLAUDE CODE PROMPT:**

```
You are adding PECOS 855R reassignment detection to VitalCV.

BACKGROUND:
When a clinician changes employers, their Medicare enrollment does NOT automatically transfer.
A new CMS-855R (Reassignment of Benefits) must be filed with the Medicare Administrative
Contractor (MAC). Processing takes 30–60 days. Failing to file Day 1 means the new employer
cannot bill Medicare for that clinician's services until it clears — costing $7,000–$10,000/day.

TASK:
1. During NPI ingestion (POST /api/ingest/npi/:npi):
   After PECOS status check, detect: does this NPI have prior PECOS enrollment at a DIFFERENT group NPI than the current employer?
   
   Logic:
   if (pecos.status === 'ENROLLED' && pecos.groupNpi !== currentEmployer.groupNpi):
     emit action recommendation: 'FILE_PECOS_855R'
   
   The action:
   {
     id: 'FILE_PECOS_855R',
     title: 'File CMS-855R Medicare Reassignment',
     owner: 'BOTH',  // employer billing dept + clinician signature
     urgency: 'CRITICAL',
     trigger: 'Prior PECOS enrollment at different group NPI detected',
     externalUrl: 'https://pecos.cms.hhs.gov',
     estimatedDaysMin: 30,
     estimatedDaysMax: 60,
     revenueImpactNote: '$7,000–$10,000/day in forgone Medicare revenue until processed.',
     instructions: 'File with your MAC immediately. Do not wait for credentialing to complete.',
   }

2. Surface in employer review packet prominently:
   pecos_reassignment: {
     required: boolean,
     priorGroupNpi: string | null,
     currentGroupNpi: string | null,
     status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_REQUIRED',
     urgencyNote: string,
   }

3. If pecos_reassignment.required === true and status !== 'COMPLETED':
   Add to the case's critical path (highest priority action in the case queue).
   Surface as: "⚠️ PECOS 855R Required — File immediately to avoid Medicare billing gap."

CONSTRAINTS:
- If the current PECOS integration does not return group NPI, add a TODO comment
  and emit the 855R action based on: prior PECOS enrollment exists + employer is different
  from any previously recorded employer in the practitioner record.
- TypeScript strict mode. Run: pnpm --filter @vitalcv/api build.
```

---

### C5 — IMG/ECFMG: Pathway detection

**Executor:** Claude Code  
**Files:** `apps/api/backend/src/services/`, blocker taxonomy  
**Effort:** ~3 hours  
**Dependency:** None  

---

**CLAUDE CODE PROMPT:**

```
You are implementing IMG (International Medical Graduate) pathway detection in VitalCV.

BACKGROUND:
Approximately 25% of the U.S. physician pipeline are IMGs (medical school outside US/Canada).
IMGs require ECFMG (Educational Commission for Foreign Medical Graduates) certification.
When documents must be re-requested from foreign schools, ECFMG verification takes minimum
10 weeks. This is often the true critical path for IMG credentialing — not state licensure.
VitalCV currently has no IMG detection.

TASK:
1. Add IMG detection to the NPI ingestion pipeline:
   Signal: if practitioner.medicalSchool.country is not ('US' | 'CA') AND practitioner.role is MD/DO:
   → Mark practitioner.isImg = true
   
   If NPPES does not return medical school country in the NPI lookup, add it as a
   manually-confirmable field in the practitioner profile.

2. Add a new soft blocker MB-05:
   id: 'MB-05'
   type: 'SOFT'
   category: 'education'
   description: 'ECFMG certification not verified. Required for all International Medical Graduates (IMGs).'
   regulatoryBasis: 'NCQA CR 3: PSV of medical education required. ECFMG: required for IMGs by most state boards and hospitals.'
   owner: 'CLINICIAN'
   estimatedResolutionDaysMin: 10  // best case, documents on hand
   estimatedResolutionDaysMax: 120  // worst case, foreign institution must reissue
   crsImpact: 'CAP_AT_79'
   detectionLogic: 'practitioner.isImg === true AND ecfmg.verificationStatus !== VERIFIED'

3. Add an action 'INITIATE_ECFMG_VERIFICATION':
   {
     id: 'INITIATE_ECFMG_VERIFICATION',
     owner: 'CLINICIAN',
     trigger: 'isImg === true',
     externalUrl: 'https://www.ecfmg.org/certification/apply.html',
     estimatedDaysMin: 70,  // 10 weeks minimum
     estimatedDaysMax: 120,
     urgencyNote: 'Initiate ECFMG verification on Day 1. This is often the true critical path for IMG credentialing.',
   }

4. Update the TTS estimator: if isImg === true AND ecfmg.status !== VERIFIED:
   licenseTrackEstimate = MAX(existing estimate, 70 days)
   Show in passport: "Critical path: ECFMG verification (estimated 10–17 weeks)"

CONSTRAINTS:
- TypeScript strict mode. Run: pnpm --filter @vitalcv/api build. Run: pnpm tsc --noEmit.
- Add a test: IMG detection fires for practitioner.medicalSchool.country = 'PH'.
```

---

## Summary

| Wave | Task | Executor | Effort | Risk If Skipped |
|---|---|---|---|---|
| A | A1: NPDB 45-day threshold | Claude Code | 30 min | NCQA audit failure |
| A | A2: CAQH 120-day attestation | Claude Code | 1 hr | False clean CRS |
| A | A3: PSV window 120 days | Claude Code | 2 hr | NCQA 2025 non-compliant |
| A | A4: Monthly monitoring 30 days | Claude Code | 1 hr | CMS audit exposure |
| A | A5: LEIE exclusion gap disclosure | Claude Code + Cursor | 2 hr | Misleading CLEAR status |
| A | A6: DEA source disclosure | Claude Code | 3 hr | Compliance misrepresentation |
| A | A7: Legally-only → REVIEW_REQUIRED | Claude Code | 2 hr | Credentialing integrity failure |
| B | B1: StateRuleRegistry | Claude Code | 4 hr | Dependency for B2, B4, C1 |
| B | B2: MB-03/MB-04 blockers | Codex | 4 hr | NP/PA prescribing liability |
| B | B3: Committee cutoff tracking | Claude Code + Cursor | 6 hr | +30–90 day ISV slips |
| B | B4: NPDB CQ enrollment action | Claude Code | 3 hr | Monitoring gaps |
| B | B5: Nursys e-Notify action | Claude Code | 2 hr | License change blindspot |
| B | B6: Payor enrollment decoupling | Claude Code + Cursor | 5 hr | CRS confusion |
| C | C1: IMLC/eNLC routing | Claude Code | 4 hr | 60–180 days missed savings |
| C | C2: Locum fast-track | Claude Code | 3 hr | 30–60 days missed savings |
| C | C3: CMS Preclusion List manual | Claude Code | 6 hr | Medicare claim denials Day 1 |
| C | C4: PECOS 855R detection | Claude Code | 4 hr | $7–10K/day billing gap |
| C | C5: IMG/ECFMG detection | Claude Code | 3 hr | 70-day blind spot |

**Wave A total: ~11.5 hours — complete before any pilot demo.**  
**Wave B total: ~24 hours — complete before pilot customer onboarding.**  
**Wave C total: ~20 hours — complete before second pilot customer.**

---

*Generated 2026-04-22 by Claude Cowork — VitalCV Task Bundler Mode*  
*Source: CREDENTIALING_EXECUTION_VALIDATION_2026-04-22.md*
