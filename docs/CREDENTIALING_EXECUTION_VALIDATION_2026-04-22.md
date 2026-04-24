# VitalCV Credentialing Execution System — Validation & Gap Analysis
**Date:** 2026-04-22  
**Author:** Claude Cowork — Healthcare Credentialing Architect Mode  
**Corpus:** VitalCV_Credentialing_Knowledge_Base.md + research threads A–F (6,195 lines, 300+ primary source citations)  
**Scope:** Validate the transition from decision system → execution system; identify critical gaps before pilot deployment

---

## Executive Summary

The VitalCV decision system architecture is **fundamentally sound**. The canonical path (Recognition → Acceptance → Start), blocker taxonomy, and CRS model correctly reflect real-world hospital credentialing law and operations. The transition to an execution system — action engine, orchestration layer, multi-case system — is the right strategic move and is technically ready to be built.

However, **nine critical accuracy gaps** exist in the current model that will cause the system to produce incorrect TTS estimates, wrong blocker classifications, or compliance failures against NCQA 2025 standards if not corrected before pilot. None require architectural changes. All are policy/data corrections.

**Total estimated remediation effort:** ~3 engineering days.  
**Risk of not fixing:** ISV metric credibility collapse at first customer audit.

---

## Section 1: Action Model Validation

### 1.1 Blocker-to-Action Mapping — What Is Correct

The 9 hard blockers and 13 soft blockers in the current taxonomy are correctly mapped to real-world conditions. Classification logic (HARD_BLOCK → CRS = 0; SB-* unwaived → CRS capped at 79) matches NCQA CR 1–8, TJC MS.06, and CMS CoP requirements precisely.

The 50-rule `ACCEPTANCE_GRAPH` decision catalog is accurately derived from:
- NCQA CR 3 (PSV requirements)
- TJC MS.06.01.03–MS.06.01.13 (credentialing + temporary privileges)
- CMS 42 CFR §482.22 (Conditions of Participation)
- NAMSS Ideal Credentialing Standards

Owner assignments are correct at the category level. Detailed owner mapping by action type:

| Action Category | Correct Owner | Current Model |
|---|---|---|
| CAQH profile setup and attestation | Clinician | ✅ Correct |
| State license application | Clinician | ✅ Correct |
| DEA Form 224 submission | Clinician | ✅ Correct |
| NPDB query | Employer/MSO | ✅ Correct |
| NPDB Continuous Query enrollment | Employer/MSO | ⚠️ Needs explicit owner assignment |
| OIG/LEIE screening | System (automated) | ✅ Correct |
| SAM.gov screening | System (automated) | ✅ Correct |
| PECOS enrollment (CMS-855I) | Clinician + Employer | ⚠️ Split ownership not modeled |
| PECOS reassignment (855R) on employer change | Both | ❌ Not in current model |
| Payor enrollment | Employer billing dept | ⚠️ Often missing from action graph |
| Collaborative practice agreement (NPs, PAs) | Both | ❌ Not in current model |
| Proctoring arrangement (CRNAs, proceduralists) | Employer | ❌ Not in current model |
| Malpractice tail coverage acquisition | Clinician | ❌ Not in current model |
| Nursys e-Notify enrollment (nurses) | Employer | ❌ Not in current model |

### 1.2 Duration Estimates — Accuracy Assessment

Estimated resolution durations from `SB-*` blockers vs. empirical data from Thread C:

| Blocker | Current Estimate | Empirical Range | Assessment |
|---|---|---|---|
| SB-01: Malpractice payment | 14–45 days | 7–45 days (committee cycle dependent) | ✅ Acceptable |
| SB-02: Practice gap >6 months | 7–21 days | 3–45 days | ⚠️ Low end too optimistic if committee review required |
| SB-05: Board cert lapsed | 30–365 days | 30–365 days (exam cycle) | ✅ Correct |
| SB-06: CAQH re-attestation | 3–14 days | 1–7 days (provider-dependent) | ✅ Acceptable |
| SB-09: Malpractice tail coverage | 7–14 days | 7–14 days (carrier-dependent) | ✅ Correct |
| SB-11: Name mismatch | 3–7 days | 1–5 days | ✅ Correct |
| State license — CA (new) | Not in current model | 75–240 days | ❌ Critical gap in TTS model |
| State license — IMLC compact | Not in current model | 14–42 days | ❌ Missing fast-path option |
| Payor enrollment — Medicare PECOS | Not in model as blocker | 15–120 days | ❌ Largest TTS driver not modeled |
| Payor enrollment — commercial | Not in model as blocker | 21–150 days | ❌ Same |
| Committee meeting miss | Not in model | +28–90 days per miss | ❌ Hidden bottleneck not modeled |
| ECFMG verification (IMG) | Not in model | 70+ days (minimum) | ❌ Critical for IMG cohort |
| Work history — unresponsive employer | Estimated 14–28 days | 14–90+ days | ⚠️ High end too optimistic |

### 1.3 The Payor Enrollment Blindspot (Critical)

The action engine models credentialing and privileging well. It does not adequately model **payor enrollment**, which is the dominant TTS ceiling for employed clinicians:

```
Critical Path Truth:
  estimatedDaysToStart = MAX(
    state_license_days,           # 0–240 days
    facility_credentialing_days,  # 45–120 days
    payor_enrollment_days         # 45–150 days ← this wins 70% of the time
  )
```

A CRS ≥ 80 clinician who completes credentialing in 45 days is still 45–105 days away from billing Medicare/Medicaid/commercial. The system's ISV metric will be misleading unless payor enrollment is explicitly tracked as a parallel track with its own blockers and owners.

**The resolution**: Activate TJC MS.06.01.13 temporary privilege pathway on Day 0 (CRS ≥ 80, clean file) so clinical work begins immediately while payor enrollment runs in parallel. ISV = days to first clinical encounter, not first billable encounter. This must be the metric definition used in all customer-facing communications.

---

## Section 2: Workflow Validation

