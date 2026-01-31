# CRED0 Doctrine: Trust Reset Philosophy

## The Trust Problem

Healthcare credentialing operates on **inferred trust**: employers collect documents and *infer* they are legitimate.

This creates a trust vacuum where:
- Every employer re-verifies the same facts
- No employer trusts another employer's verification
- Clinicians carry binders of paper credentials
- Verification cycles take 45-90 days
- Fraud is detected retrospectively, not prevented

## Why Inferred Trust Fails

### The Document Chain Problem

```
State Medical Board → Paper Certificate → PDF Scan → Email → Upload → Manual Review
                                                                              ↓
                                                                    "We think this is real"
```

**Failure Points:**
1. No cryptographic proof of authenticity
2. No way to verify document wasn't altered
3. No way to verify it's current (could be revoked)
4. No way to verify presenter has authority (could be stolen)
5. Manual review introduces human error

**Result:** Employers must re-verify from scratch every time, because they cannot trust the documents themselves.

### The Credential Committee Fiction

Medical staff committees review "credential packets" containing:
- State license copies
- DEA certificate
- Board certification scans
- Employment verification letters
- Peer references

**The Fiction:** The committee is "verifying" credentials.

**The Reality:** The committee is *hoping* the documents are real and manually cross-checking a few data points against websites. They cannot cryptographically prove authenticity.

**Consequence:** Every employer must repeat this process because no employer trusts another employer's committee review.

## Issued Trust: The Infrastructure Alternative

VitalCV replaces inferred trust with **issued trust**:

> Authoritative sources issue cryptographic proofs. Employers accept proofs instead of collecting documents.

### Issued Trust Properties

**Cryptographically Verifiable:**
- Every claim is signed by the authoritative source
- Signatures are mathematically provable
- Tampering is detectable
- Forgery is computationally infeasible

**Freshness-Guaranteed:**
- Every proof includes timestamp and expiry
- Revocation is cryptographically provable
- Stale proofs are rejected at protocol level

**Holder-Bound:**
- Proofs are bound to practitioner's DID
- Cannot be transferred or stolen
- Presentation requires cryptographic proof of control

**Non-Repudiable:**
- Authoritative source cannot deny issuance
- Acceptance creates immutable record
- Audit trail is cryptographically anchored

## The Trust Reset

CRED0 is "credentialing from zero trust":

**Assumption:** Employers trust *nothing* except cryptographic proofs from authoritative sources.

**No Trusted Intermediaries:**
- Not VitalCV
- Not other employers
- Not committees
- Not documents

**Only Trust:** Math.

### What This Enables

1. **One-Time Verification:** Primary source verifies once, issues proof, proof accepted everywhere
2. **Zero Re-Verification:** Employers accept proofs instead of re-verifying
3. **Instant Revocation:** Source revokes proof, all holders immediately see revocation
4. **Fraud Prevention:** Cannot forge proofs (requires breaking cryptography)
5. **Audit Defense:** Every acceptance has cryptographic proof trail

## Why This Is Infrastructure

Infrastructure is invisible until you need it:
- Roads don't require understanding asphalt composition
- Electricity doesn't require understanding power generation
- Trust infrastructure shouldn't require understanding cryptography

**VitalCV Infrastructure:**
- Clinician presents proof (like showing driver's license)
- Employer accepts proof (like scanning ID)
- Employment proceeds (like checking into hotel)

**User Experience:**
- No cryptography visible
- No blockchain concepts exposed
- No "web3" jargon required
- Works like trust always should have worked

## Issued vs Inferred Trust Comparison

| Dimension | Inferred Trust (Current) | Issued Trust (VitalCV) |
|-----------|-------------------------|------------------------|
| **Verification** | Manual review of documents | Cryptographic signature verification |
| **Freshness** | Unknown (documents could be outdated) | Guaranteed (timestamp + expiry in proof) |
| **Revocation** | Manual notification (if at all) | Instant cryptographic revocation |
| **Fraud Risk** | High (forgery is cheap) | Negligible (requires breaking cryptography) |
| **Re-Verification** | Required at every hire | Never (proof accepted everywhere) |
| **Audit Trail** | Paper trail, manual review | Immutable cryptographic record |
| **Trust Model** | "We hope this is real" | "Math proves this is real" |
| **Time to Verify** | Days to weeks | Seconds |
| **Employer Liability** | Negligent credentialing risk | Cryptographic proof defense |

## Regulatory Alignment

### NCQA CR1-CR5 Standards

**CR1 (Credentialing Criteria):** Requires verification from primary sources
- **Inferred Trust:** Manual phone/fax verification
- **Issued Trust:** Cryptographic proofs from primary sources

**CR2 (Application Processing):** Requires verification before privileges
- **Inferred Trust:** 45-90 day committee review
- **Issued Trust:** Instant proof verification

**CR4 (Ongoing Monitoring):** Requires monitoring for sanctions/revocations
- **Inferred Trust:** Periodic manual re-checks
- **Issued Trust:** Real-time cryptographic revocation

### CMS Conditions of Participation §482.12

**Requirement:** Medical staff credentials verified before appointment
- **Inferred Trust:** Manual verification creates liability gap
- **Issued Trust:** Cryptographic proof eliminates gap

**Audit Defense:**
- **Inferred Trust:** "We reviewed documents and believed them"
- **Issued Trust:** "We verified cryptographic signatures from authoritative sources"

## The Billion-Dollar Question

If issued trust is cryptographically superior, why doesn't it exist?

**Answer:** No one built the infrastructure.

VitalCV is the infrastructure layer that makes issued trust operational for healthcare credentialing.

## Summary

**The Problem:** Healthcare credentialing runs on inferred trust (hoping documents are real).

**The Failure:** No employer trusts another employer's verification, forcing endless re-verification.

**The Solution:** Replace inferred trust with issued trust (cryptographic proofs from authoritative sources).

**The Infrastructure:** VitalCV is the protocol layer that makes issued trust work invisibly.

**The Result:** Clinicians verified once, accepted everywhere. Employers accept proofs, never re-verify.

This is not a product feature. This is infrastructure. Like HTTPS. Like OAuth. Like DNS.

You don't think about it. You just trust it works.
