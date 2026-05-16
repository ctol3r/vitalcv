# Public Launch Ready

**Single closing synthesis** for the "launch VitalCV publicly this
week" mission. Subsumes:

- WAVES 1, 4, 6 (repo coherence + trust consistency + launch readiness) → `repo-coherence-launch-readiness.md`
- WAVE 5 (tech debt triage) → `tech-debt-triage.md`
- WAVE 3 (architecture compression) → `architecture-compression-inventory.md`
- WAVE 2 + new "public launch THIS WEEK" tasks 1–6 (UX polish + QA) → `launch-ux-scope-note.md` + this doc

This is the answer to "what does the founder do this week to ship."

## §0 — Honest scope note (new mission tasks)

The new mission asks for:

| Task | Can I do this from a build session? |
|---|---|
| 1. Final signup/onboarding QA | **No** — requires rendered flow walkthrough |
| 2. Mobile QA | **No** — requires device/responsive testing |
| 3. Passport clarity polish | **No** — UX judgment requires rendered review |
| 4. Employer demo polish | **No** — same |
| 5. Remove remaining fake/demo UX | **Partial** — can identify candidates; can't judge "feels fake" without rendered review |
| 6. Ensure clarity / trust / value perception | **No** — subjective UX outcomes |

What this doc CAN do: produce the deterministic launch checklist that
a founder + tester pair can execute in 1–2 days. Each item points
to who owns it and what unblocks the next one.

## §1 — This-week launch checklist

Ordered by dependency. Total ~6 engineering hours + ~2 operator hours.

### Day 0 — Operator unblocks production (2 hours)

