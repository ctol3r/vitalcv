# D4 — Status memory: measured availability + incident feed

**Status:** PROPOSED — needs two founder decisions (§5) before any code.
**Wave:** 1514 task D4 (waves 1509–1516). Effort L. Deliberately not started
without this design: every earlier attempt to bolt "uptime" onto this product
produced a fabricated number (see §1).
**Author's note on scope:** this doc decides *where truth lives*. It does not
redesign `/status`'s layout.

---

## 1. Problem

`/status` currently checks only at page load and says, honestly:

> "does not publish uptime figures it has not measured" — `app/status/page.tsx:93`
> "No public incident feed is published yet." — `app/status/page.tsx:154`

Honest, but empty — the page has no memory. Meanwhile the platform *does*
probe itself continuously and then throws the results away:

- `deploy-health-probe.yml` runs after every deploy (green since `71914857a`).
- `source-health-probe.yml` POSTs `/api/internal/source-health/probe` on a
  `*/15` cron (GitHub-throttled to ~2–4 h in practice — measured, not nominal).
- Probe results land in `lib/source-health/store/snapshotStore.ts`, an
  **in-memory Map** that self-documents "Ephemeral: serverless cold starts will
  reset this." Every deploy erases the platform's knowledge of its own health.

Two incidents this wave trace directly to the missing memory:

1. The retired `/metrics/public` endpoint fabricated `uptime: "99.99%"` plus
   two wall-clock counters (removed in #815 after a production audit found the
   site publicly claiming 1,083,386 verifications it never performed).
