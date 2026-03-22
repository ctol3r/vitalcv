# OpenClaw Godmode — VCV Actualization Bundle

Use this to actualize the current VitalCV doctrine into concrete product artifacts and implementation work.

```text
Use the skill at `skills/vcv-ui-foundation/SKILL.md`.

Treat these as binding constraints:
- `docs/VCV_JOBS_DOCTRINE_AND_FUTURE_STATE.md`
- `docs/VCV_UI_DOCTRINE.md`
- `ANTIGRAVITY.md`

Repo: VitalCV monorepo
Primary targets:
- `apps/web`
- `docs/`
- any existing shared UI primitives already in use

Mission:
Actualize the current VitalCV mindset into concrete product artifacts and implementation work, with Steve Jobs discipline as the primary product taste filter.

This is not a brainstorming exercise.
This is a conversion of doctrine into product reality.

## Non-negotiable mindset
- One magical moment over ten weak features.
- Hide infrastructure. Do not lead with blockchain or plumbing.
- Eliminate anything that smells like admin SaaS.
- Keep the product emotionally serious, elegant, calm, and inevitable.
- Every artifact should help a clinician prove readiness and help an employer see what is proven, what is missing, and what can proceed.

## Deliverables you must produce
Produce all of the following in order. Use the repo as the source of truth and integrate with the current app architecture where possible.

### Deliverable 1 — VCV Interview Mode Product Spec v1
Create a doc in `docs/` that defines:
- purpose and user promise
- provider-side UX
- employer/interviewer-side UX
- core objects shown in interview mode
- readiness snapshot fields
- verified proof highlight fields
- blocker and friction fields
- estimated start-speed / startability logic
- share flow and permissions model
- mobile behavior
- success metrics
- phased implementation ladder

Keep this practical, not fluffy.

### Deliverable 2 — One Magical Demo Script
Create a doc in `docs/` that can be used for YC, investors, partners, and product demos.

Must include:
- the exact setup
- the single magical act
- what appears on screen
- what the employer understands instantly
- a 60-second version
- a 3-minute version
- key lines to say aloud
- anti-jargon wording
- what not to say

The magical moment should center on:
A clinician shares one thing. An employer immediately sees what is proven, what is missing, and what can proceed.

### Deliverable 3 — Homepage Copy Refresh
Create a doc in `docs/` with:
- homepage hero copy
- subhead
- trust bar / proof bar copy
- primary CTA copy
- secondary CTA copy
- interview-mode section copy
- employer value section copy
- clinician value section copy
- final CTA section copy
- ultra-short taglines

Style:
- Tesla-level restraint
- no fluff
- no blockchain-first language
- no generic SaaS language
- must feel powerful, modern, inevitable

### Deliverable 4 — VCV Passport UX Concept
Create a doc in `docs/` that defines what the Passport is and what the user sees.

Must include:
- what the Passport is
- key screens / surfaces
- information hierarchy
- what is visible by default
- what is expandable
- how trust is shown
- how readiness is shown
- how motion/progress is shown
- what a share view looks like
- what an employer-facing view looks like
- mobile-first considerations

### Deliverable 5 — Implementation Plan
Create a doc in `docs/` that maps the above deliverables into actual repo work.

Must include:
- routes to add or modify
- components to create or reuse
- docs written vs code to implement
- dependencies already present that support this work
- what can ship in 7 days
- what can ship in 30 days
- what should wait

## Additional implementation behavior
After the docs are produced, inspect the current repo and propose the smallest valuable implementation pass that begins turning Interview Mode or Passport into reality.
Do not do a giant rewrite. Suggest the first real code patch set.

## Style rules for all docs
- concise
- clear
- forceful
- no consultant sludge
- no vague future-speak
- all wording should align with Jobs doctrine and antigravity

## Final report format
At the end, provide:
1. files created
2. key decisions made
3. what was intentionally left out
4. recommended first code patch set
5. risks or ambiguities that still need founder judgment
```
