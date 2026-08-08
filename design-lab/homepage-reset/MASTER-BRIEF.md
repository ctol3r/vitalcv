# FOUNDER HOMEPAGE RESET — MASTER BRIEF (shared by all three directions)

Source main SHA: 0b62fc04b98469d067e3153941a99aa244725a26
Status: isolated design prototypes. NOT wired into any app. No Next routes. No production changes.
Each direction = ONE self-contained `index.html` (inline CSS + JS, no build step, no external JS libs;
Google Fonts via <link> is allowed). Desktop-first at 1440×900, true mobile design at 390×844 in the
same file via media queries — the mobile composition must be intentional, not stacked desktop.

## THE ONE PRODUCT IDEA

Enter your NPI. VitalCV does the rest.
Longer: Enter your NPI. Verify it's you. VitalCV tells you exactly what needs to happen next and does
everything it safely can. VitalCV = the easy button for clinician hiring.

Emotional target: "That's it? VitalCV already knows this and is handling the rest?"

The homepage must NOT primarily feel like: a credential wallet, an evidence network, a provenance
system, a résumé builder, a credentialing vendor, a blockchain product, a data-viz project, a job
board, or an AI chatbot.

## THE PRODUCT TRAJECTORY (make this complexity feel simple — never show it as a giant diagram)

NPI → VitalCV finds the clinician → clinician proves control → profile assembles → VitalCV identifies
what remains → ranks next actions → handles what it safely can → clinician approves what needs consent
→ employer handles what only they control → relevant jobs → apply → hire → start → profile stays
useful for the next move.

## CONTENT ARCHITECTURE (same information in all three, so the founder judges DESIGN not strategy)

A. **Wide eyebrow** (hard spec below).
B. **Hero** — max: one strong headline, one supporting thought, one primary clinician action, one
   subtle employer entry. Headline direction: "Enter your NPI. VitalCV does the rest." Supporting
   thought: "We find what we can, show you exactly what remains, and handle the administrative work
   that can safely be handled." (May be rephrased per direction, but stay plain — no poetry.)
C. **How VitalCV works** — the NO-NPI explainer (spec below). This is the motion centerpiece.
D. **What VitalCV handles** — the agent ownership model, four lanes:
   "VitalCV handles" / "Needs your approval" / "Needs you" / "Employer decides".
E. **Jobs / outcome** — all this work exists to get hired and start sooner. The profile is not the
   destination.
F. **Employer doorway** — small but strong. "Hiring clinicians?" story: "Find people who fit. Know
   what remains. Keep the hire moving." Links to /employers. Must not hijack the clinician page.
G. **Final clinician action** — simple NPI entry or "Start with your NPI" CTA, then a concise footer.

## HARD EYEBROW SPEC (measured from live Palantir + Zoox, 2026-08-07 — structural fidelity only)

Reference numbers: Palantir — 64px bar, 30px gutters, 83×40 wordmark left, right cluster of
square-cornered 1px-hairline-bordered instruments (~36-50px tall: outlined CTA + boxed icon buttons),
10-12px uppercase micro-labels, full-takeover index menu with ~34px items and ↳ / ↗ glyphs.
Zoox — fixed 64px bar, 12px/700 UPPERCASE tracked micro-labels, one dominant square-cornered dark
CTA (140×50), circular menu chip, symmetric composition, airy ground.

Requirements (every direction):
- Full browser width. ONE continuous horizontal instrument. Deliberately shallow: 56–72px. Constant
  height. Content vertically centered. Gutters exactly consistent with the page grid (28–32px).
- LEFT: restrained VitalCV identity (small wordmark, not a giant logo).
- MIDDLE: very lightweight nav (max 3 items) or contextual product state. Do not overload.
- RIGHT: Sign in (quiet) + at most ONE dominant contextual action and/or a menu control.
- Hairline rules (1px) may structure the bar; square or near-square corners on instruments.
- BANNED: floating rounded container inside the viewport, SaaS pills, centered link row as the main
  event, backdrop-blur-navbar-with-thin-line, ordinary hamburger sheet.
- Scroll: the bar itself stays architecturally stable (same height); it may gain a solid ground and a
  1px bottom rule, may invert over dark sections, rules may extend/retract, content may transition.
- Mobile: eyebrow recomposes deliberately (e.g., wordmark + single CTA + menu control) at the same
  height discipline.

## THE NO-NPI EXPLAINER (section C — required story, ~5 beats)

