# Minimum Friction — Architecture Map

**Program:** Minimum Friction (MF-WAVE-00, research/architecture only)
**Baseline:** `origin/main` @ `df0ff184c2da9fbc8cfaf73f26e1928188113e61` (2026-08-16)
**Status:** Research deliverable. No code, schema, migration, route, or runtime is added by this wave.

> **DESIGN-ONLY BOUNDARY** applies (verbatim text in SECURITY_PRIVACY_MODEL).

---

## 0. The one-line answer (Q1)

**Minimum Friction is an objective *profile* and two thin planning gates over systems that already
exist — not a new subsystem.** Most primitives the thesis needs already exist; the dominant failure
mode in the repo is not "missing" but "built and unwired" (declared capability that is actually
absence). MF's job is composition, constraint, and wiring — not construction.

The four thesis mandates map to existing anchors:

```
USER GOAL              → Opportunity / TrustSpec (EXISTS / IN_FLIGHT)
+ CURRENT STATE        → PersonProfile + domain-evidence EvidenceObject (EXISTS)
+ EVIDENCE/PROVENANCE  → ClaimRecord + trust-state source coverage (EXISTS)
+ DEPENDENCIES         → PTC compiler + dependency index (NEW, docs-only)
+ TRUST OPTIMIZER      → MINIMUM_ACTION_COUNT bounded optimizer (NEW, docs-only)
+ IDENTITY ASSURANCE   → IdentityTier + NpiOwnership (EXISTS / PARTIAL)
+ DATA HANDLING        → dataClassificationFoundation (DEAD/declarative)
+ CONSENT              → ApplicationPacket + ConsentGrant (EXISTS but enforcement DEAD)
→ MINIMUM SAFE ACTION PLAN  = the friction objective profile (this program)
```

---

## 1. Primitive classification table

Legend: **EXISTS** (wired, runtime) · **PARTIAL** (some real, some inert) · **DUPLICATED** (>1
implementation) · **DEAD** (code/types exist, unwired) · **IN_FLIGHT** (landing now) · **NEW** (not
in repo) · **DO_NOT_BUILD**.

### Evidence / trust
| Primitive | Class | Anchor |
|---|---|---|
| Canonical evidence types (`EvidenceObject`, status, provenance, integrity, lifecycle) | **EXISTS** | `packages/domain-evidence/src/types.ts`; status aliased to `packages/trust-state/sourceCoverage.ts` |
| `trust-state` (resolver, source-coverage vocabulary, readiness derivation) | **EXISTS** (49 importers) | `packages/trust-state/` — "behavior frozen" |
| `detectGaps()` / `projectReadiness()` / mobility | **EXISTS** | `packages/domain-evidence/src/mobility/mobility.ts` (wired via 5 web routes) |
| Source adapters (NPPES/OIG/PECOS/state/Nursys) | **DUPLICATED** (3 families, adjudicated) | `packages/source-adapters/`, `packages/psv-adapters/`, backend `identityIngestionPipeline`; canonical entry declared in `apps/api/backend/src/services/identity/canonicalSourceAdapters.ts` |
| Freshness/staleness | **DUPLICATED** | `trust-contract/freshness-engine.ts` + `trust-state/freshnessEvaluator.ts` + `SOURCE_REGISTRY.freshnessTtl` |
| Evidence conflict adjudication | **PARTIAL/unsettled** | `trust-contract/contradictions.ts`, `arbitration-engine.ts` (RQ-05 "no canonical rule settled") |

### Readiness / next-action
| Primitive | Class | Anchor |
|---|---|---|
| Readiness computation | **EXISTS** | `mobility.projectReadiness()`; backend `computeTrustState()` |
| Next-action planners | **EXISTS ×3, all heuristic** | `agent/policy/rank.ts` (6-tier), `domain-evidence/intelligence/prioritizeActions()`, `decision/nbaEngine.ts` |
| Impact-ranked next action ("satisfies N requirements") | **NEW** | none — no dependency-index-backed leverage anywhere (P-020) |
| Event-driven recompute | **PARTIAL** | `workers/continuousMonitor.ts` (cron) recomputes CRS on *adverse change* only; **no job ages evidence→stale + recomputes gaps** |

