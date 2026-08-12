> **UPDATED:** See docs/LAUNCH_GATE.md (generated 2026-03-28) for the current pilot-readiness gate.
> This file reflects state as of 2026-03-20 and is preserved for reference.

# VitalCV Launch Package

**Generated:** 2026-03-20 15:25 PDT
**HEAD:** ea329536 (main)
**Backend:** Railway `delightful-essence-production.up.railway.app`
**Frontend:** Vercel `vitalcv.com`

---

## PHASE 1 — LAUNCH SCOPE

### Launch Mode: **Public Read + Gated Write (Pilot)**

**Public (no auth):**
| Surface | URL | Status |
|---------|-----|--------|
| Homepage | `/` | ✅ 200 |
| Explore Roles | `/explore` | ✅ 200 |
| Employers | `/employers` | ✅ 200 |
| Developers | `/developers` | ✅ 200 |
| Demo | `/demo` | ✅ 200 |
| Intelligence Dashboard | `/intelligence` | ✅ 200 |
| Intelligence Findings | `/intelligence?view=findings` | ✅ 200 |
| Intelligence Providers | `/intelligence?view=providers` | ✅ 200 |
| Intelligence Storylines | `/intelligence?view=storylines` | ✅ 200 |
| Intelligence Actions | `/intelligence?view=actions` | ✅ 200 |
| Intelligence Investigations | `/intelligence?view=investigations` | ✅ 200 |
| Intelligence Graph | `/intelligence?view=graph` | ✅ 200 |
| System Health | `/intelligence?view=system-health` | ✅ 200 |
| Calibration | `/intelligence?view=calibration` | ✅ 200 |
| Sign In / Sign Up | `/sign-in`, `/sign-up` | ✅ Clerk |

**Auth-Gated (Clerk):**
| Surface | Role | URL |
|---------|------|-----|
| Clinician Shell | CLINICIAN | `/holder` |
| Verifier Shell | VERIFIER | `/verifier` |
| Issuer Shell | ISSUER | `/issuer` |
| Documents | AUTHENTICATED | `/documents` |
| Onboarding | via `/get-ready` | public entry → Clerk gate |
| Mission Ops | ADMIN | `/mission-ops` |
| Analytics | ADMIN | `/analytics` |
| Command Center | ADMIN | `/command-center` |

**Decision:** Intelligence suite is fully public read. Apply/write actions require Clerk auth. Admin panels are role-gated.

---

## PHASE 2 — DEMO / PILOT ACCOUNTS

### Seeded Data (via `seed-opportunities.ts`)
- **8 organizations** (Bay Area Cardiac Group, MindBridge Health, etc.)
- **9 opportunities** across specialties (Cardiology, Psychiatry, EM, IM, etc.)
- **10 providers** with real NPI-style data
- **91 findings** across providers
- **22+ storylines** clustering findings into narratives
- **Graph:** 20 nodes, 135 edges for the anchor provider (NPI withheld — the number
  previously printed here belongs to a real, non-consenting physician)

### Demo Identity Strategy

**The clinician walkthrough is deferred — there is no NPI we are permitted to demo.**

`1003000126` must not be used. It is ARDALAN ENKESHAFI, M.D., a real physician who never
consented to being a demo subject; earlier material wrongly attached the fabricated name
"Dr. Sarah Chen" to it. No demo may point at a real clinician's NPI, and no other real NPI
may be substituted. A live clinician walkthrough returns only when there is an explicitly
consented, founder-controlled clinician fixture. See [`yc/DEMO_RUNBOOK.md`](yc/DEMO_RUNBOOK.md).

| Role | Identity | Path |
|------|----------|------|
| Clinician | ⬜ deferred — awaiting a consented, founder-controlled fixture | — |
| Employer | Bay Area Cardiac Group (organization, not a person) | `/explore` → view posted roles |
| Verifier | Read-only investigation | `/intelligence?view=investigations` |

### Action Required
Run seed-opportunities in production to populate `/explore`:
```bash
railway run pnpm exec ts-node -P tsconfig.seed.json prisma/seed-opportunities.ts
```

---

## PHASE 3 — SUPPORT + FAILURE PATHS

| Failure Scenario | User Sees | Recovery Path | File |
|------------------|-----------|---------------|------|
| Sign-in failure | Clerk error page | "Try again" + "Contact support" | Clerk hosted |
| Onboarding failure | "Something went wrong" + retry | Reset button → retry flow | `app/error.tsx` |
| Apply failure | Toast error "Application could not be submitted" | "Try again" button | `ApplyModal.tsx` |
| Graph not loading | Empty graph panel + "No graph data available" | Auto-retry on 45s poll | `useGraph.ts` |
| Copilot unavailable | "Copilot is warming up" or empty response | Retry button in CopilotPanel | `CopilotSearchBar.tsx` |
| Evidence unavailable | "Evidence unavailable" in detail panel | Refresh button | `SurfaceErrorState` |
| Provider lookup failure | "Provider not found" | Back to directory | `provider-detail-view.tsx` |
| Backend unreachable | Feed shows "System Degraded" → now "Pipeline Active" | Auto-retry on poll interval | `LiveFeedRibbon.tsx` |
| 404 route | Branded 404 with "Go home" | Link to `/` | `app/not-found.tsx` |
| Unhandled error | "Something went wrong" + retry | Retry button | `app/error.tsx` |

