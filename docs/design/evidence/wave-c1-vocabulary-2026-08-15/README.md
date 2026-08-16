# Wave C1 acquisition-vocabulary reconciliation — visual evidence

Date: 2026-08-15

Creative owner: Claude Code (Execution Lane D), implementing the founder
vocabulary rulings of 2026-08-15 (Wave C1). Copy-only: no visual
recomposition, no layout, motion, or CSS change. Shared public chrome is
unchanged.

## What changed

Per the 2026-08-15 founder rulings, "Provider Career Evidence Network" is
retired as public category language and "Start my CV Wallet" is retired as the
acquisition CTA. On `/`:

- Hero eyebrow: "The Provider Career Evidence Network." →
  **"Your VitalCV profile. Ready for every move."** (the clinician promise
  line, in customer vocabulary)
- Primary CTA: "Start my CV Wallet" → **"Build my free profile"**
- JSON-LD organization description: rewritten to the canonical category line
  ("the portable professional identity and employment network for
  clinicians") without the retired category name

The H1 ("One career record. More ways forward."), lede, secondary action,
stage composition, and the CV Wallet work-surface register are untouched —
CV Wallet remains lawful as a secondary product noun per the same ruling.
`/demo` copy also drops the retired category name (noindexed surface, not
screenshotted here).

## Evidence index

| Requirement | Artifact |
|---|---|
| 1440x900 before (production, vitalcv.com) / after (local production build) | `before-1440x900.png`, `after-1440x900.png` |
| 390x844 before (production, vitalcv.com) / after (local production build) | `before-390x844.png`, `after-390x844.png` |

Before captures were taken from https://vitalcv.com on 2026-08-15; a DOM probe
during capture read eyebrow `"The Provider Career Evidence Network."` and CTA
`"Start my CV Wallet"`. After captures were taken from a local `next start`
production build of this branch; the same probe read eyebrow `"Your VitalCV
profile. Ready for every move."` and CTA `"Build my free profile"`, and the
served HTML contained zero occurrences of either retired string.

No motion recording: no motion, scroll, or interaction behaviour changed.
