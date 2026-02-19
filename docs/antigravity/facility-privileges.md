# Facility-Issued Privilege Credentials

Facilities are the sole authorities for issuing privilege credentials.
Departments may issue only through explicit, scoped delegation granted by the facility.
Privilege templates are immutable and versioned; credentials bind to the exact template version at issuance.

## Canonical Rules
- Facility is the issuer of record; department issuance requires an active delegation.
- Privilege templates never mutate; updates create a new version that explicitly supersedes the prior version.
- Credentials are scoped to the facility and template version; no cross-facility reuse.

## Template Versioning
- `templateId` stays stable across versions.
- `versionId` is unique per version.
- `supersedesVersionId` must reference the prior version when superseding.

## Delegation Scope
- Delegations list allowed templates and privilege codes.
- Delegations expire and must be active at issuance.
- A department cannot issue outside its delegated privilege set.

## Issuance
1. Validate template version and facility ownership.
2. Validate delegation if a department issues.
3. Bind credential to `facilityId` + `templateVersionId`.
4. Sign with facility-scoped key (`issuer_type=facility`).

## Revocation-First Verification
1. Resolve facility status list and revocation registry.
2. Enforce TTL/expiry.
3. Verify signature against facility key set.
4. Enforce privilege scope against requested privileges.

## No Cross-Facility Leakage
- Facility scope checks require `facilityId` match.
- Credentials fail verification outside the issuing facility.
