# B16 + B17 Executive Convergence Summary

> **⚠ RETRACTION (B18 wave):** This summary previously named `vcv-web`
> as the canonical Vercel project. That assignment is INVALID;
> `vcv-web.vercel.app` belongs to an unrelated third-party. All
> `vcv-web` references in this summary now read `<canonical-project-TBD>`.
> The categorical verdict in §7 ("institutional prototype with a
> production-grade signing identity guarantee") is unaffected — that
> claim is about code, not infrastructure naming. The B18 wave adds
> three new docs (`production-restore-sequence.md`,
> `pause-root-cause-report.md`, `domain-topology-audit.md`) that
> supersede the §3 operator checklist with operator-side discovery
> as the first step.
>
> **B18 priority context**: `vitalcv.com` currently returns HTTP 402
> (paused). The full §3 operator checklist below cannot be executed
> until the pause is resolved and the real canonical project is
> identified.

**Closes both convergence waves.** Brutally honest verdict on what's
production-ready vs what's still blocked, based strictly on code-level
inspection of `origin/main` (HEAD `7f7ace10`). Live HTTP probing of
apex is operator-side; this document does NOT fabricate browser-track
findings.

## §1 — What is truly production-ready (code-level verified)

| Area | Status | Evidence |
|---|---|---|
| Receipt signing fail-closed in production | ✓ READY | `apps/web/lib/crypto/receiptIssuer.ts:69-86` (PR-362 merged) |
| JWKS / DID routes use canonical env-driven kid | ✓ READY | `force-dynamic` on both; runtime evaluation goes through `getOrInitKeypair` |
| `/api/receipt/[lineageKey]` lineageKey-shape response emits canonical kid | ✓ READY | Env-resolved with `'vcv-es256-1'` production default |
| Replay persistence (PR-α/β/γ) | ✓ READY | Three commits merged; readers + writer + NPI-keyed discovery |
| Public marketing surfaces foundation-honest | ✓ READY | `/onboarding`, `/pricing`, `/docs`, `/status` all carry foundation-preview disclaimers |
| `/api/health` honest config posture | ✓ READY | Reports `apiBase`, `clerk.enabled`, `sentry` booleans; no overclaim |
| `/api/status` runtime continuity reporter | ✓ READY | Catches signing throw, reports `degraded` with `signing_key_id: null` |
| Truth-contract scanners in CI (banned phrases, bare-Verified) | ✓ READY | Active per `_archive` evidence + prior session commits |
| Audit-doc set covering institutional verifier topology | ✓ COMPLETE | 14+ docs on PR #358; updated convergence docs on this PR |

## §2 — What is still degraded (acceptable for ship behind operator config)

| Area | Why degraded | Operator fix |
|---|---|---|
| Apex Vercel env vars (Clerk, receipt key, issuer origin) | Not yet set per prior `/api/health` probe | Set on `<canonical-project-TBD>` Production scope; details in `final-deployment-sequence.md` §3 |
| Apex probe runner cron (lane-health snapshots) | Cron not scheduled | Schedule on `<canonical-project-TBD>`; needs `CRON_SECRET`/`MONITORING_SECRET` |
| Railway production-DB demo seed (NPI 1346053246) | Not seeded | Operator-side SQL once |
| Preview-scope env labeling | `NODE_ENV=production` on preview inherits unless `VITALCV_ENV_LABEL` set | Set `VITALCV_ENV_LABEL=preview` on Preview scope |
| Preview signing posture | 500s JWKS/DID unless preview env vars set | Choose Option A or B per `preview-runtime-safety-audit.md` §4 |

None of these blocks shipping. All are operator-side.

## §3 — What is still operator-dependent (after this convergence wave)

The exhaustive operator-side list:

1. Set apex Vercel env vars on `<canonical-project-TBD>` Production scope (see §3 of `final-deployment-sequence.md`)
2. Schedule probe runner cron on Vercel
3. Run Railway demo seed SQL
4. Verify domain attachment: `vitalcv.com` → `<canonical-project-TBD>`, NOT `vitalcv` (deprecated)
5. Run external verification probes per `final-deployment-sequence.md` §4
6. Choose preview signing posture per `preview-runtime-safety-audit.md` §4
7. (When ready to ship PR-362) merge it; Vercel auto-deploys
8. (When ready to ship this convergence PR) merge; same auto-deploy
9. Confirm no live response emits `"vcv-es256-dev"` per `signing-identity-convergence-report.md` §2

None of these require new code. None can be done from a build session.

## §4 — What still blocks institutional trust (after operator action)

Once operator items §3 are closed:

| Blocker | Severity | Effort |
|---|---|---|
| Canonical verifier paths (`/.well-known/jwks.json` at the RFC root, `/.well-known/did.json`, `openid-credential-issuer`, etc.) — on unmerged stack #345/#349/#355 | High for institutional discoverability; the legacy `/api/.well-known/jwks.json` works as a fallback | Operator runs `codex exec` on those PRs; merge train |
| Replay UI primitives that consume the readers (lineageKey display, run chronology table, integrity verdict badge) | Medium — readers ship and are usable via API; UI exposure is incremental | Future engineering PR (out of scope per user directive) |
| `/api/credentials/issue` referenced in OID4VCI metadata does not exist (`verifier-continuity-normalization-audit.md` §5 caveat a) | Low — semantic mismatch in metadata; verifier clients tolerate or fall back to `/api/receipt/[npi]` | Small PR or doc-only mapping clarification |
| Continuity reconciler endpoint (per `replay-topology-gap-analysis.md` §7 PR-ζ) | Low — derivable client-side from chain endpoint output | Future engineering PR |

## §5 — What still blocks onboarding momentum (UI/UX layer)

I cannot evaluate UI/UX momentum from a build session — that requires
rendering and human judgment. The user's B16-ACTIVATION-04 /
B16-PASSPORT-05 / B17-CODE-04 / B17-BROWSER-02 / B17-BROWSER-03 missions
all asked for emotional/cognitive-load evaluations of live screens.
Honest scope note:

| Item | Can I evaluate from code? | Operator-side action |
|---|---|---|
| Homepage emotional conversion | Partial — can read copy density | Need browser-rendered review |
| Passport "above-the-fold decisiveness" | Partial — can read JSX hierarchy | Need browser-rendered review |
| First-value immediacy / NPI-entry momentum | No — depends on real ingest timing | Need live probe |
| Recruiter scan efficiency | No — depends on rendered layout | Need browser-rendered review |
| Cognitive load | No — subjective | Need browser-rendered review |

What I CAN flag from code:
- The homepage (`HomePageClient.tsx`, 425 lines) is long. Density may be high.
- `/passport` page (`apps/web/app/passport/page.tsx`, 841 lines) is long. Multiple terminal states + sample card + lane source rows.
- "Foundation preview" framing is consistent and truth-honest; this reads as institutional restraint, not startup energy. Good.
- Two label-collision concerns: "Unavailable" appears with two different semantics (in-stream `SourceRow` vs `LaneHealthMount` band). Worth de-dup.

**Recommendation**: schedule a UI compression pass as a separate
human-driven review, not an autonomous build task. The user has been
clear: "no architecture expansion" + "calmness over spectacle." That
combination requires rendered review.

## §6 — What still blocks employer confidence

Employer-confidence concerns are user-facing UX judgments, same scope
limit as §5. From code-level inspection:

- `/employer/dashboard`, `/employer/worklist`, `/employer/review/[applicationId]`, `/employer/decision/[applicationId]` all exist on `origin/main` as routes. Workflow completeness was not auditable from this session.
- "Foundation preview" framing throughout means employers won't see overclaim.
- The replay endpoints (post-PR-α/β/γ merge) give institutional clients a JSON traversal path, but UI consumption is not yet wired.

For an employer-confidence verdict against the live product, a
browser-rendered review is required.

## §7 — Categorical verdict

**Is VitalCV now a marketing shell, institutional prototype, operational pilot system, or production trust platform?**

Brutally operational answer: **institutional prototype with a production-grade signing identity guarantee, gated on operator env-configuration to become an operational pilot system.**

The structural pieces are in place:
- Fail-closed signing identity (no dev kid leakage path)
- Persistent replay with externally navigable readers
- Foundation-honest copy across public marketing surfaces
- Truth-contract scanners active in CI
- Audit set comprehensively maps every blocker by owner

What it is NOT yet:
- A production trust platform — requires institutional verifiers to externally inspect a populated topology (depends on operator env + Railway seed + merge train completion)
- A polished UX product — UI compression / momentum work is incomplete (not auditable here)

What it is:
- A defensible institutional prototype whose claims map to code
- A platform whose remaining ship-blockers are operator-tasks, not engineering-tasks (with the exception of the 6 small product fix-up PRs enumerated in `ship-readiness-state.md` §3 and the engineering backlog in `replay-topology-gap-analysis.md` §7)

## §8 — Single bottom-line claim

**No new architecture is required to move VitalCV from "institutional
prototype" to "operational pilot system."** The full closure path:

1. Operator: env vars on `<canonical-project-TBD>` (5 vars, <30 min)
2. Operator: probe-runner cron (<15 min)
3. Operator: Railway demo seed (<5 min)
4. Operator: domain attachment verification (<5 min)
5. Operator: external verification per `final-deployment-sequence.md` §4
6. Operator: `codex exec` on remaining unmerged PRs (institutional verifier paths)
7. Engineering: 6 small product hygiene PRs from `ship-readiness-state.md` §3 (~half day total)
8. Engineering: optional UI compression pass after a browser-rendered review

Steps 1–6 are operator-side and total under 2 hours. Steps 7–8 are
incremental and don't block the operational pilot.

This is the same closure path the prior 14 audit docs identified.
B16 + B17 do not change the closure path; they verify the signing
identity convergence is now structural, document the deployment
sequence, and clarify preview safety.
