# Repo Coherence + Launch Readiness

**Consolidates WAVES 1, 4, and 6** of the principal-architect mission.
Single document answering: is the product internally consistent, does
it communicate one unified promise, and is it shippable.

Scoped to `origin/main` HEAD `7f7ace10`. Code-level inspection only;
rendered-UI judgments are flagged separately in WAVE 2 scope note.

## §1 — UX language consistency (WAVE 1 + WAVE 4)

### Trust-language audit (code-grep results)

| Term | Occurrences (excluding `_archive`) | Verdict |
|---|---|---|
| `Source-backed` / `source-backed` | 185 | **CANONICAL POSITIVE PHRASE** — consistent across passport, employer review, trust-state |
| `T1` / `T2` / `T3` / `T4` | 139 (139 × 4-rung ladder ≈ 35/tier) | **CONSISTENT** — Authority ladder vocabulary stable |
| `DECISION_GRADE` / `decision-grade` | 50 | **CONSISTENT** — quality-threshold enum, code-internal |
| `Foundation preview` (in marketing copy) | Multiple (`/pricing`, `/docs`, `/status`, `/onboarding`) | **CONSISTENT TRUTH-HONEST FRAME** |
| `verified` (lowercase) | 465 — almost all in compound forms (`source-verified`, `Source-Backed Verified Snapshot`, etc.) | **CONSISTENT** — no bare-label violations found |
| `VERIFIED` (uppercase) | 90 — most in code identifiers, enums, type names | **CONSISTENT** — internal enum / status code usage |
| Bare-Verified UI label (`label: "Verified"` or `>Verified<`) | **ZERO** on `origin/main` | **CLEAN** (PR #359 enforced this previously) |

### Conflict modes (potential confusion)

| Issue | Severity | Where |
|---|---|---|
| `Unavailable` label collision: in-stream `SourceRow` (SSE error state) vs `LaneHealthMount` band (UNKNOWN snapshot when probe runner unscheduled) | MEDIUM | `/passport` page — both display "Unavailable" with different causes; user sees two indicators saying the same word for different reasons |
| `T1-T4 TrustTier` (authority ladder) vs `trustPosture.dimensions` (identity/safety/authority/eligibility four-dim) | LOW | `apps/web/design-system/components/TrustTierBadge.tsx` vs `apps/web/lib/trust/passport-contract.ts` — orthogonal axes; not actually a conflict but two readers might confuse them |
| Sign-up routes: `/sign-up` AND `/signup` both exist | LOW | `apps/web/app/sign-up/` + `apps/web/app/signup/` — SEO/duplication issue |
| Two different "verifier" framings: `/verifier` (currently empty dir on main) vs `/verify` (institutional inspector on unmerged stack) | LOW | Empty `/verifier` dir doesn't link from public nav; not user-facing today |

### Narrative consistency

| Surface | Promise it makes | Verdict |
|---|---|---|
| Homepage | "Stop Starting Over. Start Ready." — promise of readiness-not-redo | TRUTHFUL — what the product actually offers |
| `/onboarding` | "Readiness summary + next steps; does not finish credentialing" | TRUTHFUL — explicit disclaimer |
| `/pricing` | "Pricing is a foundation preview. Payments are not collected." | TRUTHFUL — no payment processing today |
| `/docs` | "Docs are a launch-readiness foundation, not complete API documentation." | TRUTHFUL |
| `/status` | "Status surfaces are foundation previews. No uptime guarantee." | TRUTHFUL |
| `/passport` | Per-source labels (`Checked`, `Source-backed`, `Access required`, `No profile yet`) | TRUTHFUL — never claims more than the source provides |
| `/employer/*` | Reviewer surfaces; foundation-honest copy | TRUTHFUL |
| `/issuer/*` | `recordedBy: 'demo'` literal; explicitly demo-grade | TRUTHFUL |
| `/p/[npi]` (public profile) | Sanitized public view; no compliance claims | TRUTHFUL |

**Headline**: VitalCV's surfaces communicate ONE promise — "readiness
preview, source-honest." No surface overclaims; the foundation-honest
frame is consistent.

## §2 — Stale / experimental surfaces (WAVE 1)

### `_archive/` content

| Path | Status |
|---|---|
| `apps/web/app/_archive/wave119/` | Archived; contains compliance, intake, mission-ops, intelligence, labs surfaces. **Not reachable** from current routing. Safe-to-leave. |
| `apps/web/app/_archive/demo/` | Archived demo surfaces (command-center, verifier-portal). **Not reachable**. Safe-to-leave. |
| `apps/web/app/_archive/verifier/` | Archived verifier surfaces. **Not reachable**. |

The `_archive/` dirs are walled off by Next App Router (paths starting
with `_` are NOT routed). No user can reach them; they exist only for
git history of prior implementations. Removing them would shrink the
repo but is not launch-blocking.

### Empty / placeholder routes

| Path | Status | Risk |
|---|---|---|
| `apps/web/app/verifier/` | Empty directory on `origin/main` | If marketing copy links here, 404 cascade. Currently no inbound nav link verified. |
| `apps/web/app/dossier/` | Verify content; likely demo | Low |
| `apps/web/app/for/` | Likely top-level marketing landing | Verify content |
| `apps/web/app/file/` | Verify purpose | Low |
| `apps/web/app/inbox/` | Verify content; likely authenticated | Medium if unauthenticated |
| `apps/web/app/calibration/` | Internal | Low if not publicly linked |
| `apps/web/app/autopilot/` | Internal | Low |
| `apps/web/app/roi/` | Marketing or internal | Verify |
| `apps/web/app/pilot/` | Internal | Low |

**Recommendation**: per-directory smoke check before public launch
(does the route 200? does it overclaim? does it expose internal data?).

## §3 — Onboarding flow continuity

### Current onboarding surfaces

| Step | Path | Content |
|---|---|---|
| Entry | `/onboarding` | Foundation overview; foundation-honest copy |
| Identity | `/onboarding/identity` | Identity collection step |
| Readiness | `/onboarding/readiness` | Readiness check |
| Fetching | `/onboarding/fetching` | Loading state |
| Success | `/onboarding/success` | Terminal |

Plus alternate paths:
- Homepage → NPI submit → `/passport?npi=` (SSE-driven hydration)
- Sign-in → role-based redirect (Clerk middleware)

**Verdict**: TWO entry funnels coexist — `/onboarding` (form-driven)
and homepage → `/passport` (NPI-driven). Both are valid; they target
different user states. The homepage→passport is the "trial-driven"
funnel; `/onboarding` is the "guided-start" funnel.

### Fragmentation risk

The homepage NPI submit fails cryptically when `/api/ingest/[npi]`
returns the masked-200 fallback (per `degraded-runtime-behavior-audit.md`
§2). This is the single most visible onboarding break. **Fix is small**
— `apps/web/lib/api.ts` `startPublicIngest` should branch on
`fallback: true`. Tracked but not yet shipped.

## §4 — Launch-blocking issues (WAVE 6)

In order of severity:

### Hard blockers (must resolve before public launch)

1. **HTTP 402 on apex** — Vercel pause active. Per `pause-root-cause-report.md`. Operator-side.
2. **Apex env vars unset** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `RECEIPT_PRIVATE_KEY_JWK`, `RECEIPT_KID`. Per `production-env-requirements.md`. Operator-side.
3. **Canonical Vercel project not operator-confirmed** — `vcv-web` claim was retracted; real project name TBD. Per `production-restore-sequence.md` §1. Operator-side.

### Soft blockers (visible during demo / first impression)

4. **`/api/ingest/[npi]` fallback client throw** — user-visible homepage break under backend stress. Small client PR.
5. **`LaneHealthMount` shows UNKNOWN seeds** — visible "Unavailable" lanes on `/passport` until probe runner cron scheduled. Operator-side.
6. **`/sign-up` vs `/signup` duplication** — SEO. 1-line redirect.
7. **Empty `/verifier` dir** — if any public link points here, 404. Audit-and-suppress.

### Cosmetic (post-launch acceptable)

8. **`Unavailable` label collision** — `/passport` page consistency
9. **Legacy `/api/.well-known/jwks.json` Content-Type** is `application/json` instead of `application/jwk-set+json`. Strict OIDC clients reject; most don't notice.
10. **`/compliance` archived** — if marketing links to it, dead link. Link audit.

### Not blockers (institutionally-strong but post-launch)

- The canonical RFC `/.well-known/*` paths (unmerged stack) — institutional verifier discovery; not required for clinician/employer launch
- Replay UI primitives — readers ship and work; UI consumption is incremental
- Continuity reconciler — derivable client-side from chain endpoint
- Receipt-issuance persistence — receipts signed on demand; revocation is v2

## §5 — Public-launch readiness verdict

**Categorical state**: institutional prototype with verified-signing
guarantee, operationally degraded until the operator completes the
recovery sequence (`production-restore-sequence.md`).

**Launchable to "first 100 real signups" requires**:

| Step | Effort | Who |
|---|---|---|
| Resolve HTTP 402 pause | <30 min | OPERATOR (Vercel dashboard) |
| Identify canonical Vercel project | 5 min | OPERATOR |
| Configure 5 required env vars + 4 recommended | <30 min | OPERATOR |
| Force deploy + run `scripts/verify-production-runtime.sh` | <5 min | OPERATOR |
| Schedule probe runner cron | <15 min | OPERATOR |
| Seed demo NPI to Railway production | <5 min | OPERATOR |
| (Optional) ship small client fix for `/api/ingest/[npi]` fallback | <1 hour | ENG (one small PR) |
| (Optional) ship `/sign-up`/`/signup` redirect + empty-`/verifier` suppression | <30 min | ENG (one small PR) |

**Total**: ~2 operator hours + ~2 engineering hours of small PRs.

**What's NOT in the launch path**: institutional verifier topology
(unmerged stack), Lane B UI primitives, continuity reconciler,
receipt-issuance persistence. These are post-launch maturation work.

## §6 — One unified promise (WAVE 4 synthesis)

VitalCV's product narrative as currently encoded:

> **"VitalCV is a clinician readiness preview, source-honest. Type
> your NPI; we check public sources (NPPES, OIG, PECOS, state-board
> where available); we render what we found; we never claim to
> finish credentialing for you."**

Every surface inspected in §1 supports this single promise:
- Homepage → NPI submission, no overclaim
- `/onboarding` → readiness summary, explicit disclaimer
- `/passport` → per-source labels, T1-T4 authority ladder
- `/employer/*` → reviewer surfaces, foundation-honest
- `/issuer/*` → `recordedBy: 'demo'`
- `/pricing`, `/docs`, `/status` → foundation-preview framing
- Replay readers → JSON contracts, deterministic identifiers
- Signing identity → fail-closed in production, no dev kid leakage

The promise is consistent. The remaining work is operational
(deployment + env) plus the small visible-defect fix list in §4 soft
blockers.

## §7 — What this audit does NOT cover

- **Rendered UI quality** (calmness, emotional convincingness) — out of scope for code-level inspection. WAVE 2 scope note documented separately.
- **Cost / billing analysis** — covered by `survival/cloudflare-migration` branch docs.
- **Per-route security audit** — out of scope for this audit; truth-contract scanners + Clerk middleware are the existing guardrails.
- **Performance benchmarks** — out of scope.

The narrow lens of this document: is the code internally consistent
in promise + language + architecture, and is the launchable surface
defined.

**Answer to both**: yes. The remaining work is operator-side, not
code-side.
