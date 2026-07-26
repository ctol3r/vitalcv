# W200-1 — Passport Architecture Gap Analysis

**Wave:** 200 (Revenue Wedge Extraction)
**Deliverable target:** the *Verified Clinician Career Packet* — a read-only, shareable, source-backed evidence artifact at `/packet/[entityId]` plus a PDF.
**Date:** 2026-06-20
**Status:** analysis complete — gates W200-2 (spec), W200-3 (UI), W200-4 (PDF).

---

## 0. Headline finding

**The passport substrate is already ~80% of the Career Packet.** The roadmap is written as if packet generation needs net-new data plumbing; it does not. VitalCV already ships:

- a hydrated, NPI/entity-keyed `PassportData` contract with identity, authority, training, standing, readiness, source-coverage, and trust-posture dimensions;
- a working readiness engine (`computeReadiness` / `computeDeterministicTrustReadiness`) with a defensible score, blockers, gaps, and next-actions;
- a canonical source-coverage state model (`checked / stale / pending / gated / unavailable / accessRequired / reviewRequired / notDecisionGrade / previewOnly`) with freshness and provenance;
- a **gated PDF exporter** (`@react-pdf/renderer`) behind `/api/export/packet?npi=` with a real export-gate (`resolveEmployerPacketExportGate`);
- an **employer review surface** at `/review/[entityId]` with share-token (`chk_*`) resolution.

The actual W200 gap is **not data** and **not export plumbing**. It is **a single read-only assembly surface** (`/packet/[entityId]`) that composes existing data into the six roadmap-named sections (Executive / Identity / Readiness / Verification / Evidence / Recruiter / Employer views) and the **recruiter-readable framing + recommendations layer**, which does not exist yet.

This changes the W200 plan from "build a generator" to "**assemble + frame existing primitives, honestly gated**."

---

## 1. Existing data — what we already have

### 1.1 Canonical passport contract

`apps/web/lib/trust/passport-contract.ts` → `PassportData`:

| Dimension | Fields (abridged) | Packet section it feeds |
|---|---|---|
| `identity` | `displayName, specialty, entityType, status, npi` | Identity Summary |
| `authority` | `credentials[] {domain, type, status, jurisdiction, issuedAt, expiresAt, verifiedAt, stale, confidenceLabel, reviewRequired}`, `summary {active, expired, stale, missing}` | Credential Readiness, Verification Sources |
| `training` | `records[] {recordType, degreeOrTitle, programName, institutionName, endYear, completed, verificationLevel}` | Evidence Summary |
| `standing` | `exclusionStatus, licensureStatus, deaStatus, pecosEnrollmentStatus, negativeFindings[]` | Trust Signals, Credential Readiness |
| `readiness` | `status (DECISION_GRADE\|PARTIAL\|CHECKING\|BLOCKED), score 0-100, level, blockers[], gaps[], estimatedStartDays, nextActions[]` | Credential Readiness, Recommendations |
| `sources` / `sourceCoverage` | `checks[] {sourceId, state, reason, checkedAt, observedAt, expiresAt, artifactId, sourceUrl, checksum, proof}`, `summary` | Verification Sources, Missing Evidence |
| `trustPosture` | `band, bandLabel, score, dimensions[], freshness, safeToRelyOnNow[], missingItems[], blockers[]` | Trust Signals |
| `truth` | `CanonicalTruthSet {identity, safety, authority, eligibility}` | Trust Signals |
| `lineageKey` | deterministic replay hash | Audit / provenance footer |
| `_degraded` | incomplete-hydration flag | honesty banner |

### 1.2 Entity identity & data flow

- **NPI-keyed** (`packages/ingest/npi.ts` — Luhn-validated, CMS NPPES live fetch) **and entityId-keyed** (UUID v4).
- Backend: `GET /api/passport/npi/:npi` and `GET /api/passport/entity/:id` (`apps/api/backend/src/routes/passportEntity.ts`) return fully-hydrated `PassportData`.
- Web proxy + degraded fallback: `apps/web/app/api/passport/npi/[npi]/route.ts` (NPPES-only hydration if backend down → sets `_degraded`).
- Fixtures: `tests/fixtures/clinician.ts`.

### 1.3 Readiness engine (real, not mock)

- `apps/api/backend/src/services/verticals/readiness/readinessEngine.ts` → `computeReadiness()`.
- `apps/api/backend/src/services/trust/trustCore.ts` → `computeDeterministicTrustReadiness()`, `deriveReadinessState()`, `deriveTrustBandFromReadiness()`.
- Weighted dimensions: identity 20 / exclusion 30 / licensure 30 / enrollment 20 = 100.
- Endorsement-timeline logic with compact-state awareness (`endorsementDelays.ts`) → `estimatedStartDays` / `clearToStartDate`.

### 1.4 Source coverage & live sources

