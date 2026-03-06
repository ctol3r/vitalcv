# VitalCV Self-Review Report — 2026-03-06

## Build Status
- ✅ `pnpm turbo build` — 10/10 tasks successful
- ✅ `pnpm lint` — zero ESLint warnings or errors
- ✅ `tsc --noEmit` — zero type errors
- ✅ All wave 109–114 routes registered and wired in `app.ts`

## Findings

### 🔴 High Priority
| # | Issue | Location | Action |
|---|-------|----------|--------|
| H1 | 8 TODO/stub implementations | sourceVerifier.ts, documentPipeline.ts, BiometricPrompt.tsx, SelectiveDisclosureModal.tsx, clip/verify page, blockchain/ | Wave task: replace stubs with real integrations |
| H2 | 18 `console.log` calls in backend | Various services | Replace with `log()` from obs/logger — leaks debug info in production |

### 🟡 Medium Priority
| # | Issue | Location | Action |
|---|-------|----------|--------|
| M1 | `turbo` outdated: 2.8.5 → 2.8.14 | devDependency | Safe minor upgrade — PR in wave 120 |
| M2 | `@types/node` 20 → 25 | devDependency | Major bump — test before upgrading |
| M3 | `next` 15.2.8 → 16.1.6 | devDependency | Major upgrade — defer until stable |
| M4 | Chain A (waves 49–65) not merged | feature/interoperability-wave65 | 4 conflict files; unique features (MATCHA, mobile wallet, Apply SDK) — extract selectively in Wave 117 |
| M5 | No unit test suite | — | Add vitest unit tests in Wave 120 |
| M6 | No CI/CD pipeline | — | Add GitHub Actions in Wave 120 |

### 🟢 Low Priority
| # | Issue | Location | Action |
|---|-------|----------|--------|
| L1 | `WAVE68.md` / `WAVE92_TRUST_KNOWLEDGE_PROTOCOL.md` in repo root | Root | Move to `docs/` or archive |
| L2 | No OpenAPI/Swagger spec | — | Generate from routes in Wave 119 |
| L3 | Missing rate limiting on conformance/audit endpoints | conformance.ts, oid4vci.ts | Add `express-rate-limit` middleware |

## Opportunities

### Waves 115–120 Plan
| Wave | Theme | Key Deliverables |
|------|-------|-----------------|
| 115 | **Subscription Billing** | Stripe subscription tiers (Starter/Growth/Enterprise), API key management, usage metering, billing portal |
| 116 | **Analytics Dashboard** | Clinician acquisition funnel, verifier activity heatmap, revenue metrics, credential issuance trends |
| 117 | **Developer Experience** | API playground (`/developers`), SDK docs page, rate-limit middleware, OpenAPI spec generation |
| 118 | **Investor & Partner Portal** | `/investors` pitch page with live metrics, `/partners` inquiry form, partnership tier display |
| 119 | **Feedback & Growth Loop** | GitHub issues webhook, NPS modal, onboarding checklist, referral tracking |
| 120 | **Production Hardening** | GitHub Actions CI, vitest unit tests, Sentry error capture, dependency updates, health dashboard |

## Metrics to Track
- Credential issuances/day
- Verification requests/hour  
- Active issuers (trustRegistry count)
- Revocation rate
- API response p95 latency
- Monthly Recurring Revenue (MRR)
