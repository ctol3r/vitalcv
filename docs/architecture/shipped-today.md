# Shipped Today

**Wave 1 (Stop The Bleeding) + Conversion Optimization wave deliverables.**
Single PR; doc-and-code; no architecture expansion.

## §1 — Code shipped

### Public surfaces (new)
| Route | File | Purpose |
|---|---|---|
| `/launch` | `apps/web/app/launch/page.tsx` | Focused public landing pad: hero + 3 audience paths + T1-T4 ladder + anti-overclaim section + CTAs |
| `/demo` | `apps/web/app/demo/page.tsx` | Demo index pointing to 3 sub-flows |
| `/demo/clinician` | `apps/web/app/demo/clinician/page.tsx` | Clinician readiness preview (fixture; no backend dep) |
| `/demo/employer` | `apps/web/app/demo/employer/page.tsx` | Employer review queue with 3 readiness states + per-application highlights/cautions |
| `/demo/issuer` | `apps/web/app/demo/issuer/page.tsx` | Issuer inbox with confirmed / in-review / unable-to-verify outcomes |
| Shared fixture data | `apps/web/app/demo/_seed.ts` | Single source of truth for demo data |

### Existing surface modified
| File | Change |
|---|---|
| `apps/web/app/HomePageClient.tsx` | Added recruiter-entry-point row below preview steps: "Hiring? See the employer view →" + "Walk through three demos" + "Why VitalCV" |

### Self-host configs (new directory)
| File | Purpose |
|---|---|
| `local-host/docker-compose.yml` | 3-service compose (web + postgres + optional cloudflared) |
| `local-host/.env.example` | Required + recommended env vars |
| `local-host/Makefile` | `make up / verify / logs / tunnel / clean` convenience targets |
| `local-host/README.md` | Operator quickstart |

## §2 — Docs shipped

| Doc | Wave | Subject |
|---|---|---|
| `docs/architecture/lean-public-surface.md` | Wave 1 Task 4 | Audit of removable routes; no autonomous deletions |
| `docs/architecture/wave1-survival-summary.md` | Wave 1 closing | Per-task disposition |
| `docs/architecture/conversion-fixes.md` | Conversion wave | What ships + what's already strong + speed-to-hire framing inventory |
| `docs/architecture/live-blockers.md` | Conversion wave | Ranked blocker list |
| `docs/architecture/shipped-today.md` | This file | What landed in one PR |

## §3 — What was NOT shipped (deliberately)

### Operator-only (cannot do from a build session)
- Disconnect Vercel Git integration (Wave 1 Task 1)
- Clear apex HTTP 402 pause
- Set Vercel env vars
- Schedule probe runner cron
- Seed demo NPI to Railway production
- Real-device mobile QA

### Requires rendered review (would risk regression)
- Homepage hero rewrite
- Passport page layout restructure
- Color / motion / typography refinement
- Onboarding flow visual polish beyond text changes

### Requires per-item operator confirmation
- Route deletions per `lean-public-surface.md` §1 (operator runs grep verification + approves)
- `@vitalcv/wallet-sdk` `./interoperability` missing module fix (pre-existing on `origin/main`)
- CI workflow churn reduction per `build-churn-audit.md` §5 (separate PR)

## §4 — Validation

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✓ Done in 12s |
| `pnpm --filter @vitalcv/web exec tsc --noEmit` | ✓ Clean (after clearing stale `.next` cache) |
| New files free of banned phrases | ✓ Truth scan CLEAN |
| New files use foundation-honest framing | ✓ |
| Zero existing tests broken | (cannot fully verify build via turbo due to pre-existing `@vitalcv/wallet-sdk` failure unrelated to this PR; direct web build path succeeds) |

## §5 — How to use what shipped

### For the founder pitching today/tomorrow:

```bash
cd ~/vitalcv
pnpm install
pnpm --filter @vitalcv/web dev
# Open http://localhost:3030/launch
# Walk through the demos:
#   http://localhost:3030/demo/clinician
#   http://localhost:3030/demo/employer
#   http://localhost:3030/demo/issuer
```

Three-minute walkthrough:
- 30s on `/launch` (hero + 3 audiences)
- 60s on `/demo/clinician` (readiness preview)
- 60s on `/demo/employer` (review queue with 3 states)
- 30s on `/demo/issuer` (issuer outcome)

No backend required. No env vars required. No deployment required.

### For the operator preparing self-host:

```bash
cd local-host/
cp .env.example .env
# Fill in values per docs/architecture/production-env-requirements.md
make up
make verify
```

Optional: `make tunnel` exposes via Cloudflare Tunnel without a
public IP.

## §6 — Single-line conversion summary

**The founder can pitch tomorrow from `localhost`. The operator can
self-host this week at $5–10/mo. Vercel can be frozen today without
killing the company.** The codebase is no longer dependent on a
specific deployment to be demo-able.
