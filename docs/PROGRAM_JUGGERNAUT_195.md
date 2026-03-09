# PROGRAM JUGGERNAUT — Wave 195 Launch Hardening

**Status:** All 16 waves (180–195) complete and merged to main.  
**Generated:** 2026-03-08

---

## IA & Route Map

### Public routes
| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/explore` | Trust-native opportunities board (filter-rich, public-first) |
| `/employers` | Employer directory + compare mode |
| `/employers/[slug]` | Full employer profile + Ask-about-employer + requirements |
| `/search` | Unified search page |
| `/ask` | Ask VitalCV natural language answer engine |
| `/get-ready` | Readiness check + prequalification entry |
| `/login` | Sign in |
| `/signup` | Sign up |
| `/opportunities/[id]` | Opportunity detail page |

### Authenticated — Clinician (holder)
| Route | Description |
|-------|-------------|
| `/holder/home` | Clinician workspace home |
| `/holder/readiness` | Credential readiness + gaps |
| `/holder/opportunities` | Personalized matched opportunities |
| `/holder/share` | Share clinical passport |
| `/holder/referrals` | Referral dashboard + ambassador program |

### Authenticated — Verifier (employer)
| Route | Description |
|-------|-------------|
| `/verifier/home` | Verifier workspace home |
| `/verifier/candidates` | Prequalified candidate queue |
| `/verifier/opportunities` | Published opportunities + pipeline |
| `/verifier/company` | Employer profile management |

### Shared
| Route | Description |
|-------|-------------|
| `/workspace/switch` | Persona/workspace switcher |

---

## Workspace Model

One login supports three persona modes:

| Mode | NPI Type | Routes |
|------|----------|--------|
| Clinician | Type 1 (individual) | `/holder/*` |
| Verifier | Type 2 (organization) | `/verifier/*` |
| Both | Type 1 + Type 2 | Full access |

Schema: `PersonProfile`, `OrganizationProfile`, `WorkspaceMembership`, `WorkspacePreference`.  
API: `GET /api/me/workspaces`, `POST /api/workspaces/switch`.

---

## Search System

Wave 184–185:
- `SearchObject` Prisma model with `SearchObjectACL` for role/org gating
- BM25 keyword + vector retrieval + structured filters + graph traversal
- Intent classification → retrieval plan → answer composer → source citation
- Guardrails: no answer without sources, no unauthorized disclosure, no black-box advice
- Sources: public pages, employer pages, opportunities, trust-state, docs

API: `POST /api/search/query`, `POST /api/search/suggest`, `GET /api/search/index-status`, `POST /api/ask`

---

## MATCHA System

Wave 187:
- 6-dimension scoring: credential gating, state/specialty, schedule/location, compensation, intent, employer preference + prequalification bonus
- Bands: CLEAR (≥85) / NEAR_CLEAR (≥60) / PARTIAL (≥30) / INELIGIBLE
- Every result returns: score, band, confidence, fit reasons, blockers, missing credentials
- Instant offer eligibility: CLEAR + prequalified + no soft blockers

API: `GET /api/matcha/opportunities/:npi`, `POST /api/matcha/explain`, `POST /api/matcha/intent`, `GET /api/matcha/instant-offer/:npi/:id`, `GET /api/matcha/analytics`

---

## Referral Policy

Wave 191:
- Consent required before link creation (explicit capture, logged)
- Rewards trigger only on `WORK_COMPLETED` — never on signup, prequalification, or lead generation
- Self-referral blocked server-side
- Duplicate referral detection prevents double attribution
- Burst detection (>20 clicks/hour) triggers fraud review queue
- Monthly cap: 500 credits / $500 cash per referrer
- **No incentives for patient referrals or regulated healthcare service referrals (hardcoded)**

---

## Instant Offer Logic

Wave 193:
- Triggered by: MATCHA eligibility (CLEAR band + prequalified), assessment completion, employer demand spike
- Channels: in-app (live), email/SMS (stub ready)
- Lifecycle: sent → opened → acted → accepted/declined
- Analytics: open rate, accept rate, reactivation rate

---

## Feature Flag Rollout Plan

| Flag | Default | Tier | Activate for |
|------|---------|------|-------------|
| `WORKSPACES` | `true` | INTERNAL | All internal users |
| `PREQUALIFY_FLOW_V2` | `true` | INTERNAL | All internal users |
| `EMPLOYER_PAGES` | `true` | PUBLIC | All visitors |
| `EXPLORE_V2` | `true` | PUBLIC | All visitors |
| `ASK_VITALCV` | `false` | PILOT | Pilot employers + beta users |
| `MATCHA_V2` | `false` | PILOT | Pilot employers |
| `ASSESSMENTS` | `false` | PILOT | Beta clinicians |
| `VERIFIER_PIPELINE` | `false` | PILOT | Pilot employer orgs |
| `REFERRALS_V2` | `false` | INTERNAL | Internal team only |
| `AMBASSADOR` | `false` | INTERNAL | Internal team only |
| `INSTANT_OFFERS` | `false` | PILOT | Prequalified clinicians |
| `MARKETPLACE_ANALYTICS` | `false` | INTERNAL | Operators only |

---

## Launch Checklist

### Pre-launch (internal)
- [ ] All 16 waves merged to main ✅
- [ ] API build clean ✅ Frontend build clean ✅
- [ ] 324 tests pass; 4 pre-existing DB integration failures (no regression) ✅
- [ ] Feature flags set correctly for internal rollout ✅
- [ ] Prisma schema migrations planned (dry-run SQL in `docs/migrations/`)
- [ ] Environment variables documented in `.env.example`
- [ ] Clerk auth gating verified on `/holder/*` and `/verifier/*` routes

### Pilot employer onboarding
- [ ] Enable `VERIFIER_PIPELINE`, `MATCHA_V2`, `INSTANT_OFFERS` for pilot orgs
- [ ] Seed at least 3 real employer profiles into `OrganizationProfile`
- [ ] Wire `GET /api/matcha/opportunities/:npi` to real DB profiles
- [ ] Enable `ASK_VITALCV` for pilot users

### Public explore launch
- [ ] Enable `EXPLORE_V2` and `EMPLOYER_PAGES` (already on by default) ✅
- [ ] SEO metadata on all public routes ✅
- [ ] Rate limiting configured (`RateLimiter` middleware from Wave 117) ✅

---

## Rollback Checklist

If a subsystem needs to be disabled post-launch:

1. Set the relevant `NEXT_PUBLIC_FEATURE_*` env var to `false` in Vercel → redeploy (no code change required)
2. API routes remain registered but gated by flag checks on the frontend
3. For full API rollback: comment out `register*Routes(app)` in `app.ts` and rebuild API
4. DB schema changes (Wave 180, 184): migrations are additive — no destructive rollback needed

---

## API Surface Added (Waves 186–195)

```
GET  /api/employers                          Wave 186
GET  /api/employers/search                   Wave 186
GET  /api/employers/compare                  Wave 186
GET  /api/employers/:slug                    Wave 186
GET  /api/matcha/opportunities/:npi          Wave 187 (refounded)
POST /api/matcha/explain                     Wave 187
POST /api/matcha/intent                      Wave 187
GET  /api/matcha/instant-offer/:npi/:id      Wave 187
GET  /api/matcha/analytics                   Wave 187
POST /api/interview/start                    Wave 189
POST /api/interview/turn                     Wave 189
GET  /api/assessments/modules                Wave 189
POST /api/assessments/start                  Wave 189
POST /api/assessments/submit                 Wave 189
GET  /api/prequalification/status/:npi       Wave 189
POST /api/prequalification/step              Wave 189
POST /api/widget/apply                       Wave 190
GET  /api/verifier/candidates                Wave 190
GET  /api/verifier/candidates/pool           Wave 190
POST /api/verifier/offers/send               Wave 190
POST /api/verifier/offers/respond            Wave 190
GET  /api/holder/applications                Wave 190
POST /api/referrals/consent                  Wave 191
POST /api/referrals/create                   Wave 191
GET  /api/referrals/me                       Wave 191
GET  /api/referrals/status/:id               Wave 191
POST /api/referrals/track/:code              Wave 191
POST /api/referrals/attribute                Wave 191
POST /api/referrals/advance                  Wave 191
POST /api/ambassador/enroll                  Wave 192
GET  /api/ambassador/profile/:npi            Wave 192
GET  /api/ambassador/tracks                  Wave 192
POST /api/ambassador/placement               Wave 192
GET  /api/ambassador/list                    Wave 192
GET  /api/ambassador/analytics               Wave 192
GET  /api/notifications/:npi                 Wave 193
POST /api/notifications/read                 Wave 193
POST /api/notifications/acted                Wave 193
POST /api/notifications/trigger              Wave 193
POST /api/growth/share                       Wave 193
GET  /api/lifecycle/:npi                     Wave 193
GET  /api/growth/analytics                   Wave 193
POST /api/analytics/event                    Wave 194
GET  /api/analytics/funnel                   Wave 194
GET  /api/analytics/search                   Wave 194
GET  /api/analytics/marketplace              Wave 194
```