### Career graph
| Primitive | Class | Anchor |
|---|---|---|
| Career-graph ontology (nodes/edges, `requires`/`satisfies`/`consented_to`/`accepted_as_head_start`) | **EXISTS as contract, DORMANT** | `packages/career-graph/src/types.ts` (type-only consumer; no `/api/career-graph`) |
| Backlink: provenance ("where from") | **EXISTS (projectable, FK-backed)** | `career-graph` projections over `ClaimRecord`/`VerificationReceiptRecord` |
| Backlink: `satisfies` / `matched_to` | **NEW (gap)** | `career-graph/src/gaps.ts` — "the single most valuable missing edge" |
| Live materialized graphs (separate) | **EXISTS** | `services/graph-engine/` (`graph_nodes/edges`), `services/graph/liveGraphBuilder.ts` |
| Note backlink traversal | **EXISTS (garden-scoped)** | `services/garden/gardenLinksService.ts` |

### Clinician profile / AI
| Primitive | Class | Anchor |
|---|---|---|
| `ProfileProvenance` (`VERIFIED/USER_ENTERED/INFERRED/UNKNOWN/CONFLICT`) | **EXISTS, display-only (not persisted)** | `apps/web/lib/profile/provenance.ts` — `CONFLICT`/`INFERRED` unreachable |
| Profile editing (self-attested) | **EXISTS** | `SelfAttestedEditor.tsx`, `ProfileSurface.tsx` → `intakeService.updateSelfAttested()` |
| Knowledge Inbox | **DEAD** | `apps/web/lib/knowledge-inbox/*` — no model, no route, no mount |
| CV extraction (live) | **PARTIAL (stub OCR default)** | `services/ai/documentPipeline.ts` → `CandidateCredential` (UNVERIFIED) |
| CV extraction (full parser) | **DEAD** | `packages/ingest/` — routeless |
| Candidate claim model | **PARTIAL** (`CandidateCredential` thin; `ClaimRecord` rich) | `schema.prisma:321`; `evidenceModel.ts:126` — no model-id, no source-passage |
| Conflict resolution (`humanReviewAt`) | **DEAD** | written `null` at all 12 sites; never set |

### Identity / assurance
| Primitive | Class | Anchor |
|---|---|---|
| NPI bootstrap (`PersonProfile.npi`) | **EXISTS (self-asserted)** | `intakeService.bootstrapNpiIntake()` — NPPES record-exists only, no name match |
| NPI ownership authorization | **EXISTS, stricter, disconnected** | `NpiOwnership` + `npiOwnershipState.ts` — VERIFIED/DELEGATED admin-only |
| `IdentityTier` (`account/preview/npi_bound/work_email_confirmed`) | **EXISTS (enforced)** | `services/identity/identityTier.ts`; `requireIdentityTier()` |
| Email OTP possession signal | **EXISTS** | `services/identity/emailOtpService.ts` |
| Passkey / WebAuthn | **DEAD** (stub verify, no registration, unused `PasskeyCredential` table) | `routes/webauthn.ts`, `schema.prisma:3575` |
| Step-up / re-auth before sensitive action | **PARTIAL, fails open ×3** | `hooks/useBiometricConfirmation.ts` — never reaches the server |
| Account recovery | **NEW** (Clerk-hosted only) | — |
| AAL concept | **NEW** | docs list it as a gap; issuer-side `AssuranceLevel` is unrelated |

