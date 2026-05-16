# W2-PR4C - Dossier Provenance

**Wave:** W2-PR4C - Dossier + Confidence Trust Alignment  
**Date:** 2026-05-09  
**Status:** Docs-only dossier provenance contract. No product code changed. No merge.  
**Purpose:** Make dossier, replay, audit, and provenance surfaces distinguish observed evidence from authoritative source truth.

## Scope

This document applies to dossier-like proof views, audit bundle previews, audit timelines, replay API copy, and employer-facing evidence exports.

It does not assert new runtime guarantees. It defines how existing evidence should be described.

## Core Rule

A dossier is a review surface for recorded evidence. It is not ownership proof, legal proof, replay prevention, or a guarantee that every related event was captured.

Every dossier row must answer:

1. What was recorded?
2. Where did it come from?
3. When was it observed or checked?
4. Is it source-backed, contextual, stale, unavailable, or review-required?
5. What integrity or replay check was performed, if any?
6. Who or what was attributed, and how certain is that attribution?

## Observational vs Authoritative

| Data class | UX label | Meaning | Limitation |
|---|---|---|---|
| Primary source response within freshness window | `Checked source result` | A configured source lane returned a usable result. | Freshness and scope still control reliance. |
| Clinician-entered or imported data | `Profile context` | Useful context attached to the profile. | Not source-backed proof. |
| Classifier output | `Observed claim candidate` | Text or document content was categorized. | Not verified. |
| Gated or unavailable source | `Source access required` or `Source unavailable` | The source was not decision-grade at this time. | Do not promote to checked. |
| Artifact hash present | `Hash recorded` | A stored hash exists for the artifact/event. | Not proof that all surrounding events were captured. |
| Hash recomputed and matched | `Hash match` | Recomputed value matched the stored value. | Integrity context, not legal proof. |
| Decision replay output | `Replay of available persisted evidence` | The system reconstructed stored evidence available to the replay path. | Not replay prevention and not a complete-world guarantee. |
| Actor metadata | `Recorded attribution` | Metadata names an org, user, system, or unknown actor. | Does not prove tenant ownership or legal authority. |

## Runtime Findings

| Surface | Current behavior | Trust risk | Required alignment |
|---|---|---|---|
| `apps/web/components/verifier/AuditProofViewer.tsx` | Uses overbroad proof/audit wording and demo evidence. | Implies stronger cryptographic, biometric, and integrity posture than inspected runtime supports. | Rewrite to evidence packet inspection, checked source rows, hash rows, and limitations. |
| `apps/web/components/decision/AuditBundlePreview.tsx` | Shows `Cryptographically Verified` and hardcoded `SHA-256 RSA` when `signatureStatus` is `VERIFIED`. | Algorithm and signature semantics are not fully visible from the prop. | Tie wording to actual signature metadata; otherwise say `Signature status: verified/unverified/invalid`. |
| `apps/web/components/trust-state/AuditTrailTimeline.tsx` | Header says `Audit-Ready Evidence Trail` and `Cryptographically Backed` even though event hash/signer are optional. | Whole timeline can read as uniformly hash-backed. | Show `Hash recorded` only on events with a hash; otherwise show `Event metadata recorded`. |
| `apps/api/backend/src/services/audit/replayEngine.ts` | Describes output as fully replayable and deterministic. | Overstates replay completeness. | Say replay reconstructs available persisted evidence and performs hash comparison. |
| `apps/api/backend/src/routes/auditReplay.ts` | Route comment says bundle is ready for named external review contexts. | Expands guarantee beyond product evidence. | Use `Structured export for internal review`. |
| `apps/web/components/review/EmployerDecisionConsole.tsx` | Audit row displays actor string without attribution basis. | Actor can be read as human authority or tenant ownership. | Label actor basis: human, organization, system, or unknown. |

## Minimum Provenance Row

```text
Evidence: [claim or artifact label]
Source: [source label or profile context]
Basis: [primary source / source match / clinician-entered / classifier / system record]
Observed: [timestamp or timestamp unavailable]
Freshness: [current / stale / unknown / pending / access required / unavailable]
Integrity: [hash match / hash recorded / hash unavailable / not checked]
Attribution: [human / organization / system / unknown] from recorded metadata
Limitation: [explicit limitation]
```

## Replay Visibility

Replay output should make the replay boundary visible:

```text
Replay basis: available persisted evidence as of the decision timestamp.
Integrity: hash comparison [matched / did not match / unavailable].
Evidence coverage: [complete / partial / unavailable] for the replay path.
Attribution: [human / organization / system / unknown] from recorded event metadata.
Limitation: replay is review context. It does not prevent replay, prove tenant ownership, or prove that every related event was captured.
```

Do not use replay wording as an anti-replay claim. If nonce or replay-attack prevention is introduced elsewhere, it must be described in that specific protocol surface, not inferred from dossier replay.

## Audit Attribution Visibility

Audit attribution must disclose what the system actually recorded.

| Recorded field | Safe label | Unsafe inference |
|---|---|---|
| `orgId` / `verifierOrgId` | `Recorded organization id` | Tenant owner or legal authority. |
| `userId` / `clerkUserId` | `Recorded user id` | Human authority or signer proof. |
| `confirmedBy` | `Recorded confirmer` | Credentialing acceptance. |
| system fallback | `System-derived attribution` | Human verification. |
| missing actor | `Actor unavailable in this event` | Tenant/action ownership. |

Recommended display:

```text
Attribution basis: organization id recorded.
Limitation: attribution identifies recorded metadata only.
```

## Source Traceability

Every evidence packet should expose available trace fields:

- source id and source label;
- artifact id;
- receipt id when present;
- source URL or raw artifact reference when safe to show;
- checksum/hash when present;
- parser version when present;
- checked/observed timestamp;
- freshness window or expiry;
- limitation state.

If a field is absent, render the absence honestly:

```text
Receipt: none attached.
Parser version: unavailable.
Hash: unavailable.
```

Do not collapse absent trace fields into a positive badge.

## Required Copy Replacements

| Replace | With |
|---|---|
| `Immutable Audit Trail` | `Recorded evidence trail` |
| `Cryptographic Proof Inspection` | `Evidence packet inspection` |
| `mathematical guarantees` | `source evidence, provenance, freshness, and recorded integrity checks` |
| `Complete integrity confirmed` | `Hash match confirmed` only after a passing hash comparison |
| `Cryptographically Backed` | `Hash recorded` only when event hash exists |
| `fully replayable accountability record` | `replay of available persisted evidence` |
| `Ready for Joint Commission review, CMS audits, or litigation discovery` | `Structured export for internal review` |
| `tenant owner` | `recorded organization id` |

## Follow-Up Implementation Shape

A safe follow-up product PR should:

1. Add provenance row rendering to dossier/audit packet views without changing layout structure.
2. Gate hash-backed labels on actual hash presence and hash-match result.
3. Replace route/service comments that overstate replay and audit readiness.
4. Add attribution-basis copy for human, organization, system, and unknown actors.
5. Add copy tests for dossier overclaims and tenant-ownership implications.

## Honesty Assessment

**Artifact alignment:** SAFE. This document narrows dossier language to recorded evidence, source traceability, replay visibility, and attribution basis.

**Runtime alignment:** GUARDED. Several surfaces still contain inflated copy or unconditional cryptographic/audit labels. Dossier surfaces should remain guarded until those labels are tied to actual hashes, signatures, timestamps, source states, and attribution metadata.