- State vocabulary in `packages/trust-state/sourceCoverage.ts`; **only `checked` is decision-grade**.
- Live launch-spine sources: `NPPES_API`, `NPPES_BULK`, `OIG_LEIE`, `PECOS_PUBLIC` (decision-grade); `DOCTORS_CLINICIANS` (enrichment, non-decision-grade). Catalog: `apps/api/backend/src/services/identity/sourceCatalog.ts`.
- Mock/preview detection: `artifactLooksMock()` — keeps synthetic payloads out of decision-grade scoring.

### 1.5 PDF export (already gated and shipping)

- Renderer: `apps/web/lib/export/employer-proof-packet-pdf.tsx` → `renderEmployerProofPacketPdf()` (`@react-pdf/renderer`, SHA-256 packet hash).
- Gate: `apps/web/lib/export/export-gating.ts` → `resolveEmployerPacketExportGate()` blocks on non-decision-grade readiness, blockers, stale/gated/missing sources; emits `survivabilityScore` + `replayAttribution`.
- Route: `apps/web/app/api/export/packet/route.ts` (`GET ?npi=`, Clerk-gated, returns `application/pdf` with `X-VitalCV-Export-Gate*` headers).
- Filename: `vitalcv-employer-packet-<npi>.pdf`.

### 1.6 Reusable UI inventory (immediately composable for `/packet`)

| Component | Path | Use in packet |
|---|---|---|
| `PassportTrustPosture` | `components/passport/PassportTrustPosture.tsx` | Trust Signals block (bands, dimensions, safe/blockers/review/stale/missing) |
| `TrustStatusBadge` | `components/ui/trust-status-badge.tsx` | per-source / per-credential status chips |
| `CandidateResultCard` | `components/employer/CandidateResultCard.tsx` | Recruiter-view candidate card (CRS ring, drivers, credentials) |
| `TrustStatePanel` | `components/employer/TrustStatePanel.tsx` | Employer-view "Start Ready" + blocking reasons |
| `CredentialReadinessCard` | `components/clinician/CredentialReadinessCard.tsx` | Credential Readiness section |
| `CRSRing` | `components/ui/*` | score visualization |
| `Card / GlassCard / Badge` | `components/ui/*` | layout + status primitives |
| `LaneHealthMount` | `components/source-health/LaneHealthMount.tsx` | source-health strip |
| `SharePacketModal` | `components/*` | shareable-link affordance (W210-4 hook) |

---

## 2. Missing data / components — the real W200 gap

| # | Gap | Severity | Notes |
|---|---|---|---|
| G1 | **No `/packet/[entityId]` route.** Packet exists only as an API-only PDF. | **P0** | This is the W200-3 deliverable. No new auth, no wallet dep — server-fetch `PassportData` and compose. |
| G2 | **No "Executive Summary" synthesizer.** Roadmap wants a one-glance verdict; `readiness` + `trustPosture` exist but nothing renders the 3-sentence "who is this / are they ready / what's missing" header. | **P0** | Pure derivation from existing fields. No new data. |
| G3 | **No "Recruiter View" framing layer.** `CandidateResultCard`/`TrustStatePanel` are *employer-review* oriented (match drivers, CRS). Recruiter wants ready / needs-review / blocked / missing-evidence at a glance (W210-2). | **P0** | Derivable from `readiness.status` + `trustPosture.band` + `sourceCoverage.summary`. |
| G4 | **No "Recommendations / next steps" presentation.** `readiness.nextActions[]` and `gaps[]` exist as data but aren't surfaced as a clinician-actionable list in a packet context. | **P1** | Render-only. |
| G5 | **No "Missing Evidence" honest-gap panel** assembled from `sourceCoverage.summary` (gated / stale / accessRequired / notDecisionGrade buckets) into human copy. | **P1** | `statusCopy.ts` partially exists; needs packet-context copy. |
| G6 | **PDF model ≠ packet sections.** `EmployerProofPacketPdfModel` covers identity + source table + hash, **not** the six roadmap sections (no recruiter view, no recommendations, no evidence summary). | **P1** | W200-4 must extend the PDF model to match the W200-2 spec, reusing the same derivation functions as the UI (single source of truth). |
| G7 | **No entity-keyed export.** Export route is `?npi=` only; `/packet/[entityId]` needs an entityId→PDF path (or resolve entityId→npi server-side). | **P1** | Small route addition. |
| G8 | **Honesty/banned-string surface.** New copy in packet sections must pass `pnpm check:claims` + `banned-verified-label.test.ts`. No bare `Verified`; gated/stale must read as gated/stale. | **P0 (constraint)** | Not a feature gap — a guardrail every new string crosses. |

**What is explicitly NOT missing** (do not rebuild): the readiness math, the source-coverage model, the PDF engine, the export gate, the share-token mechanism, the trust-posture renderer.

