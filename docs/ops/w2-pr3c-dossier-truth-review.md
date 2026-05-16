# W2-PR3C - Dossier Truth Review

**Status:** Dossier, replay, export, and audit wording review. No product code changed.  
**Scope:** Dossier-like proof inspection, audit bundle preview, replay API wording, trust-container rendering, and audit event attribution.

## Truth Boundary

A dossier surface may show:
- available persisted evidence;
- source labels;
- timestamps and freshness;
- artifact hashes;
- hash-match results;
- actor/system attribution fields;
- limitations and missing metadata.

A dossier surface may not imply:
- legal proof;
- complete replay of every event;
- immutable audit history unless the write path is actually durable and immutable;
- blockchain anchoring;
- zero-knowledge proof;
- biometric binding;
- tenant ownership;
- full employer acceptance.

## Surface Review

| Surface | Current posture | Evidence | Verdict |
|---|---|---|---|
| Trust container panel | Strong | Explicitly says it does not replace PSV or upgrade partial evidence. Missing metadata is neutral. | Keep. |
| Employer review packet explanation | Mostly aligned | Says source-backed readiness snapshot and lists source states. | Keep, but downgrade "Audit-grade document" language. |
| Audit proof viewer | Unsafe | Uses "Immutable Audit Trail", "mathematical guarantees", "Zero-knowledge proof verified", and biometric signature copy. | Rewrite or keep out of production. |
| Audit bundle preview | Needs guard | Shows "Cryptographically Verified" and "SHA-256 RSA" based on prop-level status, not algorithm metadata. | Tie copy to real signature metadata. |
| Audit replay service docs | Inflated | Describes a "fully replayable accountability record" and deterministic replay. | Replace with "reconstructs available persisted evidence and hash-checks the capsule". |
| Audit replay route docs | Inflated | Says bundle is ready for Joint Commission review, CMS audits, or litigation discovery. | Remove legal/regulatory readiness claims. |
| Audit trail timeline | Inflated by default | Renders "Cryptographically Backed" even when individual event hash/signer are optional. | Render hash-backed only when hash exists. |

## Observational vs Authoritative

Use these distinctions:

| Data shown | Classification | UX language |
|---|---|---|
| Source lane returned checked result within freshness window | Source-backed | "Checked source result" |
| Source lane is pending/gated/unavailable/stale | Contextual | "Not decision-grade yet" |
| Artifact hash was recomputed and matches | Integrity check | "Hash match" |
| Decision capsule references stored artifacts | Replay context | "Replayed from available stored evidence" |
| Actor/org/user metadata exists | Attribution metadata | "Recorded actor" or "Recorded organization" |
| Actor is absent or system-derived | Limited attribution | "System-derived attribution" or "Unknown actor" |

Do not convert any of the above into "proof of ownership", "legal proof", or "complete audit".

## Freshness Disclosure

Every dossier/proof row should disclose:
- source name;
- checked/observed timestamp when available;
- freshness state;
- whether the item is decision-grade, contextual, stale, access-required, review-required, or unavailable;
- limitation notes before any call to action.

If `checkedAt` or `observedAt` is missing, render "Not yet checked" or "Timestamp unavailable"; do not hide the field and leave a positive badge standing alone.

## Provenance Visibility

Minimum provenance row:

```text
Source: [source label]
Observed: [timestamp or unavailable]
Basis: [primary source, source match, clinician-entered, inferred, system record]
Limitation: [none if no limitation, otherwise explicit]
```

For replay output:

```text
Replay basis: available persisted evidence as of the decision timestamp.
Integrity: hash comparison [matched / did not match / unavailable].
Attribution: [human / organization / system / unknown] from recorded event metadata.
Limitation: replay is context, not legal proof.
```

## Required Copy Replacements

| Replace | With |
|---|---|
| "Immutable Audit Trail" | "Recorded evidence trail" |
| "Cryptographic Proof Inspection" | "Evidence packet inspection" |
| "Trust is derived from mathematical guarantees" | "Trust is derived from source evidence, provenance, freshness, and recorded integrity checks" |
| "Zero-knowledge proof verified" | "Selective-disclosure proof" only if SD-JWT proof verification is actually present; otherwise remove |
| "Complete integrity confirmed" | "Hash match confirmed" only when the hash check passed |
| "Bound to clinician DID via biometric signature payload" | "Bound to clinician identifier" only if the inspected artifact proves it; otherwise remove |
| "Cryptographically Backed" | "Hash recorded" only when `event.hash` exists |
| "fully replayable accountability record" | "reconstructs available persisted evidence for review" |
| "Ready for Joint Commission review, CMS audits, or litigation discovery" | "Structured export for internal review" |

## Audit Attribution Requirements

Audit attribution copy must state what is actually recorded:
- `orgId` means an organization id was recorded; it does not prove tenant ownership by itself.
- `userId` means a user id was recorded; it does not prove legal authority.
- `confirmedBy` means a human confirmation value was recorded; it does not prove credentialing acceptance.
- system fallback means the event was system-derived; it should never render like a human verifier.

Allowed:
- "Recorded actor: org/user/system"
- "Attribution source: decision capsule metadata"
- "Actor unavailable in this event"

Forbidden:
- "Tenant owner"
- "Organization accepted ownership"
- "Legally accepted"
- "Complete audit proof"
- "Immutable ledger"

## Dossier Honesty Assessment

**UNSAFE.** The trust-container panel is correctly constrained, but the proof viewer, bundle preview, replay service comments, route copy, and audit timeline contain semantic inflation. Dossier/export surfaces should not ship until the wording is downgraded to available evidence, hash comparison, source freshness, limitations, and recorded attribution.
