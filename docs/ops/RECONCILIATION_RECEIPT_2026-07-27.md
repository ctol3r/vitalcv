> **SUPERSEDED 2026-07-28T00:39Z.** This document is retained for history only.
> The single canonical receipt is [CANONICAL_RECEIPT_2026-07-28.md](CANONICAL_RECEIPT_2026-07-28.md).
> One correction carried forward: this document flagged PR #943 as the risky
> "parallel path" candidate. That was wrong — #943 targets the actually-serving
> modules. See §2 of the canonical receipt.

# Production reconciliation receipt — 2026-07-27

**Status: ACTIVE INCIDENT. This is not a completed cleanup.**

Compiled read-only under change freeze. No production write, merge, deploy, or
deletion was performed while producing this document. Every check below was run
live against production between **21:26Z and 21:35Z on 2026-07-27**.

**Headline:** a public, unauthenticated production API still serves a fabricated
clinician identity ("Chen Sarah") bound to a real physician's NPI, and a second
public endpoint publishes a fabricated practice state and specialty for all ten
real registrants. Neither is cache staleness — both are wrong at rest in Postgres.

---

## 1. Deployed state

| Surface | Value | Source |
| --- | --- | --- |
| Web SHA | `924609bc4b8e73118c0eec6c012b226306badc67` | `GET https://vitalcv.com/api/version` |
| API SHA | `924609bc4b8e73118c0eec6c012b226306badc67` | `GET https://api.vitalcv.com/health` |
| Branch / env | `main` / `production` / `railway` | both |
| Deployment ID | `2fdbb01d-c212-429d-aa78-a8c26e5aa291` | web |
| Node (container) | `v22.11.0` | API `/health` |
| Health checked at | `2026-07-27T21:26:49.679Z` — web ok, backend ok, Clerk production enabled, Sentry false | `GET /api/health` |
| Drift | **None.** Both services equal the `origin/main` tip (`924609bc4`, #941, merged 21:14Z). | `git merge-base` |
| `builtAt` | `null` — the build-time field is still unpopulated, so deploy age is not self-reported | web `/api/version` |

### Cache state — three different regimes, and only one of them is a TTL

| Path | Cache behaviour | Consequence |
| --- | --- | --- |
| `/api/providers` | `etag` only. **No `Cache-Control`, no CDN age.** Two consecutive calls byte-identical. | Served fresh from Postgres per request. **There is no TTL to wait out** — the data is wrong at rest. |
| `/api/graph/investigation`, `/api/graph/global` | Snapshot-backed: payload `generatedAt: 2026-03-18T10:33:01.384Z`, `cacheStatus: "hit"` | Reads come off a March build run, but the underlying `graph_nodes` row is `active = true`. **A cache flush alone will not remove the fabrication, and a row delete alone will not clear the snapshot.** Both are required. |
| `/verify/:npi` | Stored passport snapshots that do **not** re-derive on read | Already-computed records keep serving old labels after a fix deploys. Confirmed: `/verify/1003000126` still shows a snapshot computed 20:59:04Z, pre-#941. |

---

## 2. Production mutations performed today

### 2a. What is provable from production

| Table | Post-state (verified 21:28–21:33Z) | Inference |
| --- | --- | --- |
| `Provider` | 10 rows, all with `updatedAt = 2026-07-27 19:28:11.879` — **identical to the millisecond** | A single bulk `UPDATE` at **19:28:11.879Z**. `createdAt` remains `2026-03-17` (original seed). |
| `Provider.fullName` | Now the real NPPES registrant names | Corrected by that update. |
| `Provider.stateOfPractice` / `taxonomyCode` / `providerType` | **Not corrected** — see §3 | The update was partial. |
| `User` | 0 rows `clerkUserId LIKE 'seed_user_%'`; 0 rows `email LIKE '%@vitalcv.local'`; 6 total, all legitimate (`ct@sourcd.xyz`, 2 QA, 3 `svc-monitor`) | Seed accounts were **deleted**, not disabled. |
| `person_profiles` | 1 row total; **0 rows with `npi IS NULL`** | Seeded profiles are **gone** (cascade from `User`), not unbound. |
| `trust_score_history` | 0 rows at `methodology_version = '243.1'` | Seed scores already removed. |
| `graph_nodes` (institution, seed-era) | 0 | Already removed. |
| `graph_nodes` (clinician, seed) | **1 surviving** — see §3 | Not removed. |
| `claim_records` for the ten | 2,226 remain (genuine source history) | Script notes 42 fabricated rows were deleted. |
| `vcv_entities` | 10 — genuine NPPES registry identities | Deliberately retained per the script's design. |

### 2b. What cannot be established — and this is the material gap

| Required field | Finding |
| --- | --- |
| **Actor / session** | **No record.** The only `AuditEvent` today is `NPI_INGESTED` for `1234567893` at `04:28:58.529Z` — unrelated. There is **no audit row for the `Provider` update, the `User` deletion, or the `claim_records` deletion.** |
| **Transaction timestamps** | Only the `Provider` update is timestamped (`19:28:11.879Z`). Deletions leave no row behind, so their time is unrecoverable from the database. |
| **Before/after counts** | **No pre-mutation snapshot exists.** Only post-state is observable. Before-counts in this document are reconstructed from the script's assertions, not measured. |
| **Backup manifest path / hash** | **None found.** No backup artifact on disk, in the repo, or in the scratchpad. |
| **Rollback procedure** | **None exists for the deletions.** Railway Postgres PITR is the only restore path. |

**Discrepancy worth flagging.** `remove-seeded-demo-providers.ts` (branch
`claude/defab-dead-components`, `7e6bc69fd`) documents the partial production fix as
having *"NULLed `person_profiles.npi`"*. Production shows **zero** `person_profiles`
rows with a NULL npi and **zero** seed users — consistent with deletion, not
unbinding. The script's own baseline description does not match production. Any
plan derived from that description should be re-derived from measured state.

**The mutation was not made by that script.** The script explicitly disclaims
touching `Provider` or `claim_records`, stating a partial fix "already landed in
production from another session." Its documented safety rail (dry-run default,
`CONFIRM_DELETE_SEEDED_PROVIDERS` + `OPERATOR`, verified backup + SHA-256 manifest,
single transaction, durable operator receipt) **was therefore not exercised.**

