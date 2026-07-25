# "Can VitalCV read OIG exclusions?" — the site gives two opposite answers

**Found:** 2026-07-25 on production. Three public surfaces, one deploy.
**Status:** unresolved. Needs a scope ruling, and one Railway env fact. §5.

> **Revision note.** The first cut of this document said the surfaces
> "cannot both be true" and that `connector not live` was probably the stale
> claim. Further tracing showed that is **wrong**, and the real defect is more
> interesting: they describe **different subsystems**, and neither says which.
> Corrected in place rather than re-filed, so the reasoning stays inspectable.

---

## 1. What a reader sees

| Surface | Served by | Says about OIG / LEIE and CMS PECOS |
| --- | --- | --- |
| `/api/status` | web | `lifecycle: active`, `status: operational` — "Monthly LEIE snapshot cache…", "Quarterly PECOS snapshot…" |
| `/trust/attribution` | web | `not retrieved (connector not live)` — **20 occurrences** |
| `/status/technical` | web | `connector-not-live` — *"none are wired to live upstream services in the current build"* |

All three are public and unauthenticated. A clinician or employer asking the
plain question *"can VitalCV read federal exclusion data?"* gets **yes** from
one page and **no** from two others.

## 2. Why this is not simply one page lying

The three surfaces are answering about **different systems**:

- **`/api/status`** derives from `apps/web/lib/trust/sourceLanes.ts`. Its
  evidence comments cite **backend** code — `OigLeieAdapter.ts:79` (reads the
  real HHS LEIE CSV, live unless `OIG_LEIE_ENABLED=false`) and
  `identityIngestionPipeline.fetchPecos` (real CMS data.gov API). So it is a
  claim about the **backend ingestion pipeline**.
- **`/trust/attribution`** and **`/status/technical`** are hand-written registers
  describing what the **web tier itself** retrieves per field. `ConnectorMatrix`
  states its bar explicitly: *"MUST NOT claim a connector is live unless the
  build has evidence."*

And the web tier genuinely cannot read OIG data: `apps/web/package.json` has **no
dependency on the backend package**, and the only OIG code in `apps/web` is
`lib/source-health/probes/oigProbe.ts`, which fetches
`oig.hhs.gov/exclusions/exclusions_list.asp` purely to check the **site is
reachable**. It is a liveness probe, not a data read.

**So all three statements can be simultaneously accurate.** The defect is that
none of them names its scope, so together they publish a contradiction the
reader has no way to resolve.

## 3. Why it still matters

For a product whose entire thesis is refusing to overclaim, "does VitalCV read
the federal exclusion list?" is close to the most consequential question an
employer can ask — and the site answers it both ways within three clicks. The
`/api/status` payload is the one other systems consume, and it is the one making
the **stronger** claim while describing a service the web tier cannot reach.

## 4. The structural cause

`lib/trust/sourceLanes.ts` (NUM-1.5) is the designated single definition of lane
truth, and its header says: *"Do not re-introduce a hand-written lane list
somewhere else."*

`source-lane-registry.test.ts` enforces that for the four surfaces NUM-1.5
replaced — `register.ts`, `app/api/status/route.ts`, `MetricStrip`,
`SourceCoverageRibbon`. It does **not** cover `TrustAttributionRegister` or
`ConnectorMatrix`, which are hand-written lane lists that predate it. A sixth
copy could be added tomorrow and nothing would notice.

## 5. What has to be decided (not guessable from the repo)

**A — the scope ruling (design).** Should a public lane state describe *platform
capability including the backend pipeline*, or *what the surface in front of you
retrieves*? Both are defensible; publishing both silently is not. Whichever is
chosen, every surface must state it in words.

**B — one environment fact.** On the Railway **API** service, is
`OIG_LEIE_ENABLED` set to `false`? If it is, then the backend does not read LEIE
either, and `/api/status` is overclaiming `operational` outright — the most
serious version of this, because that payload is machine-consumed.

These are not correctable by inference. The two directions are asymmetric:
raising the attribution surfaces to match `/api/status` is an **overclaim** if
wrong — telling employers VitalCV reads federal exclusions when nothing in the
serving tier does. That is the failure mode this product exists to prevent, so
this stops at proof.

## 6. The fix, once A and B are answered

1. Give `SourceLaneOps` an explicit scope field (which subsystem the state
   describes) so the distinction is data, not prose.
2. Bind `TrustAttributionRegister` and `ConnectorMatrix` to the registry.
3. Extend `source-lane-registry.test.ts` from a fixed list of four files to a
   **discovery** check: any file declaring a lane-availability literal must
   either consume the registry or sit on a documented exception list. That is
   what would have caught this, and the freshness overclaim fixed in #822.

Constraint worth knowing before starting: `trust-attribution-register.test.tsx`
pins that OIG / PECOS / STATE_BOARD / FSMB / NURSYS rows never claim
`source-backed`, and `connector-matrix.test.tsx` pins the same for its rows. A
live-but-snapshotted backend lane therefore needs a truth state *between*
`source-backed` and `connector-not-live`. That is a design decision, not a
rename.

## 7. The gap this belongs to

`check-public-claims` matches 23 banned **phrases**. It structurally cannot catch
a claim that is false — or unscoped — against system state. Neither `read live`
(fixed in #822) nor `connector not live` is a banned string. Every defect in this
class so far has been found by a human comparing two surfaces by hand.
