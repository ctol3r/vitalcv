# ACT-1.0 — Employer Activation Current-State Map

**Bundle:** ACT-1 (Employer Activation Control Tower) · **Sub-bundle:** ACT-1.0 (recon, no product code)
**Verified baseline:** `origin/main` @ `55cbcd9f2`, read-traced 2026-07-18.
**Method:** every row below was read directly in the source at the cited `file:line`; claims reached only by inference are marked *(inferred)*.

> Companion: [ADR — head-start acceptance is not credentialing completion](../adr/ADR-activation-head-start-and-qualified-start.md).

---

## 1. The one-sentence finding

**Both ends of the activation loop are real; the middle does not exist.** The front (a sealed, consented `ApplicationPacket`) and the back (audited `EmployerAcceptance` and `Start` writes) are live and correct — but they live in **three disjoint keyspaces that never reference each other**, and there is no application-scoped requirement ledger or start-ready/started state carrying one application from acceptance to a measurable start.

The three keyspaces:

| Keyspace | Keyed on | Written by | Linked to Application? |
|---|---|---|---|
| `Application` / `ApplicationPacket` | `opportunityId` + `clerkUserId`; `packetHash` | `applicationService.ts` (sealed, LIVE) | — (this IS the application) |
| `EmployerAcceptance` | `employerId` + `clinicianNpi` (bare strings, **no FK**) | `employerReviewActions.ts:903` (LIVE) | **No** |
| `Recognition → Acceptance → Start` | `recognitionId` / `subjectId` (DID) | wedge API-key routes (LIVE, PSV-gated) | **No** |

Closing ACT-1 means giving these a single application-scoped spine — additively, without forking a fourth model.

---

## 2. Route / data truth table

| Surface | file:line | Class | Reads real data | Writes |
|---|---|---|---|---|
| MATCHA "Apply with VitalCV" CTA | `apps/web/components/matcha/OpportunityApplyCta.tsx:93` | LIVE | — | delegates to ApplyWithVitalCV |
| ApplyWithVitalCV modal | `apps/web/components/apply/ApplyWithVitalCV.tsx:255` | LIVE | trust-state | `POST /api/apply/share` → **Share/Bundle, NOT a sealed application** |
| **Sealed apply modal** | `apps/web/components/explore/ApplyModal.tsx:242` | LIVE | yes | `POST /api/opportunities/:id/apply` |
| applyToOpportunity (the seal) | `apps/api/backend/src/services/opportunities/applicationService.ts:317` | LIVE | yes | `Application` + `ApplicationPacket` + consent `AuditEvent`, one `$transaction` |
| Packet builder/hasher | `apps/api/backend/src/services/opportunities/applicationPacketService.ts:121` | LIVE | pure | sha256 seal over canonical content |
| Employer **review** page | `apps/web/app/employer/review/[applicationId]/page.tsx:16` | LIVE | yes (`loadApplicationEvidenceView`) | read-only — **no action buttons wired** |
| Packet read route | `apps/api/backend/src/routes/applications.ts:118` | LIVE | requires verified Clerk JWT (`:124`) | none |
| Employer **decision** page | `apps/web/app/employer/decision/[applicationId]/page.tsx:7,52` | **MOCK** | **No** — `MOCK_DECISION_ITEM`, ignores `applicationId` | none |
| Workflow-action route | `apps/api/backend/src/routes/applications.ts:229` | LIVE | `requireOrgRole(VERIFIER_MUTATION_ROLES)` | `Application.status` + HITL item + audit |
| **Accept (live)** `/api/employer-review/:entityId/accept` | `apps/api/backend/src/routes/employerActions.ts:311` | LIVE | RBAC + passport-BLOCKED gate (422) | `EmployerAcceptance` + outbox `EMPLOYER_REVIEW_ACCEPTED` + audit — **keyed entityId/NPI, not applicationId** |
| Accept (named `accept_head_start`) | `apps/api/backend/src/routes/employer-action.ts:64` | **DEAD — never mounted in `app.ts`** | — | would write `EmployerAcceptance` |
| Canonical Recognition/Acceptance/Start | `apps/api/backend/routes/wedge.ts:257,335,443` | LIVE (apiKey, PSV-gated) | yes | real FK chain, **DID-keyed, no Application link** |
| **Activation** console | `apps/web/app/activation/[caseId]/page.tsx:39` | **DEMO-ONLY** | **No** — only `demo-001`; all else `notFound()` | none |

