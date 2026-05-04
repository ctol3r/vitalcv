# Identity Vendor Evaluation

Status: foundation evaluation only. No vendor is procured, no identity proofing vendor is live, and no IAL2 or IAL3 assurance is claimed by this document.

## Decision Boundary

VitalCV needs a vendor for government ID verification, selfie/liveness, manual review fallback, consent capture, retention controls, and audit-safe event evidence before any production identity proofing flow can ship.

The current application may use `NEXT_PUBLIC_IDENTITY_VENDOR=mock` for non-production foundation surfaces. The mock vendor is not a proofing service and must not be treated as identity assurance evidence.

## Vendor Comparison

| Vendor | Strengths | Gaps / Due Diligence Required | VitalCV Fit |
|---|---|---|---|
| Persona | Broad identity orchestration, configurable flows, document and selfie checks, manual review tooling. | Procurement must verify healthcare data handling, retention controls, audit exports, and contract terms for minimum necessary use. | Strongest initial fit for configurable workflows and audit-oriented review needs. |
| Stripe Identity | Familiar developer experience, document verification, global platform maturity, straightforward integration model. | Less specialized for complex healthcare credentialing review workflows; retention and redaction posture must be contractually verified. | Good fallback if simpler identity proofing is preferred over deeper workflow configurability. |
| Onfido | Mature document and biometric verification, global coverage, established fraud signal surface. | Procurement must validate US healthcare data obligations, retention windows, audit-safe receipt shape, and manual review transparency. | Viable enterprise option if compliance and receipt requirements are contractually satisfied. |
| Veriff | Strong fraud and liveness posture, global document coverage, mature verification operations. | Procurement must validate audit artifacts, consent record shape, retention/redaction controls, and operational transparency. | Viable risk-focused option, pending proof that audit-safe artifacts fit VitalCV's trust model. |

## Recommendation

Recommended first procurement target: Persona.

Rationale:
- Best apparent fit for configurable identity workflows where VitalCV must keep proofing, consent, manual review, and audit evidence separate.
- Better alignment with a staged launch because flows can be configured for a narrow clinician identity proofing path before broader expansion.
- Still requires legal, security, privacy, and procurement review before any production use.

Fallback: Stripe Identity if the team intentionally chooses a simpler, narrower integration with less workflow configurability.

## IAL2 / IAL3 Gap Analysis

VitalCV should not claim IAL2 or IAL3 from the current foundation. The following gaps must close first:

| Gap | Needed For | Current State |
|---|---|---|
| Vendor procurement and contract | IAL2 path | Open procurement decision. |
| Government ID verification | IAL2 path | Planned control only. |
| Selfie/liveness or equivalent holder binding | IAL2 path | Planned control only. |
| Consent record and retention policy | IAL2 path | Policy requirement documented; vendor evidence missing. |
| Audit-safe proofing receipt | IAL2 path | Not available until vendor contract and integration define receipt shape. |
| Manual review fallback | IAL2 operational reliability | Required control; vendor evidence missing. |
| Hardware-backed / supervised or higher-assurance process | IAL3 path | Not in current product scope. |
| Formal assurance assessment | IAL2 / IAL3 claim | Not started. |

## Board Ceiling

Identity proofing rows stay at approximately 30% until vendor procurement closes. This is a procurement decision, not engineering. Engineering can prepare mock contracts, typed adapters, and safe UI states, but it cannot create real identity assurance without a selected vendor and reviewed contract.
