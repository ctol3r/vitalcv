# Two public trust surfaces disagree about the OIG and PECOS connectors

**Found:** 2026-07-25, on production, both surfaces served from the same deploy.
**Status:** unresolved — resolving it requires reading a Railway env var. **Not a
guess I should make.** See §4 for the single question that settles it.

---

## 1. The contradiction

| Surface | OIG / LEIE | CMS PECOS |
| --- | --- | --- |
| `/api/status` (JSON) | `lifecycle: active`, `status: operational` — *"Monthly LEIE snapshot cache with nightly exclusion sweep; fails closed when the cache is stale."* | `lifecycle: active`, `status: operational` — *"Quarterly PECOS snapshot; snapshot age is surfaced as staleness on trust surfaces."* |
| `/trust/attribution` (page) | `not retrieved (connector not live)`, `data-truth-state="connector-not-live"` | `not retrieved (connector not live)`, same state |

`connector not live` appears **20 times** on `/trust/attribution`.

Both are public, unauthenticated, and describe platform capability rather than
one clinician's record. They cannot both be true.

## 2. Why they diverged

`lib/trust/sourceLanes.ts` (NUM-1.5) exists precisely to stop this. Its header
documents the same four-way drift and says:

> Add a lane here and every surface picks it up. Do not re-introduce a
> hand-written lane list somewhere else.

`/api/status` and the homepage source ribbon both derive from it.
**`components/trust/TrustAttributionRegister.tsx` does not.** It is a
hand-written array with `state: 'connector-not-live'` as a literal — the exact
pattern the registry forbids. It was not among the surfaces NUM-1.5 replaced, so
`source-lane-registry.test.ts` ("leaves no hand-written lane list behind in the
surfaces it replaced") never covered it.

## 3. Which side the code evidence favours

The registry's values are cited; the attribution register's are not.

- **OIG** — `apps/api/backend/adapters/OigLeieAdapter.ts:5` targets the real
  feed `https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv`, and `:79`
  resolves `mode: process.env.OIG_LEIE_ENABLED === 'false' ? 'disabled' : 'csv'`
  — i.e. **live unless explicitly disabled**.
- **PECOS** — the registry cites `identityIngestionPipeline.fetchPecos` calling
  the real CMS data.gov dataset API.

On code alone, `connector not live` looks like the stale claim.

## 4. Why this is NOT being auto-corrected

The adapter defaults to live, but the deployed truth depends on
**`OIG_LEIE_ENABLED` on Railway**, which cannot be read from the repo. This
codebase has a documented history of env-gated features being inert in
production while the code path looks live.

The two possible corrections are **not** symmetric in harm:

| Direction | If it turns out wrong |
| --- | --- |
| Raise `/trust/attribution` to match `/api/status` | **Overclaim** — the site tells employers VitalCV reads federal exclusion data when it does not. The worst failure mode this product has. |
| Lower `/api/status` to match `/trust/attribution` | Underclaim — the site hides a real capability. Bad, not dangerous. |

Because the harmful direction is the one the code evidence points toward, this
needs a human who can read the Railway environment. Guessing here would repeat
the exact class of defect the audit exists to find.

**The one question that resolves it:** on the Railway API service, is
`OIG_LEIE_ENABLED` set to `false`?

- **Not set / any other value** → the connector is live. `/trust/attribution` is
  stale; fix it by binding it to the registry (§5).
- **Set to `false`** → `/trust/attribution` is right and **`/api/status` is
  overclaiming `operational`** — a more serious bug, because `/api/status` is
  the surface other systems consume.

Either answer produces a real fix. Only the founder can supply it.

## 5. The structural fix, once the answer is known

Do not hand-edit the strings; that is what produced the drift. Bind
`TrustAttributionRegister` to `SOURCE_LANE_OPS` so lane liveness has exactly one
definition, then extend `source-lane-registry.test.ts` with a case asserting no
surface publishes a lane state contradicting the registry.

Note the constraint that makes this non-trivial: `trust-attribution-register.test.tsx`
pins that OIG / PECOS / STATE_BOARD / FSMB / NURSYS rows **never claim
`source-backed`**. A live-but-snapshotted lane therefore needs a truth state
between "source-backed" and "connector not live" — the registry's `detail`
strings already carry the honest wording ("monthly snapshot", "quarterly
snapshot"). That mapping is a design decision, not a mechanical rename.

## 6. The wider gap this belongs to

`check-public-claims` matches 23 banned **phrases**. It structurally cannot
catch a claim that is *false against system state* — `read live` was never a
banned phrase, and neither is `connector not live`. Every defect in this class
found so far has been caught by a human comparing two surfaces by hand.

The durable fix is a data-derived test: for each lane in `SOURCE_LANE_OPS`,
assert every public surface's rendered claim is consistent with it. That guard
would have caught both this and the freshness overclaim fixed in #822.
