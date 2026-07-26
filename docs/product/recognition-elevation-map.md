# Recognition Elevation Map

**Mission:** make VitalCV Recognition a first-class clinician-facing artifact — visible, understandable,
shareable, and verifiable — by reusing the systems that already generate and store it.
**Date:** 2026-07-01. **Base:** `origin/main` @ `2486f7f2d`.

Doctrine anchor (frozen, `MASTER_PROMPT.md §3`): the canonical path is
`Recognition → Acceptance → Start`; Recognition anchors to at least one valid PSV receipt;
revocation fails closed. Copy discipline: holder-facing **"Present VitalCV Recognition"**,
employer/verifier-facing **"Accept VitalCV Authority"**, decision verb **"Accept as head start"**.

---

## 1. What recognition concepts already exist?

| Concept | Where | Status |
| --- | --- | --- |
| `RecognitionEvent` (employer-signed, PSV-anchored) | `packages/domain-events/RecognitionEvent.ts`, spec in `packages/domain-common/employmentContracts.ts` | REAL, frozen spec |
| `EmployerAcceptance` (dual-signed, references Recognition) | `packages/domain-events/EmployerAcceptance.ts` | REAL, frozen spec |
| `StartAttestation` | `packages/domain-events/StartAttestation.ts` | REAL, frozen spec |
| `RecognitionStatus` lifecycle (`ACTIVE / REVOKED / EXPIRED`) | `packages/shared/recognition/RecognitionStatus.ts` | REAL resolver |
| Evidence classes `recognition / acceptance / start` | `packages/domain-evidence/src/types.ts` | REAL taxonomy; not yet materialized at runtime |
| `RecognitionImpact` on career events + `TimelineProjection.recognition` subset | `packages/domain-evidence/src/timeline/timeline.ts:40,74` | REAL projector, empty input today |
| Trust-state gate `MISSING_ACCEPTANCE` blocking `start_ready` | `packages/trust-state/contracts.ts`, `TrustStateResolver.ts` | REAL |
| Acceptance history contract (`EmployerAcceptanceHistoryEntry`, summary headline/trustCopy) | `apps/web/lib/employer-review-actions.ts:51-73` + normalizer | REAL, employer-side only |

## 2. Where is Recognition generated?

Employer review actions. `POST /api/employer-review/:entityId/accept` (backend
`apps/api/backend/src/routes/employerActions.ts`, service
`services/entity/employerReviewActions.ts#recordEmployerReviewAcceptance`) writes an
`employer_acceptance` durable record plus a non-repudiable `EMPLOYER_REVIEW_ACCEPTED` audit event
with a `DecisionTrustSnapshot`. The web proxy is
`apps/web/app/api/employer-review/[entityId]/[action]/route.ts`. Canonical
`recognition/acceptance/start` Prisma tables (Wave 240) also exist with repositories
(`repositories/recognitions.repo.ts`); the legacy `employer_acceptances` path is what the live
employer review surface writes today.

## 3. Where is Recognition stored?

PostgreSQL via Prisma (`apps/api/backend/prisma/schema.prisma`): canonical `recognition`,
`acceptance`, `start` tables (lines ~27–82) and the legacy `employer_acceptances` table (~471).
The clinician-readable projection is derived from `auditEvent` rows
(`type = 'EMPLOYER_REVIEW_ACCEPTED'`, keyed by `clinicianId = NPI`) in
`loadEmployerAcceptanceHistory` — real persistence, no fixtures.

## 4. Where is Recognition surfaced today?

- **Employer side (prominent):** `/review/[entityId]` shows acceptance history + decision console
  ("Accept as head start").
- **Clinician side (buried):** only as application status — `/holder/applications` "Accepted"
  metric card and per-application status/timeline
  (`components/mobile/ClinicianApplicationsSurface.tsx:61,83`,
  `ClinicianApplicationDetailSurface.tsx`).
- **Nowhere on:** `/holder` (root passport view), `/holder/home` (momentum dashboard),
  `/holder/readiness`, `/verify/[npi]` (public verifier), `/packet/[entityId]` (career packet has
  no acceptance section), `/activity/[npi]` timeline (projector supports recognition events but the
  passport→evidence adapter in `apps/web/lib/evidence/passport-to-evidence.ts` never emits them).

## 5. Where can clinicians share it?

