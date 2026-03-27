# VitalCV Public Truth Audit

## 1. Claims Review by Route

### Route: `/` (Homepage)
- **Claim:** "Interview Mode: Share proof in the room. Employer sees what's verified, what's missing, what can proceed."
- **Status:** **[Partial]**
- **Allowed Wording:** "Share verified proof before the interview starts. The employer sees exactly what is verified (and when), what is pending, and the current readiness state."
- **Prohibited Wording:** "What can proceed" (implies we make the final call, which is false; employers make the call based on readiness state).

- **Claim:** "Verified against State Medical Boards, NPDB, DEA, OIG / LEIE, ABMS, NPPES."
- **Status:** **[Live]**
- **Allowed Wording:** "Verified against State Medical Boards, NPDB, DEA, OIG / LEIE, ABMS, NPPES at [Timestamp]."
- **Prohibited Wording:** Any mention of verification without a clear mechanism or path to see the timestamp.

### Route: `/explore` (Explore)
- **Claim:** "Find every verified clinician in your state."
- **Status:** **[Aspirational]**
- **Allowed Wording:** "Search our directory of source-verified clinician profiles."
- **Prohibited Wording:** "Every clinician", "100% of clinicians" (we only have the ones integrated/verified).

### Route: `/employers` (Employers)
- **Claim:** "Launch-safe entry point for hiring teams."
- **Status:** **[Live]**
- **Allowed Wording:** "Accelerate interview-to-start velocity by removing manual source queries."
- **Prohibited Wording:** "Zero friction onboarding", "Cut time by 80%" (unless mathematically tracked and proven on the dashboard).

- **Claim:** "Verified Employers" label
- **Status:** **[Inconsistent]**
- **Allowed Wording:** "Source-Verified Employer" (when matching recognized NPI / facility registries).
- **Prohibited Wording:** "Verified" without context of what makes them verified.

### Route: `/developers` (Developers)
- **Claim:** "Real-time sync with all state licensing boards."
- **Status:** **[Inconsistent]**
- **Allowed Wording:** "High-frequency synchronization with supported state and federal primary sources."
- **Prohibited Wording:** "Real-time" (most states are batch-updated), "All state licensing boards" (we only support specific ones).

- **Claim:** "Instant Integration"
- **Status:** **[Aspirational]**
- **Allowed Wording:** "Developer-ready APIs optimized for rapid integration."
- **Prohibited Wording:** "Instant Integration", "Zero setup".

## 2. Global Copy Rules

- **No Absolute Guarantees:** Remove "all", "instant", "100%", "never", and "guaranteed" across the site, unless programmatically enforced.
- **Show the Work (Timestamping):** Replace abstract "Trust us" copy with objective facts: "Verified from [Source] at [Timestamp]".
- **Focus on Leverage, Not Magic:** Pitch the product as a powerful tool that accelerates the credentialing workflow.
- **Align with Data Reality:** Do not claim a candidate is "Cleared". Use "Source Data Verified".
- **Jargon Removal:** Do not use internal meta-terms (e.g., "OpenClaw Truth Layer") in marketing facing pages. Keep it about the output: "Audit-ready proof."
