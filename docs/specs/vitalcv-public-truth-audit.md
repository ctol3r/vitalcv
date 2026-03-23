# VitalCV Public Truth Audit

## 1. Claims Review by Surface

### Homepage

#### Core Value Prop
- **Claim:** "Interview Mode: Share proof in the room. Employer sees what's verified, what's missing, what can proceed."
- **Status:** **[Partial]**
- **Correction Needed:** "Share verified proof before the interview starts. The employer sees exactly what is verified (and when), what is pending, and the current readiness state."
- **Reason:** 'What can proceed' implies we make the final call; we do not. The employer makes the call based on the readiness state we provide.

#### Trust Layer
- **Claim:** "Verified against State Medical Boards, NPDB, DEA, OIG / LEIE, ABMS, NPPES."
- **Status:** **[Live]**
- **Correction Needed:** None. We actually check against these sources. But we must ensure the UI shows exactly when the verification happened.

### Employers

#### Speed & Conversion
- **Claim:** "Launch-safe entry point for hiring teams."
- **Status:** **[Live]**
- **Correction Needed:** Keep, but ensure we never say "Zero friction onboarding" without caveats. Replace aspirational speed claims (if any exist in marketing campaigns like 'Cut time by 80%') with: "Accelerate interview-to-start velocity by removing manual source queries."

#### Trust and Compliance
- **Claim:** "Verified Employers" label
- **Status:** **[Inconsistent]**
- **Correction Needed:** "Source-Verified Employer" or clearly detail what exactly is verified. Define what makes an employer "verified" (e.g., matching recognized NPI / facility registries).

### Developers

#### Real-time Claims
- **Claim:** "Real-time sync with all state licensing boards."
- **Status:** **[Inconsistent]**
- **Correction Needed:** "High-frequency synchronization with supported state and federal primary sources."
- **Reason:** "All" is a legal and technical liability. "Real-time" is often technically false for batch-updated state boards. Use "high-frequency".

#### Integration
- **Claim:** "Instant Integration"
- **Status:** **[Aspirational]**
- **Correction Needed:** "Developer-ready APIs optimized for rapid integration." 

### Pricing

#### Usage Rules
- **Claim:** "Unlimited verifications per candidate."
- **Status:** **[Aspirational]**
- **Correction Needed:** "Comprehensive verification bundled per candidate." 
- **Reason:** 'Unlimited' creates unbounded operational risk if vendors or state scrapers change rate limits.

#### Financial ROI
- **Claim:** "Pay only when you hire."
- **Status:** **[Live] / [Partial]**
- **Correction Needed:** Align with the strict billing logic. If billing is strictly per accepted audit packet, ensure the messaging conveys that exactly.

---

## 2. Source Coverage Disclosure Requirements
- **Rule:** Never imply total national coverage if the feature relies on a state-by-state rollout. 
- **Disclosure:** We must maintain a public, continually updated sub-page or tooltip listing the exact state boards, federal registries (e.g., DEA, PECOS, LEIE), and institutions we currently support. 
- **Transparency:** Any "Unavailable", "Pending Integration", or "Maintenance" source must be explicitly marked as such in the UI. We do not fake certainty. If a board's API goes down, we report the board as down—we don't show a cached "Verified" status without an explicit timestamp of the last known good state.

---

## 3. Launch-Safe Wording Rules

- **No Absolute Guarantees:** Remove "all", "instant", "100%", "never", and "guaranteed" across the site, unless programmatically enforced and mathematically true.
- **Show the Work (Timestamping):** Replace abstract "Trust us" copy with objective facts: "Verified from [Source] at [Timestamp]". Trust is an output, not a marketing claim. 
- **Focus on Leverage, Not Magic:** Pitch the product as a powerful tool that accelerates and clarifies the credentialing workflow. It does not replace human oversight; it supercharges it.
- **Align with Data Reality:** Do not claim a candidate is "Cleared". Instead, use "Source Data Verified". The employer makes the clearing decision.
- **Jargon Removal:** Do not use internal meta-terms in marketing facing pages (e.g., "The OpenClaw Truth Layer"). Keep it about the output: "Audit-ready proof."
