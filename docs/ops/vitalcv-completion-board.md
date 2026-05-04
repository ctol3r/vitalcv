# VitalCV Completion Board
Last Updated: 2026-04-27 (post RELIABILITY-2 / PR #187 merge)
Source: RELIABILITY-2

## Philosophy
This board tracks the functional reality of VitalCV. 
* "Complete" means hardened, tested, and actively solving the buyer problem in the wedge context.
* It does *not* mean "we wrote a ticket for it" or "the mock exists."
* **Current Wedge Live Usability: 100% | +100 | production artifact updated and P0 route/API/mobile blockers fixed**

## CORE SYSTEM
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Trust Infrastructure | 87% | 0% | Core container and proof layers exist. |
| Truth / Enforcement | 94% | +3% | RELIABILITY-2 (PR #187, commit cbcc0390): live probe runner enforces LIVE only on confirmed 2xx; `noFakeLive.test.ts` proves cold store + all-fail batches yield zero LIVE. Stacks on RELIABILITY-1 (PR #186) state machine and TRUTH-ALIGN-1D (PR #183) public claims matrix. |
| Drift + Monitoring | 77% | +10% | RELIABILITY-2 (PR #187, commit cbcc0390): scheduled live probes via GitHub Actions (cron `*/15 * * * *` + `workflow_dispatch`); in-memory snapshot store with carry-forward semantics; internal API gated by `Authorization: Bearer <CRON_SECRET>` or `x-monitoring-secret` legacy header. 37 new tests (snapshotStore=8, runAllProbes=11, noFakeLive=4, probeRoute=10, snapshotsRoute=4). |
| Governance / Audit | 70% | 0% | ARTIFACT_EXPORTED captures safe metadata; compliance checks pass. |

## PRODUCT LOOP
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Holder Experience | 82% | 0% | Clinician profile expanded with Knowledge Inbox data capture model. |
| Verifier Experience | 88% | 0% | Employer console handles proof objects and CTAs gracefully on live site. |
| Hiring Loop | 45% | 0% | Basic acceptance signals work; integration into HRIS is 0%. |
| Pilot Ops / GTM | 93% | 0% | Pilot funnel is entirely unbroken end-to-end and live verified. |

## DATA + PSV
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Source Spine | 78% | +5% | RELIABILITY-2 (PR #187, commit cbcc0390): probe wrappers now invoked by scheduled runner; `runAllProbes` orchestrates NPPES / OIG / PECOS / state-board sequentially, never throws on per-source failure. State-board still UNKNOWN by design. |
| Authority Lanes | 32% | 0% | State boards require extensive adapter build-out. |
| Bulk / CSV / Imports | 30% | 0% | Some CSV ingest; roster management is manual. |

## INTELLIGENCE + UX
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Orchestrator / Decision Logic | 68% | 0% | Deterministic Knowledge Inbox classification (13 states) enforcing safe provenance triage. |
| UX / Usability | 100% | 0% | Mobile UI clips fixed; 16-section profile with provenance badges live; PWA foundation active. |
| Career Autopilot | 25% | 0% | Concept only. |

## ENTERPRISE
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Issuer / Trust Object | 78% | 0% | Knowledge Trust Graph panel mounts in product to explicitly display proof and evidence invariants. |
| Security / Compliance | 45% | +10% | TRUTH-ALIGN-1D (PR #183, commit 0e66b78c): Security / Compliance Truth +10 — "audit trail" / "HIPAA-aligned" / "SOC2 certified" / "W3C VC issued" overclaims removed from public surfaces; replaced with "audit-boundary metadata" and "VC-compatible architecture (planned)". Identity artifacts encrypted; HIPAA/SOC2 architecture still pending. |
| Deploy / Production Truth | 95% | 0% | Root `.vercel/project.json` → `vcv-web` canonical flow works. Backend 500s are now caught and safely degraded at the Edge. Domain verified. |

## OVERALL
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Launch Wedge Completion | 100% | 0% | P0 routes (ingest, review, pilot, employers, privacy, terms) all completely unblocked or gracefully degraded. |
| Pilot-Ready Completion | 99% | 0% | The pilot funnel is entirely clear of 404s and 500-level dead ends. Needs first live inbound. |
| Enterprise-Ready Completion | 42% | +2% | RELIABILITY-2 + RELIABILITY-1 + TRUTH-ALIGN-1D: scheduled source health monitoring with safe-metadata API; HIPAA/SOC2 architecture still pending. |
| **Overall VitalCV Completion** | **70%** | **+2%** | RELIABILITY-2 (PR #187) merged: live probe scheduling + snapshot store + internal API + GitHub Actions cron. 873/873 tests green; 88/88 source-health subset; web build passes. |

## Wave RELIABILITY-2 evidence (post PR #187 merge — commit cbcc0390)
* **Files added:** `apps/web/lib/source-health/runner/runAllProbes.ts`, `apps/web/lib/source-health/store/snapshotStore.ts`, `apps/web/app/api/internal/source-health/{probe,snapshots}/{route,_handler}.ts`, `apps/web/app/api/internal/source-health/_auth.ts`, `.github/workflows/source-health-probe.yml`. `getLaneSnapshots.ts` modified to read from store with UNKNOWN fallback (signature preserved).
* **Scheduling:** GitHub Actions — cron `*/15 * * * *` + `workflow_dispatch`, default-branch guard, `permissions: contents: read`, 5-minute timeout, no deploy step. Vercel cron deferred per directive.
* **Auth:** Dual-mode `Authorization: Bearer <CRON_SECRET>` (preferred for scheduled callers) OR `x-monitoring-secret: <MONITORING_SECRET>` (legacy/manual). `crypto.timingSafeEqual` constant-time compare with length-mismatch path consuming time. Fail-closed: 401 on mismatch, 500 when both env vars unset.
* **Truth invariants enforced in code:**
  * `LIVE` is emitted ONLY by a confirmed 2xx probe response.
  * Cold store → 4× UNKNOWN, zero LIVE (proven by `noFakeLive.test.ts`).
  * All-fail batch (5xx + timeout + 429 + network-error) → zero LIVE in result, store, AND surface fallback.
  * `runAllProbes` never throws on per-source failure; exceptions → `errors[]` + UNKNOWN snapshot with redacted reason token.
  * Response shapes are safe metadata only: `{ sourceId, state, reason, lastSuccessAt, lastErrorAt, lastLatencyMs, observedAt }`. No raw payloads, no headers, no NPI, no PII.
* **Tests:** 37 new — snapshotStore=8, runAllProbes=11, **noFakeLive=4**, probeRoute=10 (with deep-grep banned-substring assertion for `headers|body|payload|npi|firstName|lastName|email|ssn|dob`), snapshotsRoute=4. Source-health subset 88/88 pass; full repo 873/873.
* **Documentation:** `apps/web/lib/source-health/README.md` appended with "Live Probe Scheduling" section, cold-start truth note (snapshots ephemeral; durable persistence is next layer), secret rotation procedure, and verbatim classification-telemetry note: "Scheduled probe snapshots are classification telemetry, not credential verification and not clinician defects. A `DEGRADED` or `UNAVAILABLE` lane reflects upstream source health only — it never invalidates a clinician's profile, NPI, or any source-backed evidence captured during a `LIVE` window."
* **Codex verdict:** SAFE. All 14 verification criteria satisfied. No critical findings.

## Wave RELIABILITY-1 evidence (post PR #186 merge — commit 8d679e62)
* **Module added:** `apps/web/lib/source-health/` (state machine, contract, probes, aggregator, README) and `apps/web/components/source-health/` (LaneHealthBadge, LaneHealthSection, LaneHealthMount).
* **State machine:** `LIVE | DEGRADED | UNAVAILABLE | UNKNOWN | RATE_LIMITED`. `canEvidenceBeUpgraded(state)` returns true ONLY for `LIVE`. `assertNever` enforces exhaustiveness.
* **Contract:** `unavailableLane()` is deterministic, table-driven, banned-phrase-proof. RATE_LIMITED correctly sets `canRetryNow=false`.
* **Probes:** NPPES / OIG / PECOS / state-board, dependency-injected, never throw. State-board probe intentionally returns UNKNOWN — no faked LIVE.
* **Surfaces:** Lane health badges mounted on `/passport` and `/employer/dashboard` (5-line additions, no refactors).
* **Tests:** 51/51 source-health pass: 20 truth-table (4 sources × 5 states) + 17 banned-phrase regression + 9 runProbe + 5 aggregator. Zero banned-phrase violations.
* **Codex verdict:** SAFE. No critical findings.

## Wave TRUTH-ALIGN-1D evidence (post PR #183 merge — commit 0e66b78c)
* **Doc landed:** `docs/ops/vitalcv-public-claims-matrix.md` — 4-state taxonomy (Live / Partial / Planned / Forbidden), every shipped claim cross-checked to real code.
* **Copy reframe:** "audit trail" → "audit-boundary metadata" across marketing, employer, review, issuer surfaces (7 files).
* **Compliance pills replaced:** `['HIPAA-aligned', 'W3C VC', 'OID4VCI', 'ES256']` → `['Source-backed', 'NPPES identity', 'Provenance-tracked', 'VC-compatible architecture (planned)']`.
* **HomeSections / BentoGrid / StartClinicianAction:** explicit "on the roadmap and not yet shipped" qualifiers added for cryptographic signing.
* **Tests:** 763/763 pass, lint + typecheck clean. Codex verdict: SAFE.

## Wave GOD-3S evidence
* **Validation Proof:** 454/454 tests passed.
* **Architecture Safe:** Confirmed that Knowledge Inbox items map strictly to `USER_ENTERED` or `INFERRED` domains, with explicit graph rules preventing auto-upgrades to `VERIFIED` without a PSV receipt.

## Wave GOD-3 evidence
* **Inbox Capabilities:** Data models, types, and deterministic classification helper created to funnel free-text input safely into `USER_ENTERED` or `INFERRED` items without faking PSV checks.
* **Graph Updates:** 5 new node types and 5 new edge types added to architectural graph; 3 new explicit graph rules ensuring AI/ML triage never overrides real source evidence.
* **Validation:** 445 tests clean. Zero banned string collisions.

## Wave GOD-2 evidence
* **Profile Capabilities:** 16 distinct sections (identity, contact, locations, medical school, residency, fellowship, specialty, subspecialty, board certifications, licenses, work history, affiliations, research, publications, documents, career goals).
* **Provenance Enforcement:** Explicit 5-state vocabulary introduced (`VERIFIED`, `USER_ENTERED`, `INFERRED`, `UNKNOWN`, `CONFLICT`).
* **Knowledge Trust Graph Panel:** Built and mounted dynamically on the `PassportEntityClient` so clinicians see exactly what rules govern their evidence flow.

## Wave LIVE-102 evidence
* **Browser Audit Result:** LIVE WEDGE USABLE
* NPI action returned source-backed identity dynamically from the public proxy.
* UI fidelity properly renders `Pending` and `Access required` states instead of collapsing them to `Unavailable`.

## Wave LIVE-101 evidence
* **Browser Audit Result:** LIVE WEDGE USABLE
* NPI action returned source-backed identity dynamically.
* Overclaims prevented (NPPES is identity only, not licensure proof).
* Source fallback semantics are honest.

## Wave LIVE-100G evidence
* **Browser Audit Result:** LIVE WEDGE USABLE
* NPI action, employer path, pilot CTA, legal footer, and mobile basics were all explicitly verified live on vitalcv.com.

## Wave LIVE-100D evidence
* **Browser Audit Result:** LIVE WEDGE USABLE
* NPI action, employer path, pilot CTA, legal footer, and mobile basics were all explicitly verified live on vitalcv.com.

## Wave LIVE-100C evidence
* **Files changed**: `apps/web/app/api/ingest/[npi]/route.ts` (Graceful 5xx fallbacks), `apps/web/app/employers/page.tsx` (Redirect to `/pilot`), `apps/web/app/privacy/page.tsx`, `apps/web/app/terms/page.tsx`, `apps/web/app/review/page.tsx`, `apps/web/app/review/request/page.tsx`, `apps/web/components/layout/Navbar.tsx`, `apps/web/components/layout/Footer.tsx`, `apps/web/__tests__/buyer-proof-page.test.tsx`, `apps/web/__tests__/ingest-proxy-fallback.test.ts`.
* **Wedge Recovery**: Homepage hero no longer hard-crashes the app when the backend is restarting/unavailable, but safely serves bounded, truth-preserving "pending/unavailable" lanes so the UI can proceed.

## Wave LIVE-100B evidence
* **Knowledge Trust Graph**: 9-node static panel mounted at `/passport/[id]`, collapsible TrustGraphXRay available but not page-mounted.
* **Provenance vocabulary**: 5-tier (VERIFIED / USER_ENTERED / INFERRED / UNKNOWN / CONFLICT) enforced in source and tested against banned overclaims.

## Wave LIVE-100 canonical-app evidence
* Canonical repo root: `/Users/christoler/vitalcv`
* Canonical app: `apps/web` (`@vitalcv/web`)
* Root Vercel project: `vcv-web` (`prj_TFcurSwwzG2TCvR9INCVcZlGPiDZ`), buildCommand `pnpm turbo run build --filter=@vitalcv/web`
* Legacy / non-canonical Vercel project: `vitalcv-marketing` (`prj_Rsi0LSCEbf9QUzVnxEz1uCqmvgXo`)
* Deploy-path doc: `docs/ops/deploy-canonicality.md`
