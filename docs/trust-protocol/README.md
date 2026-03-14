# VitalCV Trust Protocol

**Version:** 1.0.0-rc1  
**Status:** Request for Adoption  
**Published:** 2026-03-14  
**Canonical URL:** https://vitalcv.com/protocol  

---

## What Is This?

The VitalCV Trust Protocol defines a machine-readable, cryptographically verifiable standard for representing clinical workforce trust. It answers one question across every healthcare system, staffing platform, and HR tool:

> **"Is this clinician safe to practice, right now, for this role?"**

The protocol is open. Any system can implement it. VitalCV operates as the reference implementation and primary trust anchor, but the protocol is designed to work across issuers.

---

## Protocol Components

| Component | Spec | Status |
|---|---|---|
| **Trust Band** | [spec/trust-band.md](spec/trust-band.md) | ✅ Stable |
| **TrustState API** | [api/trust-state.md](api/trust-state.md) | ✅ Stable |
| **Decision Capsule Schema** | [schemas/decision-capsule.md](schemas/decision-capsule.md) | ✅ Stable |
| **Verification Artifact Format** | [schemas/verification-artifact.md](schemas/verification-artifact.md) | ✅ Stable |
| **Clinician Passport** | [api/passport.md](api/passport.md) | ✅ Stable |
| **Webhook Event Taxonomy** | [api/webhooks.md](api/webhooks.md) | ✅ Stable |

---

## Quick Start

### Verify a clinician (one API call)

```bash
curl https://api.vitalcv.com/api/trust-state/1234567890 \
  -H "Authorization: Bearer <api_key>"
```

```json
{
  "npi": "1234567890",
  "readiness_level": "L3",
  "readiness_score": 87,
  "readiness_status": "Credentialing Complete",
  "trustBand": "GREEN",
  "computedAt": "2026-03-14T09:00:00Z"
}
```

### Embed a trust badge

```html
<img src="https://vitalcv.com/api/passport/1234567890/embed.svg" 
     alt="VitalCV Verified" />
```

### Receive webhook events

```json
{
  "event": "passport.verified",
  "npi": "1234567890",
  "candidate": {
    "trustBand": "GREEN",
    "readinessScore": 87,
    "activeCredentials": 4
  }
}
```

---

## For Ecosystem Partners

### Staffing Platforms
Integrate trust band display into candidate profiles. One API call per NPI.  
→ [ATS Integration Guide](../integration-kits/hris-ats/README.md)

### HR Technology Vendors
Embed the `VitalCV.mount()` widget to add credential verification to any job application flow.  
→ [Widget SDK docs](api/widget-sdk.md)

### Credential Vendors & Licensing Boards
Implement the Verification Artifact format to make your credentials portable and machine-readable.  
→ [Verification Artifact spec](schemas/verification-artifact.md)

### EHR and Health Systems
Query trust state at provider onboarding and at privileging renewal. Decision Capsules create an audit trail compatible with Joint Commission evidence requirements.  
→ [Decision Capsule schema](schemas/decision-capsule.md)

---

## Implementing the Protocol

To claim compatibility with the VitalCV Trust Protocol, a system must:

1. Accept Trust Band values (`L0`, `L1`, `L2`, `L3`) as defined in [spec/trust-band.md](spec/trust-band.md)
2. Produce or consume Verification Artifacts in the format defined in [schemas/verification-artifact.md](schemas/verification-artifact.md)
3. Use NPI as the canonical clinician identifier
4. Treat `L0` as "unverified / do not proceed" and `L3` as "fully verified / proceed"

Compatibility declarations welcome at [protocol@vitalcv.com](mailto:protocol@vitalcv.com).

---

## License

Protocol specifications: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)  
Reference implementation: [MIT](../../LICENSE)  
VitalCV name and logo: All rights reserved, VitalCV Inc.