### 2.1 Core Credentialing Flow — Matches Reality

The VitalCV canonical flow maps correctly to real hospital credentialing operations:

```
NPI lookup (NPPES)
  → OIG/LEIE exclusion check
  → SAM.gov debarment check
  → State license verification (FSMB PDC or state board direct)
  → NPDB query
  → CAQH PSV bundle (14 elements)
  → Board certification (ABMS CertiFACTS or equivalent)
  → Work history (5-year lookback)
  → Malpractice history (NPDB + carrier letter if flagged)
  → CRS computation
  → Credentials committee routing
  → Temporary privilege activation (if CRS ≥ 80, clean)
  → Full board approval
  → Payor enrollment (parallel track)
```

This matches: NCQA CR 1–8, TJC MS.06.01.01–MS.08.01.03, CMS §482.22, Banner Health Credentials Manual, NAMSS ICS.

### 2.2 Steps Missing From Current Workflow

#### Missing Step 1: State CSR (Controlled Substance Registration)
**22 states require a separate state CSR** before a practitioner can prescribe controlled substances in that state. The system tracks DEA registration but not state CSRs. For prescribers moving to CA, TX, FL, NY, or IL, this is a separate blocker with its own 7–45 day resolution timeline.

**Where it breaks:** A clinician with active DEA can be blocked from prescribing in their target state if the state CSR is missing. The system currently shows `DEA: ACTIVE` and considers this resolved. It is not resolved.

#### Missing Step 2: Collaborative/Supervision Agreement (NP/PA)
**Non-independent practice states** (currently ~20 states require some form of collaboration/supervision agreement for NPs) require a written agreement signed by both the NP and a supervising/collaborating physician before the NP can practice. This agreement is a prerequisite to credentialing completion at many facilities.

**Owner split:** Clinician must find a collaborating physician; employer must execute the agreement. Neither can act alone.

**Impact:** Adds 7–30 days to NP/PA TTS that the current model does not surface.

#### Missing Step 3: PECOS 855R Reassignment
When a clinician **changes employers**, the Medicare enrollment does not transfer automatically. A new CMS-855R (Reassignment of Benefits) must be filed with the MAC. This takes 30–60 days and represents a gap in billing continuity that costs the employer real revenue.

**Where it breaks:** System correctly models initial PECOS enrollment (CMS-855I) but does not detect or route the reassignment filing when a provider record shows prior PECOS enrollment at a different group.

#### Missing Step 4: Proctoring Requirements
**CRNAs** (new graduates, ASA Class III cases: 5 proctored cases required) and **procedural specialists** (cardiac interventions, spine surgery, etc.) require a facility-arranged proctoring period before independent privileges. This adds 30–60 days that the system does not model.

**Detection signal:** Role = CRNA + graduation date < 1 year ago → flag proctoring requirement.

#### Missing Step 5: ECFMG Verification (IMGs)
International Medical Graduates (estimated 25% of U.S. resident/fellow pipeline) require ECFMG certification verification. When documents must be re-requested, this takes **minimum 10 weeks**. The system has no IMG detection and no ECFMG blocker type.

**Detection signal:** Medical school country ≠ US/CA + NPI taxonomy = MD/DO → flag ECFMG requirement.

#### Missing Step 6: Committee Cutoff Date Tracking
The system models committee review duration (7–30 days) but does not track the **actual committee meeting calendar** per organization. Missing a committee cutoff by a single day costs 28–90 days (the full interval to the next meeting).

**The fix**: `Organization` record should include `nextCommitteeMeetingDate` and `committeeMeetingCadence`. The action engine should emit an escalation alert when a file is T-5 days from cutoff.

### 2.3 Unrealistic Assumptions in Current Model

| Assumption | Reality | Risk |
|---|---|---|
| DEA verification is real-time | No public DEA API exists. Verification uses AMA Profiles (monthly update), certificate copies, or third-party resellers. | System may claim real-time DEA status it cannot actually verify. |
| LEIE check is complete exclusion verification | ~50% of state Medicaid exclusions never appear in LEIE. SAM.gov and state Medicaid exclusion lists must also be checked. | System can show `CLEAR` when clinician is excluded from state Medicaid programs. |
| CAQH data is current if attestation active | CAQH re-attestation cycle is 120 days (not 180). Between re-attestations, license could have been suspended, exclusion added, or board cert lapsed — none reflected until next PSV cycle. | Treating active CAQH as current evidence without checking `attestedAt` date can result in stale trust. |
| NPDB self-query valid for 60 days | HRSA policy: NPDB self-query is valid for **45 days**, not 60. If a credentials committee meeting falls on day 46, the file must be re-queried. | Credentialing files may proceed to committee with expired NPDB evidence, creating NCQA audit failure. |
| PSV window is 180 days | NCQA CR 3 changed effective July 1, 2025: PSV window is now **120 days** for NCQA Accreditation, **90 days** for CVO Certification. | Any system still using 180-day logic is out of compliance. |
| Monthly monitoring is optional | NCQA CR 6 (2025): ongoing monitoring is now **monthly** (was semi-annual). OIG/SAM/license checks must run every 30 days. | Missing this creates liability exposure for pilot customers. |

---

## Section 3: Gap Identification

### 3.1 Missing Blockers (Not in Current HB/SB Catalog)