---

## 3. Reusable APIs / services / UI (summary)

**APIs ready to extend, not build:**
- `GET /api/passport/entity/[id]` — packet data fetch.
- `GET /api/passport/npi/[npi]` — NPI path + degraded fallback.
- `GET /api/export/packet?npi=` — PDF (extend to entityId, extend model per W200-2).
- `/review/[entityId]` + share-token (`chk_*`) resolution — sharing pattern to reuse for W210-4.

**Services ready to reuse:** `resolveEmployerPacketExportGate`, `renderEmployerProofPacketPdf`, `computeDeterministicTrustReadiness`, `resolveCanonicalSourceCoverageState`, `statusCopy`.

**UI ready to reuse:** see §1.6.

**Net-new to build in W200:** one route (`/packet/[entityId]`), ~4 derivation helpers (executive summary, recruiter-status rollup, recommendations list, missing-evidence copy), and the extended PDF model — all pure transforms over `PassportData`, sharing one derivation module between UI and PDF.

---

## 4. Dependency diagram

```mermaid
flowchart TD
  NPI[NPI / entityId] --> INGEST[packages/ingest/npi.ts\nLuhn + NPPES live]
  INGEST --> BACKEND[GET /api/passport/:id\npassportEntity.ts]
  BACKEND --> ENGINE[Readiness engine\ntrustCore.computeDeterministicTrustReadiness]
  ENGINE --> PASSPORT[(PassportData\npassport-contract.ts)]
  SRC[Source catalog\nNPPES/OIG/PECOS] --> COVERAGE[sourceCoverage state model\nchecked/stale/gated/...]
  COVERAGE --> PASSPORT

  PASSPORT --> DERIVE{NEW: packet derivation\nexec summary / recruiter rollup\n/ recommendations / missing-evidence}

  DERIVE --> UI[NEW: /packet/[entityId]\nread-only assembly\nreuses PassportTrustPosture,\nCandidateResultCard, CRSRing]
  DERIVE --> PDFMODEL[EXTEND: EmployerProofPacketPdfModel]

  PDFMODEL --> GATE[resolveEmployerPacketExportGate\nDECISION_GRADE only]
  GATE -->|allowed| PDF[renderEmployerProofPacketPdf\n@react-pdf + SHA-256]
  GATE -->|blocked| BLOCK[409 + replayAttribution]

  UI --> SHARE[Reuse share-token chk_*\n→ W210-4]
  UI -.->|export button| PDFMODEL

  classDef new fill:#1b5e20,color:#fff,stroke:#0a3d12;
  classDef extend fill:#5d4037,color:#fff,stroke:#3e2723;
  class DERIVE,UI new;
  class PDFMODEL,GATE extend;
```

Legend: green = net-new (W200), brown = extend existing, uncolored = already shipping.

---

## 5. Constraints carried into W200-2/3/4 (doctrine compliance)

1. **Partial stays partial** (Trust Graph Rule 5). The packet may render a PARTIAL readiness; it may never present partial as decision-grade. Export gate already enforces this — the UI must visually match.
2. **No bare `Verified`** and **no banned strings**. Every new packet string passes `pnpm check:claims` + `banned-verified-label.test.ts`. Gated/stale/unknown render honestly; revoked fails closed.
3. **Issuer-verification helpers stay pure.** The derivation module is a pure transform over `PassportData` — no fetches, no audit writes, mirroring `receiptCandidate.ts` / `policyReview.ts` discipline.
4. **Single derivation source of truth.** UI and PDF consume the *same* helper functions so the screen and the PDF can never disagree (current employer-packet code already keeps PDF derivation centralized — extend, don't fork).
5. **Zero PHI on any export.** Packet carries source-backed credential evidence only.
6. **Canonical path preserved:** Recognition → Acceptance → Start. Packet is the shareable artifact in that path, not a new product surface.

---

## 6. Done-criteria check (W200-1)

- [x] Complete architecture map — §1 (data, identity, engine, sources, PDF, UI inventory).
- [x] Reusable components identified — §1.6, §3.
- [x] Missing components documented — §2 (G1–G8 with severity).
- [x] Dependency diagram included — §4.

## 7. Recommended sequencing into W200-2

1. **W200-2 spec** defines the six packet sections as pure functions of `PassportData` and pins the derivation module API (one signature reused by UI + PDF).
2. **W200-3 UI** builds `/packet/[entityId]` from existing components + the new derivation helpers; honest gating visually mirrors the export gate.
3. **W200-4 PDF** extends `EmployerProofPacketPdfModel` to the same six sections via the shared derivation module; adds entityId→export path.

The critical insight for the builder: **W200 is an assembly + framing wave, not a data wave.** Estimate is dominated by copy/honesty review and the recruiter-framing derivation, not by new infrastructure.
