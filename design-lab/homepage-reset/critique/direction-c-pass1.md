# Direction C — Precision / Editorial · Critique pass 1 (during implementation)

Method: Playwright captures at 1440×900 / 390×844 (pane compositor freeze makes it unreliable for
scroll states; builder additionally verified interaction, tab order, inversion, and ban sweeps
headlessly).

## Five-second test — PASS (strongest of the three so far)
The 96px expanded-Archivo "Enter your NPI. / VitalCV does the rest." between drafted rules is
unmissable; the NPI instrument with a black START block is the obvious action; the eyebrow
annotation "N° 01 — CLINICIAN HIRING, HANDLED" names the category in five words.

## Easy-button test — PASS
Frame sequence 1→5 explicitly moves work off the clinician ("VitalCV starts clearing the list.
One item pauses for your approval; you approve; work continues."). Ownership section closes with
"Four owners. No mystery about whose move it is."

## Distinctiveness test — PASS (by a wide margin)
Nothing in healthcare software looks like this. Drafted rules + registration crosshairs + expanded
grotesk + scarce vermilion reads as a category-defining technology company. Zero resemblance to
AI-startup gradients or SaaS templates — and zero resemblance to the current VitalCV site.

## Trust test — PASS
"Nothing here is a live result — it is the idea, drawn once. The real flow starts with your
number, below." under the explainer; "TEN DIGITS, THEN PROVE IT'S YOU. NOTHING IS SHARED WITHOUT
YOUR APPROVAL." under the hero; outlined (unfilled) license-record bar honestly signals
not-every-fact-is-confirmed. Builder ban-sweeps: all clean, including any `verif*` form.

## Product test — PASS
The five ruled frames literally diagram the product: masked seed → sourced facts (NPPES / state
board) → owner-labeled remainder → states in motion with approval pause → role/apply/first-day
meter. The static spread is arguably as legible as the animation — ideal for reduced motion.

## Employer test — PASS
"05 — Hiring clinicians?" section: one editorial sentence + outlined CTA; plus the hero's mono
"HIRING? → FOR EMPLOYERS" annotation. Present, credible, not hijacking.

## Eyebrow spec check — PASS
60px drafted band between two full-width 1px rules; restrained tracked wordmark; centered
contextual index annotation (updates N° 01→06 per section); Sign in + single black square CTA;
full inversion over the black outcome band with identical geometry; mobile recomposes to
wordmark + START + MENU (full-page black index menu).

## Risks / watch items
1. The most assertive direction — if the founder wants maximum calm, this is the far pole.
2. Hero leaves a large drafted void between headline band and instrument row at 1440×900;
   intentional editorial air, but noted.
3. Mobile h1 is a 4-line stack ("Enter / your NPI. / VitalCV / does the rest.") — deliberate and
   strong, but the lone "Enter" first line is a taste call for the founder.

## Defects found → actions
1. Full-page captures smear the fixed eyebrow mid-page (Playwright stitching) — harness now pins
   #eyebrow to absolute for full-page shots. HARNESS CHANGE, not a prototype defect.
2. "Eyebrow during scroll" shot was taken over a white band only — harness now also captures the
   bar over #outcome (desktop-06b) to evidence inversion. HARNESS CHANGE.
No prototype code changes required in pass 1.
