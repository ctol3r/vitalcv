# ACT-1.0 — Employer Activation Control Tower: Current-State Map

**Bundle:** ACT-1.0 (recon, contracts, collision lock) — no product code.
**Prepared against:** `origin/main` @ `85dbc181d` (#743), 2026-07-18.
**Method:** direct source trace of the employer-activation loop in `apps/api/backend`, `apps/web/app/employer`, `apps/web/app/activation`, and `prisma/schema.prisma`. Every claim carries a `file:line` anchor. Read-only; nothing changed.

> **Headline finding.** The front half of the hiring loop is real (application create → sealed packet → opportunity-version freeze). The employer-facing second half is **fragmented across three unreconciled decision/acceptance paths**, the reviewer decision UI is an honest mock, and the activation console is an honest demo. `head_start_accepted`, application-linked requirements, and start/started events do not exist as a wired loop. Nothing in the current open-PR set owns the employer-decision/activation files, so ACT-1 has a clear lane.

---

## 1. Canonical application trace (one real application, end to end)

A submitted application is a real, durable row. You can hold one `applicationId` and reach its packet, consent receipt, and audit trail:

1. **Create** — `applyToOpportunity()` at `apps/api/backend/src/services/opportunities/applicationService.ts:317`, called from `POST /api/applications` (`routes/applications.ts:91`). Writes `tx.application.create` (`applicationService.ts:394`) and a **consent receipt** as an `auditEvent` (`applicationService.ts:211`), plus a submit audit (`:275`, `:430`).
2. **Application row** — `model Application` (`prisma/schema.prisma:1762`): `id`, `opportunityId`, `clerkUserId`, `npi?`, `coverNote?`, `status ApplicationStatus @default(PENDING)`, `artifacts Json`, `timeline Json`, `reviewedBy/At/Note`, **`sealedPacketVersion Int?`** (Wave-0 Seal; `NULL` = legacy, explicitly labeled), `packets ApplicationPacket[]`, `@@unique([opportunityId, clerkUserId])`.
3. **Sealed packet** — `model ApplicationPacket` (`schema.prisma:1796`): `packetVersion`, `clerkUserId`, and **frozen strings, not relations to mutable rows, so the packet replays without re-reading current state** (schema comment `:1793`). Sealed/read via `applicationPacketService.ts` + `applicationPacketReadService.ts` (read audits at `:258`). Opportunity version frozen onto the packet: migration `20260718000000_application_packet_opportunity_version` adds `opportunity_version TEXT`.
4. **Lifecycle** — `ApplicationStatus` is a Prisma enum (`schema.prisma:3475`) with **18 values**: `PENDING, REVIEWED, ACCEPTED, DECLINED, WITHDRAWN, DRAFT, SUBMITTED, VIEWED, IN_REVIEW, CREDENTIALING, COLLECTING_DOCS, VERIFICATION, WAITING_ON_SOURCE, READY_FOR_REVIEW, COMMITTEE_REVIEW, APPROVED, REJECTED, STARTED`. Transitions are audited by `applicationLifecycle.ts:15` (`auditEvent.create`).

**Trace verdict:** the "front half" is production-real and replayable. The application, its consent, and its sealed packet all exist as durable rows with audit events. This is the foundation ACT-1 converts — not replaces.

---

## 2. Route / data truth table

Kind legend: **live** (wired to canonical data + audit), **partial** (real but incomplete/one path stubbed), **mock** (honest foundation, hardcoded), **demo** (honest, gated to a demo slug), **dormant** (model/service defined, no live caller).

| Path / surface | Kind | Evidence |
|---|---|---|
| `POST /api/applications` → `applyToOpportunity` | **live** | `applicationService.ts:317,394`; consent receipt `:211` |
| Sealed `ApplicationPacket` write/read | **live** | `applicationPacketService.ts`, `applicationPacketReadService.ts:258`; frozen-string model `schema.prisma:1793` |
| Opportunity-version freeze | **live** | migration `20260718000000…`, `ADD COLUMN opportunity_version` |
| `POST /api/applications/:appId/workflow-action` (accept/request_info/reject) | **partial** | `routes/applications.ts:245`; handler `employerWorkflowService.ts:432` — see §3 path ①. Guarded `requireOrgRole(VERIFIER_MUTATION_ROLES)` `:174,:231`. |
| `POST /api/employer-review/:entityId/:action` → `recordEmployerReviewAcceptance` | **partial** | `services/entity/employerReviewActions.ts:839`; writes `EmployerAcceptance` + audit, but `artifactId=null` (see §3 path ②). |
| `omegaOrchestrator` decision service (writes activation sidecar) | **partial** | `services/decision/omegaOrchestrator.ts:129` `startActivation.create`; reads `:180,:246`; drift updates `driftEngine.ts:154`, `driftPropagation.ts:60` (see §3 path ③). |
| `apps/web/app/employer/decision/[applicationId]/page.tsx` | **mock** | `MOCK_DECISION_ITEM` (`:7`); copy "Decision recording is planned for the production workflow" (`:36`), "no persisted decision outcome in this shell" (`:45`). Renders `<DecisionPanel item={MOCK_DECISION_ITEM}/>`. |
| `apps/web/app/activation/[caseId]/page.tsx` | **demo** | `caseId !== 'demo-001' → notFound()` (`:45`); demo banner (`:66`); synthetic `demoCase()` from `lib/activation/activationData`; uses **old Tailwind tokens** (`emerald/amber/slate`), not Calm Wave. Payer note: "Real integrations are vendor-gated; the demo shows the tracking shape" (`:344`). |
| `apps/web/app/employer/{review,review-queue,worklist}` | **partial** | reviewer surfaces; drive from `lib/employer-review-actions.ts`, `lib/employer-workflow.ts`, `lib/server/employer-workspace.ts`. |
| `apps/web/app/employer/{dashboard,candidates,post,profile}` | **live/partial** | workspace surfaces (owner-scoped profile shipped earlier; not in ACT-1 critical path). |
| `model Recognition` / `Acceptance` / `Start` | **dormant** | `schema.prisma:120/140/160`; **zero live `.create/.update` callers** in `apps/api/backend/src` (grep clean). The canonical event-sourced R→A→S spine is defined but unwired. |
| `start_activations` table + `activation_state` | **partial** | migration `20260706000000_start_activation_sidecar`: cols `clinician_npi, org_id, acceptance_id?, role, activation_state DEFAULT 'NOT_STARTABLE', activated_at, metadata` + `chk_activation_state` constraint. Written **only** by `omegaOrchestrator` (path ③). |

---

## 3. The three unreconciled decision/acceptance paths (the core delta)

ACT-1 must converge these, not add a fourth.

**① `runEmployerWorkflowAction`** — `employerWorkflowService.ts:432`
- Actions: `request_info` (creates HITL task + `MissingRequest` + audit `REQUEST_INFO_EVENT` per request, sets status `REVIEWED`; `:444–511`) and `accept | reject` (`:526–564`).
- **Accept just flips `status='ACCEPTED'`** with review note *"Approved and moved to credentialing."* (`:529`), then `closeOpenMissingRequests`. **It writes no `EmployerAcceptance` row, no `start_activation`, no requirements, and — unlike `request_info` — no audit event.** This is the primary gap: "accept" produces a status flip, not an activation.
- Conflates accept with approval: the route maps `accept→'APPROVE'` decision (`routes/applications.ts:261`).

**② `recordEmployerReviewAcceptance`** — `services/entity/employerReviewActions.ts:839`
- The employer-review path (`/api/employer-review/:entityId/:action`). Writes an `EmployerAcceptance` row + `AuditEvent (EMPLOYER_REVIEW_ACCEPTED)` + a `DecisionTrustSnapshot` in the audit metadata. **But `artifactId` is null** — the acceptance is not linked to the sealed `ApplicationPacket` it accepted. File is `@ts-nocheck`.

**③ `omegaOrchestrator`** — `services/decision/omegaOrchestrator.ts:129`
- The only live writer of the `start_activations` sidecar (`startActivation.create`), with drift reconciliation (`driftEngine.ts:154`, `driftPropagation.ts:60`). Its trigger and relationship to ① and ② is **not** obvious from the call sites and must be traced in ACT-1.1 before extending.

**Reconciliation requirement (ACT-1.1/1.2):** one auditable accept action that (a) links to the sealed packet (`packetHash`/`sealedPacketVersion`), (b) writes an acceptance record with scope + versions, (c) writes audit-before-success, and (d) opens an activation case + only the remaining requirements — replacing the status-flip in ① and the null-`artifactId` gap in ②, and reconciling with the sidecar ③ already writes.

---

## 4. Data-model spine

| Model | Status | Notes |
|---|---|---|
| `Application` (`:1762`) | live | rich `ApplicationStatus` enum; `sealedPacketVersion` links to packet |
| `ApplicationPacket` (`:1796`) | live | versioned, frozen-string, replayable; carries `opportunity_version` |
| `EmployerAcceptance` (`:1837`) | partial | flat acceptance row; written by ②; `artifactId` null → not linked to packet |
| `Acceptance` / `Recognition` / `Start` (`:140/120/160`) | **dormant** | canonical event-sourced spine, **no live callers** — decide: wire these or extend `EmployerAcceptance` + `start_activations`. Do **not** fork a 4th model. |
| `start_activations` (sidecar) | partial | additive activation phase already exists; `acceptance_id` FK slot present; state defaults `NOT_STARTABLE`; only `omegaOrchestrator` writes it |

**Recommendation:** treat `start_activations` (+ `acceptance_id`) as the additive activation phase ACT-1.3/1.4 builds on (it already exists and is constraint-guarded), and reconcile the acceptance write onto one path that populates `EmployerAcceptance.artifactId` (or the dormant `Acceptance.psvReportId`) so the accepted **packet** is linkable. Backfill nothing into head-start/start states without a real historic event.

---

## 5. Audit & authorization canon

- **Audit:** `prisma.auditEvent.create({ type, hash: sha256ForPayload(...), referenceId, clinicianId, organizationId, metadata })` is the canonical shape (e.g. `employerWorkflowService.ts:491`, `applicationLifecycle.ts:15`, `applicationService.ts:211`). Event `type` constants are per-service (`REQUEST_INFO_EVENT`, `EMPLOYER_REVIEW_ACCEPTED`). **Audit-before-success holds for `request_info` and lifecycle transitions but NOT for `accept/reject` in path ①** — a gap ACT-1.2 must close.
- **Authorization:** `requireOrgRole(VERIFIER_MUTATION_ROLES)` middleware (`middleware/orgRoleGuard`) guards employer mutation routes (`routes/applications.ts:174,231`). Tenant/org scoping exists; ACT-1 must apply it to every new read/write and add cross-tenant tests.

---

## 6. Gaps vs the ACT-1 definition of done

| ACT-1 sub-bundle | Present today | Gap to close |
|---|---|---|
| 1.1 decision context from sealed packet | packet is real + replayable | decision UI is a mock (`MOCK_DECISION_ITEM`); wire it to canonical packet reads + not-found/wrong-tenant/stale states |
| 1.2 head-start acceptance + precise requests | `request_info` is real + audited | `accept` is an unaudited status-flip with no acceptance/packet link; add audited head-start acceptance (scope, packetHash, versions) distinct from `APPROVED`; reconcile paths ①②③ |
| 1.3 application-linked requirements | `start_activations` sidecar exists | no application-linked requirement model/records; instantiate remaining requirements after acceptance; two-persona views (no generic dashboard — Antigravity) |
| 1.4 start-ready / start / cancel events | `activation_state`, `activated_at` columns | no start-ready predicate, no `START_READY/RECORDED/CANCELLED` events; add them over durable events, never inferred |
| 1.5 time-to-start metrics | audit events carry timestamps | no event-derived metric layer; build a server-side pure/query layer + limited in-workflow operator view (not a vanity dashboard) |

---

## 7. Additive migration plan (no destructive changes)

1. **Link acceptance → packet:** populate `EmployerAcceptance.artifactId` (currently null) with the accepted `ApplicationPacket` id/hash at accept time (additive; read services tolerate legacy null rows).
2. **Activation phase:** reuse `start_activations` (+ `acceptance_id`, `activation_state`); extend the `chk_activation_state` constraint additively for the ACT-1.3/1.4 states (`head_start_accepted`→`requirements_in_progress`→`start_ready`→`started`/`cancelled`).
3. **Requirements:** additive `activation_requirements` table keyed by `application_id`/`activation_id` (category, status, owner, dependency, dueAt, policyVersion) — reuse `OpportunityRequirement` vocabulary if a live one exists; do **not** fork a separate credential checklist.
4. **Start events:** additive event rows (or typed `AuditEvent`s) for `START_READY/RECORDED/CANCELLED`; correction-by-supersession, never overwrite.
5. Gate all new write paths behind a pilot flag (`NEXT_PUBLIC_FEATURE_*` via `apps/web/lib/features.ts`, or a backend `FEATURE_*` in `config/envValidation.ts`).

Migrations are additive `.sql` under `apps/api/backend/prisma/migrations/<ts>_<name>/`; applied via Railway pre-deploy (per repo convention). Preserve historic applications/packets; read services must tolerate pre-activation rows.

---

## 8. Collision boundaries (open PRs, 2026-07-18)

| Active lane / PR | Owned files/globs | Overlaps ACT-1? |
|---|---|---|
| #741 `wave/homepage-pillrow` | `HomePageClient`, home motion/reader components/CSS | **No** — off-limits (homepage lane) |
| #636 `wave/profile-licensure-doximity` | profile licensure UI | No |
| #543 onboarding student lane; #465 ops-engine-live; #506 auth gate (DO NOT MERGE) | onboarding / ops-engine / `/api/me/role` | No direct overlap; #506 auth is adjacent |
| #410–#414 product-hardening series | verification/institutional semantics | Adjacent — coordinate if a shared trust contract is touched |
| dependabot (#744 npm group, #581 vitest, #580 jose, CI bumps) | deps/CI | No |

**No open PR owns `apps/web/app/employer/decision`, `apps/web/app/activation`, `employerWorkflowService.ts`, or the acceptance/start-activation services.** ACT-1 has a clear primary lane. Keep any shared application-lifecycle/trust-contract edit additive and in its own commit.

---

## 9. Test & CI commands (verified present)

```bash
pnpm run build:web                                   # canonical web build (do NOT substitute a bare filtered build)
pnpm --filter @vitalcv/web exec vitest run <focused> # web unit/contract
pnpm --filter @vitalcv/web exec playwright test <spec>
pnpm --filter chai-vc-platform-backend test          # backend jest (needs placeholder DATABASE_URL; NOT a merge gate per repo history)
pnpm typecheck ; pnpm lint ; pnpm check:claims
```

**CI gates on main** (`.github/workflows/`): `ci.yml` (web-e2e, web quality), `public-claims-gate`, `copy-compliance-gate`, `audit-coverage-gate`, `canonical-path-gate`, `a11y-gate`, `security-audit`, `backend-tests`, `deploy-{web,api}`, `deploy-health-probe`, `release-verify`, `openid-conformance`, `source-health-probe`. The backend-heavy ACT-1 work must keep `backend-tests` and `audit-coverage-gate` green.

---

## 10. Acceptance (ACT-1.0 exit criteria)

- ✅ **One canonical application ID reaches all related records** — `Application` (`:1762`) → `ApplicationPacket` (`:1796`) via `sealedPacketVersion` → consent/submit/lifecycle `auditEvent`s (`applicationService.ts:211/275/430`). Acceptance link is the known gap (`EmployerAcceptance.artifactId` null).
- ✅ **Every mock/demo surface is labeled and gated** — decision page = honest "shell" (`MOCK_DECISION_ITEM`); activation = `demo-001`-only with a demo banner and 404 for real ids.
- ✅ **Collision boundaries are named, not guessed** — §8; employer-decision/activation files are unowned by open PRs.

**Next:** ACT-1.1 — drive `employer/decision/[applicationId]` from the sealed packet (replace `MOCK_DECISION_ITEM`), reconciling paths ①②③ onto one audited, packet-linked accept. See the ADR alongside this doc for why head-start acceptance is not credentialing completion.
