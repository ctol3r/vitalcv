## Wave Passport — Portable Clinician Credential Identity

Build the VitalCV clinician passport. Exit criteria: fully public /p/:npi page with real data, privacy layers, SVG badge, and embeddable share actions.

### READ THESE FIRST
- `apps/api/backend/src/routes/passport.ts` — GET /api/passport/:npi (basic, no privacy layers)
- `apps/web/app/p/[slug]/page.tsx` — public profile page (NPI mode) calling /api/public/profile/npi/:npi
- `apps/web/app/passport/[id]/page.tsx` — HARDCODED DUMMY DATA (needs real API)
- `apps/api/backend/src/routes/publicProfile.ts` — GET /api/public/profile/npi/:npi

### CONSTRAINTS
- DO NOT touch apps/api/backend/src/graphql/prisma_client.ts
- TypeScript strict, pnpm --filter @vitalcv/api build AND pnpm --filter web build must pass
- No DB migrations
- Tailwind v4 CSS-based config, Next.js 15 App Router

### BUILD THESE

**1. Extend GET /api/passport/:npi (apps/api/backend/src/routes/passport.ts)**
Add privacy layers: public facts (NPI_ENROLLMENT, STATE_LICENSE, BOARD_CERTIFICATION) vs restricted facts.
Pull trustBand + readinessScore from getCachedTrustState(npi) imported from ../services/trust/trustStateEngine.
Map readiness_level: L3/L2→GREEN, L1→YELLOW, L0→RED.
Return shape: { npi, public: { name, specialty, providerType, state, trustBand, readinessScore, totalCredentials, activeCredentials, shareUrl, embedUrl }, credentials: [...], meta: { methodology, computedAt, passportVersion: "1.0" } }

**2. Add GET /api/passport/:npi/trust**
Returns: { npi, trustBand, readinessScore, readinessStatus, computedAt, shareUrl }
No auth required. Apply proofRateLimit if available.

**3. Add GET /api/passport/:npi/embed.svg**
Returns inline SVG badge (no deps): 320x80px, dark background #080e1a, clinician name + trust band chip (GREEN=#10b981 / YELLOW=#f59e0b / RED=#ef4444), "Verified by VitalCV", score.
Cache-Control: public, max-age=3600. Content-Type: image/svg+xml.

**4. Add GET /api/passport/:npi/card.json**
Returns JSON-LD: { "@context": "https://vitalcv.com/schema/v1", "@type": "ClinicianPassport", npi, name, trustBand, readinessScore, shareUrl, badgeUrl, verifiedAt, issuer: "VitalCV" }

**5. Rewrite apps/web/app/passport/[id]/page.tsx as real server component**
Replace all dummy data ("Dr. Sarah Chen") with real fetches to /api/passport/${npi} and /api/passport/${npi}/trust.
Error states: 404 → "passport not available" graceful fallback. Network error → same.
Sections: hero (name/specialty/state), trust band chip (GREEN/YELLOW/RED + score bar), credential list (isPublic=true only), share/embed section.
NO auth() call — fully public page.

**6. Create Next.js proxy routes**
- apps/web/app/api/passport/[npi]/route.ts — proxies GET to backend /api/passport/:npi
- apps/web/app/api/passport/[npi]/trust/route.ts — proxies to /api/passport/:npi/trust
- apps/web/app/api/passport/[npi]/embed.svg/route.ts — proxies SVG, preserves Content-Type

**7. Create apps/web/components/passport/PassportShareActions.tsx**
'use client' component. Props: { npi, name }. Buttons: "Copy Link", "Copy Embed Code", "Copy LinkedIn Markdown".
Uses navigator.clipboard.writeText(). useState for "Copied!" toast. No external libs.

**8. Create 6 tests in apps/api/backend/src/routes/__tests__/passport.test.ts**

### FINAL STEPS
1. pnpm --filter @vitalcv/api build — must pass
2. pnpm --filter web build — must pass  
3. git add -A && git commit -m "feat(wave-passport): portable clinician passport — public /p/:npi, privacy layers, SVG badge, embeds, share actions"
4. openclaw system event --text "Done: Passport live — /api/passport/:npi, SVG badge, JSON-LD card, real data replacing dummy Dr. Sarah Chen" --mode now
