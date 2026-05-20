# Interoperability Rehearsal Boundaries

Authoritative reference for what the interoperability surfaces shipped
in `feat/interoperability-rehearsal-infrastructure` claim, demonstrate,
plan, and explicitly do not implement.

This document is binding. New interoperability copy must trace to a
row in one of the five tables below.

## Rehearsal vs Production

| Category | Status | What this means |
|---|---|---|
| **Rehearsal** | implemented | The exchange surface, replay envelope, cross-check lane, and timeline DEMONSTRATE the shape of an institutional handoff. The shape is real; the live federation that would carry it in production is NOT implemented. |
| **Simulation** | implemented | Demo cohort data drives the surface so the workflow can be walked through without external systems. The data is fixture data; no PHI, no production records. |
| **Supported discovery** | implemented | The receiving institution can discover the originating institution via did:web (`/.well-known/did.json`) and OID4VCI metadata. See PR #392 / #393. |
| **Planned interoperability** | future-state | OID4VCI issuance flow, wallet handoff, federation, multi-issuer trust framework. NOT in this wave. |
| **Unsupported federation** | not in scope | Cross-issuer trust lists, universal-resolver multi-method DID resolution, automatic acceptance, instant verification. NEVER claimed. |
| **Unsupported production exchange** | not in scope | Real-time evidence pipeline between two production institutions; live revocation propagation; binding consent receipts. NEVER claimed. |

## What the rehearsal demonstrates

| Surface | Demonstrates | Does NOT claim |
|---|---|---|
| `/interoperability/exchange/[exchangeId]` | Two-party handoff workspace shape | Federated network |
| Replay Bundle Envelope (`replayBundleEnvelope.ts`) | Portable evidence pointer set | Credential issuance / signed VC |
| Independent Cross-Check Panel | Receiving institution's per-lane confirmation workflow | Automatic acceptance |
| Trust Exchange Timeline | Operational chronology of an exchange | Real-time trust transfer |
| Evidence Reuse Panel | Operational efficiency framing (fewer duplicate queries) | Regulatory substitution / guaranteed reuse |
| Export Verification Exchange Button | Local PDF print of the surface | Cross-institution document sharing |

## Banned language

The following phrases MUST NOT appear in any rehearsal surface copy
or component label. The truth-audit test (`apps/web/__tests__/
interoperability-rehearsal-infrastructure.test.ts`) gates against
regression.

- "automatically verified"
- "guaranteed acceptance"
- "universally accepted"
- "fully verified"
- "instant verification"
- "automatic trust transfer"
- "federated by default"
- "production-ready federation"
- "trust transferred" (the trust is shown; transfer is institution-owned)
- "credential issued via VitalCV" (rehearsal does not issue)
- "magical onboarding"

## Normalized language (use these)

- "Rehearsal infrastructure"
- "Institution-owned cross-check"
- "Replay bundle"
- "Portable operational evidence"
- "Receiving institution"
- "Originating institution"
- "Source-confirmed"
- "Continuity restored"
- "Operator note"
- "Independent cross-check"
- "Replayable evidence"

## Posture statements (binding)

When external materials reference the interoperability rehearsal, they
MUST use only the normalized language above. The footer line on the
exchange page ("Rehearsal infrastructure · institution-owned cross-
check · no production credential issuance · no federation guarantee")
is the canonical posture; do not paraphrase it.

## Codex audit checklist (rehearsal-specific)

In addition to the standard checks in
`docs/ops/codex-ready-checklist.md` (PR #394), the rehearsal wave
adds:

- [ ] Every claim in `apps/web/components/interoperability/*.tsx`
      uses normalized language from this doc.
- [ ] No banned phrase appears in any touched file (strict regex match
      after comment stripping).
- [ ] The page footer renders the canonical posture line verbatim.
- [ ] `ExportVerificationExchangeButton` triggers `window.print()`
      and nothing else (no `share` / `send` semantics).

## Remaining interoperability gaps

1. **No live receiving-institution UI.** This wave ships the SHAPE of
   the receiving institution's view inside VitalCV's own product.
   A real receiving-institution surface would live on the receiving
   institution's systems.
2. **No machine-readable envelope schema.** The
   `ReplayBundleEnvelope` TypeScript type is the schema today;
   serialization to a portable wire format (JSON-LD / VC 2.0
   `evidencePackage`) is a future wave.
3. **No revocation channel.** Revoked credentials are flagged via
   `RevocationStateBanner` (PR #382) but the rehearsal does not
   simulate live revocation propagation.
4. **No discovery probe.** The rehearsal does not probe the
   receiving institution's `.well-known/did.json` -- it assumes
   discovery has already happened out-of-band.