---

## 3. Application state machine

`ApplicationStatus` enum (`schema.prisma:3475`) declares **18 values**; code writes only **five**:

- **Written (verified):** `PENDING` (submit, `applicationService.ts:390`), `WITHDRAWN` (`:486`), `REVIEWED` / `ACCEPTED` / `DECLINED` (`reviewApplication:526`, `runEmployerWorkflowAction:472`).
- **Enum-only / aspirational (no writer):** `DRAFT, SUBMITTED, VIEWED, IN_REVIEW, CREDENTIALING, COLLECTING_DOCS, VERIFICATION, WAITING_ON_SOURCE, READY_FOR_REVIEW, COMMITTEE_REVIEW, APPROVED, REJECTED, STARTED`. **The entire credentialing → start-ready → started tail is unwired.**

There is **no state-machine class**; transitions are direct `prisma.application.update` calls, guarded ad hoc by `assertVerifierOwnsOpportunity` (`:967`) and `ensureActionableState` (`employerWorkflowService.ts:352`, blocks re-acting on terminal states). `logApplicationTransition` (`applicationLifecycle.ts`, `@ts-nocheck`) writes a proper transition audit but is **called only from a test** — orphaned.

---

## 4. Infrastructure primitives to REUSE (do not reinvent)

| Concern | Canonical primitive | file:line |
|---|---|---|
| Durable audit | `writeEmployerReviewAuditEvent(writer, {type, referenceId, metadata})` — hashes + typed `type`; `writer` is `prisma` or a `tx` (duck-typed → audit joins the mutation transaction) | `services/entity/employerReviewActions.ts:760` |
| Audit type union | `AuditEventType` (TS-only; DB `type` is bare String) — reuse existing `EMPLOYER_REVIEW_*`, add via this union | `types/auditEventTypes.ts:61` |
| App→org ownership | `assertVerifierOwnsOpportunity(opportunityId, clerkUserId)` → Application→Opportunity.organizationId→Org | `services/opportunities/applicationService.ts:967` |
| Role gate | `decideEmployerActionRbac(user)` (VERIFIER/ADMIN, server-side `User` table) + `enforceEmployerMutationRbac` | `services/authz/employerActionRbac.ts:49`, `routes/employerActions.ts:194` |
| Truth gate | `gateProof(lanes)` blocks decision-grade with unchecked lanes; runtime accept refuses `passport.decisionPosture === 'BLOCKED'` (422) | `packages/trust-contract/src/gating.ts:81`, `routes/employerActions.ts:353` |
| Feature flag | env-based: `parseBooleanEnvVar` or tri-state `off\|shadow\|enforce` (`getRbacMode()` pattern). **No DB flag table.** | `config/env.ts`, `middleware/orgRoleGuard.ts:50` |
| Migrations | `prisma migrate dev` → additive SQL; prod `railway.toml` `preDeployCommand = prisma migrate deploy`; drift guard `check-migration-drift.mjs` **wired in CI** — a new table needs a real CREATE migration or the PR fails | `docs/DEPLOYMENT.md:103`, `scripts/check-migration-drift.mjs` |

> **Header middlewares (`requireOrgRole`, `verifiedIdentity`, `tenantGuard`) are mostly `off` in this checkout** and documented as not-yet-hard boundaries. The real employer authorization today is `decideEmployerActionRbac` + `assertVerifierOwnsOpportunity`. Build on those two. (Enforce rollout is tracked separately.)