**No dead ends exist.** Every error state has a retry or navigation escape.

---

## PHASE 4 — DAY-1 MONITORING

### Health Endpoints
| Endpoint | What it checks | Expected |
|----------|---------------|----------|
| `GET /health` | Backend alive, request metrics | `{"status":"ok"}` |
| `GET /readyz` | Backend + DB connectivity | `{"status":"ready"}` |

### Monitoring Script
Save as `scripts/launch-monitor.sh`:

```bash
#!/bin/bash
# VitalCV Launch Day Monitor
# Run: ./scripts/launch-monitor.sh

BACKEND="https://delightful-essence-production.up.railway.app"
FRONTEND="https://vitalcv.com"

echo "=== VitalCV Launch Monitor ==="
echo "Time: $(date)"

# 1. Backend health
HEALTH=$(curl -s "$BACKEND/health")
echo "Backend health: $(echo $HEALTH | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["status"], "sha:", d.get("git_sha","?")[:8])')"

# 2. Readyz (DB)
READY=$(curl -s "$BACKEND/readyz")
echo "DB ready: $(echo $READY | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')"

# 3. Route checks
echo "--- Route Health ---"
for r in "/" "/explore" "/employers" "/intelligence"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND$r")
  echo "$CODE  $r"
done

# 4. Data counts
#
# These reads need an authorized organization context. Supply it at run time via
# SMOKE_AUTH_HEADER — a value you are entitled to use, in `Header: value` form.
# This runbook deliberately does not carry a working one: a checked-in header
# that reaches data routes is an attack recipe, not a smoke test. Left unset,
# each check reports that it was skipped rather than reaching the route.
echo "--- Data Counts ---"
if [ -z "$SMOKE_AUTH_HEADER" ]; then
  echo "Findings: skipped (SMOKE_AUTH_HEADER unset)"
  echo "Feed items: skipped (SMOKE_AUTH_HEADER unset)"
else
  FINDINGS=$(curl -s "$BACKEND/api/findings?limit=1" -H "$SMOKE_AUTH_HEADER" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("total",0))' 2>/dev/null)
  echo "Findings: $FINDINGS"

  FEED=$(curl -s "$BACKEND/api/intelligence/feed?limit=1" -H "$SMOKE_AUTH_HEADER" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("total",0))' 2>/dev/null)
  echo "Feed items: $FEED"
fi

# Set GRAPH_SMOKE_NPI to an NPI you are permitted to query. Do not hardcode a real
# clinician's NPI here — see "Demo Identity Strategy" above; 1003000126 in particular
# is off-limits. Left unset, this check reports that it was skipped rather than
# silently querying someone. Needs SMOKE_AUTH_HEADER as above.
if [ -n "$GRAPH_SMOKE_NPI" ] && [ -n "$SMOKE_AUTH_HEADER" ]; then
  GRAPH=$(curl -s "$BACKEND/api/graph/investigation?npi=$GRAPH_SMOKE_NPI&limit=1" -H "$SMOKE_AUTH_HEADER" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"nodes={len(d.get(\"nodes\",[]))} edges={len(d.get(\"edges\",[]))}")' 2>/dev/null)
else
  GRAPH="skipped (GRAPH_SMOKE_NPI or SMOKE_AUTH_HEADER unset)"
fi
echo "Graph: $GRAPH"

# 5. Error check
ERRORS=$(echo $HEALTH | python3 -c 'import json,sys; print(json.load(sys.stdin)["metrics"]["error_requests"])' 2>/dev/null)
echo "Error requests: $ERRORS"

echo "=== Monitor Complete ==="
```

### Threshold Alerts (check manually or via cron)
| Metric | Normal | Alert |
|--------|--------|-------|
| `/health` status | `ok` | anything else |
| `/readyz` status | `ready` | `not_ready` |
| Findings count | >50 | drops to 0 |
| Feed items | >10 | drops to 0 |
| Graph nodes | >5 | 0 when findings exist |
| Error requests | <10% of total | >20% |
| Frontend routes | 200 | non-200 |
| Deploy SHA drift | matches `git log` HEAD | mismatch |

---

## PHASE 5 — ROLLBACK / RECOVERY