Nowhere explicitly. Share plumbing exists — `POST /api/share`, `POST /api/apply/share`,
`/review/chk_<token>` recipient flow, public `/verify/[npi]`, `/packet/[entityId]` — but none of it
is framed as "present your Recognition", and the holder surfaces have no share affordance for it.

## 6. Where is it buried or mislabeled?

- Acceptance = Recognition-in-product, but it is labeled only as an application status inside
  `/holder/applications`.
- `/holder/timeline` metadata promises "recognition" events, then redirects to `/activity/[npi]`
  which can never contain them (adapter gap, §4).
- `/api/employer-review/:entityId/acceptance-history` is a public read with a ready-made summary
  (`headline`, `acceptedOrganizationCount`, `trustCopy`) that no clinician surface consumes.
- Old "Accept Recognition" intake UI is dead code under `apps/web/app/_archive/wave119/`.

## 7. Which routes/components/APIs already exist?

- Public read: `GET /api/employer-review/[entityId]/acceptance-history` (web proxy whitelists it in
  `PUBLIC_READ_ACTIONS`; backend keys on clinician NPI).
- Types + response normalizer: `apps/web/lib/employer-review-actions.ts`.
- Public verification: `/verify/[npi]`, `/verify` (JWT), `/verify/receipt/[receiptId]`,
  `/review/chk_*`, `/packet/[entityId]` — all registered in
  `components/layout/publicSurfaceRoutes.ts`.
- Timeline: `GET /api/timeline/[entityId]` → `projectTimeline` (accepts NPI via
  `resolvePassportRuntimePassport`).
- Holder data: `/api/me/workspaces` → `personProfile.npi`; `ClinicianMobileProvider` already holds
  `activeApplications[].status === 'ACCEPTED'`.

## 8. What is fake, duplicated, or missing?

- **Fake:** `components/sandbox/SharePacketModal.tsx` generates `Math.random()` share links (demo
  only — do not reuse). `TrustConsentModal` is a UI shell with no persistence.
- **Duplicated:** canonical `acceptance` table vs legacy `employer_acceptances` (live path);
  two holder "homes" (`/holder` and `/holder/home`).
- **Missing:** (a) any NPI-keyed read of acceptance history — the resolver
  (`resolveEmployerReviewSubject`) only accepts a `vcvEntity` UUID, and the holder context only has
  an NPI; (b) a clinician-facing Recognition surface; (c) recognition events in the timeline
  projection input; (d) acceptance visibility on the public verifier.

## 9. Smallest product change that makes Recognition obvious

Let the existing public acceptance-history read accept an NPI, then consume it everywhere the
clinician already looks: a Recognition card on holder home, a `/holder/recognition` detail surface,
share affordances that point at the existing public verifier, an acceptance panel on
`/verify/[npi]`, and acceptance events merged into the timeline projection. No new trust model, no
new storage, no demo data.

---

## PR buckets

| # | PR | Scope | Risk tier |
| --- | --- | --- | --- |
| A | `recognition/npi-acceptance-history` | Backend: acceptance-history route resolves 10-digit NPI inputs (scoped to that GET; mutations untouched) + tests. Carries this map doc. | **Tier 2** — public backend read, needs external review |
| B | `recognition/home-card` | Web: `RecognitionCard` on `/holder` fed by NPI → acceptance-history; "Accepted as head start" metric on `ClinicianHomeSurface` from existing provider data. Honest empty state. | **Tier 1** — self-merge after tests/build/prod check |
| C | `recognition/detail-surface` | Web: `/holder/recognition` — "Present VitalCV Recognition": history entries, what acceptance means, PSV anchoring explainer; linked from card + applications. Route added to `holder-route-contract` surfaces. | **Tier 1** |
| D | `recognition/share-and-verify` | Web: share affordances on the detail surface (copy real `/verify/[npi]` link, reuse presentation actions); acceptance panel on public `/verify/[npi]` so recipients see acceptances without an account. | **Tier 1** |
| E | `recognition/timeline-events` | Web: merge acceptance-history into `/api/timeline/[entityId]` as `acceptance`-class evidence so `/activity/[npi]` renders recognition events (projector already supports them). | **Tier 2** — touches trust/timeline semantics |

Copy rules for all buckets: never bare "Verified"; no banned phrases (`CLAUDE.md`); use
"Accepted as a head start", "Recognition recorded", "Present VitalCV Recognition"; empty states are
honest ("No employer acceptances recorded yet"); acceptance is presented as an employer decision
record, never as a credential guarantee.

