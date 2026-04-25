# VitalCV Completion Board
Last Updated: 2026-04-24 (post Wave ISSUER-1)
Source: Wave ISSUER-1

## Philosophy
This board tracks the functional reality of VitalCV. 
* "Complete" means hardened, tested, and actively solving the buyer problem in the wedge context.
* It does *not* mean "we wrote a ticket for it" or "the mock exists."
* **Current Wedge Live Usability: 100% | +100 | production artifact updated and P0 route/API/mobile blockers fixed**

## CORE SYSTEM
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Trust Infrastructure | 90% | +3% | Issuer verification request routing and status tracking established. |
| Truth / Enforcement | 71% | 0% | Identity, OIG, PECOS enforced; licensure lanes sparse. |
| Drift + Monitoring | 62% | 0% | Freshness timers run, but active re-checks need ops testing. |
| Governance / Audit | 70% | 0% | ARTIFACT_EXPORTED captures safe metadata; compliance checks pass. |

## PRODUCT LOOP
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Holder Experience | 82% | 0% | Clinician profile expanded with Knowledge Inbox data capture model. |
| Verifier Experience | 88% | 0% | Employer console handles proof objects and CTAs gracefully on live site. |
| Hiring Loop | 50% | +5% | Verification routing maps built for clearinghouses, GME offices, and boards. |
| Pilot Ops / GTM | 93% | 0% | Pilot funnel is entirely unbroken end-to-end and live verified. |

## DATA + PSV
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Source Spine | 70% | 0% | NPPES fallback identity pipeline recovered; honest fallback cadence implemented for OIG/PECOS. |
| Authority Lanes | 35% | +3% | Issuer/partner verification boundaries defined (e.g. National Student Clearinghouse). |
| Bulk / CSV / Imports | 30% | 0% | Some CSV ingest; roster management is manual. |

## INTELLIGENCE + UX
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Orchestrator / Decision Logic | 70% | +2% | Deterministic Knowledge Inbox and Issuer Partner routing rules active. |
| UX / Usability | 100% | 0% | Mobile UI clips fixed; 16-section profile with provenance badges live; PWA foundation active. |
| Career Autopilot | 25% | 0% | Concept only. |

## ENTERPRISE
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Issuer / Trust Object | 80% | +2% | Trust graph expanded to handle Consent Artifacts, Issuers, and Verification Partners. |
| Security / Compliance | 35% | 0% | Identity artifacts encrypted, but HIPAA/SOC2 architecture pending. |
| Deploy / Production Truth | 95% | 0% | Root `.vercel/project.json` → `vcv-web` canonical flow works. Backend 500s are now caught and safely degraded at the Edge. Domain verified. |

## OVERALL
| Area | Completion | Delta | Why |
| :--- | :--- | :--- | :--- |
| Launch Wedge Completion | 100% | 0% | P0 routes (ingest, review, pilot, employers, privacy, terms) all completely unblocked or gracefully degraded. |
| Pilot-Ready Completion | 99% | 0% | The pilot funnel is entirely clear of 404s and 500-level dead ends. Needs first live inbound. |
| Enterprise-Ready Completion | 40% | +2% | Security/Compliance boundaries + Issuer verification tracking initiated. |
| **Overall VitalCV Completion** | **68%** | **+2%** | Tests green (468 tests), live-URL verified, Issuer confirmation hub foundation merged. |

## Wave ISSUER-1 evidence
* **Issuer Verification:** Added data models for `IssuerVerificationRequest`, `ConsentArtifact`, and `IssuerResponse`.
* **Partner Router:** `routeVerificationClaim` implemented to deterministically map education to clearinghouses, residency to GME offices, and background checks to CRA partners.
* **Graph Updates:** 7 new node types (Issuer, ConsentArtifact, etc.) and 9 new edges (ROUTES_TO, CONSENTS_WITH) added to the architectural Trust Graph. 5 explicit trust invariants enforced to ensure an issuer *request* never upgrades the proof tier prematurely.
* **Validation:** 468 tests green.

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