---

## 3. Live post-TTL checks — ten NPIs × five surfaces

All ten NPIs are real NPPES registrants. Cross-checked live against
`npiregistry.cms.hhs.gov` at 21:29Z.

### 3a. Identity bootstrap — **PASS (10/10)**

`GET /api/identity/bootstrap/:npi` at 21:27:41Z. All ten return
`identitySource: NPPES_API`, `alreadyRegistered: false`, and the true registrant.
The two NPI-2 organizations correctly return no personal name. **#937 holds.**

### 3b. Provider search / listing — **FAIL (10/10)**

`GET https://api.vitalcv.com/api/providers` — **HTTP 200 unauthenticated**
(explicitly public in `tenantGuard.ts:25,94`).

| NPI | NPPES truth | VitalCV publishes |
| --- | --- | --- |
| 1003000126 | ARDALAN ENKESHAFI · Hospitalist · **MD** | Internal Medicine · **CA** |
| 1003000134 | THOMAS CIBULL · Pathology · **IL** | `207R00000X` · **TX** |
| 1003000142 | RASHID KHALIL · Anesthesiology · **OH** | `207R00000X` · **NY** |
| 1003000159 | MARSHA VOGES · NP Family · **SC** | `207R00000X` · **IL** |
| 1003000167 | JULIO ESCOBAR · Dentist · **NV** | `207R00000X` · **MA** |
| 1003000175 | BELINDA REYES-VASQUEZ · Dentist · **CA** | `207R00000X` · **FL** |
| 1003000183 | DENNIS CYPHERS · Massage Therapist · **WA** | `207R00000X` · WA |
| 1003000191 | ALYSSA WELTMAN · Speech-Language Path. · **NC** | `207R00000X` · **GA** |
| 1003000209 | KOPELMAN FAMILY CHIROPRACTIC INC · **NPI-2** | `207R00000X` · **AZ** · type **"Individual"** |
| 1003000217 | TRI-STATE EYE CARE CENTER, LTD. · **NPI-2** | `207R00000X` · **CO** · type **"Individual"** |

