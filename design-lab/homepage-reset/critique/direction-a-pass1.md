# Direction A — Operational Calm · Critique pass 1 (during implementation)

Method: live render reviewed via Browser pane (hero) + Playwright captures at 1440×900 / 390×844
(the pane's hidden-tab compositor freeze makes scroll-driven states unreliable there; per repo
practice, visual truth comes from Playwright renders).

## Five-second test — PASS
"Enter your NPI. VitalCV does the rest." is the first thing read; the NPI field with a spruce
Start button is the obvious action. What VitalCV is (does clinician-hiring work for you) is carried
by the adjacent week-ledger illustration. Nothing competes with the message.

## Easy-button test — PASS
The hero ledger shows work leaving the clinician's plate ("Pulled your public NPPES listing — DONE
BY VITALCV", "Drafted your work history — READY FOR YOUR APPROVAL"). The ownership section states
"Every item in a hire has exactly one owner. VitalCV takes what it can safely take — and never
pretends to own the rest." It reads as removal of work, not a new system to operate.

## Distinctiveness test — PARTIAL (accepted trade-off of this direction)
Bone + spruce + mono micro-labels + hairline rules give it more character than healthcare-blue
SaaS, and the ledger/ownership grammar is distinctly "operator". It is deliberately the calmest of
the three; it will read least loud next to C. That is its thesis, not a defect.

## Trust test — PASS
Honest framings everywhere: "ILLUSTRATION" tag + "A picture of the working pattern — not live
data." on the ledger; "No NPI required to look… not a live lookup." on the explainer; no banned
vocabulary (grep-verified by builder and re-checked); no bare "Verified" label anywhere.

## Product test — PASS
The 5-beat sticky-stage explainer walks NPI → facts (NPPES / practice / state board record) →
what remains with owners → work resolving through four states with one approval pause → role +
first-day meter. Live probe confirmed clean crossfades (an earlier "overlap" was a screenshot
stitching artifact of the sticky stage, not a real defect).

## Employer test — PASS
Quiet one-line doorway under the hero form + a dedicated bone-2 band ("Find people who fit. Know
exactly what remains. Keep the hire moving.") — visible without hijacking.

## Eyebrow spec check — PASS
64px constant, full-width, bottom hairline from start, wordmark left, two quiet middle items,
Sign in + single spruce square-cornered instrument right. Mobile recomposes (wordmark + Start +
MENU text control → full-height calm index). No pills, no blur, no floating container.

## Defects found → actions
1. Hero ledger appeared empty in the Browser pane — diagnosed as the pane's hidden-tab compositor
   freeze; Playwright render shows rows resolved. NO CODE CHANGE.
2. Explainer element-screenshots stitch the sticky stage into overlapping nonsense — capture
   harness switched to fixed-scroll viewport shots for sticky directions. HARNESS CHANGE.
3. Mobile h1 orphaned "rest." on line 3 — mobile h1 now 33px + text-wrap:balance. FIXED.
4. Stage composition in beats 2/4 leaves generous empty area above content at 900px viewport —
   within the direction's "generous but not empty" tolerance; scenes are justify-centered.
   ACCEPTED (watch in pass 2).
