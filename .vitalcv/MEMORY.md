# MEMORY.md — VitalCV Agent Working Memory
_Last updated: 2026-03-12. Maintained by SparkJoy._

---

## Architectural Discoveries

- `TrustGraphPrimary` has force simulation + hover-highlight but no filter/search until Wave 232
- `FilterableTrustGraph` (Wave 232) wraps it with Obsidian-style type filters + search
- PSV adapter framework is production-ready for Nursys, BreEZe, FSMB — needs NPDB/DEA/OIG completion
- MATCHA service exists (`services/matcha/`) but is not connected to the live opportunity board
- Verifier inbox at `/verifier/inbox` still uses seeded data — open loop
- `features.ts` gates: ASK_VITALCV=false, MATCHA_V2=false, REFERRALS_V2=false, INSTANT_OFFERS=false
- Prisma schema has 67+ models — extremely deep data model already
- 86 route files, 97 service directories — backend is comprehensive
- `app.ts` registers all routes — always add new routes here
- Wave numbering: currently at 233. No gaps in main branch.

---

## Design System Memory

- Homepage background: `#080e1a` (deep navy — authoritative, medical-grade)
- Pure black `#060609` was too "crypto/void" — switched to navy at Wave 231
- Tailwind v4: `bg-white/3`, `border-white/8` glass pattern throughout dark surfaces
- No light sections on homepage — full dark void, unified
- Floating credential chips (FloatingCredentials.tsx) — pure CSS keyframes, no JS runtime cost
- STEP_ACCENT now uses dark glass tokens (border-blue-500/20) not light (border-blue-200)
- The medical audience needs: precision, clarity, warmth, not crypto/startup aesthetics

---

## Product Decisions

- Free job board is a **distribution wedge**, not a revenue line — funded by intelligence layer
- MATCHA is the intelligence layer — credential-aware, not keyword-matching
- Clinic capacity score is the **enterprise sales wedge** — new metric no one else provides
- Mobile app is a **key priority** (Christopher: "it doesn't feel portable without the mobile app")
- Blockchain PSV anchoring already started with SD-JWT — extend to on-chain in Phase 5
- The graph must be functional (Obsidian/Roam model) — every visual feature must be operationally useful

---

## Risky Areas

- Prisma Json fields: always `JSON.parse(JSON.stringify(v))` — don't forget
- `react-force-graph-2d` NOT installed — don't import it (prior agent broke TrustGraph this way)
- Tailwind v4 cross-file @apply: can't @apply custom classes from imported files — use direct CSS
- Next.js proxy: components MUST use `/api/...` relative paths, not `${getApiBase()}`
- Worktrees + pnpm: worktrees don't inherit root node_modules — run `CI=true pnpm install`
- `prisma generate` must run from `apps/api/backend/` not repo root

---

## Wave History Summary (recent)

| Wave | What |
|---|---|
| 229 | Application flow — ApplyModal, applicationService, 6 proxy routes |
| 230 | Antigravity UI — void black hero, starfield, floating credentials |
| 231 | Medical-grade refinement — deep navy, human copy, doctor-first |
| 232 | Moneyball thesis section + FilterableTrustGraph (Obsidian-style) |
| 233 | Platform vision — 5 pillars + novel tech + integration network section |

---

## Open Questions / Unresolved

- What is the MATCHA v2 data model for career path modeling?
- How should clinic capacity score be calculated? (starts per quarter / credentialing velocity)
- Should the graph show real PSV data or remain illustrative until we have live data?
- PubMed integration: show publication count + recent papers on Trust Passport?
- Should Ask VitalCV (Wave 185, flag-gated) be enabled now?

---

## Abandoned Ideas Worth Remembering

- `react-force-graph-2d` was the original graph library — not installed, abandoned
- Starfield (animated canvas) on homepage — too "space/crypto" for medical audience, removed Wave 231
- Rotating tagline ("cryptographically. / permanently.") — removed, too developer-speak for doctors
- BackgroundField as homepage wrapper — removed, switched to plain div with background color

---

## Strategic Context

- **YC application active** — March 13, 2026 is selection day (tomorrow)
- Christopher has no remaining funds — this is the make-or-break moment
- Family stakes: wife + 2 boys depend on this succeeding
- The Moneyball thesis + Platform Vision + Medical-grade design are now on the homepage
- The site needs to look like a category-defining company, not a credentialing tool