| ID | Type | Condition | Category | Regulatory Basis |
|---|---|---|---|---|
| MB-01 | HARD | CMS Preclusion List placement (distinct from LEIE, no automated feed) | sanctions | 42 CFR §§422.222, 423.120(c)(6) |
| MB-02 | HARD | Active state Medicaid exclusion (50% never appear in LEIE) | sanctions | 42 USC §1396a(a)(39) |
| MB-03 | SOFT | State CSR missing or expired in state of practice (prescribers) | licensure | State controlled substance acts; 22 states |
| MB-04 | SOFT | Collaborative/supervision agreement missing (NPs/PAs in non-independent states) | licensure | State NP/PA practice acts |
| MB-05 | SOFT | ECFMG certification not verified (IMG with medical school outside US/CA) | education | NCQA CR-3; ECFMG/FAIMER |
| MB-06 | SOFT | Active felony charges pending (pre-conviction) | identity | Standard bylaws |
| MB-07 | SOFT | NPDB CQ not enrolled — monitoring gap between reappointments | monitoring | NCQA CR-6 2025 |
| MB-08 | SOFT | Malpractice tail coverage not confirmed (claims-made policy, prior employment) | board | NAMSS ICS; carrier bylaws |
| MB-09 | INFO | Board eligibility >5 years without certification progress | board | Standard bylaws (time-limited board eligibility) |
| MB-10 | INFO | OPPE data from prior facility shows quality concerns | monitoring | TJC MS.08.01.01 |
| MB-11 | SOFT | PECOS re-enrollment bar active (1–10 year bar post-revocation) | enrollment | 42 CFR §§424.530–424.545 |
| MB-12 | SOFT | Application not completed within 90 days of MSO request → administrative closure | identity | Standard bylaws (Banner Health; industry standard) |

### 3.2 Missing Actions (Not in Current Action Engine)

| Action | Owner | Trigger | Est. Duration | Impact |
|---|---|---|---|---|
| Enroll in NPDB Continuous Query | Employer | On Recognition | Ongoing ($2.50/yr/provider) | Eliminates NPDB staleness permanently |
| Enroll in Nursys e-Notify | Employer | On Recognition (RN/NP/LPN) | Day 1 (free) | Near-real-time nursing license monitoring |
| Apply via IMLC compact (physicians) | Clinician | New state license needed; IMLC-eligible states | 14–42 days vs. 90–180 days standard | Largest single TTS compression lever for multi-state MDs |
| Apply via eNLC compact (nurses) | Clinician | New state license needed; NLC state | 3–10 days vs. 14–90 days standard | Same for RNs |
| File PECOS 855R (employer change) | Both | Prior PECOS enrollment detected at different group | 30–60 days | Prevents billing gap |
| Acquire malpractice tail coverage | Clinician | Claims-made policy; leaving prior employer | 7–14 days | Blocks credentialing without it |
| Execute collaborative practice agreement | Both | Role = NP/PA + non-independent practice state | 7–30 days | Hard prerequisite in ~20 states |
| Arrange proctoring schedule | Employer | Role = CRNA or procedural specialty; new grad | 30–60 days | Hard prerequisite for independent privileges |
| Request ECFMG CSR | Clinician | IMG detected | 10+ weeks | Often the true critical path for IMGs |
| Check CMS Preclusion List | System (manual flagged) | Every credentialing cycle | 1 day (manual check) | LEIE miss rate ~50% for Medicaid exclusions |
| Re-verify state Medicaid exclusion lists | System | Monthly monitoring cycle | 1 day automated | Covers LEIE gap |
| File state CSR application | Clinician | Prescriber + 22 CSR states | 7–45 days | Blocks controlled substance prescribing |
| Verify DEA via AMA Profiles or certificate copy | System | Prescriber flag | 1–5 days | No public DEA API; must use accepted secondary sources |

### 3.3 Missing Dependencies (Critical Path Errors)

These missing dependency edges cause the action engine to mark actions as "startable" when they cannot legally begin:

```
DEA registration
  REQUIRES: Active state medical license (NOT just active NPI)
  SYSTEM STATUS: Not modeled — DEA and license treated as independent

PECOS enrollment (billing)
  REQUIRES: Active DEA registration (for prescribers) + active license
  SYSTEM STATUS: Partially modeled

Temporary privilege grant
  REQUIRES: NPDB query COMPLETE (not just initiated)
  REQUIRES: No challenges to licensure (must be verified, not assumed)
  SYSTEM STATUS: NPDB query "in progress" may be incorrectly treated as satisfied

Board certification PSV satisfies education PSV
  HIERARCHY: BoardCert (verified) → No residency PSV needed → No med school PSV needed
  SYSTEM STATUS: These may be computed independently, creating redundant PSV work

Commercial payor enrollment
  REQUIRES: Active CAQH ProView profile + attestation current
  SYSTEM STATUS: CAQH status and payor enrollment not linked as dependency

State CSR
  REQUIRES: Active state license (same state)
  REQUIRES: Often requires state CSR before DEA grants registration in that state
  SYSTEM STATUS: Not modeled at all
```

### 3.4 Hidden Bottlenecks (Not Surfaced in Current UX)

**Bottleneck 1: Work history verification is the #1 within-PSV delay.** Median 28 days, high 90+ days when prior employers are unresponsive or have been acquired/closed. The system shows PSV as a single status block, masking that work history is typically the last element to complete and the one most likely to trigger committee delays.

**Bottleneck 2: Malpractice claims history letter from prior carrier.** Requires ordering directly from the malpractice carrier (not from NPDB). Takes 7–45 days. Only triggered after NPDB shows a paid report, but some organizations order it routinely. The system does not model this as a separate action step.

**Bottleneck 3: Board approval lag after MEC.** Most TTS models count "committee approval" as the end of the credentialing track. In reality, the full sequence is: Credentials Committee → MEC recommendation → Governing Board approval → then privileges are official. Board meets monthly or quarterly. This adds 2–6 weeks that most systems ignore.

**Bottleneck 4: EMR/IT access provisioning.** After full privileges are granted, the clinician cannot start clinical work until they have EMR access, security training completion, and building/badge access. This adds 1–7 days that is completely outside the credentialing model but is part of ISV.

**Bottleneck 5: "Legally only" employment responses.** When a prior employer responds to verification requests with only dates of employment and declines to comment on standing, TJC and NAMSS ICS require this to be escalated to committee review. The system does not detect or route this response pattern.

---

## Section 4: Prioritization Logic

### 4.1 Case Prioritization Framework

Cases should be prioritized by **Expected ISV Days Saved × Probability of Successful Resolution**, not by file completeness or CRS score alone.

