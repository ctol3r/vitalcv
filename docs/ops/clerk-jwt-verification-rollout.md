# Clerk JWT verification rollout: `off` → `shadow` → `enforce`

**Status: not started. This is the plan and its exit criteria, not a record of
a completed rollout.**

A1's consented execution needs verified identity on two backend paths. That
is a reason to run the rollout properly, not a reason to shortcut it. Going
straight from `off` to `enforce` would flip an auth mode that has never been
observed carrying real traffic, on paths that gate sharing a clinician's
evidence packet — the failure mode is silent 401s on the exact surface a
clinician just approved, which reads to them as VitalCV losing their
approval.

Prior art: the G1 enforce flip was reverted in 23 minutes
(`enforce_readiness_and_rollback_2026_08_07`). Shadow is what that attempt
skipped.

## Why A1 needs it

`CLERK_JWT_VERIFICATION=off` makes `verifiedIdentityMiddleware` a no-op that
returns before setting `req.verifiedAuth`, so every route calling
`requireVerifiedClerkUserId` 401s **regardless of the headers sent**. Two A1
paths run through those routes:

| Path | Route | Guard |
| --- | --- | --- |
| Level-3 consented share | `POST /api/apply/share` | `requireVerifiedClerkUserId` + `requireNpiAuthorization` |
| Ownership read (context assembly) | `GET /api/ownership/state/:npi` | verified identity |

Under `off`, A1 degrades honestly — the execution service records
`agent_action_failed` and the clinician is told the action did not complete
— but consented sharing does not function.

Note the inconsistency worth designing around: the Level-2 refresh
(`POST /api/trust-state/:npi/refresh`) reads the raw `x-clerk-user-id`
header and keeps working under `off`. So a partial rollout leaves L2
executing and L3 refusing, which is safe but asymmetric.

## Stage 1 — `shadow`

`verifiedIdentityMiddleware` verifies the bearer and populates
`req.verifiedAuth`, but a verification failure does not reject the request.
This is the observation stage; nothing about A1 changes behavior yet.

**Exit criteria — all must hold over a full business week:**

1. **Coverage.** ≥99% of requests to the two affected routes carry a bearer
   that verifies. A missing bearer is a *client* defect (an unmigrated
   caller), and each one must be identified before enforce, not counted as
   noise.
2. **Identity agreement.** For every request carrying both, the verified
   subject equals the `x-clerk-user-id` header. **Zero unexplained
   mismatches.** A mismatch is not a tuning parameter — it means one of the
   two is wrong about who is calling, on a path that authorizes disclosure.
3. **Internal-id resolution.** Every verified subject resolves through
   `resolveInternalUserId` to a real `User.id`. An unresolvable subject would
   become a 403 (or a 500 against the `@db.Uuid` column) under enforce —
   the `npi_ownership.user_id` boundary bug in a new costume.
4. **Ownership authz parity.** The `requireNpiAuthorization` outcome
   (allow/deny) computed from the *verified* subject matches the outcome
   from the header subject, for every request. A divergence here changes who
   can share whose packet.
5. **Non-browser callers enumerated.** Cron, monitoring, and internal
   service callers that touch these routes are listed with their auth story.
   Any that cannot present a user bearer need an explicit decision before
   enforce, not a 401 in production.

**Instrumentation to add before flipping to shadow:** structured log lines on
the two routes recording `{ route, hasBearer, verifiedSubject?,
headerSubject?, agree, internalIdResolved, authzOutcome }`. No tokens, no
PII. Without these, shadow proves nothing — it just runs quieter.

## Stage 2 — `enforce`

Only after every Stage-1 criterion holds. Flip during a window with someone
watching, and check the same log lines for a 401 spike on the two routes plus
`agent_action_failed` events carrying `canonical_ownership_authz`.

**Rollback:** set `CLERK_JWT_VERIFICATION=shadow` and redeploy. Because A1
records an honest failure rather than a fake success, a bad enforce flip
costs clinicians a retry — it does not produce a wrong share or a phantom
authorization.

## What A1 does NOT depend on

The consent ledger, scope derivation, plan regeneration, execution gates, and
the whole telemetry chain are web-side and work identically under any of the
three modes. Only the two canonical calls above are gated. A1 can therefore
be reviewed, merged, and exercised on its own timeline; this rollout is a
separate, sequenced decision.