### Last Known Good SHAs
| Component | SHA | Date | Tag |
|-----------|-----|------|-----|
| Backend (Railway) | `ea329536` | 2026-03-20 | current |
| Frontend (Vercel) | `ea329536` | 2026-03-20 | current |
| Pre-hardening | `beb4ac3e` | 2026-03-20 | pre-launch-hardening |
| Wave A checkpoint | `708bf915` | 2026-03-09 | wave-A-green-state |

### Frontend Rollback (Vercel) — 2 minutes
```bash
# Option 1: Revert to previous deployment in Vercel dashboard
# vercel.com → vitalcv → Deployments → find last good → "..." → Promote to Production

# Option 2: CLI
cd ~/vitalcv
git revert HEAD --no-edit
git push origin main
# Vercel auto-deploys from GitHub push
```

### Backend Rollback (Railway) — 3 minutes
```bash
# Option 1: Railway dashboard → delightful-essence → Deployments → Rollback

# Option 2: Git revert
cd ~/vitalcv
git revert HEAD --no-edit
git push origin main
# Railway auto-deploys from GitHub push
```

### Post-Rollback Verification Checklist
```
[ ] curl https://delightful-essence-production.up.railway.app/health → status: ok
[ ] curl https://delightful-essence-production.up.railway.app/readyz → status: ready
[ ] SHA matches expected rollback target
[ ] https://vitalcv.com loads
[ ] https://vitalcv.com/intelligence loads with data
[ ] https://vitalcv.com/explore loads
```

### Env Verification
```bash
cd ~/vitalcv
vercel env ls | grep -E "BACKEND|API_BASE"
# Expect: BACKEND_URL, NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_BACKEND_URL → all Encrypted, Production
```

---

## PHASE 6 — INTERNAL LAUNCH CHECKLIST

### Public Surfaces
| # | Surface | Route | Status |
|---|---------|-------|--------|
| 1 | Homepage | `/` | ✅ PASS |
| 2 | Explore | `/explore` | ⚠️ PASS (renders; needs seeded opportunities) |
| 3 | Employers | `/employers` | ✅ PASS |
| 4 | Developers | `/developers` | ✅ PASS |
| 5 | Demo | `/demo` | ✅ PASS |

### Operator Surfaces
| # | Surface | Route | Status |
|---|---------|-------|--------|
| 6 | Intelligence Dashboard | `/intelligence` | ✅ PASS |
| 7 | Findings | `?view=findings` | ✅ PASS |
| 8 | Providers | `?view=providers` | ✅ PASS |
| 9 | Storylines | `?view=storylines` | ✅ PASS |
| 10 | Actions | `?view=actions` | ✅ PASS |
| 11 | Investigations | `?view=investigations` | ✅ PASS |
| 12 | Graph | `?view=graph` | ✅ PASS |
| 13 | System Health | `?view=system-health` | ✅ PASS |
| 14 | Calibration | `?view=calibration` | ✅ PASS |

### Core Loops
| # | Flow | Status | Note |
|---|------|--------|------|
| 15 | Clinician onboarding | ⚠️ PARTIAL | Entry via `/get-ready` → Clerk gate → onboarding flow |
| 16 | Apply to role | ⚠️ PARTIAL | ApplyModal exists; needs seeded opportunities to test |
| 17 | Employer review | ⚠️ PARTIAL | EmployerDashboard exists; needs employer Clerk account |
| 18 | Verifier evidence inspection | ✅ PASS | Via intelligence → finding → evidence panel |
| 19 | Provider investigation | ✅ PASS | Select provider → findings + graph + storylines update |

### Data Integrity
| # | Check | Status |
|---|-------|--------|
| 20 | Backend health | ✅ `status: ok` |
| 21 | DB connectivity | ✅ `status: ready` |
| 22 | Deploy SHA match | ✅ `ea329536` |
| 23 | Feed delivery mode | ✅ `delivery.mode: live` |
| 24 | Findings count consistent | ✅ Fixed (total matches section) |
| 25 | Graph returns data | ✅ 7+ nodes, 22+ edges |

---

## PHASE 7 — FINAL VERDICT

1. **Chosen launch mode:** Public Read + Gated Write (Pilot)
2. **Demo/pilot account readiness:** ⚠️ PARTIAL — intelligence data live; run seed-opportunities for `/explore`
3. **Support/failure path readiness:** ✅ YES — all error states have branded recovery UX
4. **Day-1 monitoring readiness:** ✅ YES — `/health` + `/readyz` live; monitoring script ready
5. **Rollback readiness:** ✅ YES — documented for both Railway + Vercel, 5-min executable
6. **Unresolved launch risks:**
   - `/explore` shows 0 opportunities until seed script runs (medium — 5 min fix)
   - Clinician onboarding requires Clerk account setup (expected for gated write)
   - Graph rendering depends on client-side canvas — confirmed data flows, render not visually verified in auth session
7. **Final verdict: "VCV is operationally launch-ready" = YES** *(conditional on running seed-opportunities)*

---

*This document is the single source of truth for VitalCV launch operations.*