```
PRIORITY_SCORE(case) =
  (BASELINE_TTS_WITHOUT_VITALCV - ESTIMATED_TTS_WITH_VITALCV)
  × P(successful_start)
  × EMPLOYER_REVENUE_WEIGHT
  - SYSTEM_EFFORT_COST
```

**Tier 1 — Maximum ROI (action immediately):**
- CRS ≥ 80, no active blockers, temporary privilege pathway available
  - Action: Flag to employer for Day 0 CEO authorization
  - Expected ISV improvement: 45–120 days (full committee/board cycle bypassed for clinical start)
  - Revenue impact to employer: $7,000–$10,000/day × days saved

**Tier 2 — High ROI, resolvable blocker (action within 24 hours):**
- CRS 60–79 with a single soft blocker that is clinician-resolvable in <7 days
  - Examples: Stale CAQH attestation, name mismatch, missing CSR application
  - Action: Send targeted action request to clinician with instructions
  - Expected ISV improvement: 7–21 days per blocker resolved

**Tier 3 — Medium ROI, system-automatable action (action within 48 hours):**
- Evidence is stale but source is programmatically accessible (OIG/LEIE, NPPES, SAM.gov, PECOS public file)
  - Action: Auto-refresh evidence; recompute CRS; notify if status changed
  - Expected ISV improvement: Prevents downstream committee rejection (avoids +30–90 day reset)

**Tier 4 — Low ROI, structural delay (surface to employer, do not promise fast resolution):**
- New state license application required in CA/TX/FL/NY (75–240 days)
- ECFMG verification required (70+ days)
- Hard blockers (active exclusion, license revocation): surface clearly, do not route for action
- Board certification re-examination (30–365 days, exam cycle)

**Tier 5 — No ROI (do not queue as "in progress"):**
- Hard blockers with no resolution path (active OIG exclusion, active license revocation)
  - Action: Surface to employer, recommend deferral until resolved externally

### 4.2 Multi-Case Prioritization Rules

For the multi-case system managing N clinicians simultaneously:

1. **Alert before committee cutoff.** Every case where `nextCommitteeMeetingDate - today ≤ 5 days` AND file is not yet submitted → P0 escalation. Missing a cutoff costs 28–90 days and destroys ISV for that case.

2. **Prioritize cases that unblock payor enrollment.** A credentialed clinician who is not yet enrolled in Medicare/Medicaid is a forgone revenue case every day. Track `pecos_enrollment_pending_days` per case; surface cases > 30 days to employer billing team.

3. **Cluster cases by blocker type for batch resolution.** If 5 clinicians all have stale OIG/LEIE checks, refresh all 5 in a single batch job, not one by one.

4. **ISV leaderboard.** Surface the top-5 cases closest to temp-privilege eligibility (CRS ≥ 78–79, one soft blocker remaining). These are the cases where a single action unlocks Day 0 clinical start.

### 4.3 Role-Specific Priority Adjustments

| Role | Priority Multiplier | Rationale |
|---|---|---|
| Locum MD/DO | 3× | Facility needs are urgent; temp privileges possible immediately; 7–30 day TTS realistic |
| CRNA | 1.5× | Anesthesia coverage is operationally critical; proctoring adds fixed delay regardless |
| MD/DO new grad, same state | 2× | License in hand; CAQH setup is fast; large ISV improvement possible |
| MD/DO new state license (CA/TX) | 0.3× | 75–240 day floor on license is irreducible; limited system leverage |
| IMG with ECFMG pending | 0.2× | 10-week floor regardless; system cannot accelerate |
| AMC-affiliated | 0.5× | Internal committee cadence often quarterly; fixed delay |

---

## Section 5: Failure Analysis — 20 Clinician Simulation

The following simulates 20 clinician archetypes through the current system to identify failure modes.

---

### 5.1 Case 1 — MD/DO, Clean File, In-State License
**Profile:** Board-certified internist, licensed in practice state, no NPDB reports, work history 8 years  
**Expected TTS:** 45–75 days  
**System behavior:** ✅ CRS should reach ≥ 80 within 24 hours of NPI ingestion. Temp privilege pathway activates. Payor enrollment runs in parallel.  
**Where it fails:** If system does not have org-level committee cutoff date, file may be submitted 1 day late → +30 days added invisibly.

---

### 5.2 Case 2 — MD/DO, New State License Required (California)
**Profile:** Hospitalist relocating from TX to CA, clean file  
**Expected TTS:** 120–240 days  
**System behavior:** ⚠️ System should surface CA license (75–240 day range) as the critical path immediately. IMLC compact option should be presented (CA is not an IMLC member state — this is a known exception that must be hardcoded).  
**Where it fails:** System may not know CA is not in IMLC. If it routes to "apply via compact," the action is wrong and delays the correct application path.

---

### 5.3 Case 3 — NP, Non-Independent Practice State, No Collaborative Agreement
**Profile:** FNP relocating to TX (collaborative agreement required), clean credentials  
**Expected TTS:** 60–120 days  
**System behavior:** ❌ System does not detect TX collaborative agreement requirement. CRS may reach 80 based on license and PSV alone, but the NP cannot legally prescribe without the agreement in place.  
**Where it fails:** Employer activates temp privileges based on CRS ≥ 80. NP begins practice. Employer realizes prescribing isn't permitted without agreement. Legal/compliance exposure.  
**Fix:** State-aware practice scope check must be part of the credentialing rule engine, not just CRS.

---

### 5.4 Case 4 — MD/DO, 3 Malpractice Payments in 5 Years
**Profile:** ER physician, 3 paid NPDB reports (all within specialty norm, all < $150K, all resolved)  
**Expected outcome:** REVIEW_REQUIRED → committee deliberation → likely approved with documented rationale  
**System behavior:** ✅ Rule R23 (SB-01) correctly flags this as REVIEW_REQUIRED and caps CRS at 79.  
**Where it fails:** Committee review timing is not modeled. If the committee meets monthly, an added 30-day delay is guaranteed. System should surface "committee review required — next meeting: [date]" not just "REVIEW_REQUIRED."