---

## 5. The additive delta (design intent — implemented in ACT-1.1+)

The spine is **application-scoped** and reuses the FKs that already exist (`Application→Opportunity`, `ApplicationPacket→Application`):

1. **Link acceptance to the application.** Add nullable `applicationId`/`packetHash` to the acceptance write path (or a thin join row) so an `EmployerAcceptance` can be traced to the exact sealed packet it accepted. Additive — existing entityId/NPI writers keep working.
2. **`ActivationRequirement` (new table, FK `applicationId → Application.id`).** The missing middle: per-application requirement ledger with `{category, label, necessity, status, owner, dependencyIds, dueAt, policyVersion, resolvedBy, resolvedAt}` (shape per ACT-1.3). Instantiated only *after* an acceptance/decision. No such model exists today (`OpportunityRequirement` confirmed absent).
3. **Start-ready / started keyed on `applicationId`.** New audit types `START_READY`, `START_RECORDED`, `START_CANCELLED` written against the application, plus the qualified-start predicate (all required requirements `met|waived|not_applicable` + explicit authorized `start_ready`). Reconcile with the DID-keyed `Start` model rather than fork it (ACT-1.4).
4. **Real decision surface + activation case.** Drive `employer/decision/[applicationId]` from the real application (retire `MOCK_DECISION_ITEM`); replace `activation/demo-001` with an application-linked case (keep the demo behind a visible test-only guard).

All additive: new tables + nullable columns + new audit `type` values. No enum value is repurposed; `ACCEPTED`/`APPROVED` are **not** overloaded to mean credentialed (see ADR).

---

## 6. Collision boundaries (active lanes — do NOT edit)

Verified against open PRs / recent main at trace time:

| Avoid (other lanes) | Safe for ACT-1 |
|---|---|
| MATCHA deck + discovery + interested/passed (`components/matcha-deck/*`, `components/matcha/*`) — J-track | Employer decision/review routes + APIs |
| Homepage hero/motion/story (`HomePageClient`, `components/home/*`) — #741 just merged; VHS lane | Application-lifecycle extension + activation migration |
| Release-monitor / synthetic-clinician (`scripts/release-monitor/*`) | Activation case/requirement/start models + tests |
| Shared match ranking/scoring | Audit, authz, pilot metrics |

Any application-lifecycle edit that crosses the MATCHA apply handoff must stay **additive**, isolated in its own commit, and coordinated before merge.

---

## 7. No-code verification report (baseline commands)

Confirmed present on this branch; run before ACT-1.1 to establish green baseline:

```bash
pnpm run build:web                                              # canonical web build (typecheck + lint gate)
pnpm --filter @vitalcv/web exec vitest run <focused-home/employer tests>
pnpm --filter @vitalcv/web exec playwright test <employer + npi specs>
pnpm check:claims                                              # banned-claims scan
pnpm test:backend:db                                          # backend + DB (needs DATABASE_URL — name if skipped)
node apps/api/backend/scripts/check-migration-drift.mjs        # migration-chain guard (CI-enforced)
```

**Known baseline caveats:** `pnpm test:backend:db` needs a Postgres `DATABASE_URL`; report it skipped rather than green if absent. The migration-drift guard will fail any new activation table that lacks a real `CREATE TABLE` migration — ship the migration in the same PR.

---

## 8. ACT-1.0 acceptance — met

- ✅ One canonical application ID leads to all related packet, consent, employer-action, and audit records (traced §2, §3).
- ✅ Every mock/demo surface is labeled and gated: `employer/decision` (MOCK), `activation/demo-001` (DEMO-ONLY), `logApplicationTransition` (TEST-ONLY), `employer-action.ts` (DEAD/unmounted).
- ✅ Exact active-work collision boundaries named (§6), not guessed.
- ✅ No product code changed in ACT-1.0.