2. A night of ten merges produced a wall of red deploy-probe runs because the
   probe was reading store *warmth*, not source *health* (#832 + `71914857a`).
   A durable ledger makes that class of false signal structurally impossible.

## 2. Constraints (each one grounded)

| # | Constraint | Ground |
|---|---|---|
| C1 | No fabricated or extrapolated numbers; a figure renders only when measured. | Truth doctrine; `/status` copy; the #815 incident. |
| C2 | Schema changes are founder-gated: migration files ride a PR with a founder note; Railway `preDeployCommand` applies them on deploy, so **merging the PR is the founder act**. | CLAUDE.md ground rules (doctrine Rule 4); `enterprise_100_task_map` (auto-apply). |
| C3 | The runtime image ships only `.next`, `public`, `prisma`, `lib/generated` — **`docs/` does not exist in production**. `/status` cannot read `docs/ops/incidents/*.md` at request time. | `apps/web/Dockerfile:62-66`. |
| C4 | No paid services or per-lookup costs. External status vendors are out. | `cost_policy_no_paid_data_sources` (2026-07-13). |
| C5 | The migration chain must rebuild a database from scratch. | `migration_drift_landmine` (#699 guard). |
| C6 | GitHub cron cadence is nominal, not actual. Sample density cannot be assumed. | `*/15` cron observed firing every ~2–4 h. |
| C7 | The web tier already owns a Prisma schema and a working prod `DATABASE_URL`. | `apps/web/prisma/schema.prisma` (PilotLead, AuditEvent…); `web_database_url_placeholder_prod` (fixed + monitored). |

## 3. Half A — measured availability

### Options

**A1 — `AvailabilitySample` model in the web schema (RECOMMENDED).**
One row per lane per probe tick, written by the existing probe handler
(`app/api/internal/source-health/probe/_handler.ts`) in the same pass that
feeds the in-memory store. The store stays exactly as it is — it remains the
fast "live view"; the table is the memory. `/status` aggregates on read
(rolling window, per lane), cache the aggregate for 5 min.

- Write hook: one function call added to `handleProbe`'s existing result loop.
- Read hook: `/status` (server component) + optionally `/api/status`.
- Migration: single `CREATE TABLE` + two indexes (`laneId, observedAt`).
  Founder-gated per C2; satisfies C5 trivially.

**A2 — GitHub as the ledger (workflow-run history). REJECTED.**
Zero schema change, but: measures GitHub's ability to reach prod rather than
prod itself; sample density is hostage to C6; needs an API token at page
render; couples the public status page to GitHub availability; and backfilling
from it would present CI reachability as product uptime — a C1 violation in
waiting.

**A3 — Railway volume + JSON file. REJECTED.**
Pins the web service to one instance, hand-rolls concurrency, complicates
deploys. The web tier already has Postgres (C7); a file store is strictly worse.

### The honesty grammar (this is the actual design)

The number `/status` may eventually render is **probe-observed lane
availability**, and its denominator is **samples taken, never wall-clock**:

- Each sample records `observedAt`, `laneId`, `ok`, `latencyMs`, `probeSource`
  (`cron` | `deploy` | `manual`).
- A cron gap (C6) is **unmeasured time** — it does not count for or against.
  The page must say "measured at N samples over the last 30 days", not imply
  continuous observation.
- **30-day gate:** no percentage renders until a lane has ≥30 distinct days
  each containing ≥1 sample. Before that, the current copy stays. The number
  appears when it is real (the audit brief's rule, verbatim).
- No global "uptime". Per-lane only. A blanket figure would repeat the
  "read live" flattening this wave just spent #822/#817 undoing.
- Language: "probe-observed availability", never "uptime SLA". We observed;
  we do not promise.

## 4. Half B — incident feed

Founder-authored markdown in `docs/ops/incidents/*.md` (curated records, same
authorship class as `pilot-legal/`), compiled at **build time** into
`apps/web/lib/generated/incidents.json` — because of C3 the request-time read
is impossible, and `lib/generated` is already the established generated-and-
shipped path (`prisma generate` writes there today; `build` is
`prisma generate && next build`, so the script slots in between).

- `scripts/generate-incidents.ts`: parse frontmatter (`id`, `date`, `title`,
  `severity`, `lanes`, `resolvedAt`), validate against the banned-strings list
  (an incident write-up is public copy — the truth contract applies to it),
  emit JSON. Deterministic; output stays gitignored like the prisma client.
- `/status` imports the JSON. Zero incidents → exactly the current honest
  copy. The section upgrades only when a real incident file exists.
- Incidents are **founder-authored only**. Agents may draft a file in a PR;
  nothing auto-publishes. An incident feed that writes itself is a liability
  generator.
- Publishing cadence: an incident becomes visible on the next deploy. For a
  page that today says "no feed is published yet", next-deploy latency is
  acceptable; request-time freshness is explicitly a non-goal (C3 makes it
  expensive and nothing requires it).

## 5. Founder decisions required

| # | Decision | Recommendation |
|---|---|---|
| FD-A | Approve the `AvailabilitySample` migration (the one schema change; C2 makes the PR merge itself the founder act — the PR will carry the founder note). | Approve A1. |
| FD-B | Sign off the honesty grammar in §3: samples-taken denominator, unmeasured-gap rule, per-lane only, 30-day gate, "probe-observed availability" wording. | As written. |

Everything else (script, JSON shape, retention default of raw samples 180 d →
daily rollup after) is implementation detail inside those two decisions.

## 6. Implementation sketch (after FD-A/FD-B)

Two PRs, deliberately separable:

1. **Ledger PR:** migration + write hook in `_handler.ts` + a
   `getLaneAvailability(windowDays)` read module + tests (write path unit,
   30-day-gate boundary, gap-handling). `/status` renders nothing new yet —
   data must age before the gate opens, so shipping the writer early is what
   starts the 30-day clock.
2. **Surface PR (≥30 days later, by construction):** `/status` renders the
   per-lane figures + the incident build script. Coordinate with
   `status-source-lanes.test.ts` and the `sourceLanes.ts` registry (#817) —
   lane ids come from there, not a new list.

What this kills when done: the last honest-but-empty section of `/status`, the
probe's amnesia, and the temptation—which this codebase has now demonstrated
twice—to fill the gap with an invented number.

## 7. Non-goals

- No external status vendor (C4). No per-moment SLA claims. No backfill from
  GitHub history (A2's rejection reasons). No synthetic or extrapolated
  figures of any kind (C1). No second freshness vocabulary — cadence stays in
  `sourceCatalog.refreshSlaHours` / `sourceLanes.ts` (#817/#830 settled that).