| # | Action | Doc reference | Owner |
|---|---|---|---|
| 1 | Identify canonical Vercel project | `production-restore-sequence.md` §1 (PR #363) | OPERATOR |
| 2 | Resolve HTTP 402 pause | `pause-root-cause-report.md` §2 (PR #363) | OPERATOR |
| 3 | Set 5 required env vars: `RECEIPT_PRIVATE_KEY_JWK`, `RECEIPT_KID=vcv-es256-1`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `production-env-requirements.md` §1 (PR #363) | OPERATOR |
| 4 | Set 4 recommended env vars: `NEXT_PUBLIC_API_BASE`, `BACKEND_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `VITALCV_ENV_LABEL=production` | `production-env-requirements.md` §2 | OPERATOR |
| 5 | Run Railway demo seed for NPI 1346053246 | `final-deployment-sequence.md` §5 | OPERATOR |
| 6 | Schedule probe runner cron | `production-env-requirements.md` §2 row `CRON_SECRET` | OPERATOR |

**Verification**: run `scripts/verify-production-runtime.sh` (PR #363
ships this). Expect all 7 categories PASS. If any FAIL, follow the
referenced diagnostic doc.

### Day 1 — Engineering small-PR sweep (~3 hours)

| # | Action | Risk | Source |
|---|---|---|---|
| 7 | Fix `/api/ingest/[npi]` client to branch on `fallback: true` (avoid throwing on backend-degraded responses) | LOW | `launch-ux-scope-note.md` Candidate B |
| 8 | Add redirect `/signup` → `/sign-up` in `next.config.mjs` | LOW | `tech-debt-triage.md` Bucket 2 #6 |
| 9 | Rename `LaneHealthMount` "Unavailable" to "Probe pending" when seeds are UNKNOWN (removes the label collision) | LOW | `launch-ux-scope-note.md` Candidate A |
| 10 | Audit marketing copy for inbound links to `/verifier`, `/compliance`, `/.well-known/jwks.json` (the canonical-path version not on main); remove or update | LOW | `tech-debt-triage.md` Bucket 2 #5, #7 |
| 11 | (Optional) Drop `source-health-probe.yml` cron from 15-min to hourly (per `build-churn-audit.md` §5.1 on `survival/cloudflare-migration` branch) | LOW | `survival/cloudflare-migration` |

All five can land in **one small "launch hygiene" PR**. Total diff
likely <100 lines.

### Day 2 — Founder-side QA pass (~1 day, requires rendered review)

| # | Task | What to verify |
|---|---|---|
| 12 | Walk homepage → NPI submit → passport flow as a real user | First impression: clarity, trust, momentum. Does it feel calm? |
| 13 | Walk `/onboarding` → identity → readiness → success | Step continuity; loading states; success transition |
| 14 | Walk `/passport/<live-NPI>` rendered against live backend | Lane statuses populated; band shows real probe data (cron now scheduled); banned-phrase scan clean |
| 15 | Walk `/employer/review/<applicationId>` | Reviewer clarity; evidence hierarchy; next-action prominence |
| 16 | Mobile device walkthrough of the same four flows | Responsive layout; tap targets; mobile typography |
| 17 | Banned-phrase regression scan via `scripts/verify-production-runtime.sh` | Should still be CLEAN post-deploy |

**Honest acknowledgment**: items 12-16 are the WAVE-2 / new-mission
UX polish. They cannot be performed by an automated session. They
require a human reviewer with the product loaded in a browser.

### Day 3 — Soft launch (optional but recommended)

| # | Action |
|---|---|
| 18 | Invite 5–10 trusted clinicians to sign up and use the product |
| 19 | Watch Sentry errors and `/api/status` for ~24 hours |
| 20 | Schedule first iteration UX-polish PR based on real user feedback |

This step doesn't block "public launch" — it's a low-risk validation
before broad announcement.

### Day 4–5 — Public announcement

| # | Action |
|---|---|
| 21 | Public launch announcement on whatever channels apply |
| 22 | Continue monitoring `/api/status`, Sentry, Vercel analytics |
| 23 | First-week post-launch: ship the Bucket 3 backlog from `tech-debt-triage.md` in priority order |

## §2 — What's actually launchable RIGHT NOW

Assuming Day 0 + Day 1 items close (8 operator hours + 3 engineering
hours total):

| Surface | Launch verdict |
|---|---|
| Homepage `/` | READY — NPI submit flow works once Day 1 #7 lands |
| `/pricing`, `/docs`, `/status`, `/legal/*`, `/privacy`, `/terms` | READY — foundation-honest copy, no overclaim |
| `/onboarding` (entry + 4 sub-steps) | READY — foundation-honest, pure render |
| `/passport` + `/passport/[id]` | READY post-Day-0 (probe runner scheduled + demo seed) and Day-1 #9 (label collision fix) |
| `/p/[npi]` (public profile) | READY — sanitized public view |
| `/sign-in`, `/sign-up` | READY post-Day-0 (Clerk env set) |
| `/employer/dashboard`, `/employer/worklist`, `/employer/review/[applicationId]`, `/employer/decision/[applicationId]` | READY for "first 10 employers" — workflow completeness untested but route surface exists |
| `/api/health`, `/api/status` | READY |
| `/api/.well-known/jwks.json` (legacy mirror) | READY post-Day-0 (signing env set); emits canonical kid |
| `/api/replay/*` readers | READY — post-PR-α/β/γ already on main |
| `/api/receipts/verify` | READY — ES256 signature oracle |

## §3 — What's intentionally NOT shipping this week

Per `tech-debt-triage.md` Bucket 3 — post-launch:

- Canonical RFC `/.well-known/*` paths (jwks at root, did, openid-credential-issuer, openid-configuration, trust-register) — institutional verifier discovery; unmerged stack #345/#349/#355; institutional buyer demand will pull this forward
- Lane B trust UI primitives (TrustHeader composite, ReplayLineage UI, etc.) — readers ship as JSON; UI consumption is incremental
- Continuity reconciler endpoint — derivable client-side
- Receipt-issuance persistence by `jti` — receipts on-demand for now
- Writer expansion to non-orchestrator ingest sites
- Architecture compression beyond the safe `_archive/` removal in `architecture-compression-inventory.md` §1
- Cloudflare migration (Path A/B/C decision on `survival/cloudflare-migration` branch) — survival measure; not launch-blocking

None of these are launch-blocking. All are intentionally deferred.

## §4 — Removing "fake/demo feeling" (new mission task 5)

Code-level audit found:

| Item | Status |
|---|---|
| `/issuer/*` family uses `recordedBy: 'demo'` literal | EXPLICITLY DEMO-GRADE — appropriate posture for issuer flows. Suppress from public nav if not already. |
| `/api/receipt/[lineageKey]:171` dev-mock branch | GATED by `if (isDev())` — never reaches production |
| `/passport` "Sample readiness snapshot" placeholder card | LABELED "Sample" in the idle state — appropriate; clears once NPI submitted |
| `_archive/demo/` directory | UNREACHABLE (Next App Router walls off `_` prefixes) |
| Foundation-preview copy throughout | TRUTH-HONEST — not "fake" in the misleading sense; explicitly disclaims completion claims |

**Verdict**: the codebase does NOT contain "fake feeling" UX that
needs removal. What it has is foundation-honest framing. The
distinction matters: removing the foundation-honest framing would
be the opposite of what truth-contract requires.

**What COULD feel fake to a first-time user** (requires rendered
review):

- `LaneHealthMount` UNKNOWN seeds (probe runner unscheduled) → looks like "we don't know what we're showing you." **Fixed by Day-0 #6 + Day-1 #9.**
- `/api/ingest/[npi]` HTTP-200 fallback masquerade → user sees cryptic error. **Fixed by Day-1 #7.**
- `/passport` sample card might be confusing if the user lingers on the idle state. **Requires rendered review** to decide if the copy is clear enough.
- Visible legacy/internal routes if linked from nav. **Day-1 #10 audit fixes this.**

After Day 0 + Day 1, the rendered-UI feel for first-time users should
be significantly cleaner. Final calibration is Day 2 founder QA.

## §5 — Mobile QA (new mission task 2)

Cannot be performed from a build session. Mobile UX requires:

- Real-device testing (iOS Safari + Android Chrome at minimum)
- Viewport-specific render checks
- Tap-target sizing
- Form usability under mobile keyboards

The codebase uses Next 15 + Tailwind responsive utilities throughout.
Per code inspection, layouts use `sm:`/`md:`/`lg:` prefixes
consistently. But "consistent prefix usage" is not the same as
"good mobile UX."

**Recommendation**: Day-2 founder QA pass should include a mobile
walkthrough. If specific responsive bugs are found, they're typically
small (CSS class additions); ship in the same hygiene PR.

## §6 — Emotional trust (new mission task 6)

Per `launch-ux-scope-note.md` §4: emotional trust is judged by
rendered output. The code-level structure SUPPORTS emotional trust
(foundation-honest copy, no overclaim, T1-T4 authority ladder visible)
but the **felt** trust depends on:

- Loading state design
- Color / weight / typography hierarchy
- Motion (or restraint thereof)
- Cognitive density per screen

All of these are rendered-review concerns. The honest scope is:
**after Day 0 + Day 1 land, the code is positioned to convey
emotional trust; final calibration is a Day 2 human pass.**

## §7 — Single launch verdict

**VitalCV is launchable to "first 100 real signups this week"
behind 8 hours of operator + engineering work + 1 day of
founder-led rendered QA.**

Specifically:

- **Day 0** (Mon-ish): operator unblocks production (~2 hours)
- **Day 1** (Tue-ish): one small hygiene PR closes 5 visible defects (~3 hours engineering)
- **Day 2** (Wed-ish): founder QA pass on rendered surfaces (~6 hours human review)
- **Day 3–5**: soft-launch then announcement

The remaining work post-launch is incremental UX polish + the
Bucket 3 backlog. None blocks the public-facing announcement.

## §8 — What I am explicitly NOT doing in this synthesis

- Performing the rendered QA (cannot from a build session)
- Modifying any UX surface (no homepage redesign, no passport restructure)
- Auto-applying the small-PR hygiene fixes (they're proposed; operator picks order + reviewer)
- Generating more architecture audits (the set is exhaustive; this synthesis closes the audit cycle)
- Speculating on launch metrics / traction projections

This is the closing operational artifact. The work between here and
public launch is operator + founder action, not autonomous engineering.

## §9 — Bottom line

The repo is launch-ready in shape. The bottleneck is operator-side
production restoration + ~1 day of focused founder QA. Total time
to public-facing: **3–5 days from when the operator clears HTTP 402.**

No more autonomous architecture work is required.