The visitor watches the concept unfold WITHOUT entering anything. It is an explanatory product
illustration — abstracted interface animation, NOT a fake live result and NOT a fake clinician.

1. **Your NPI** — an abstract identity seed enters. NEVER render a real 10-digit NPI. Use masked
   glyphs (e.g. "• • • • • • • • • •" or "NPI · ##########" as obvious placeholder shapes).
2. **VitalCV finds what it can** — professional facts appear from clearly identified sources
   (NPPES, state license board records, practice information). Values are ABSTRACT — skeleton bars /
   redacted blocks with real field labels ("Name", "Specialty", "Practice", "License record"). Do
   not imply every source is connected or every fact confirmed. Source names shown small.
3. **VitalCV figures out what remains** — the surface shifts from "collected" to "Here's what still
   matters": a SMALL number of actions labeled by owner: "VitalCV can handle this" / "Needs your
   approval" / "You need to complete this" / "The employer controls this".
4. **VitalCV gets to work** — items visibly MOVE into states: Done by VitalCV / Ready for your
   approval / Needs you / Waiting on employer. Work is being REMOVED from the clinician, not a new
   checklist created. One item pauses for approval; approval occurs; work continues.
5. **Opportunity / start** — resolves into: a relevant role, a simple application, remaining start
   work, progress toward first day. Ends with momentum, not a database record.

Motion rules: plays once (may respond subtly to scroll); works without sound; respects
prefers-reduced-motion with an understandable static end-state (all beats visible); no looping
carnival; makes NO false claims. Provide a small "Replay" affordance if natural.

## THE AGENT IS AN OPERATOR, NOT A CHATBOT

No chat bubbles, no fake transcripts, no giant conversational prompt, no "Ask VitalCV anything",
no bot mascots. The agent is visible through WORK: next action, work completed, work prepared,
approval required, external dependency, timeline, activity receipt, status change, blocker removed.

## COPY RULES

Plain product language. Good: "We found this." / "Here's what remains." / "I can handle this." /
"Approve this action." / "The hospital controls this step." / "Done." / "Find roles." /
"Apply with VitalCV." / "Keep moving."

NEVER on this page: evidence network, provider career evidence network, provenance, lane, artifact,
packet, credential object, trust tier, dossier, passport, wallet, graph, receipt, recognition,
readiness score.

TRUTH CONTRACT — banned strings anywhere in copy or attributes: "automatically verified",
"guaranteed verification", "complete credentialing", "instant credentialing", "legally accepted",
"risk transferred", "final verification without review", "source confirmed before response",
"certified compliant", "HIPAA compliant", "SOC2 certified". No status label may be the bare word
"Verified" (e.g. "Confirmed with the source" / "Matches the state board record" style phrasing, and
only where honest). Do not overclaim: VitalCV finds what it CAN, handles what it SAFELY can, and
never claims to execute what it cannot.

## VISUAL RULES (all directions)

Challenge everything from the current site: fonts, scale, radius, section widths, cards, backgrounds,
grid, icons, motion, CTA shape, whitespace, nav mechanics. BANNED: glowing AI gradients,
purple/blue AI blobs, massive pills, endless bento boxes, glassmorphism, stock clinicians in scrubs,
floating fake browser windows everywhere, decorative waveform/data noise, film/scene conceptual
model, generic healthcare-blue SaaS. Every element supports comprehension or character.

Current-site language being challenged (for the record): warm paper #f7f5f0-ish ground, big
editorial display serif with italic violet accent word, violet rounded pills, journey-rail nav
(Your Number → Sources → Permission → Review), film-strip stage row, film/scene motion.

## REAL PRODUCT ENTRY

The real action ("Enter your NPI" / "Start with your NPI") must point at the canonical real flow —
use `https://vitalcv.com/` hero flow semantics: a form that would submit to the existing onboarding
entry (`/onboarding?npi=`). In the prototype the form's submit is intercepted with a small note
("Prototype — real flow continues at vitalcv.com") so nothing fake executes. The explainer teaches;
the real entry executes. Never blur the two.

## ACCESSIBILITY BASELINE

Semantic landmarks (header/nav/main/section/footer), one h1, logical heading order, visible focus
states, WCAG AA contrast, prefers-reduced-motion honored everywhere (no meaningful info lost),
keyboard-reachable controls, alt/aria on illustrative SVG (aria-hidden where decorative), no
scroll-jacking.
