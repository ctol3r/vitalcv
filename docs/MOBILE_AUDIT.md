# VitalCV Mobile Product Audit

**Generated:** 2026-03-20 15:54 PDT
**Audit Scope:** Mobile-responsive web + Expo native app

---

## PHASE 1 — MOBILE PRODUCT INVENTORY

### A. Expo Native App (`apps/mobile/`)

**Stack:** Expo SDK 52, React Native 0.76, expo-router

| Tab | File | Lines | Status |
|-----|------|-------|--------|
| Wallet | `(tabs)/wallet.tsx` | 231 | **Complete** — FlatList of StoredCredentials, pull-to-refresh, sync with WalletSyncService |
| Present | `(tabs)/present.tsx` | 303 | **Complete** — QR code generation, selective disclosure claim toggle, OID4VP presentation |
| Scan | `(tabs)/scan.tsx` | 274 | **Complete** — Camera QR scanner, OID4VP request parsing, presentation response |
| Settings | `(tabs)/settings.tsx` | 195 | **Complete** — Biometric toggle, sync toggle, clear wallet, version info |

**Services (fully implemented):**
| Service | What it does |
|---------|-------------|
| `LocalCredentialStore.ts` | SecureStore-backed credential CRUD + search |
| `WalletSyncService.ts` | Backend ↔ local credential sync |
| `OID4VPHandler.ts` | OpenID4VP presentation protocol |
| `OfflinePresentationEngine.ts` | Offline credential presentation |
| `NotificationService.ts` | Push notification registration + handling |

**Missing from native app:**
- ❌ Sign-in / auth flow (no Clerk mobile SDK integration)
- ❌ Onboarding
- ❌ Readiness / trust state
- ❌ Apply to role
- ❌ Application status tracking
- ❌ Copilot
- ❌ Graph view
- ❌ Evidence view
- ❌ Dependencies not installed (`node_modules` missing)

**Native app verdict:** The wallet/present/scan core is **complete** but the app is a **credential wallet only** — not a full clinician surface. No auth, no onboarding, no apply flow.

---

### B. Mobile-Responsive Web (Next.js PWA potential)

| Surface | Route | Mobile Responsive | Status |
|---------|-------|-------------------|--------|
| Homepage | `/` | ✅ Excellent | Fully stacked, readable, CTAs accessible |
| Explore | `/explore` | ✅ Good | Grid collapses to 1-col, filters accessible |
| Employers | `/employers` | ✅ Good | Stacked layout |
| Developers | `/developers` | ✅ Good | Responsive |
| Demo | `/demo` | ✅ Good | Responsive |
| Sign-in | `/sign-in` | ✅ Excellent | Clerk widget is mobile-native |
| Onboarding | `/get-ready` → `/onboarding` | ⚠️ Partial | Sign-in works; onboarding steps have `sm:` breakpoints (7 instances) but not deeply tested |
| Intelligence Dashboard | `/intelligence` | ⚠️ Usable | Stacks vertically; stat cards readable; findings list works |
| Intelligence Findings | `?view=findings` | ⚠️ Usable | Single column works but dense |
| Intelligence Graph | `?view=graph` | ❌ Poor | Canvas-based graph not designed for touch/mobile |
| Holder / Passport | `/holder` | ⚠️ Partial | WalletPassport has 1 responsive breakpoint; needs more |
| Apply Modal | ApplyModal | ❌ Not tested | No responsive classes found in component |
| Mobile Landing | `/mobile` | ✅ Complete | Marketing page only — "Coming Soon" |

