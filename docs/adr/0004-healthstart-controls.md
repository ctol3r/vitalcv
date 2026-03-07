# ADR-0004: HealthStart NIST/HIPAA Control Mapping

**Date:** 2026-02-10  
**Status:** Accepted  
**Deciders:** VitalCV Engineering, Compliance  
**Tags:** security, compliance, infra

---

## Context

VitalCV processes PHI-adjacent data (NPI numbers, license records, employment history).
Healthcare customers require HIPAA compliance evidence before procurement, and enterprise
customers increasingly require NIST 800-53 control attestation.

We needed a systematic approach to:
1. Map our existing security controls to recognized frameworks
2. Generate evidence packs for customer due diligence
3. Provide a self-assessment baseline for future SOC 2 / HITRUST alignment

Options considered:
- **Manual compliance docs** — point-in-time, high maintenance
- **Third-party GRC tool** — expensive; not integrated with the codebase
- **In-code control registry** — controls defined in code, evidence generated programmatically

## Decision

Implement **HealthStart** — an in-code control registry mapping VitalCV capabilities to
NIST 800-53 and HIPAA safeguard controls.

Each control is defined with:
- `controlId` — NIST or HIPAA identifier (e.g. `AC-2`, `§164.312(a)`)
- `title` / `description` — human-readable
- `implemented` — boolean gate
- `evidence` — array of implementation references (file paths, route names)
- `ssp` — System Security Plan narrative

The `deploymentProfile` service generates an SSP evidence pack on demand.
The HealthStartDocs portal at `/healthstart` surfaces controls for customer review.

## Alternatives Considered

| Option | Description | Why Rejected |
|--------|-------------|--------------|
| Manual DOCX policy docs | Standard practice | Stale, unlinked to actual code |
| Vendor GRC (Drata, Vanta) | Automated compliance tooling | Cost prohibitive at stage; no custom control logic |
| OSCAL format | NIST-standard machine-readable SSP | Valuable future target; too complex for initial impl |

## Consequences

### Positive
- Controls are auditable and version-controlled alongside code
- SSP evidence pack generated from live system state
- Enables self-service compliance review for enterprise customers

### Negative / Trade-offs
- Custom implementation; not OSCAL-compliant (yet)
- `implemented: true` is self-attested — no external audit

### Neutral / Notes
- 15 controls mapped across AC, AU, CM, IA, SC, SI families
- Future: export to OSCAL format for FedRAMP alignment

## References

- [NIST 800-53 Rev 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [HIPAA Security Rule §164.3xx](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- `apps/api/backend/src/services/healthstart/deploymentProfile.ts`
- Wave 118 (Waves 118–123 numbering): HealthStart Control Inheritance