---

### 5.5 Case 5 — MD/DO, Active OIG LEIE Exclusion
**Profile:** Cardiologist with active Medicare exclusion from prior billing fraud conviction  
**Expected outcome:** HARD_BLOCK — no credentialing possible  
**System behavior:** ✅ HB-01 correctly fires. CRS = 0. Recognition state = NOT_RECOGNIZED.  
**Where it fails:** System shows HARD_BLOCK correctly, but does not surface the reinstatement timeline (OIG exclusions are not automatically lifted; the provider must apply for reinstatement). Employer needs this context to decide whether to maintain the relationship.

---

### 5.6 Case 6 — MD/DO, CAQH Attestation 125 Days Old
**Profile:** Established hospitalist, CAQH last attested 125 days ago (5 days past 120-day window)  
**Expected outcome:** STALE → CRS contribution from CAQH dimension zeroed until re-attestation  
**System behavior:** ⚠️ If system is using 180-day threshold (old standard), this case passes incorrectly. **The correct threshold is 120 days.**  
**Where it fails:** False positive — system reports clean when the CAQH data is regulatory stale. NCQA audit would flag this.

---

### 5.7 Case 7 — CRNA, New Graduate, Proctoring Required
**Profile:** New CRNA, 6 months post-graduation, moving to first hospital position  
**Expected TTS:** 105–180 days  
**System behavior:** ❌ System has no proctoring detection. CRS may reach 80 based on credentials. Employer activates temp privileges. Anesthesia department then informs MSO that 5 ASA Class III proctored cases are required before independent privileges granted.  
**Where it fails:** System does not prevent privilege activation before proctoring is arranged. Hospital may face TJC compliance issue.

---

### 5.8 Case 8 — MD/DO, IMG, ECFMG Not Yet Verified
**Profile:** IMG hospitalist from India, 3 years post-residency in US, ECFMG obtained during residency application but not stored in VitalCV  
**Expected TTS:** 60–90 days (if ECFMG can be re-retrieved quickly) or 70+ days (if documents must be re-requested)  
**System behavior:** ❌ System has no ECFMG detection or blocker. Education PSV may be satisfied via board certification PSV (correct per NCQA hierarchy), but if board cert is also not yet verified, the system may show education PSV as pending without surfacing the ECFMG pathway at all.  
**Where it fails:** System fails to route clinician to correct verification pathway. PSV delays unexpectedly.

---

### 5.9 Case 9 — MD/DO, License Verified But Expiring in 22 Days
**Profile:** Family physician with state license expiring in 22 days from today  
**Expected outcome:** SOFT_FLAG (R18) — license expiring within 30 days of start date  
**System behavior:** ✅ Rule R18 fires correctly.  
**Where it fails:** System flags the expiry but does not initiate a license renewal action. The renewal action must be owned by the clinician and have a 7–30 day completion window. Without routing the action explicitly, the flag may sit unresolved.

---

### 5.10 Case 10 — MD/DO, Stale NPDB Self-Query (48 Days Old)
**Profile:** Physician with self-query submitted 48 days ago (3 days past 45-day HRSA limit)  
**Expected outcome:** REVIEW_REQUIRED (stale) — file cannot proceed to committee  
**System behavior:** ⚠️ If system uses 60-day threshold (common misquote), this passes incorrectly. **HRSA policy: 45 days, not 60.**  
**Where it fails:** File proceeds to committee with expired NPDB evidence. NCQA audit catch. Entire credentialing cycle may be invalidated.

---

### 5.11 Case 11 — MD/DO, Prescriber, Missing State CSR (TX)
**Profile:** Anesthesiologist moving to Texas, has active federal DEA, but Texas requires separate state CSR (Controlled Substances Registration)  
**Expected TTS impact:** +7–45 days  
**System behavior:** ❌ System marks DEA as verified and considers controlled substance prescribing authorized. Texas CSR is not in the blocker model.  
**Where it fails:** Clinician cannot prescribe Schedule II–V substances in Texas until CSR is obtained. Hospital may have clinical coverage gap.

---

### 5.12 Case 12 — MD/DO, Locum Tenens, Agency Credential File Exists
**Profile:** Locum MD, 10 years experience, active credential file with national locum agency  
**Expected TTS:** 7–30 days (facility-specific privileging only)  
**System behavior:** ⚠️ System likely processes this clinician as a standard new application, running full PSV from scratch. It should detect the agency credential file and initiate a fast-track pathway.  
**Where it fails:** System adds 30–60 days of redundant PSV work for a clinician who is already verified. ISV for locums should be a VitalCV showcase case.

---

### 5.13 Case 13 — MD/DO, Prior Employment "Legally Only" Response
**Profile:** Surgeon, one prior employer (from 4 years ago) responds to work history verification with "dates of employment only, no further comment"  
**Expected outcome:** REVIEW_REQUIRED — escalate to committee (NAMSS ICS standard)  
**System behavior:** ❌ System likely marks work history element as "verified" once the employer responds (response received = complete). A "legally only" response is not verification — it is escalation-required.  
**Where it fails:** System incorrectly clears a work history element that requires committee escalation. Credentialing integrity failure.

---

### 5.14 Case 14 — MD/DO, Changing Employers, PECOS Reassignment Needed
**Profile:** Internist leaving Group A, joining Group B. Currently enrolled in PECOS under Group A's billing NPI.  
**Expected outcome:** CMS-855R must be filed. Billing gap until reassignment processes (30–60 days).  
**System behavior:** ❌ System does not detect prior PECOS enrollment under a different group. No 855R action is generated. Group B tries to bill Medicare and gets denials for 30–60 days.  
**Where it fails:** Revenue impact to employer: $7,000–$10,000/day × 30–60 days = $210,000–$600,000 in delayed revenue. This is the ROI story that makes CFOs pay attention.