### Apply / disclosure / consent
| Primitive | Class | Anchor |
|---|---|---|
| `ApplyWithVitalCV` widget | **EXISTS (live on `/`)** | `components/apply/ApplyWithVitalCV.tsx` → legacy `BundleShareEvent` path |
| Legacy share (`shareBundle`) | **EXISTS (weaker consent)** | `services/distribution/applyShareService.ts` — `@ts-nocheck`, SSRF/signing issues (SECURITY §1) |
| Sealed packet + consent | **EXISTS, enforcement DEAD** | `ApplicationPacket` + `ConsentGrant` + durable `AuditEvent` (Apply Intent path only) |
| `ConsentReceipt` model | **NEW (does not exist)** | name survives only as `ApplicationPacket.consentReceiptId → AuditEvent.id` (no FK) |
| `ReadinessSnapshot` (persisted) | **EXISTS** | `schema.prisma:959`; `readinessSnapshotService.issueReadinessSnapshot()` |
| `selectiveClaims` | **PARTIAL, non-functional subset** | UI sends `credentialType`, server filters `domain` — mismatch (SECURITY §1.5b) |
| `purposeOfUse` | **PARTIAL** (free text, no enum, 3 vocabularies) | `BundleShareEvent.purposeOfUse` etc. |
| Recipient resolution (server-side) | **EXISTS (opportunity path only)** | `services/distribution/recipientResolution.ts` |
| Revocation enforcement | **PARTIAL** | `BundleShareEvent.revokedAt` enforced in 2/5 readers; **not on public bundle route** |
| Durable share audit | **DEAD (in-memory)** | `services/audit/auditLedger.ts` module array |

### Data safety
| Primitive | Class | Anchor |
|---|---|---|
| Data classification foundation | **DEAD (declarative, self-documents as not live)** | `apps/web/lib/security/dataClassificationFoundation.ts` |
| Retention foundation | **DEAD (declarative)** | `apps/web/lib/security/retentionFoundation.ts` |
| Redaction | **EXISTS (Sentry only)** | `packages/shared/observability/` `scrubEvent()` |
| stdout log hygiene on share path | **PARTIAL/gap** | `applyShareService.ts` logs raw NPI + Clerk id; convention exists but unapplied |
| Analytics (funnel) | **EXISTS, disciplined (no PII)** | `apps/web/lib/analytics/funnel.ts` |
| LLM boundary | **EXISTS, gated (one live path)** | `api/matcha/cover-letter` — stated prefs only, no NPI/credential |
| Account/PII deletion | **NEW (none)** | no account deletion, no DSAR path |