## Definition of done (mission)

A clinician can answer immediately: **Am I recognized?** (home card), **What does it mean?**
(detail surface), **How do I share or prove it?** (share affordances + public verifier).

---

## Wave 2D closure — verified state as of 2026-07-02

All five buckets above are merged and deployed. This section supersedes the gap claims in
§4 ("Nowhere on"), §5 ("Nowhere explicitly"), §6, and §8 "Missing" (a)–(d) — kept above,
unrewritten, as the point-in-time record of what this mission changed.

| Bucket | PR | Landed as |
| --- | --- | --- |
| A — NPI acceptance read | [#484](https://github.com/ctol3r/vitalcv/pull/484) | `resolveEmployerReviewSubjectByNpi` (read-only) on `GET /api/employer-review/[npi]/acceptance-history` |
| B — home card | [#485](https://github.com/ctol3r/vitalcv/pull/485) | `components/recognition/RecognitionCard.tsx` on `/holder` + `ClinicianHomeSurface` (`/holder/home`); honest tri-state (recognized / none recorded / unavailable-as-system-state) |
| C — detail surface | [#486](https://github.com/ctol3r/vitalcv/pull/486) | `/holder/recognition` → `components/recognition/RecognitionSurface.tsx`; entries carry org label, scope, accepted date |
| D — share + public verifier | [#487](https://github.com/ctol3r/vitalcv/pull/487) | `ShareRecognitionPanel` ("Present VitalCV Recognition", copy-link → public `/verify/[npi]`); "Employer acceptances" panel on `/verify/[npi]` |
| E — timeline events | [#488](https://github.com/ctol3r/vitalcv/pull/488) | acceptance history merged into `GET /api/timeline/[entityId]` for NPI subjects (`lib/recognition/acceptance-evidence.ts`); `/activity/[entityId]` consumes this route, so `/holder/timeline` → `/activity/[npi]` renders them — the §6 adapter gap is closed |

**Post-mission fix:** [#490](https://github.com/ctol3r/vitalcv/pull/490) restored the public
verifier after the W1300 tenant guard left `/api/trust-proof/` off its allowlist — production
`/verify/[npi]` had rendered "NPI not found" for every NPI, making Bucket D unreachable.
`/verify/[npi]` now reads `GET /api/passport/npi/:npi` (anonymous by design, redacted credential
labels for anonymous viewers) and the redacted trust-proof read is public again.

**Production verification (2026-07-02, web deploy `43304d495` SUCCESS 09:48Z):**

- `GET api.vitalcv.com/api/trust-proof/1003000126` → 200 (was 401 `organization_context_required`).
- `GET api.vitalcv.com/api/employer-review/1003000126/acceptance-history` → 200,
  `{"headline":"No prior acceptances","history":[]}` — honest zero-state, no fabrication.
- `https://vitalcv.com/verify/1003000126` → full verifier view: identity, source-coverage lanes,
  readiness, "Employer acceptances" section present; "NPI not found" absent.
- `GET vitalcv.com/api/timeline/1003000126` → 200 `vitalcv.timeline.v1` projection (coverage
  events; `recognitionImpact: "none"` — truthful, zero acceptances recorded in production).

**Honest limits of this verification:**

- Production has **zero recorded employer acceptances**, so the recognized-state card, populated
  detail surface, and timeline recognition events are test-verified only
  (`recognition-card.test.tsx`, `recognition-share-verify.test.tsx`, `holder-route-contract.test.ts`);
  production shows them after the first real accept.
- Gated `/holder/*` surfaces are proven by the route-contract suite + deploy freshness, not a
  signed-in browser pass (Clerk's CDN bot-blocks automated browsers; a 307→sign-in only proves
  middleware fired). Chris's signed-in pass remains the outstanding human check.
- Backend `GET api.vitalcv.com/api/timeline/:id` directly returns 401 (tenant guard). The clinician
  path does not use it — the web route composes the projection in-process — but any future external
  timeline consumer will need an allowlist decision like #490's.

**DoD status:** visible (card on both holder homes) · understandable (`/holder/recognition`) ·
shareable (Present VitalCV Recognition → copy-link) · verifiable (public `/verify/[npi]`,
production-proven). Recognition is a career asset a clinician can present; the record is
NPI-keyed, anonymized-org, and survives across opportunities.