Three defects, all on real identifiable parties:
1. **Practice state wrong for 9 of 10** (1003000183 matches by coincidence).
2. **Taxonomy `207R00000X` (Internal Medicine) applied to all ten** — publishing a
   dentist, a massage therapist, a speech-language pathologist, a chiropractic
   corporation and an optometry practice as internal medicine.
3. **Two organizations published as `"Individual"`.**

Serving source: `Provider` table → `apps/api/backend/src/routes/providers.ts:100-101`
(`prisma.provider.count` / `findMany`). No auth guard, no cache.

### 3c. Graph investigation — **FAIL (10/10)**

`GET https://api.vitalcv.com/api/graph/investigation?npi=<npi>` — **HTTP 200
unauthenticated**. At 21:34:37Z, **every one of the ten queries** returns a
40-node payload containing:

```
"label": "Chen Sarah", "type": "clinician",
"metadata": { "npi": "1003000126", "state": "CA", "specialty": "Internal Medicine" }
```

NPI 1003000126 is **ARDALAN ENKESHAFI, a Hospitalist in Maryland.**

Serving source traced: `graph_nodes` row **`gn_43c8f018b35a938f7e5f1d4c`**,
`active = true`, created 2026-03-18. It is the **only** surviving fabricated-name
node — a scan of `graph_nodes` for all ten seed names
(Sarah Chen, Michael Rivera, Emily Nakamura, James Okonkwo, Priya Sharma,
David Kim, Alexandra Petrov, Robert Washington, Maria Gonzalez, Thomas Anderson,
in both orderings) returns exactly one row.

**The endpoint ignores its `npi` parameter** — all ten NPIs return the identical
global payload. So the fabricated node is served on *every* investigation query,
not only on 1003000126's.

A second endpoint, `GET /api/providers/:npi/investigation`, returns **HTTP 500 and
leaks a raw Prisma error** exposing schema internals
(`prisma.residencyProgram.findMany()`, column names) — a snake_case/camelCase
schema drift plus an information disclosure.

### 3d. `/verify/:npi` — **FAIL (10/10)**

At 21:34:45Z every one of the ten renders `SOURCE-BACKED` tiers (3–9 occurrences
each). The control confirms the defect class is unfixed:

`/verify/1234567893` (NPI that does not exist; NPPES `result_count: 0`) renders
**6 × SOURCE-BACKED**, while VitalCV's own API is honest — `/api/trust-state/1234567893`
returns `identityVerified: false` and `NPPES_API` `reason: "NPPES checked but did
not return an active identity record"`. The surface keeps the `checked` state and
**drops the reason**. This is board item 3, still live, on a snapshot freshly
computed at request time.

`/verify/1003000126` additionally shows:
- **"Internal Medicine" × 22** against a Hospitalist (the §3b fabrication, resurfaced),
- **`GATED_NURSYS_CONFIG_REQUIRED` × 3** — a raw internal token rendered in the
  employer-facing Source column,
- **STALE × 4** from a snapshot computed 20:59:04Z, before #941 deployed at 21:14Z.

### 3e. Signed-in wallet fallback — **NOT SAFELY TESTABLE**

#940 (`3ba65d057`, "stop substituting fabricated credentials on a clinician's own
wallet") is confirmed an ancestor of the deployed SHA, so the fix is live.
Exercising the authenticated path requires a real clinician session; I did not
authenticate. **Unverified in production.** Note the standing CI caveat: the
"Web E2E (real auth)" check passes in ~20s while running zero specs
(`E2E_CLERK_* secrets not configured`), so it is not evidence here either.

