# Wave 4: YC Demo UI Design

## Overview

Three-page demo flow in the marketing app (`apps/marketing`) that connects to
existing backend demo endpoints via the `/api/demo/[...path]` proxy.

**Goal:** YC-ready minimal UI — real API calls, no mock data.

## Routes

| Route | Purpose |
|-------|---------|
| `/demo` | Landing — black/white, NPI input, "Apply with VCV" |
| `/demo/dashboard?npi=<npi>` | Dashboard — score, hash, timestamp, verify CTA |
| `/demo/verify?artifact=<hash>` | Verifier — hash match, signature, freshness |

## Flow

1. User enters NPI on `/demo` → `POST /api/demo/verify` → redirect to `/demo/dashboard?npi=...`
2. Dashboard renders artifact data → "Verify" CTA → `/demo/verify?artifact=<hash>`
3. Each page is deep-linkable (verifier can share URL directly)

## Page Designs

### Landing (`/demo`)

- Black background, white text, no nav/footer
- VitalCV wordmark top-center
- Headline: "Verify a Healthcare Provider"
- Large NPI text input (white border on black)
- "Apply with VCV" button (white on black)
- Sample NPI chips below input (from `GET /api/demo/sample-npis`)

### Dashboard (`/demo/dashboard`)

- White background, standard color system
- Header: logo + provider name + NPI
- 2×2 card grid (stacked on mobile):
  - **Readiness Score** — numeric score + GREEN/YELLOW/RED band
  - **Bundle Hash** — truncated SHA256 + copy button
  - **Verified At** — relative + absolute timestamp
  - **Credential Status** — signed/unsigned indicator
- "Verify This Bundle" primary CTA → verifier page

### Verifier (`/demo/verify`)

- White background, verification-focused layout
- Provider summary card (name, NPI, specialty, source)
- Three verification rows:
  1. Hash Match — ✓/✗ with computed vs expected
  2. Signature — ✓/✗ verification status
  3. Freshness — artifact age
- Overall VERIFIED/UNVERIFIED banner

### YC Demo Badge

- Fixed top-right yellow pill: "YC DEMO"
- Shown when `GET /api/demo/status` returns `demo_mode: true`

## API Integration

All calls through existing marketing app proxy (`/api/demo/[...path]/route.ts`):
- `GET /api/demo/sample-npis` — landing page sample chips
- `GET /api/demo/provider?npi=<npi>` — provider info for dashboard header
- `POST /api/demo/verify` body `{npi}` — artifact bundle for dashboard + verifier
- `GET /api/demo/status` — YC_DEMO_MODE flag

## Tech Stack

- Next.js pages in `apps/marketing/app/demo/`
- Tailwind CSS (already configured in marketing app)
- No additional dependencies needed
- Server components where possible, client components for interactive bits

## Non-Goals

- No authentication
- No persistence (stateless demo)
- No credential issuance in this flow (that's `/demo/issue`)
- No mobile-native optimization (responsive is sufficient)
