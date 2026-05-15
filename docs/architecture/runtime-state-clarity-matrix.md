# Runtime State Clarity Matrix

**B20-CODE-04 deliverable.** A single-glance reference that makes
runtime / deployment / environment state unmistakable. Designed so a
future operator can identify which state the runtime is in by reading
one row of one table.

## §1 — Six runtime state categories

| State | What it means | How to distinguish externally |
|---|---|---|
| **PRODUCTION** | Apex `vitalcv.com` serving the canonical deployment, env fully configured | `/api/health` returns `service: "web"`; `config.clerk.enabled: true`; `apiBase: true`; JWKS emits `vcv-es256-1` |
| **PREVIEW** | Vercel branch/PR deployment, distinct URL (e.g., `<project>-git-<branch>.vercel.app`) | `/api/health` `timestamp` matches branch's most recent commit; if `VITALCV_ENV_LABEL=preview` is set, `/api/status.environment` reads `"preview"` |
| **LOCAL** | `pnpm dev` on developer machine | `NODE_ENV=development`; JWKS emits ephemeral `vcv-es256-dev`; backend at `localhost:4000` |
| **PAUSED** | Vercel-level intercept; deployment exists but disabled | HTTP 402 on every path; no application code runs |
| **DEGRADED** | App runs but one or more env / dependencies missing | `/api/health` shows `clerk.enabled: false` or `apiBase: false`; `/api/status.runtime_continuity.status: "degraded"`; signing routes may 500 (fail-closed) |
| **MISCONFIGURED** | App runs but routing / domain attachment wrong | `/api/health.service` is NOT `"web"`; OR apex returns content from a different repo; OR JWKS emits a kid that doesn't match expectation |

## §2 — External probe to identify the state

```bash
APEX=https://vitalcv.com

# Probe in order; stop at the first row that matches.
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$APEX/")
HEALTH=$(curl -s --max-time 8 "$APEX/api/health" 2>/dev/null)
JWKS_KID=$(curl -s --max-time 8 "$APEX/api/.well-known/jwks.json" 2>/dev/null | jq -r '.keys[0].kid // empty')
ENV_LABEL=$(echo "$HEALTH" | jq -r '.environment // empty' 2>/dev/null)
SERVICE=$(echo "$HEALTH" | jq -r '.service // empty' 2>/dev/null)
CLERK=$(echo "$HEALTH" | jq -r '.config.clerk.enabled // empty' 2>/dev/null)
```

| Observation | State |
|---|---|
| `$STATUS == 402` | PAUSED |
| `$SERVICE != "web"` | MISCONFIGURED (apex attached to wrong project) |
| `$JWKS_KID == ""` (no kid; signing route 500) | DEGRADED (signing env unset) |
| `$JWKS_KID == *dev*` | MISCONFIGURED (PR-362 guard not deployed OR pre-PR-362 build) |
| `$JWKS_KID == "vcv-es256-1"` AND `$CLERK == "true"` | PRODUCTION |
| `$JWKS_KID == "vcv-es256-1"` AND `$CLERK == "false"` | DEGRADED (Clerk env partially missing) |
| `$JWKS_KID == "vcv-es256-preview-1"` | PREVIEW (option A configured) |
| Probe times out or returns non-2xx non-402 | UNREACHABLE (DNS / TLS / network) |

## §3 — Internal indicators

Surfaces inside the app that distinguish state without an external probe:

