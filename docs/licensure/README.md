# National U.S. Licensure Coverage Program

**Status as of 2026-08-01: no licensure route is live.** VitalCV cannot currently
read a licence record from any U.S. board, by any route. 70 authorities are
catalogued; zero are readable.

Do not describe this repository as having national state-board coverage.

- Catalog and runtime truth: [`packages/licensure`](../../packages/licensure)
- Generated matrix: [`national-coverage-matrix.md`](./national-coverage-matrix.md)
- Access diligence (unblocks everything else): [`L1-access-diligence.md`](./L1-access-diligence.md)

---

## What exists

| Component | Module | State |
| --- | --- | --- |
| LicensureAuthorityRegistry | `src/authorityRegistry.ts` | 69 physician/osteopathic boards across 55 jurisdictions + 1 national nursing route |
| LicensureSourceRouter | `src/sourceRouter.ts` | Declares the priority chain; `resolveOperationalChain` returns empty |
| FsmbPdcAdapter | `src/adapters/fsmbPdcAdapter.ts` | Fails closed — no agreement, no credentials, no response mapping |
| NursysAdapter | `src/adapters/nursysAdapter.ts` | Fails closed — same |
| StateBoardAdapterContract | `src/adapters/adapterContract.ts` | Contract only; zero implementations |
| LicensureRuntimeState | `src/runtimeState.ts` | Every route `BLOCKED_ON_ACCESS` or `NOT_IMPLEMENTED` |
| LicenseEvidenceProjection | `src/evidenceProjection.ts` | Built; nothing to project yet |
| LicensureMonitoringJob | `src/monitoringJob.ts` | Built; `plan()` returns empty |
| LicensureConflictReview | `src/conflictReview.ts` | Built |
| PublicLicensureCoverageProjection | `src/publicCoverageProjection.ts` | Built and wired into the wallet + status lane |

### The registry is sourced, not remembered

Every physician board row was transcribed from the FSMB "Contact a State Medical
Board" directory, retrieved 2026-08-01 from
<https://production.fsmb.org/contact-a-state-medical-board/>. Rows carry their
provenance. New rows must cite a retrieval the same way.

### Deliberate inventory gaps

These are recorded rather than filled in, because a guessed row reads exactly
like a sourced one:

- **Physician assistants** — PA licensure authority per jurisdiction is not
  inventoried. The FSMB directory does not publish PA scope per board. Absence
  of `PHYSICIAN_ASSISTANT` from a board's `professions` means *not established*,
  never *not licensed here*.
- **Boards of nursing** — the ~59 individual BONs are not inventoried. Nursing
  routes through the single national Nursys entry.
- **American Samoa** — no FSMB member medical board. Whether an applicable
  licensure authority exists is unestablished. Tracked in
  `UNINVENTORIED_TARGET_JURISDICTIONS` rather than silently omitted.
- **Public search URLs** — not recorded for any board. Identifying a lawful,
  machine-accessible search surface is per-board diligence (L5).

---

## Wave status

| Wave | Scope | State |
| --- | --- | --- |
| L0 | National board inventory + data contracts | **Done** |
| L1 | FSMB commercial / access diligence | **Blocked — needs Chris.** See [L1-access-diligence.md](./L1-access-diligence.md) |
| L2 | FSMB production adapter | Blocked on L1 |
| L3 | Nursys access + production adapter | Blocked on L1 |
| L4 | Direct-board adapter framework | **Contract done**; implementations blocked on per-board terms review |
| L5 | Priority direct-board connectors | Blocked on L4 + per-board terms |
| L6 | Runtime coverage registry | **Done** |
| L7 | Wallet licensure projection | **Done** |
| L8 | Monitoring + delta events | Contract done; inert until a route is live |
| L9 | Remaining clinician professions | Not started |
| L10 | Production convergence + public coverage receipt | Public projection done; convergence blocked on L2/L3 |

---

## Active HARD STOPs

The program's own stop conditions currently hold for **every** route:

- Terms / permitted use unresolved — no board or network has had a terms review.
- Credentials unavailable — no FSMB or NCSBN production credentials exist.
- Production has not completed a successful source run — `lastProductionSuccessAt`
  is `null` everywhere.

Two further stops apply per-board and are unassessed: whether the board blocks
automated access, and whether CAPTCHA prevents reliable lawful access.

---

## Activation rule

A route goes live only when `isLive()` in `src/types.ts` passes, which requires
**all** of: permitted access, production credentials, a fresh successful
production run, schema validation, fail-closed tests, provenance persistence and
health monitoring.

Do not add an override flag, an env-var bypass, or an early return to that
function. Flipping a route on means changing the facts, not the label.

After any registry or runtime-state change, regenerate the matrix:

```bash
node packages/licensure/tools/generateCoverageMatrix.js
```

---

## Public copy rules

Enforced by `src/__tests__/truthRules.test.ts`:

- Never *"All state boards verified."*
- Never a nationwide-coverage claim while `countLiveRoutes()` is 0.
- Never the bare word *"Verified"* as a status label.
- Prefer counting boards: *"Licensure records returned from 3 boards."*
- Scope-aware lane labels: *"Physician licensure — national source access
  pending"*, becoming *"Physician licensure — nationwide FSMB coverage"* only
  once national routes are genuinely live.
