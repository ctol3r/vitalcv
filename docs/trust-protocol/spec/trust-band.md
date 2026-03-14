# Trust Band Specification

**Version:** 1.0.0  
**Methodology:** `243.1`  
**Status:** Stable  

---

## Overview

The Trust Band is a four-level categorical score representing a clinician's verified readiness to practice. It is computed from canonical verification facts and expressed as a single machine-readable value.

Trust Bands are:
- **Deterministic** — same inputs always produce the same band
- **Timestamped** — every band carries a `computedAt` value; bands expire
- **Auditable** — every computation is reproducible from its source artifacts

---

## Levels

### L0 — Unverified

```
trustBand: "RED"
readiness_level: "L0"
readiness_score: 0–24
```

**Meaning:** No verified credentials exist, or critical verification has failed.  
**Permitted actions:** None. Do not proceed with hiring, privileging, or deployment.  
**Typical causes:**
- No NPI found in NPPES
- Active OIG/LEIE exclusion
- License expired with no renewal evidence
- Identity verification failed

---

### L1 — Partial Verification

```
trustBand: "RED"  
readiness_level: "L1"
readiness_score: 25–49
```

**Meaning:** Identity confirmed but credential verification is incomplete or degraded.  
**Permitted actions:** Manual review only. Do not proceed without human oversight.  
**Typical causes:**
- NPI confirmed, license not yet verified
- Board certification status unknown
- OIG check pending or inconclusive
- State board lookup unavailable

---

### L2 — Substantially Verified

```
trustBand: "YELLOW"
readiness_level: "L2"  
readiness_score: 50–79
```

**Meaning:** Core credentials verified but gaps remain (e.g. expiring credentials, missing specialty cert).  
**Permitted actions:** Conditional proceed — gap items must be tracked and resolved.  
**Typical causes:**
- License active but expiring within 90 days
- Board certification not yet renewed
- DEA registration unconfirmed
- One state board lookup pending

---

### L3 — Fully Verified

```
trustBand: "GREEN"
readiness_level: "L3"
readiness_score: 80–100
```

**Meaning:** All required credentials verified from primary sources. Clinician is clear to start.  
**Permitted actions:** Proceed with hiring, privileging, deployment, or renewal.  
**Requirements for L3:**
- NPI confirmed in NPPES (Type 1 individual)
- At least one active state license verified (primary source)
- OIG/LEIE exclusion check: CLEAR
- No expired credentials in the active set
- `computedAt` within the freshness window (see below)

---

## Trust Score (Numeric)

The `readiness_score` is a 0–100 numeric value within the band range. It is computed by the Trust State Engine using methodology version `243.1`:

```
score = 
  demand_signal          × 0.15  (market need for this specialty/state)
  pipeline_readiness     × 0.10  (application completeness)
  credential_readiness   × 0.40  (PSV coverage × recency × source quality)
  speed_to_start         × 0.35  (days since first credential verified)
```

The score is advisory within a band. Routing decisions MUST use the band (`L0`–`L3`), not the raw score.

---

## Freshness Windows

Trust state computations have a maximum age. After expiry, the band MUST be recomputed before use in a hiring or privileging decision.

| Band | Default TTL | Reason |
|---|---|---|
| L3 | 1 hour (cached) / 30 days (DB) | Credentials don't change hourly; OIG updates daily |
| L2 | 1 hour (cached) / 7 days (DB) | Expiring credentials may cross threshold |
| L1 | 1 hour (cached) / 24 hours (DB) | Partial state resolves quickly |
| L0 | 1 hour (cached) | Re-check frequently; exclusions can be lifted |

A trust state computation with `computedAt` older than the TTL MUST NOT be returned; the system must recompute.

---

## Band Transitions

Bands can only change as a result of a new trust state computation triggered by:
- A new verification artifact being ingested
- A credential expiring
- An OIG exclusion being added or lifted
- A state board status change
- An explicit refresh request

Bands do NOT degrade silently between computations. They are valid for their TTL.

---

## Wire Format

```typescript
interface TrustBandResult {
  npi:              string;        // 10-digit NPI
  readiness_level:  "L0" | "L1" | "L2" | "L3";
  readiness_score:  number;        // 0–100
  readiness_status: string;        // human-readable label
  trustBand:        "GREEN" | "YELLOW" | "RED";  // backward compat alias
  computedAt:       string;        // ISO 8601
  methodology:      string;        // "243.1"
  gap_summary:      string[];      // what's missing for L3
  facts:            CanonicalFactSummary[];
}

interface CanonicalFactSummary {
  factType:   string;    // "StateLicense" | "NPIEnrollment" | "OIGClear" | ...
  source:     string;    // "NPPES" | "OIG_LEIE" | "STATE_BOARD" | ...
  status:     string;    // "VERIFIED" | "EXPIRED" | "PENDING" | "FAILED"
  verifiedAt: string | null;
  expiresAt:  string | null;
}
```

---

## Conformance

A system is **Trust Band conformant** if it:

1. Accepts `L0`, `L1`, `L2`, `L3` as the canonical band values
2. Never routes an `L0` clinician to a hiring or privileging decision without human override
3. Respects the TTL windows (does not cache band values beyond their TTL)
4. Exposes `computedAt` and `methodology` version alongside every band value
5. Treats unknown/missing band values as `L0` (conservative fallback)