### Professional Trust Computing
| Primitive | Class | Anchor |
|---|---|---|
| TrustSpec 0.1 | **IN_FLIGHT (unwired by design)** | `packages/domain-evidence/src/trust-computing/trustSpec.ts` (#1406) |
| TrustIR / Compiler / dependency index / proof | **NEW (docs only)** | `docs/trust-computing/PTC_*` |
| Trust Optimizer | **NEW (no code)** | designed single-objective `MINIMUM_ACTION_COUNT`; multi-objective DEFERRED |
| Action model | **PARTIAL/DUPLICATED** | `GapRemediation` + StartAgent `AgentAction` |
| Demo-1 fixtures | **PARTIAL** | only `trustSpecValidation.ts` fixtures exist; `demo1.ts`/`golden.ts` do not |

---

## 2. Gaps that MF actually depends on (ranked)

1. **`satisfies` edge / dependency index** — nothing records that evidence X satisfies requirement
   Y. Without it, leverage ("this action satisfies 3 requirements") and precomputed application are
   impossible to compute (only fixture-able). Owned by PTC compiler (NEW).
2. **Persisted per-field provenance** — `provenance.ts` is display-only; `CONFLICT`/`INFERRED` are
   unreachable. The AI candidate lane has no provenance store to promote through.
3. **Consent *enforcement*** — the models can represent purpose-bound consent (sealed path) but
   revocation/expiry columns are written by nobody; the live path uses the weaker record.
4. **Evidence-staleness recompute** — cron recomputes on adverse change, not on aging; anticipatory
   maintenance needs an aging trigger.
5. **Assurance step-up that reaches the server** — biometric gate fails open ×3; no passkey
   registration exists.
6. **Candidate metadata: model-id + source-passage** — the two fields the promotion contract needs.

**None of these is "build a new subsystem."** Each is a wiring, constraint, or single-model-field
task over an existing anchor.

## 3. Duplication risks (do not add to these)

- **NPI ownership** answered twice (`PersonProfile.npi` self-asserted vs `NpiOwnership` admin-gated),
  unreconciled. MF must pick `NpiOwnership` as the authority and connect the bootstrap to it —
  **not** add a third.
- **Apply transaction** exists twice (`BundleShareEvent` vs `ApplicationPacket`/`ConsentGrant`).
  MF converges on the sealed path; do not create a third.
- **`ReadinessSnapshot`** name means three different things; **`purposeOfUse`** has three
  vocabularies; **source adapters** have three families. MF adds none of these — it picks the
  canonical one already declared.
- **Optimizer / graph / consent model** — the thesis explicitly forbids a second of each. Confirmed
  buildable as profiles/wiring over the existing one.

## 4. Proposed architecture — thin layer, exact owner boundaries

```
┌───────────────────────────── MINIMUM FRICTION (this program) ─────────────────────────────┐
│  Question Admission Gate     Disclosure Admission Gate     Friction objective profile       │
│  (deterministic ask-rule)    (deterministic share-rule)    (lexicographic, §OPTIMIZATION)   │
│  AI Candidate Quarantine contract   Leverage view ("Why this?")   "One Thing" selection      │
└──────┬───────────────┬───────────────┬───────────────┬───────────────┬────────────────────┘
       │ reads         │ reads         │ constrains    │ reads         │ reads
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────────────┐
│ PersonProfile│ │ domain-     │ │ PTC compiler│ │ NpiOwnership│ │ ApplicationPacket + │
│ + Candidate  │ │ evidence +  │ │ + dep index │ │ + Identity  │ │ ConsentGrant        │
│ Credential   │ │ trust-state │ │ + optimizer │ │ Tier        │ │ (sealed path)       │
│ (EXISTS)     │ │ (EXISTS)    │ │ (NEW-PTC)   │ │ (EXISTS)    │ │ (EXISTS, enforce ✗) │
└──────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘
```

**Owner boundaries (who owns what — MF never crosses these):**

| Concern | Owner | MF's relationship |
|---|---|---|
| Institutional policy meaning | PTC TrustSpec/compiler | MF *reads* dependency facts; never authors policy |
| Evidence truth & source coverage | domain-evidence / trust-state | MF *reads*; never mints evidence |
| Requirement satisfaction | PTC compiler | MF *reads* `satisfies`; never asserts it |
| Identity assurance state | `NpiOwnership` / `IdentityTier` | MF *reads* + maps actions→minimum assurance |
| Consent record & enforcement | `ApplicationPacket`/`ConsentGrant` | MF *constrains* (gate) + recommends wiring |
| AI extraction | `documentPipeline`/`CandidateCredential` | MF *quarantines*; never promotes |
| Employer decision | `employerWorkflowService` | MF never touches (out of boundary) |
| The friction plan | **MF** | the only new thing MF owns |

## 5. Answers to remaining architecture questions

- **Q5 (Career Graph backlinks without another graph):** Yes for provenance/what-was-shared; the
  `satisfies`/`matched_to` edges are gaps owned by PTC, not a new graph. Do not build a second graph.
- **Q6 (missing edge/provenance metadata):** `satisfies` edge; model-id + source-passage on
  candidates; persisted per-field provenance. Listed in §2.
- **Q17 (dependency analysis prevents unnecessary requests):** exactly — once `satisfies` exists,
  the Question Admission Gate can prove a fact is already covered and suppress the ask. Fixture-able
  in Demo-0 ahead of the compiler.
- **Q18 (what to maintain automatically):** source refresh + derived-state recompute +
  stale-projection expiry (all "owner=vitalcv" actions); never attest/share/accept/confirm-start.
- **Q19 (always human-authorized):** share private evidence, attest a fact, resolve a factual
  conflict, employer accept, confirm first day, delete source truth (thesis §23).
