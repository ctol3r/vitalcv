# The exclusion screen returned CLEAR for excluded providers

**Found:** 2026-07-27, exercising `leieCache` against the live HHS LEIE list.
**Status:** fixed in this PR. Scope of the fix is narrow; §6 lists what it does not address.

---

## 1. The defect

`scoreCandidate` in `apps/api/backend/src/services/identity/leieCache.ts` had
three return branches and a fall-through:

| Branch | Condition | Result |
| --- | --- | --- |
| 1 | `firstExact && middleMatch && stateMatch && specialtyExact` | `STRONG_FUZZY` 0.90 |
| 2 | `firstExact && stateMatch && specialtyFamily` | `STRONG_FUZZY` 0.76 |
| 3 | `!firstExact && firstPartial` | `WEAK` 0.58 |
| — | anything else | `null` → **`CLEAR`** |

Both strong branches require a **specialty**. The only specialty-free branch
was gated on `!firstExact`. So an **exact** first + last + state match with no
specialty matched no branch, fell through, and reported `CLEAR`.

A **worse** match — same person, first name truncated — hit branch 3 and
returned `POSSIBLE_MATCH`.

## 2. Reproduction against the live list

LEIE vintage `2026-07-10`, 83,665 entries. `CRISELDA ABAD-SANTOS`, CA,
psychiatry, excluded `1128b4` since 2025-01-20:

| Query | Verdict | Score |
| --- | --- | --- |
| exact first name, no specialty | **`CLEAR`** | 0 |
| **partial** first name (`CRIS`), no specialty | `POSSIBLE_MATCH` | 0.58 |
| exact first name + specialty | `POSSIBLE_MATCH` | 0.76 |
| exact first + middle + specialty | `POSSIBLE_MATCH` | 0.90 |

Knowing the provider's full first name made the screen miss. Reproduced on
three excluded providers; all three behaved identically.

## 3. Why it is not a corner case

Of 83,665 LEIE rows, **80,233 are named individuals** and only **8,196 of those
carry an NPI (10.2%)**. The remaining **72,037 (89.8%) are reachable only by
name**.

NPI matching works correctly and always did — verified `EXACT` / `EXCLUDED` /
score 1 on three known-excluded NPIs. But it covers a tenth of the list. Name
matching covers the rest, and name matching without a specialty returned
`CLEAR`.

The call sites make this concrete:

| Call site | Passes | Reaches the dead path? |
| --- | --- | --- |
| `routes/oig.ts:95` | `firstName`, `lastName`, `npi` — no state, no specialty | **Yes** |
| `services/providers/connectors/oigConnector.ts:79` | `npi` only, no name at all | Cannot match the 89.8% |
| `workers/continuousMonitor.ts:542` | name + state + specialty | Reaches branch 2 — but see §6 |

`routes/oig.ts` resolves the provider's name from NPPES and then queries with
no state or specialty, which is exactly the branch that returned nothing.

## 4. The fix

A fourth branch for `firstExact` without specialty corroboration, scored
between the partial-name branch and the specialty-corroborated ones:

- `firstExact && stateMatch` → 0.68, `MEDIUM`
- `firstExact` alone → 0.62, `LOW`
- `firstPartial` → 0.58, `LOW` (unchanged)

The invariant restored is **monotonicity**: a superset of matched fields must
never score below a subset. That is the property whose absence produced the
inversion, and it is what the regression tests pin — ordering, not the
specific constants, so retuning the numbers later will not silently reopen it.

**The verdict stays `POSSIBLE_MATCH`, never `EXCLUDED`.** A name alone is not
proof of identity; auto-excluding on one would bar the wrong person from work.
Only an exact NPI hit asserts exclusion outright, and that path is untouched.

## 5. Cost of the fix

More names now route to human review. The tail is bounded: of 76,037 distinct
first+last pairs on LEIE, **72,804 (95.7%) are unique**, and only 3,233 repeat.
The worst collision is `MARY JOHNSON` at 12 rows.

Verified unchanged after the fix:
- three nonsense-name probes still `CLEAR`
- exact first name + nonsense surname still `CLEAR` (surname equality is still required)
- nonsense first name + real surname still `CLEAR`
- all three known-excluded NPIs still `EXACT` / `EXCLUDED`

`John Smith` with no NPI moves from `CLEAR` to `POSSIBLE_MATCH` (0.62). That is
the intended direction: on an exclusion screen a review is cheap and a false
clear is not.

## 6. What this does NOT fix

- **`oigConnector.ts` still queries by NPI alone**, so the connector remains
  blind to 89.8% of the list regardless of this change. Widening it is a
  behaviour change for every caller and belongs in its own PR.
- **`continuousMonitor` passes an NPPES specialty into a LEIE specialty field.**
  These are different vocabularies — NPPES taxonomy text (`Physician
  Assistant`) versus LEIE's own strings (`PSYCHIATRY`, `INTERNAL MEDICINE`).
  `specialtyFamilyKeys` bridges some of them by substring, but how reliably was
  not measured here and should not be assumed.
- **The `/api/status` vs `/trust/attribution` contradiction** in
  `lane-truth-contradiction-2026-07-25.md` is untouched. That needs the scope
  ruling and the Railway env fact recorded there; this PR changes matching
  behaviour, not what any surface claims.
- **CI still does not exercise the real list.** `oigConnector.test.ts` and
  `services/identity/__tests__/leieCache.test.ts` remain quarantined for
  fixture isolation. The tests added here use a mocked CSV and run in CI; the
  live-list verification in §2 was run by hand.