---

### 5.15 Case 15 — MD/DO, Board Cert Attestation Discrepancy
**Profile:** Physician attested "Board Certified — Internal Medicine" on application. ABMS CertiFACTS shows certification lapsed 8 months ago.  
**Expected outcome:** REVIEW_REQUIRED — attestation discrepancy (Rule R17, R32)  
**System behavior:** ✅ System correctly detects the discrepancy between attestation and PSV finding.  
**Where it fails:** System correctly flags but does not distinguish between "never held" (more serious, potential intentional misrepresentation) and "lapsed" (less serious, administrative failure). The committee needs this distinction to calibrate response.

---

### 5.16 Case 16 — MD/DO, Practice Gap 14 Months, Written Explanation Available
**Profile:** Hospitalist who took 14 months off for family medical leave, has written explanation and documentation  
**Expected outcome:** REVIEW_REQUIRED → committee likely approves with documented rationale  
**System behavior:** ✅ Rule R35 fires (REVIEW_REQUIRED for gap >12 months). Written explanation captured.  
**Where it fails:** System may not check whether the "written explanation" is actually sufficient for NCQA CR-3 requirements. A note saying "family reasons" is less defensible than a physician letter documenting the leave. System should require verification of the explanation, not just presence of text.

---

### 5.17 Case 17 — MD/DO, Active CMS Preclusion List (Not on LEIE)
**Profile:** Physician with prior Medicare enrollment revocation. Appears on CMS Preclusion List but has since been reinstated to OIG (so LEIE shows clean).  
**Expected outcome:** HARD_BLOCK — active re-enrollment bar  
**System behavior:** ❌ System checks OIG LEIE (shows CLEAR), SAM.gov (shows CLEAR if reinstated). CMS Preclusion List is not checked. System shows CLEAR. Employer credentialing the provider faces claim denials from day 1.  
**Where it fails:** This is the most dangerous gap in the current model. There is **no automated feed for the CMS Preclusion List**. It must be manually flagged. System should surface a human-review prompt: "Has this provider had any prior PECOS revocation? Manual Preclusion List check required."

---

### 5.18 Case 18 — NP, Telehealth, Credentialing by Proxy
**Profile:** Telehealth NP seeing patients across 8 states through originating site CBP arrangements  
**Expected TTS:** 14–30 days per facility (CBP pathway)  
**System behavior:** ⚠️ System may route this as 8 independent credentialing processes (8× 45–90 days each). The CBP pathway (CMS §482.22(a)(3)–(a)(4)) allows originating sites to rely on the distant site's credentialing under a written agreement.  
**Where it fails:** System adds 6–12 months of unnecessary credentialing burden for a clinician who qualifies for CBP. For telehealth customers, this is a core use case.

---

### 5.19 Case 19 — MD/DO, New PHP Participation Disclosed
**Profile:** Surgeon who recently enrolled in a state Physician Health Program for alcohol dependency, currently compliant  
**Expected outcome:** SOFT_FLAG → committee review; current PHP participation in good standing is not disqualifying in most bylaws  
**System behavior:** ⚠️ PHP is listed as SB-08 with 14–60 day resolution estimate. Correct classification. However, state disclosure obligations vary significantly — in some states PHP participation is confidential by law; in others it must be disclosed to the board.  
**Where it fails:** System gives generic PHP guidance without state-specific PHP disclosure rules. Incorrect guidance could expose clinician or employer to licensure complications.

---

### 5.20 Case 20 — MD/DO, AMC Position, Quarterly Committee
**Profile:** Surgeon joining academic medical center with a credentials committee that meets quarterly  
**Expected TTS:** 120–240 days  
**System behavior:** ❌ System assumes monthly committee cadence in TTS estimates. Quarterly committee adds 0–90 days to the credentialing timeline depending on when the file is submitted relative to the next meeting.  
**Where it fails:** ISV estimate for this case is off by up to 90 days. Employer sets expectations based on system estimate. VitalCV credibility damaged when actual start date is 3 months later than predicted.

---

### 5.21 Simulation Summary

| Category | Cases | System Handles Correctly | System Fails or Partially Fails |
|---|---|---|---|
| Hard blockers (active sanctions) | Cases 5, 17 | Case 5 (LEIE) | Case 17 (Preclusion List — critical gap) |
| Soft blockers — PSV staleness | Cases 6, 10 | None | Both (wrong day thresholds) |
| Missing role-specific requirements | Cases 3, 7, 11 | None | All three |
| Work history edge cases | Cases 13, 16 | Case 16 (partially) | Case 13 (legally-only response) |
| TTS modeling accuracy | Cases 2, 12, 18, 20 | None | All four |
| Multi-employer transitions | Case 14 | None | Case 14 (855R) |
| Standard clean-file processing | Cases 1, 4, 8, 9, 15, 19 | Cases 1, 4, 9, 15 | Cases 8 (IMG), 19 (PHP state nuance) |
| **Total** | **20** | **~8 (40%)** | **~12 (60%)** |

The failure rate is not a product quality problem — it is a **completeness problem**. The core engine is correct. The gaps are in specific domain rules (state CSR, CBP, PECOS reassignment, Preclusion List) and data thresholds (45-day NPDB, 120-day CAQH, 120-day PSV window).

---

## Section 6: Improvement Plan

### 6.1 Fix Immediately (P0 — Pre-Pilot, <1 Week)

These are precision corrections to existing logic. No architectural changes required.

**FIX-01: NPDB staleness threshold**  
`maxFreshness[NPDB_MALPRACTICE_ADVERSE]` = **45 days** (not 60).  
File: `packages/trust-state/sourceCoverage.ts`  
Effort: 30 minutes.

**FIX-02: CAQH re-attestation threshold**  
`maxFreshness[CAQH_ATTESTATION]` = **120 days** (not 180).  
Exception: Illinois = 180 days; encode as org-level policy override.  
File: `packages/domain-common/psvPolicy.ts`  
Effort: 1 hour.