---

## 4. Remaining fabricated data and routes

### Actively served (public, unauthenticated, live now)

| Item | Location | Blast radius |
| --- | --- | --- |
| Fabricated identity "Chen Sarah" on a real NPI | `graph_nodes.gn_43c8f018b35a938f7e5f1d4c` → `/api/graph/investigation`, `/api/graph/global` | 1 row; served on **every** investigation query |
| Fabricated state + taxonomy + entity type | `Provider` (10 rows) → `GET /api/providers` | 10 real registrants incl. 2 organizations |
| Fabricated specialty on the verify surface | `Provider` → `/verify/1003000126` | 1 clinician |
| `SOURCE-BACKED` for unaffirmed lanes | `npiPassportContract.ts` NPPES ~`:468-470`, PECOS ~`:524-532` | Every `/verify` page |
| Raw `GATED_NURSYS_CONFIG_REQUIRED` token in employer-facing Source column | `/verify` | Employer-visible |
| Prisma error + schema disclosure | `GET /api/providers/:npi/investigation` → 500 | Any caller |

### Corrected but cache-stale

- `/verify` passport snapshots computed before #941 (20:59:04Z) still render `STALE`
  for the State License lane. Snapshots do not re-derive on read; a **recompute**,
  not a deploy, is required.
- Graph payloads carry `generatedAt: 2026-03-18` from a cached build run.

### Pending deletion (identified, not yet removed)

- `graph_nodes.gn_43c8f018b35a938f7e5f1d4c` (the one fabricated node).
- `Provider` field corrections for the ten (correction, not deletion — the rows now
  hold real names and must not be dropped).

### Inaccessible / dead code (no production exposure)

- Demo-identity component cluster and orphaned files — removed across
  `c1cf8c1d9`, `c2cd239f0`, `ea9326f87`; PR **#942** carries the remainder.
- Payer Credential Network surface — removed in `60f4d7edf` / `63bf28211`
  (invented ratings of real insurers).