### C. Backend Mobile API Support

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/api/identity/:npi?view=mobile` | Mobile identity preview | ✅ Implemented |
| `/api/identity/:npi/claims?view=mobile` | Paginated mobile claims | ✅ Implemented |
| `/api/identity/:npi/receipts?view=mobile` | Mobile receipts | ✅ Implemented |
| `/api/watchtower/mobile/subscriptions` | Mobile alert subscriptions | ✅ Implemented |
| `/api/graph/mobile/:nodeId` | Mobile graph expansion | ✅ Implemented |

**Backend verdict:** Mobile API layer is **surprisingly complete** — identity, claims, receipts, watchtower alerts, mobile graph. The backend is ready for mobile.

---

## PHASE 2 — MINIMUM MOBILE LAUNCH SCOPE

### Tier 1: Must Have (mobile-responsive web)
| # | Flow | Current State | Gap |
|---|------|---------------|-----|
| 1 | Clinician sign-in | ✅ Complete | Clerk mobile works |
| 2 | Onboarding (NPI entry) | ⚠️ Partial | Needs responsive hardening |
| 3 | Readiness / trust state | ❌ Missing on mobile | No mobile readiness view |
| 4 | Apply to role | ❌ Missing | ApplyModal not responsive |
| 5 | Application status | ❌ Missing | No status tracking view |
| 6 | Trust-state updates/alerts | ❌ Missing | No push/alert surface |
| 7 | Credential/profile visibility | ⚠️ Partial | WalletPassport needs responsive work |

### Tier 2: Nice to Have
| # | Flow | Current State |
|---|------|---------------|
| 8 | Notifications | ❌ No web push |
| 9 | Copilot | ❌ Not mobile-optimized |
| 10 | Graph (simplified) | ❌ Canvas not touch-ready |

---

## PHASE 3 — WEB / MOBILE RESPONSIBILITY SPLIT

### Product Surface Assignment

| Surface | Primary | Secondary | Notes |
|---------|---------|-----------|-------|
| **Sign-in** | Mobile | Web | Clerk handles both |
| **Onboarding** | Mobile | Web | First experience is likely mobile |
| **Readiness dashboard** | Mobile | — | Daily check-in surface |
| **Apply to role** | Mobile | Web | Quick action from explore |
| **Application status** | Mobile | — | Status + alerts |
| **Trust state + alerts** | Mobile | — | Push notifications |
| **Credential wallet** | Native app | Mobile web | SecureStore in native, view-only on web |
| **Present credentials** | Native app | — | QR/OID4VP requires camera |
| **Intelligence dashboard** | Web | Mobile (read-only) | Complex multi-panel layout |
| **Investigation workbench** | Web | — | Desktop-only caseboard |
| **Graph exploration** | Web | — | Canvas requires desktop |
| **Employer operations** | Web | — | Review, investigate, decide |
| **Verifier evidence** | Web | — | Deep inspection |
| **Calibration** | Web | — | Admin/operator tool |

### Enforced Rule
> Mobile = daily habit surface (status, readiness, apply, alerts)
> Web = operations control plane (investigate, decide, graph, caseboard)

---

## PHASE 4 — MOBILE READINESS REPORT

### 1. What the current mobile app actually supports
- **Native (Expo):** Credential wallet, QR present, QR scan, OID4VP, offline presentation, push notifications, biometric auth — **but no sign-in, no onboarding, no apply, no readiness**
- **Mobile web:** Homepage ✅, Explore ✅, Sign-in ✅, Intelligence (readable but dense) ⚠️, Onboarding (partial) ⚠️, Holder/Passport (partial) ⚠️
- **Backend:** Mobile-specific API routes fully implemented (identity, claims, receipts, watchtower, mobile graph)

### 2. Minimum mobile launch scope
1. Sign-in (done — Clerk)
2. Onboarding responsive hardening
3. Mobile readiness view (trust band + credential status + blockers)
4. ApplyModal responsive
5. Application status page
6. Trust-state alert surface (web push or in-app)
7. WalletPassport responsive hardening

### 3. Top 5 missing mobile blockers

| # | Blocker | Severity | File/Area |
|---|---------|----------|-----------|
| 1 | **No mobile readiness view** — clinician has no way to see "am I cleared?" on phone | HIGH | New component needed: `MobileReadinessCard.tsx` |
| 2 | **ApplyModal not responsive** — can't complete the core action on mobile | HIGH | `apps/web/components/explore/ApplyModal.tsx` |
| 3 | **No application status page** — after applying, no way to track on mobile | HIGH | New page needed: `/applications` or `/holder/applications` |
| 4 | **WalletPassport not mobile-optimized** — credential view cramped on small screens | MEDIUM | `apps/web/components/wallet/WalletPassport.tsx` |
| 5 | **No PWA manifest or service worker** — can't "Add to Home Screen" for app-like experience | MEDIUM | `apps/web/public/manifest.json` + `apps/web/app/manifest.ts` |

### 4. Recommended next tasks for Claude Code
1. **ApplyModal responsive** — add `sm:`/`md:` breakpoints, touch-friendly inputs, bottom-sheet pattern on mobile
2. **Application status page** — `/holder/applications` with status cards (SUBMITTED → REVIEWING → CLEARED → STARTED)
3. **PWA manifest + icons** — `manifest.ts` with name, icons, theme_color, start_url, display: standalone

### 5. Recommended next tasks for Codex
1. **MobileReadinessCard component** — trust band hero, credential checklist, blocker list, "Get Cleared" CTA; wired to `/api/trust-state/:npi`
2. **WalletPassport responsive overhaul** — stack credential cards vertically, larger touch targets, swipe-to-present gesture area
3. **Mobile onboarding responsive hardening** — test all 6 OnboardingFlowSteps at 390px, fix any overflow/truncation

### 6. Recommended next tasks for Antigravity
1. **Mobile readiness design** — design the "am I cleared?" card (trust band visualization, credential progress ring, blocker chips) for 390px viewport
2. **Application status design** — timeline visualization for application lifecycle (vertical on mobile, horizontal on desktop)
3. **Mobile nav pattern** — bottom tab bar for `/holder` shell (Readiness | Credentials | Apply | Status) vs current top navbar

### 7. Final verdict: "mobile is now treated as tier-1" = **NO — but the path is clear**

Mobile has strong foundations:
- Backend mobile API: ✅ complete
- Native wallet app: ✅ complete (credential core)
- Mobile-responsive web: ⚠️ partial (homepage/explore/sign-in work; readiness/apply/status missing)

**Gap to tier-1:** 5 components need building or hardening. Estimated: 2–3 focused waves.

---

*This audit defines the mobile product boundary. Everything above the line ships before mobile launch.*