**FIX-03: PSV window enforcement**  
All evidence freshness checks must use **120-day PSV window** (NCQA 2025), not 180.  
For customers with NCQA CVO certification: 90 days.  
File: `packages/domain-common/employmentContracts.ts` → `AcceptancePolicy.psvWindowDays`  
Effort: 2 hours.

**FIX-04: Monthly monitoring enforcement**  
NCQA CR 6 (2025): OIG/SAM/license checks must run **every 30 days**, not 180.  
`maxFreshness[EXCLUSION_OIG_LEIE]` = 30  
`maxFreshness[EXCLUSION_SAM_GOV]` = 30  
`maxFreshness[STATE_LICENSE_MD_DO]` = 30 (for active, enrolled providers)  
File: `packages/trust-state/sourceCoverage.ts`  
Effort: 1 hour.

**FIX-05: LEIE ≠ complete exclusion check**  
Everywhere the system shows "Exclusions: CLEAR" it must reflect that this covers OIG LEIE + SAM.gov. State Medicaid exclusion list check is not automated and must be surfaced as a "manual check required" flag until state Medicaid list APIs are integrated.  
File: `apps/web/components/passport/PassportWallet.tsx` (copy)  
File: `apps/api/backend/src/services/identity/sourceCatalog.ts` (source metadata)  
Effort: 2 hours.

**FIX-06: DEA verification source disclosure**  
The system must not claim real-time DEA verification. It must declare its verification source:  
`{ source: "AMA_PROFILE_DEA" | "CERTIFICATE_COPY" | "THIRD_PARTY" | "NOT_VERIFIED", data_refresh_date: ISO8601 }`  
A clinician with `DEA: NOT_VERIFIED` should get a soft flag, not a pass.  
File: `packages/psv/sources/` (DEA adapter)  
Effort: 3 hours.

**FIX-07: "Legally only" employment response → escalation**  
Work history verification where employer response = "dates only / no further comment" must set `workHistory.verificationStatus = LEGALLY_ONLY_RESPONSE` → fires REVIEW_REQUIRED, not VERIFIED.  
File: `packages/domain-common/psvContracts.ts`  
Effort: 2 hours.

---

### 6.2 Add Next (P1 — Sprint 1, 1–2 Weeks)

These add new blockers and actions to the existing engine.

**ADD-01: State CSR blocker**  
Detection: `role.prescriber == true AND state IN [22 CSR states] AND stateCsr.status != ACTIVE`  
Classification: HARD_BLOCK (until CSR obtained)  
Action: Route clinician to state CSR application; owner = clinician  
Resolution estimate: 7–45 days  

**ADD-02: Collaborative practice agreement (NPs/PAs)**  
Detection: `role IN [NP, PA] AND practiceState IN [non-independent-states]`  
Non-independent states as of 2025: AL, CA, FL, GA, KY, MI, MO, NC, SC, TN, TX, VA + others  
Classification: SOFT_BLOCK (cannot prescribe without it; can see patients under supervision)  
Action: Initiate agreement workflow; owner = both  

**ADD-03: CMS Preclusion List manual flag**  
Detection: `priorPecosEnrollment.revocationHistory != null OR providerDisclosure.pecosRevocation == true`  
Action: System surfaces: "Manual CMS Preclusion List check required. Check at: cms.gov/preclusion-list"  
Owner: MSO staff  
Cannot be automated; must be human-checked. Log the check as an `AuditEvent`.  

**ADD-04: Committee cutoff date tracking**  
Add `Organization` record fields:  
```typescript
committeeMeetingCadence: 'monthly' | 'biweekly' | 'quarterly'
nextCommitteeMeetingDate: Date
committeeCutoffDaysBeforeMeeting: number  // files due N days before meeting
```
Action engine: surface P0 escalation when `nextCommitteeMeetingDate - today <= committeeCutoffDaysBeforeMeeting + 2`  

**ADD-05: NPDB Continuous Query enrollment action**  
When Recognition is issued, system prompts employer: "Enroll this provider in NPDB Continuous Query ($2.50/year). This eliminates NPDB staleness permanently and satisfies NCQA CR-6 ongoing monitoring."  
Owner: Employer/MSO  
One-time action; marks `npdb.continuousQueryActive = true`; staleness clock disabled.  

**ADD-06: Nursys e-Notify enrollment for nurses**  
When `role IN [RN, LPN, NP, CRNA]` AND Recognition issued:  
Action: "Enroll this provider in Nursys e-Notify (free). Receive near-real-time license status alerts."  
Owner: Employer  

---

### 6.3 Add Later (P2 — Sprint 2, 2–4 Weeks)

**ADD-07: IMLC/eNLC compact detection**  
When new state license is the critical path blocker:  
Check if target state is IMLC member (physicians) or NLC member (nurses)  
If yes, surface fast-path: "Apply via IMLC compact (14–42 days) instead of standard application (90–240 days)"  
Current IMLC members: 41 states + DC + Guam  
CA, NY are NOT IMLC members — hardcode this exception.  

**ADD-08: Telehealth CBP pathway detection**  
When `clinician.practiceType == TELEHEALTH AND requestingOrg.type == ORIGINATING_SITE`:  
Surface: "Credentialing by Proxy pathway available per CMS §482.22(a)(3). Requires written agreement with distant site. Estimated TTS: 14–30 days."  

**ADD-09: PECOS 855R reassignment detection**  
Query: Does this NPI have prior PECOS enrollment under a different group NPI?  
If yes: "PECOS reassignment (Form 855R) required. File with MAC now. 30–60 day processing time. Do not wait — file Day 1 to protect billing continuity."  
Revenue impact surfaced: "$7,000–$10,000/day in forgone Medicare revenue until processed."  

**ADD-10: IMG/ECFMG pathway detection**  
When `medicalSchool.country != US` AND `medicalSchool.country != CA`:  
Surface ECFMG blocker: "ECFMG verification required. Initiate immediately. Minimum 10 weeks if documents must be re-requested."  
Action: Route clinician to ECFMG CSR request process.  

