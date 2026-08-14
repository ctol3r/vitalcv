# Credential operations core

Status: first production-facing foundation. This document describes implemented
code and explicit boundaries; it is not a certification or nationwide coverage
claim.

## Purpose

The credential-operations domain gives VitalCV one durable workflow substrate
for CVO credentialing, state licensing, payer enrollment, facility privileging,
recredentialing, reappointment, delegation setup/oversight, and renewal.

It complements existing product contracts:

```text
reviewed workflow template
  -> tenant-owned clinician case
  -> frozen case tasks
  -> references and receipts
  -> ActivationRequirement roll-up where a qualified start is involved
```

`ActivationRequirement` remains the application-linked summary of work left to
a qualified start. A `CredentialOperationsCase` is the detailed operational
record and may link to one activation requirement. It does not replace the
activation ledger, immutable `ApplicationPacket`, employer decision service, or
VitalCV Recognition.

## Implemented contract

- Platform administrators may draft and activate versioned workflow templates.
- Activation records the human reviewer, review time, and SHA-256 content hash.
- Active template content is treated as immutable. A changed active template
  fails its integrity check when a case is created; rule changes require a new
  version.
- Each template declares its exact target authority, jurisdiction, professions,
  effective window, and observed HTTPS source references.
- Each case belongs to one server-derived organization and one `PERSON`
  `VcvEntity`, and freezes the template hash and target-authority snapshot.
- Requirements are copied into case tasks. Root tasks begin `READY`; dependent
  tasks begin `NOT_STARTED`.
- Case creation is database-idempotent within an organization and records its
  audit event in the same transaction.
- Organization reads and writes derive access from active workspace membership.
  Clinicians may read a case only through a non-self-reported, unrevoked entity
  claim. Platform administrators use the explicit active-admin mechanism.
- Unknown and unauthorized case reads both return 404.

## Restricted-data boundary

VitalCV stores operational references and receipts, not raw SSNs, dates of
birth, health disclosures, medical histories, or peer-review material. JSON
ingestion rejects restricted keys and SSN-like values. Template requirements
declare one of:

- `STANDARD`: ordinary non-restricted operational data may be stored.
- `REFERENCE_ONLY`: store an identifier or receipt pointing to the controlled
  system of record.
- `EXTERNAL_ONLY`: the work and sensitive values remain in the partner,
  authority, payer, or facility system.

No external submission is automatic in this bundle. A task may describe a
human-approved submission, but the core does not send it.

## HTTP surface

```text
POST /api/credential-ops/templates
POST /api/credential-ops/templates/:templateId/activate
GET  /api/credential-ops/templates
POST /api/credential-ops/cases
GET  /api/credential-ops/cases
GET  /api/credential-ops/cases/:caseId
```

Template writes require an active platform administrator. Case writes and list
reads require an active organization workspace with role `ADMIN`, `VERIFIER`,
or `CREDENTIALING_SPECIALIST`. Request headers and request-body organization IDs
never choose case tenancy.

## Deliberately not claimed

This foundation does not claim CVO accreditation, delegated-credentialing
approval, nationwide licensing coverage, payer access, facility privileges,
committee approval, or completed credentialing. Those outcomes require actual
partner/access contracts, design-partner rule matrices, controlled external
execution, and recorded human or institution decisions.

## Next execution units

1. Task transition service with dependency release, human approval receipts,
   source-result references, correction history, and transactional audit.
2. Design-partner rule-matrix authoring/import and validation for the exact
   launch states, payers, facilities, professions, and effective dates.
3. Credentialing-file QA, discrepancy resolution, committee packet/decision,
   and native committee workflow plus integration adapters.
4. Delegation agreement, roster, audit sampling, corrective-action, and
   oversight records; accredited-partner evidence remains distinct from any
   future VitalCV accreditation.
