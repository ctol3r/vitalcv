# Activation Productization Audit

Scope: `/`, `/passport`, and `/onboarding`

Goal: make VitalCV feel like a calm, identity-first product that increases activation momentum without adding new systems, infrastructure, or feature density.

## 1. What still feels procedural

- The passport active state still exposes source rows for NPPES, OIG/LEIE, PECOS, and the state-board lane.
- Labels such as "Checking exclusion status..." and "Checking Medicare enrollment..." still read like a workflow monitor.
- The onboarding page explains continuation well, but it still frames the experience as a process description.
- Error and retry states still use process language instead of a more reassuring forward-motion tone.

## 2. What still weakens onboarding momentum

- The handoff from `/passport` to `/onboarding` is still an explicit decision point.
- Secondary actions like "Re-check sources" and "Cancel" can interrupt the primary momentum path.
- The homepage still requires a full NPI before any reward appears, which is correct but still introduces friction.
- The onboarding page could be even more singular if its supporting copy were reduced slightly.

## 3. What still visually fragments the experience

- `/` uses a centered activation card, while `/passport` still shifts into a denser diagnostic surface.
- `/passport` combines banners, badges, source rows, readiness summaries, and recovery controls, which makes it feel assembled from modules.
- `/onboarding` is calmer, but its hierarchy and spacing still read as a separate page pattern rather than a continuous follow-on.
- The signed-in banner and role-context banner are useful, but they interrupt the visual quietness at the top of the flow.

## 4. What still feels like enterprise tooling

- Terms like NPPES, OIG/LEIE, PECOS, readiness, and lane health are necessary, but they still sound like internal system language.
- The passport page still resembles an operator console because it surfaces granular status rows and recovery controls.
- Badge-heavy treatment on the live passport state still signals instrumentation more than reassurance.
- `LaneHealthMount` is operationally appropriate, but it contributes to the sense that the page is a control surface.

## 5. What still weakens emotional trust

- The copy explains what VitalCV does more than it lets the user feel what it already recognized.
- Some labels still emphasize checks and failure handling instead of recognition and forward motion.
- The trust story is credible, but the emotional story is not yet fully compressed into one clean promise per route.
- The product still feels a little more like "here is the verification" than "you are already moving."

## 6. Top remaining conversion opportunities

- Reduce the passport active-state density further and collapse more of the source detail into one human summary sentence.
- Make the `/onboarding` primary CTA the only visually dominant choice, with secondary actions quieter.
- Tighten the homepage supporting copy to one promise, one proof, and one next step.
- Smooth route-to-route wording so `/`, `/passport`, and `/onboarding` read like one continuous activation sequence.
- Remove one more layer of diagnostic texture from the passport surface if it is not needed to move the user forward.
- Keep the calm typography and whitespace, but strip out anything that still makes the product feel assembled rather than inevitable.

