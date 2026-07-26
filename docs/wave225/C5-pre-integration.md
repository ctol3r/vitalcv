# W225-C5 — PRE Integration

**Wave:** 225 · **Date:** 2026-06-21

How the **Professional Recognition Event (PRE)** integrates across Evidence, Graph, Trust, Mobility, and Timeline — without weakening the canonical Recognition→Acceptance→Start contract.

---

## 0. What PRE already is

PRE is **not new**. The canonical path already exists, signed and hash-anchored, in `packages/domain-common/employmentContracts.ts` and the Prisma `Recognition`/`Acceptance`/`Start` tables (see W215-C1):

- `RecognitionEvent` — employer's signed acknowledgment (recognitionId, employerDid, proof Ed25519, hashAnchor).
- `EmployerAcceptance` — countersigned acceptance (psvReportId gate).
- `StartAttestation` — employer-attested actual start.
- `VerifiedCanonicalPath` — a type-branded guarantee the three exist in order; **cannot be bypassed**.

PRE = this triad as the persistent professional-recognition memory. W225 *surfaces* it; it does not redefine or relax it.

## 1. Integration per layer (all read-only projections)

| Layer | PRE integration |
|---|---|
| **Evidence** | `RecognitionEvent`/`EmployerAcceptance`/`StartAttestation` normalize (read-only) into `EvidenceObject{ class: recognition \| acceptance \| start }` (W220-C2). Status is decision-grade only when the signed event verifies; the normalizer never constructs a `VerifiedCanonicalPath`. |
| **Graph** | recognition/acceptance/start evidence project as nodes; subject→node edges use `RECOGNIZED_BY` / `ACCEPTED_BY` / `STARTED_AT` (W221, already in `GRAPH_RELATIONSHIP_TYPES`). |
| **Trust** | these classes feed `ProfessionalTrust` + `InstitutionalTrust` (W222 dimension map). A recognition reinforces professional standing; it never inflates authority/identity. |
| **Mobility** | a `start`/`acceptance` is experience signal for `ExperienceRequirement`s (W230-C3); it does not by itself satisfy a licensure requirement. |
| **Timeline** | recognition/acceptance/start events carry `recognitionImpact` and populate `TimelineProjection.recognition` (W225-C3, built). |

## 2. The integration rule (one direction only)

PRE flows **into** the projections as read-only evidence; the projections never write back a recognition. Specifically:

1. **No synthesis.** The timeline/graph/trust never *create* a PRE — only the signed, gated canonical path does.
2. **Branding preserved.** Evidence normalizers project an already-`VerifiedCanonicalPath`; they cannot mint one (TypeScript branding enforces this).
3. **Scope preserved.** A recognition is scoped to its employer/role; it reinforces `professional`/`institutional` trust but is not global credential truth (Trust Graph PSV-scope rules apply).
4. **Recorded-only.** Absence of a recognition in the projection ≠ "never recognized" (Rule 35) — the projection reflects what is recorded.

## 3. Reputation linkage

`ReputationSummary.standing` (W225-C3) is reinforced by recognition events through `ProfessionalTrust`, but standing can reach `established` only via decision-grade evidence breadth — a single recognition cannot manufacture an established reputation. This keeps reputation honest and non-gameable.

## 4. Future (W250-3) — PRE as persistent identity memory

When W250 expands PRE into "persistent professional identity memory," the substrate is already here: the canonical tables + the read-only projections. The expansion is additive (more recognition sources, richer scope), gated like every other persistence decision (`defer_until_contract_aligned`), and must preserve §2's one-direction rule.

## 5. Success-criteria answers

- **How do we model recognition?** As read-only evidence projected from the existing signed canonical path, surfaced in graph/trust/timeline.
- **How do we evolve Graph → Memory?** The graph already carries recognition nodes; Memory is the timeline projection (built) that orders them with trust/mobility impact — no new store.

**Deliverable status:** complete. → C6.
