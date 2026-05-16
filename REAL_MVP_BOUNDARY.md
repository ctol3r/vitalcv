# REAL_MVP_BOUNDARY.md
Generated: 2026-05-15 — Wave 6 of Founder Survival Mission

## The One Rule
If a feature doesn't directly help a clinician get hired or an employer decide faster, it is not MVP.

---

## MVP in One Sentence
A clinician enters their NPI. VitalCV checks federal registries. They see their readiness status. They can share it with an employer. The employer can view it and request missing items.

That's it.

---

## What IS MVP (required for first users, first demos, first pilots)

### Clinician Flow ✓
| Feature | Status | Notes |
|---------|--------|-------|
| Enter NPI → see NPPES identity | **LIVE** | Works today |
| OIG exclusion check | **LIVE** | Works today |
| Readiness score (simple) | **LIVE** | computeDecision() |
| Sign up with email/Google | **LIVE** | Clerk auth |
| Bind NPI to account | **LIVE** | `/api/me/link-npi` |
| View readiness status | **LIVE** | holder dashboard |
| Share passport link | **LIVE** | `/verify/[npi]` |

### Employer Flow ✓
| Feature | Status | Notes |
|---------|--------|-------|
| View shared passport | **LIVE** | `/verify/[npi]` |
| Pilot request form | **LIVE** | `/pilot` |
| Contact form | **LIVE** | `/contact` |

### Minimum required for first paid pilot
| Feature | Status | Notes |
|---------|--------|-------|
| Employer dashboard (basic) | **PARTIAL** | `/employer/dashboard` exists |
| Review candidate readiness | **PARTIAL** | `/review/[entityId]` exists |
| Request missing credential | **NOT DONE** | Can be email-first |

---

## What is NOT MVP (stop building this)

### Cut immediately — never needed for first revenue
- ❌ Graph substrate (`/clinician/graph`, `@vitalcv/graph-core`)
- ❌ Consumer wallet / DID / Verifiable Credentials UI
- ❌ Career Autopilot (`/autopilot`)
- ❌ AI copilot / inbox AI (`/api/copilot`, `/api/ask`)
- ❌ Mobile native app (`/mobile/native-readiness`)
- ❌ Blockchain infrastructure (any of it)
- ❌ Embedded SDK (`@vitalcv/embed-sdk`)
- ❌ Staffing exchange vertical (`/for/staffing-exchange`)
- ❌ CVO vertical (`/for/cvo`)
- ❌ Payer vertical (`/for/payer`)
- ❌ Audit receipts with cryptographic proof chains
- ❌ OpenID4VP presentation protocol
- ❌ JWKS / SD-JWT / VC issuance (employer doesn't need this)
- ❌ Multi-issuer orchestration
- ❌ Trust graph / knowledge graph
- ❌ PSV adapter abstraction layer
- ❌ Command registry / event sourcing
- ❌ Idempotency engine
- ❌ Conflict resolution engine
- ❌ SOC2 compliance tooling (before first enterprise contract)
- ❌ HIPAA BAA infrastructure (before first enterprise contract)
- ❌ Sentry error tracking (use free Cloudflare analytics for now)

### Cut until first paying employer contract
- ❌ Bulk CSV import
- ❌ Employer worklist (replace with email-first)
- ❌ PSV receipt issuance
- ❌ Issuer portal (`/issuer/*` routes)
- ❌ Admin panel (`/admin/*`)
- ❌ Ops dashboard (`/ops/*`)

---

## The Minimum Demo Path (what you show in 10 minutes)

1. Open `vitalcv.com`
2. Type in a real NPI (use `1457128589` — Macie Miller)
3. Show: identity confirmed, sanctions clear, readiness score
4. Click "Create your passport"
5. Sign up with Google (30 seconds)
6. Show holder dashboard: "Your credentials are X% ready"
7. Share the passport link
8. Open link as "employer" — show what they see
9. Done. Ask for the pilot.

**If any of steps 1–9 break, that is a P0 bug. Nothing else matters.**

---

## Feature Prioritization for Next 2 Weeks

### Week 1 (before any outreach)
1. Verify full demo path works end-to-end with real NPI
2. Ensure homepage passes 15-second clarity test (done — homeage rewritten)
3. Ensure `/pilot` page converts (employer entry point)
4. Fix any 500 errors on core path (`/api/ingest`, `/api/health`, `/passport`)
5. Disable Vercel preview deployments (cost)

### Week 2 (while in conversations with employers)
1. Add email capture to `/pilot` page (Resend or Mailchimp — free tier)
2. Basic employer review: employer sees passport, can leave a note or request item
3. Add clinician "share my passport" button in holder dashboard
4. One-paragraph "what happens next" copy on onboarding success page

### After first paid pilot commitment
Then and only then:
- Formal employer dashboard
- Bulk candidate review
- PSV workflow
- Formal issuer portal

---

## What Constitutes "Done Enough to Sell"

A product is sellable when:
- [ ] A clinician can sign up and see their readiness in < 2 minutes
- [ ] An employer can view that readiness via a link without signing up
- [ ] The pilot page converts to a real conversation (email or call)
- [ ] The founder can demo it live without it breaking

**You are already at 85% of this.** The remaining 15% is fixing the demo path, not building new features.

---

## Stop Signal

**Stop building when you have:**
- 1 employer in a paid pilot conversation
- 5 clinicians who have created passports
- 1 week of usage data

At that point, build only what those people ask for.
Everything else is speculation.