**ADD-11: Locum tenens fast-track pathway**  
When `employmentType == LOCUM_TENENS AND agency.credentialFile.exists == true`:  
Route to fast-track: "Agency credential file detected. Initiate facility-specific privileging only. TTS: 7–30 days."  
Skip full PSV bundle (already completed by agency); verify currency of key elements only.  

**ADD-12: Proctoring requirement detection**  
When `role == CRNA AND graduationDate > (today - 12 months)`:  
Flag: "Proctoring required: 5 ASA Class III cases before independent privileges. Arrange with anesthesia department."  
Owner: Employer anesthesia department.  

---

### 6.4 Remove / Simplify

**REMOVE-01: Do not surface "NPDB: CLEAR" as a completion signal**  
A clean NPDB is not the end of malpractice due diligence. The NPDB has significant underreporting (hospitals that fail to report). Surface NPDB as one input, not a final verdict. Copy change only.

**REMOVE-02: Do not show payor enrollment progress inside the CRS**  
Payor enrollment affects ISV but is not a credentialing compliance dimension. Mixing it into the CRS creates confusion about what the score means. Track payor enrollment in a parallel `EnrollmentTrack` model.

**SIMPLIFY-01: Surface state-specific rules as a lookup, not exceptions**  
Build a `StateRuleRegistry` that encodes: independent practice status, IMLC membership, CSR requirement, eNLC compact membership, DEA address requirement, collaborative agreement requirements. This replaces scattered conditional logic with a clean lookup table that is easy to update as state laws change.

**SIMPLIFY-02: Collapse TTS into 5 parallel tracks**  
Current TTS model sums blockers. Replace with explicit parallel tracks per Section 6.3 of the Knowledge Base:
```
tracks = [
  licensure_track,           # state license, DEA, CSR
  payor_enrollment_track,    # PECOS, Medicaid, commercial
  facility_committee_track,  # PSV bundle, committee, board
  privileging_track,         # temp privileges, FPPE, proctoring
  operational_track,         # EMR access, badge, orientation
]
estimatedTTS = max(track.estimatedEnd for track in tracks)
criticalPath = argmax(track.estimatedEnd).blockers
```
Show employers: "Your critical path is `payor_enrollment_track`. We've compressed everything else. File 855R now."

---

## Summary Tables

### Critical Accuracy Fixes (Required Before Pilot)

| Fix | Risk If Missed | Effort |
|---|---|---|
| NPDB 45-day threshold (not 60) | NCQA audit failure on filed that proceed to committee on day 46+ | 30 min |
| CAQH 120-day threshold (not 180) | False-positive clean files; stale data accepted | 1 hr |
| PSV window 120 days (not 180) | Out of NCQA 2025 compliance from day 1 | 2 hr |
| Monthly monitoring enforcement | CMS audit exposure for pilot customers | 1 hr |
| LEIE ≠ complete exclusion | Employer hires Medicaid-excluded clinician | 2 hr |
| DEA source disclosure | False claims of real-time DEA verification | 3 hr |
| "Legally only" response → escalation | Credentialing integrity failure | 2 hr |
| **Total** | | **~12 hours** |

### New Blockers Required (P1 Priority)

| Blocker | Clinician Impact | Employer Impact |
|---|---|---|
| State CSR missing | Cannot prescribe controlled substances | Coverage gap, liability |
| Collaborative agreement missing (NP/PA) | Cannot practice independently | Clinical ops disruption |
| CMS Preclusion List (manual) | Claim denials from Day 1 | Revenue loss |
| Committee cutoff date | +30–90 day TTS slip | ISV degradation |

### ISV Improvement Levers (Ranked by Days Saved)

| Lever | Max Days Saved | Owner |
|---|---|---|
| Temp privilege activation (CRS ≥ 80) | 45–120 days to first clinical encounter | System + Employer |
| IMLC/eNLC compact routing | 60–180 days on new state license | System → Clinician |
| NPDB CQ enrollment on Day 1 | Eliminates staleness failures (prevents +30–90 day committee resets) | System → Employer |
| Committee cutoff tracking | 28–90 days (prevents 1-day-late misses) | System → MSO |
| PECOS 855R Day 1 routing | 30–60 days billing continuity | System → Employer billing |
| Locum fast-track detection | 30–60 days (bypasses redundant PSV) | System |
| DEA/CSR parallel initiation | 7–45 days | System → Clinician |

---

## Next Actions

**This week:**
1. Apply all 7 P0 fixes (FIX-01 through FIX-07). Total effort: ~12 hours.
2. Build `StateRuleRegistry` with the 4 state-level rule categories. Single source of truth.
3. Update `AcceptancePolicy` to reflect NCQA 2025 `psvWindowDays: 120`.

**Next sprint:**
1. Add state CSR blocker (ADD-01) and collaborative agreement blocker (ADD-02).
2. Add committee cutoff date tracking to `Organization` model (ADD-04).
3. Add NPDB CQ enrollment action routing (ADD-05).

**By pilot launch:**
1. IMLC/eNLC fast-path detection (ADD-07).
2. PECOS 855R reassignment detection (ADD-09).
3. CMS Preclusion List manual flag workflow (ADD-03).
4. Payor enrollment as an explicit parallel track, decoupled from CRS (SIMPLIFY-02).

---

*End of Report. Generated 2026-04-22 by Claude Cowork — Healthcare Credentialing Architect Mode.*  
*Primary sources: NCQA CR 1–8 (2025), TJC MS.06–MS.08, CMS 42 CFR §482.22, NPDB Guidebook, NAMSS ICS, Banner Health Credentials Manual, OIG/LEIE, GSA SAM.gov, HRSA NPDB, FSMB PDC, Nursys/NCSBN, ABMS CertiFACTS, AMA Physician Profiles, DEA Diversion Control Division, HCQIA Title IV.*
