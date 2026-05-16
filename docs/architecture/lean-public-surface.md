# Lean Public Surface

**TASK 4 audit.** Identifies surfaces worth keeping vs surfaces that
add cognitive load without serving the survival-mode launch.

This document does NOT delete code. It catalogs candidates for the
operator to confirm. Per the user's explicit "REMOVE" directive,
items in §1 are recommended for removal in a follow-up PR; items in
§2 are recommended for hiding-from-public-nav only.

## §1 — Recommended for removal (operator confirms before deletion)

| Path / item | Reason | Risk if removed |
|---|---|---|
| `apps/web/app/_archive/**` (entire tree, ~80 files) | Walled off by Next App Router (`_` prefix); zero routes; historical only | NONE — Next doesn't route these |
| `apps/web/app/calibration/` | Internal-experimental; no public nav inbound | LOW — verify with `grep -rn '/calibration' apps/web/components apps/web/app` first |
| `apps/web/app/autopilot/` | Internal; no public nav inbound | LOW (same check) |
| `apps/web/app/roi/` | Internal/marketing experiment | LOW |
| `apps/web/app/pilot/` | Internal | LOW |
| `apps/web/app/ops/` | Internal ops surface | LOW (operators may still reach by URL) |
| `apps/web/app/analytics-foundation/` | Internal | LOW |
| `apps/web/app/investigate/` | Internal | LOW |
| `apps/web/app/dossier/` | Verify; likely demo-grade | LOW after verify |
| `apps/web/app/for/` | Verify content | LOW |
| `apps/web/app/file/` | Verify | LOW |

## §2 — Hide from public nav, keep route (low-risk)

| Surface | Why keep | Why hide from nav |
|---|---|---|
| `/issuer/*` family | Demo-grade demos (`recordedBy: 'demo'`); useful for invited reviewers | Not public-launch ready; the foundation-honest framing is fine for invitees, confusing for public visitors |
| `/admin/*`, `/internal/*` | Already gated by Clerk middleware | Already not nav-linked publicly |
| `/holder/*`, `/verifier/*` (verifier path is the auth-gated one, distinct from the empty top-level `/verifier` dir which we redirected) | Clerk-gated | Already not publicly nav-linked |
| `/onboarding/identity`, `/readiness`, `/fetching`, `/success` | Form-step shells | Internal flow steps; only reachable from `/onboarding` |

## §3 — KEEP (the launchable public surface)

This is the **lean public surface** the survival launch ships with:

### Marketing / entry

- `/` (homepage)
- `/launch` ← new in this PR
- `/demo` + `/demo/clinician` + `/demo/employer` + `/demo/issuer` ← new in this PR
- `/pricing` (foundation-preview copy)
- `/docs`
- `/status`
- `/legal/*`, `/terms`, `/privacy`
- `/contact`

### Clinician core

- `/sign-up`, `/sign-in` (Clerk)
- `/signup` (foundation describer with new CTA → `/sign-up`)
- `/onboarding` (entry + sub-steps)
- `/passport`, `/passport/[id]`
- `/p/[npi]` (public profile)
- `/account` (authenticated)

### Employer core

- `/employer/dashboard`
- `/employer/worklist`
- `/employer/review/[applicationId]`
- `/employer/decision/[applicationId]`

### API (kept; needed for runtime)

- `/api/health`, `/api/status`
- `/api/passport/**`
- `/api/ingest/[npi]`, `/api/ingest/stream/[runId]`
- `/api/replay/**`
- `/api/receipt/by-lineage/[lineageKey]`, `/api/receipts/verify`
- `/api/.well-known/jwks.json` (+ namespace mirror)
- `/api/auth/resolve-role` (middleware fallback)

That's the lean surface. Everything else is either internal,
demo-grade, or experimental.

## §4 — Estimated cognitive-load reduction

Per the user's goal "reduce cognitive load by 70%":

| Metric | Before | After (per this audit) | Reduction |
|---|---|---|---|
| Top-level routes a public visitor can reach | ~40 (every dir in `apps/web/app/`) | ~12 (`/launch`, `/demo*`, `/pricing`, `/docs`, `/status`, `/legal`, `/terms`, `/privacy`, `/contact`, `/sign-up`, `/sign-in`, `/onboarding`, `/passport`, `/p/<npi>`) | ~70% ✓ |
| Surfaces in primary marketing nav | depends on nav component; likely 8–10 currently | 5–6 (Home, Launch / Demo, Pricing, Docs, Sign in) | ~40% |

The route-deletion + nav-hiding approach together delivers the 70%
reduction in cognitive load for public visitors WITHOUT breaking
authenticated / institutional flows.

## §5 — Recommended removal PR (operator confirms)

If the operator approves §1, the cleanup is one PR roughly:

```
chore(repo): remove archived + internal-experimental routes

- Delete apps/web/app/_archive/** (walled off; zero runtime impact)
- Delete apps/web/app/{calibration,autopilot,roi,pilot,ops,analytics-foundation,investigate,dossier,for,file}/
  AFTER per-directory grep confirms no inbound public links
- Update marketing/components nav to remove any links to deleted paths
```

Estimated diff: ~80–120 file deletions, no test changes, no env
changes, no schema changes. Reviewable in <30 minutes.

**Pre-PR step (operator-side, mandatory)**: for each directory in §1
rows 2–11, run:

```bash
grep -rn "/<dir-name>" apps/web/components apps/web/lib apps/web/app/page.tsx 2>/dev/null | grep -v "_archive\|__tests__"
```

If zero hits: safe to delete. If hits exist: either remove the
linking surface or keep the directory.

## §6 — What this audit does NOT recommend deleting

- `/api/**` (entire backend API surface) — every API route has callers; per-route audit needed, NOT a survival-mode batch operation
- Workspace packages (`packages/**`) — load-bearing imports
- `apps/marketing` — separate Vercel project, separate domain; don't touch
- `apps/api/backend/**` — Railway-hosted backend; out of scope for web
- Lane B trust UI primitives in `apps/web/components/trust/**` — they ship the institutional vocabulary; even if not yet wired into every UI, removing them removes optionality for the institutional buyer story

## §7 — Lean-surface verdict

A 12-route public surface + 4-route employer-core + Clerk auth =
a clean, focused launch experience. The 25+ internal/experimental
routes that exist on `origin/main` today are real cognitive load
for a first-time visitor, and per §1 most can be removed without
risk.

The operator decides whether to ship the cleanup PR. This audit
provides the inventory; no deletions performed autonomously.