| Surface | Indicator | Reading |
|---|---|---|
| `/api/health.service` | Identifies which `apps/*` is serving | `"web"` = `apps/web`; other = wrong project |
| `/api/health.timestamp` | Per-request fresh ISO | Compare to most recent main commit time to detect stale runtime |
| `/api/health.config.apiBase` | `NEXT_PUBLIC_API_BASE` set? | `false` = cosmetic env gap |
| `/api/health.config.clerk.enabled` | Clerk publishable key set? | `false` = auth flow broken |
| `/api/health.config.clerk.mode` | `production` / `development` / `none` | Distinguishes Clerk env type |
| `/api/health.config.sentry` | DSN set? | `false` = errors not captured |
| `/api/status.runtime_continuity.status` | `operational` / `degraded` | Aggregates signing health |
| `/api/status.runtime_continuity.signing_key_id` | Emits canonical kid OR `null` | `null` = signing env missing |
| `/api/status.environment` | Reads `VITALCV_ENV_LABEL` then `NODE_ENV` | Reports `preview` when `VITALCV_ENV_LABEL=preview` set |

## §4 — Common confusion modes and how to resolve

| Confusion | Resolution |
|---|---|
| "Is this preview or production?" | Set `VITALCV_ENV_LABEL=preview` on Preview scope; `/api/status.environment` then reports honestly |
| "Is the deployment stale or paused?" | Stale: `/api/health.timestamp` lags `main` HEAD by hours+. Paused: HTTP 402 on every path. |
| "Is the signing identity right or wrong?" | Right: `JWKS_KID == "vcv-es256-1"`. Wrong: any value containing `"dev"`. See `signing-identity-convergence-report.md` §2. |
| "Is the runtime degraded or failing?" | Degraded: 200 with `clerk.enabled: false` / `signing_key_id: null`. Failing: 500s or 503s on most paths. |
| "Is env missing or code broken?" | Env missing: explicit 500 from fail-closed routes; `/api/status` reports `degraded`. Code broken: 500 from random routes; logs show stack traces. |
| "Is apex pointed at the right project?" | `/api/health.service` must be `"web"`. If it's something else, domain is attached to the wrong project (see `domain-topology-audit.md`). |

## §5 — Per-state operator action

| State | Operator action |
|---|---|
| PRODUCTION | None; system is healthy |
| PREVIEW | Verify it labels itself as preview (`VITALCV_ENV_LABEL`); if not, set the env var |
| LOCAL | N/A (developer workflow) |
| PAUSED | Run `pause-root-cause-report.md` §2 diagnostic |
| DEGRADED | Run `production-env-requirements.md` checklist; identify which env var is missing |
| MISCONFIGURED | Run `domain-topology-audit.md` + `production-restore-sequence.md` §1 |

## §6 — Single-line operator query

Given the current apex behavior, paste this into a terminal:

```bash
S=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 https://vitalcv.com/); \
  K=$(curl -s --max-time 8 https://vitalcv.com/api/.well-known/jwks.json | jq -r '.keys[0].kid // "—"'); \
  C=$(curl -s --max-time 8 https://vitalcv.com/api/health | jq -r '.config.clerk.enabled // "—"'); \
  echo "Apex: HTTP $S | JWKS kid: $K | Clerk enabled: $C"
```

| Output | Diagnosis |
|---|---|
| `Apex: HTTP 402 \| JWKS kid: — \| Clerk enabled: —` | **PAUSED** — see `pause-root-cause-report.md` |
| `Apex: HTTP 200 \| JWKS kid: — \| Clerk enabled: false` | **DEGRADED** — env vars missing |
| `Apex: HTTP 200 \| JWKS kid: <something>-dev \| Clerk enabled: true` | **MISCONFIGURED** — signing leakage |
| `Apex: HTTP 200 \| JWKS kid: vcv-es256-1 \| Clerk enabled: true` | **PRODUCTION** ✓ |

## §7 — What this matrix does NOT cover

- Cron / scheduled-job state (not part of HTTP-visible runtime; see `production-env-requirements.md` §2 row `CRON_SECRET`)
- Backend (Railway) health (separate process; probe `https://api.vitalcv.com/health` directly)
- DNS / TLS layer (out of scope; assumed working given §1 distinguishability via curl)

The matrix is meant for **HTTP-visible runtime state on apex**. It
intentionally does not try to be exhaustive — its goal is making the
six categories above unmistakable, not cataloguing every possible
subsystem state.