- `seed-provider-intelligence.ts` — now carries a tripwire (#937) refusing
  non-local `DATABASE_URL`.

### Already clean (verified, no action)

`trust_score_history` v243.1 = 0 · seed-era institution nodes = 0 · seed `User` = 0 ·
seed `person_profiles` = 0 · `npi_ownership` / `npi_did_binding` / `ShareLink` /
`DecisionCapsule` / `EmployerAcceptance` / `Application` for the ten = 0.

---

## 5. Open branches and PRs touching truth or identity

| Branch / PR | Covers | Overlap / conflict |
| --- | --- | --- |
| `claude/dazzling-shannon-544057` (`c8e1368a2`) — "a settled negative must not read as still checking" | **Board item 3.** Touches `trustCore.ts`, `trustStateEngine.ts`, `passportService.ts`, `employerPacket.ts` + 6 test files | **No PR opened.** Edits `passportService.ts`; the board's corrected analysis names **`npiPassportContract.ts`** as the live `/verify` contract. **Confirm which path actually serves before merging** — this may fix a parallel path and leave production unchanged. |
| `claude/defab-dead-components` (`7e6bc69fd`) — "stop a live unauthenticated route publishing fabricated claims on a real NPI" | The §3b/§3c incident + `remove-seeded-demo-providers.ts` | **Overlaps `claude/priceless-sammet-a0c094` and `claude/nervous-booth-68dd89`** — all three carry a different revision of the same script. Its stated baseline (`person_profiles.npi` NULLed, 114 residual rows) **does not match measured production** (rows deleted; 1 residual node). Re-baseline before any run. |
| **PR #942** `claude/defab-code-and-docs` — MERGEABLE | Fabricated identities in dead components + stale docs | Docs/dead-code only. Subset of `defab-dead-components`. |
| `claude/mystifying-grothendieck-7e5a67` (`63bf28211`) | Invented payer ratings of real insurers | Also edits `globalGraph.ts` — **same file the graph fabrication is served through.** Sequence against the graph fix. |
| `claude/priceless-sammet-a0c094` (`ea9326f87`) | Demo-cluster cascade | Script overlap above. |
| `claude/nervous-booth-68dd89` (`d1ead653d`) | Script re-baseline + demo docs | Script overlap above. |
| `yc/demo-runbook-2026-07-27` (`d88a301a4`) | Remediation board + runbook | Local, unpushed. Its item-3 status is confirmed still accurate. |
| `claude/interesting-brattain-9bfe64` (`22b202b9a`) | Earlier revision of the item-3 fix | Superseded by `dazzling-shannon`. |

**Three revisions of `remove-seeded-demo-providers.ts` exist on three branches, none
merged, all built on a baseline that production contradicts.** That is the single
largest conflict risk in the current tree.

**Merge-discipline note (carried forward):** six commits landed on `main` today
after `b99127e3`; only #937 and #940 were remediation. #935/#936/#938/#939 —
copy and visual work explicitly on the hold list — shipped alongside the
correctness fixes rather than after them.

---

## 6. Ordered remediation plan

No implementation has begun. Each production step below requires specific written
approval naming the exact script and scope.

**P0 — contain the active incident (in this order)**

1. **Withdraw the fabricated identity from serving.** Single row
   `graph_nodes.gn_43c8f018b35a938f7e5f1d4c`. Setting `active = false` is
   reversible and preferable to deletion; a delete needs the `graph_edges` cascade
   enumerated first. **Must be paired with graph snapshot invalidation** — the
   payload is served from a cached March build run, so the row change alone will
   not clear it. Re-check `/api/graph/investigation` after.
2. **Stop `/api/providers` publishing false attributes.** Either correct
   `stateOfPractice` / `taxonomyCode` / `providerType` from NPPES for the ten, or
   suppress those fields until they can be sourced. Consider whether an
   unauthenticated public listing of provider attributes should exist at all.
3. **Re-baseline before any script run.** Measure production directly; do not
   trust the script's `SUPERSEDED SCOPE` block. Take a verified backup with a
   SHA-256 manifest first — the previous mutation has neither.

**P1 — close the truth gap on `/verify`**

4. Resolve which module serves `/verify` in production (`npiPassportContract.ts`
   vs `passportService.ts`), then land the item-3 fix on the path that actually
   serves. Apply the OIG lane's shape: affirmation ≠ non-answer. Surface the
   existing `reason` string.
5. **Recompute stored passport snapshots** after deploy. A deploy alone does not
   correct already-computed records.

**P2 — governance debt created today**

6. Audit-trail gap: production data surgery left no `AuditEvent`. Decide whether
   direct DB mutation must write an audit row, and enforce it.
7. No backup exists for today's deletions. Confirm Railway PITR covers the window
   and record the recovery point.

**P3 — correctness tail**

8. `GET /api/providers/:npi/investigation` — fix the schema drift and stop
   returning raw Prisma errors.
9. `/api/graph/investigation` ignores its `npi` parameter.
10. Replace the raw `GATED_NURSYS_CONFIG_REQUIRED` token with a source name.
11. Add rate limiting to `/api/identity/bootstrap/:npi` (unauthenticated, now the
    primary public read path; every cache miss hits NPPES).

**P4 — decisions owed**

12. Whether the ten registrants are notified, and by whom. Two are organizations.
13. Consolidate the three `remove-seeded-demo-providers.ts` revisions to one.
14. **The demo hold stays in force.** Items 2, 3 and the §3b/§3c findings are all
    open; no NPI demo is recorded or recommended.

---

*Checks run 21:26Z–21:35Z against SHA `924609bc4`. Read-only throughout.*

---

## 7. Addendum — Wave P0.3 demo-NPI containment (#945)

Appended 2026-07-28T00:40Z. Later than the checks above and **not** read-only:
this section records a merge and a production deploy. Scope is code containment
only — no production row was created, modified or deleted.

### Deployed state

| Surface | Value | Source |
| --- | --- | --- |
| Merge commit | `3d8262ce883cfa28b02f021214a041735b88c3f1` (#945, squash) | `gh pr view 945` |
| API SHA | `3d8262ce883cfa28b02f021214a041735b88c3f1` | `GET https://api.vitalcv.com/demo/status` → `git_sha` |
| Branch / env | `main` / `production` | same response |
| Merged at | `2026-07-28T00:30:59Z` | `gh pr view 945 --json mergedAt` |
| Verified at | `2026-07-28T00:39Z` | probes below |
| CI | 15/15 pass, incl. Backend Tests (Postgres) | `gh pr checks 945` |

The deployed SHA was read from the service, not inferred from merge timing.

### Endpoint evidence — before vs after

| Probe | Before (`fab96fc41`) | After (`3d8262ce8`) |
| --- | --- | --- |
| `GET /demo/sample-npis` | `{"samples":[{"npi":"1003000126",…}]}`, HTTP 200, unauthenticated | `{"samples":[]}`, HTTP 200 |
| `GET /api/providers/health` | six connectors queried `1003000126` against NPPES, state boards, OIG, ABMS, CAQH, NPDB on every call | `"sampleNpi":"1558395516"` × 6 |
| Real NPI in either response | present | `0` occurrences |

`/api/providers/health` was **deliberately not probed before the deploy**: each
call is itself the harm — it makes production query six external registries about
a real physician. It was probed only once the substitute was live, at which point
it exercises a number that cannot be issued to anyone.

### Substitute value

`1558395516` — fails the NPI check digit (Luhn over `"80840"` + the first 9
digits), so it can never be issued; final digit `6` preserved because the sandbox
connectors branch on it. `0000000000` was avoided: it is a reserved "entity
without an NPI" sentinel in `leieCache`.

### Explicitly out of scope

- **No production rows touched.** Seed `alertId`s were left unchanged precisely
  because `seedDefaults` inserts only `if (!existing)` keyed on `alertId` —
  renaming one is what would have made this deploy write a row.
- `GET /api/alerts` returns **401 `organization_context_required`**. That bounds
  the fabricated alert rows to authorized users; it does **not** establish that
  they are absent or harmless. Their removal remains a separate, explicitly
  approved data-reconciliation operation, scoped by exact seed id and never by
  NPI — real source-freshness alerts reference the same NPI legitimately.

### Follow-up opened

**#946 (P1)** — `protocolSpec` conformance cases now pair the unissuable NPI with
success-shaped expectations (`requiredStatusCodes: [200, 201]`, required `name` /
`readiness_score` / `artifactsCreated`). A correct implementation must answer
not-found for a check-digit-invalid NPI, so those cases now fail a conforming
server and pass only one that fabricates a record. `CONFORMANCE_TESTS` is served
publicly from `routes/protocol.ts` and executed by `conformanceRunner` against
arbitrary targets, so the wrong expectation ships to third parties. To be fixed
on its own, not folded into another patch.

*Merge and deploy performed 00:30Z–00:39Z. Production reads read-only; the only
write was the deploy itself.*

---

## 8. Deployment-integrity investigation — #941 and `/verify`

Checks run 2026-07-28T00:42Z–00:52Z against SHA `3d8262ce8`. Read-only.

### 8a. Board item 4 — **RESOLVED**: `npiPassportContract.ts` serves `/verify`

The receipt asked which of `npiPassportContract.ts` or `passportService.ts` serves
`/verify`. Traced end to end:

`app/verify/[npi]/page.tsx` → `GET {BACKEND}/api/passport/npi/:npi`
→ `routes/passportEntity.ts` (registered at `app.ts:150`)
→ `buildPassportDataByNpi` → **`npiPassportContract.ts`**

`passportService.ts::buildPassport` serves `/api/passport/entity/:id` (UUID-keyed)
— a different route. The either/or is settled: #941 landed on the serving module.

Both services confirmed on the same SHA, so this is not cross-service drift:

| Service | SHA | Source |
| --- | --- | --- |
| API | `3d8262ce883cfa28b02f021214a041735b88c3f1` | `GET api.vitalcv.com/health` |
| Web | `3d8262ce883cfa28b02f021214a041735b88c3f1` | `GET vitalcv.com/api/version` |

`924609bc4` (#941) is a confirmed ancestor of both.

### 8b. #941's rendered symptom — **FIXED**

`/verify/1234567893` (never-registered control) renders **0** occurrences of
`Stale`/`STALE`. The reported defect — a never-checked board reading as Stale —
does not reproduce on the page.

### 8c. **OPEN — the lane still emits the pre-fix contract**

`GET /api/passport/npi/:npi` in production returns, for `STATE_BOARD`:

| Case | state | checkedAt | reason |
| --- | --- | --- | --- |
| No licence row (`1234567893`) | `pending` | `null` | `Licensure source not yet checked` |
| Licence row (`1003000126`) | **`stale`** | **`2026-04-03T09:35:11.800Z`** | — |

The deployed code cannot produce this. With `liveAvailable: false` and
`STATE_BOARD_ENABLED` unset, `stateBoardLive` is false and the lane must emit
`state: 'gated'`, `checkedAt: null`, and the reason *"State board verification
requires access VitalCV does not have yet…"*. Both rows above match the
`stateBoardLive === true` branch — the pre-#941 path.

Ruled out: CDN/edge cache (no `age`/`cf-cache-status`; a cache-busted request
returns byte-identical lane data); cross-service drift (§8a); a later revert
(`origin/main` still carries the fix at `npiPassportContract.ts:512`); a duplicate
lane (one `buildSourceCoverage`, one `STATE_BOARD` entry); `gated` not being
canonical (it is, `packages/trust-state/sourceCoverage.ts`); env (API service has
only `NPPES_API_ENABLED`, `OIG_LEIE_ENABLED`, `PECOS_ENABLED`).

**Cause not established.** The `reason` string is decisive — it is passed through
untransformed, so the short string proves the `stateBoardLive === true` branch ran.
Next step: add a build/version marker to the passport payload, or log
`stateBoardLive` + `process.env.STATE_BOARD_ENABLED` at lane construction, and
re-probe. Do not close #941 until this reconciles.

**Consequence:** for any clinician who has a licence row, `/verify` still reports
the state board as `stale` against a timestamp taken from a self-reported NPPES
licence number. That is the precise false statement #941 set out to remove.

### 8d. **OPEN — the same pre-fix lane logic exists in five other modules**

`'Licensure source not yet checked'` with the `license ? checked : pending` shape
also appears in:

- `services/entity/passportService.ts` (×2)
- `services/trust/trustStateEngine.ts` (×2)
- `services/verticals/readiness/readinessEngine.ts`
- `apps/web/lib/trust/passport-truth-set.ts`

#941 fixed one of six. Any surface reading through the others still collapses
never-checked into checked-then-aged.

### 8e. **OPEN — board item 3 confirmed still live**

`/verify/1234567893` renders **SOURCE-BACKED × 4** for an NPI with no NPPES
record, adjacent to the very query URLs that returned nothing
(`…/api/?number=1234567893&version=2.1`). The API is honest — it returns
`"NPPES checked but did not return an active identity record"` — and the surface
renders that reason **0 times**. The surface still drops the backend's reason.

### 8f. The drift gate is not runnable

`pnpm check:deploy` is not a defined script; `scripts/deployment-integrity-check.ts`
and `apps/web/lib/platform/deployment-integrity.ts` are untracked local files, and
`tsx` is not installed. There is currently **no executable deployment-integrity
gate**, so §8c could not have been caught automatically.

### Verdict

**`/verify` is not yet trustworthy.** #941 removed the rendered "Stale" label, but
the underlying lane contract is still pre-fix for licence-row clinicians (§8c),
five sibling implementations are untouched (§8d), and the SOURCE-BACKED /
dropped-reason defects remain (§8e).

*Read-only throughout.*
