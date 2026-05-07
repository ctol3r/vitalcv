# Confidence Doctrine v2

VitalCV ships **two** confidence models. They live side by side because they
answer different questions. This doc explains which to use when, and codifies
the rules of the categorical model so future surfaces don't drift.

## The two models

### Categorical (this doctrine)

Answers: **how was this value recalled?**

| Tier | Meaning |
|---|---|
| `verified` | Value is from a primary-source registry the system queried directly. |
| `inferred` | Value is AI-derived from a clinician-supplied document or third-party feed. |
| `unknown` | Data is not on file. **Neutral signal, not negative.** |
| `contradicted` | Two authoritative sources disagree. Requires human reconciliation. |

Used on: passport, employer review, dossier, file detail, inbox, application
active state, autopilot. Anywhere a reader is judging *evidence*.

Code: [`apps/web/components/vds/confidence/`](../../apps/web/components/vds/confidence/).

### Scored (sibling, retained)

Answers: **how confident is the AI in this inference?**

Output: a numeric value in [0, 1], rendered as a percentage badge or meter.

Used on: intelligence / risk surfaces where AI-derived inferences need a
graded readout. The categorical model collapses to `inferred` for the same
data; the scored model adds resolution.

Code: [`apps/web/components/ui/ConfidenceMeter.tsx`](../../apps/web/components/ui/ConfidenceMeter.tsx) and [`apps/web/components/ui/confidence-score.tsx`](../../apps/web/components/ui/confidence-score.tsx).

## When to use which

| Context | Model |
|---|---|
| A value with a registry-vs-document provenance question | Categorical |
| An AI-derived match score on a fuzzy join | Scored |
| A field on the clinician passport | Categorical |
| A risk score on the intelligence dashboard | Scored |
| An evidence row in the dossier export | Categorical |
| An inferred relationship in the trust graph | Scored |

If a surface needs both (e.g., "this NPI match is `inferred` at 73%"), render
both: a categorical badge for the recall channel, a scored display for the
inference confidence.

## Decision tree (categorical model)

```
if value is from a primary-source registry the system queried directly
    → verified
else if value is AI-derived from a clinician-supplied document
        or third-party feed
    → inferred
else if data is not on file
    → unknown          (neutral signal, NOT negative)
else if two authoritative sources disagree
    → contradicted     (requires human reconciliation)
```

The narrative form is exported from
[`doctrine.ts`](../../apps/web/components/vds/confidence/doctrine.ts) as
`confidenceDoctrineNarrative` and read verbatim by Wave 37's reconciliation
drawer. Treat as authoritative; do not paraphrase in surface copy without
reading from the constant.

## Hard rules

1. **There are exactly four tiers.** A 5th tier is a recall-scope problem,
   not a doctrine change. If you find yourself wanting one, the right move is
   to widen `KNOWN_PRIMARY_SOURCES` in `tier-resolver.ts` or add a recall kind
   to `FieldRecallKind`.
2. **`unknown` is neutral, not negative.** UI MUST NOT style it as warning red
   or position it as a deficiency. The amber accent on the badge signals
   "needs attention to populate," not "alarming."
3. **The label `Verified` on a confidence badge is the *tier name*.** It is
   NOT a pipeline status. For pipeline lane state, use `Checked` (the lane
   primitives already do — see
   [`design-system/components/LaneStateBadge.tsx`](../../apps/web/design-system/components/LaneStateBadge.tsx)).
4. **No tier may claim primary-source verification on AI-derived data.**
   Inferred ≠ verified. Surfaces MUST NOT promote `inferred` to `verified`
   without a registry refetch.
5. **Tier descriptions are bundled.** Help components MUST NOT fetch them at
   runtime. If you need to localize, do it at build time.

## Resolver

`resolveConfidenceTier(field)` is the deterministic resolver in
[`apps/web/lib/confidence/tier-resolver.ts`](../../apps/web/lib/confidence/tier-resolver.ts).
Use it at API/adapter boundaries. React components should prefer
`useConfidenceTier`.

```ts
import { resolveConfidenceTier } from '@/lib/confidence/tier-resolver';

const tier = resolveConfidenceTier({
  source: 'NPPES (CMS)',
  recall: 'primary',
  value: '1346053246',
});
// → 'verified'
```

## Adding a new primary source

1. Add the identifier (uppercased, substring-matchable) to
   `KNOWN_PRIMARY_SOURCES` in `tier-resolver.ts`.
2. Add a test case in
   `apps/web/lib/confidence/__tests__/tier-resolver.test.ts` proving
   `resolveConfidenceTier({ source: 'NEW_SOURCE' })` returns `'verified'`.
3. Document the source in this file's "Known primary sources" list (below).
4. Open a PR; Codex reviews the source claim against publicly available
   evidence that the registry publishes a primary record.

### Known primary sources

| Identifier | Registry | Why primary |
|---|---|---|
| `NPPES` | National Plan and Provider Enumeration System (CMS) | Statutory NPI registry. |
| `DEA` | Drug Enforcement Administration | Controlled-substances registration of record. |
| `PECOS` | Provider Enrollment, Chain, and Ownership System | Medicare enrollment of record. |
| `NPDB` | National Practitioner Data Bank | Statutory adverse-event reporting registry. |
| `OIG` | HHS Office of Inspector General · LEIE | Federal exclusions list. |
| `SAM` | System for Award Management | Federal contractor exclusions list. |
| `NURSYS` | National Council of State Boards of Nursing | Multistate RN compact. |
| `CAQH` | Council for Affordable Quality Healthcare | Industry profile of record (caveat: aggregator). |

## Sibling: lane state

Surfaces that render lane state (`verified | pending | access | blocked |
contradicted | unknown`) use the lane vocabulary from
[`LaneStateBadge`](../../apps/web/design-system/components/LaneStateBadge.tsx),
not this doctrine. Lane state describes pipeline progress; categorical
confidence describes value provenance. They overlap on the words `verified`
and `contradicted` but mean different things.

If both legends appear on the same page, label them so readers can tell which
column is which: `Lane state` vs `Field confidence`.
