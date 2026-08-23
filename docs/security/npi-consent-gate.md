# NPI consent gate

**Gate:** `.github/workflows/npi-consent-gate.yml` → `scripts/check-npi-consent.ts`
**Register:** `consent/consented-npis.json`
**Contract:** the baseline may **shrink, never grow** — same ratchet as
[`header-trust-ratchet.md`](./header-trust-ratchet.md).

## What it enforces

No check-digit-**valid** NPI may appear in scanned source unless it is either

1. listed in `consented[]` with a recorded basis, or
2. present in `baselineUnconsentedNpis` at the exact file where it already was.

A new valid NPI in a new file fails the build.

## Why a valid NPI is not a number

A check-digit-valid NPI is a person. One unauthenticated request to the public
NPPES registry turns it into a name, a specialty and a practice address. When
one is used as a fixture, a demo constant, a seed row or a rendered example,
VitalCV is making assertions about a named clinician who was never asked.

Check-digit-**invalid** numbers are unrestricted, because they cannot name
anyone. That is the entire reason the substitution convention picks them.

## The incident this closes

Three occurrences in five months, each fixed correctly and locally, none of
them checked:

| Date | What happened |
| --- | --- |
| 2026-03 | Seed scripts wrote invented licences and sanctions about real, named physicians into the production database. |
| 2026-08-10 | The dev page-stack harness rendered a real physician's named record. The NPI was swapped for a check-digit-invalid one, final digit preserved. |
| 2026-08-16 | `/trust/doctrine` — public, no-auth, SSR — was found printing a real enumerated provider's name beside `status: 'verified'` and `tier: 'T3'`. The identical substitution as six days earlier, on the surface strangers can actually read. |

The 2026-08-10 fix was right and changed one file. Nothing propagated it,
because nothing was measuring. This gate is that measurement.

## Fixing a failure

**Do not** add an entry to `baselineUnconsentedNpis` to make CI pass. That list
is the record of work outstanding, not an allowlist. Instead:

- **Use a check-digit-invalid number.** Preserve the final digit if a sandbox
  connector branches on it. Verify with the NPPES registry that it returns
  `result_count: 0`.
- **Or record real consent** under `consented[]`, with the basis.

## Deliberately out of scope

`apps/web/lib/directory/sitemap-seed.json` holds **4,955 real NPIs** and is not
scanned. That file is the public-directory beachhead — a known, founder-owned
values decision about publishing records for clinicians who never enrolled,
carried as an open founder decision rather than as a defect.

Folding it into this gate would bury a decision the founder must make under a
check an agent can silence. If that decision is ever made, it belongs in the
consent register, not in this exemption.

## Current state (2026-08-16)

The baseline was generated, not chosen: **35 valid NPIs across 219 file
references**, being the true state of `origin/main` at `57dfe9f8b`. Sampling
the registry, at least five resolve to real, enumerated people — four of those
in non-test files:

| NPI | Enumerated? | Notable location |
| --- | --- | --- |
| `1003000126` | yes | 13 non-test files, incl. live backend agents |
| `1003000134` | yes | `seed-provider-intelligence.ts` |
| `1215930367` | yes | `components/status/ConnectorMatrix.tsx` |
| `1699264564` | yes | `services/ingest/ingestOrchestrator.ts` |

Names and specialties are deliberately **not** recorded here. The numbers are
unavoidable — the ratchet is keyed on them and eviction work needs them — but
transcribing the registrants' identities into a new durable document would
repeat, in this file, the thing the gate exists to stop. Anyone doing the
eviction can resolve a number against NPPES at the moment they need it.

This corrects a claim in the *Closing the Gap* plan (CG-1-07), which recorded
"the seed scripts are clean". `apps/api/backend/scripts/seed-provider-intelligence.ts`
carries a contiguous block of nine valid NPIs from the earliest NPPES
allocation range, at least two of which are enumerated real providers.

Emptying this baseline is CG-1-07. The gate exists so that the number can only
go down.

## Proving the gate works

Never trust it because it passes. Injection, verified 2026-08-16:

| Case | Expected | Observed |
| --- | --- | --- |
| Baseline, unmodified | exit 0 | exit 0 |
| New real NPI in a new file | exit 1 | exit 1, file named |
| Revert the `/trust/doctrine` fix | exit 1 | exit 1, file named |
| Restore one fabricated institution row | exit 1 | exit 1, file named |
| Restore both | exit 0 | exit 0 |

Re-run that sequence after any change to the scanner.
