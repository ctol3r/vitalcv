# VitalCV Codebase Explained

This repository is best understood as a productized institutional trust platform for healthcare professionals, not as a blockchain lab or a verifier prototype.

VitalCV exists to reduce credentialing friction and help a clinician move forward faster while keeping employers and CVOs confident that the person in front of them is operationally safe to advance.

The product goal is simple:
- Clinician: “This already helps me professionally.”
- Employer / CVO: “This feels operationally safe.”

The codebase is organized around that experience.

## 1. What The Product Actually Is

VitalCV is a professional identity and trust activation platform for healthcare workers.

It helps with the moment where a person is trying to prove they are real, current, and ready enough to move forward. The system reduces repeated credential checking by turning source-backed verification into something the user can understand quickly and the employer can rely on.

The user journey is:
1. A clinician lands on the homepage.
2. They enter an NPI or start a guided onboarding flow.
3. VitalCV recognizes identity, checks source-backed signals, and shows a trust snapshot.
4. The passport tells the user what is ready, what is pending, and what still needs sources.
5. The clinician continues onboarding or shares the result with an employer.
6. The employer review surface makes a proceed / review / wait decision.

The product is trying to combine consumer-grade momentum with institutional-grade trust. That is the core moat.

## 2. Product Surfaces

### Homepage (`/`)

The homepage is the emotional entry point.

Purpose:
- Convert attention into NPI entry or onboarding
- Signal professional identity recognition quickly
- Make the product feel calm, modern, and trustworthy

Emotional goal:
- “This already feels useful to me.”

Operational goal:
- Move the user into the first trust or activation step with as little friction as possible

What matters most:
- Identity-first framing
- Low cognitive load
- Verdict-first hierarchy
- No dashboard energy
- No infrastructure exposition

The homepage should feel closer to Stripe, Plaid, or Apple Health than to a credentialing admin console.

### Passport (`/passport`)

The passport is the first major value surface.

Purpose:
- Show an instant trust snapshot
- Summarize readiness in a readable way
- Let the user feel “this already knows me”

Emotional goal:
- “I look more employable now.”

Operational goal:
- Give a fast scanning view of what is source-backed, what is pending, and what is degraded

What matters most:
- Readability
- Calm presentation
- Short verdicts
- Clear next action
- No technical overload

This surface should help the user and the employer answer the same question quickly: can this person move forward?

### Onboarding (`/onboarding`)

Onboarding is the momentum continuation layer.

Purpose:
- Continue activation after the first identity step
- Refine readiness
- Fill in missing professional details

Emotional goal:
- “I’m making progress.”

Operational goal:
- Turn partial trust into a more complete and usable profile

What matters most:
- Progress without bureaucracy
- Clear next step
- Minimal friction
- No enterprise-setup feel

The onboarding flow should feel supportive, not procedural.

### Employer Review Surfaces

Employer review surfaces are where operational decisions happen.

Purpose:
- Decide whether to proceed, review, or wait
- Make trust posture legible for staffing, CVO, and hiring teams

Emotional goal:
- “I can confidently move this person forward.”

Operational goal:
- Present enough truth for a safe decision without making the reviewer read a systems document

What matters most:
- Verdict-first reading
- Confidence without false certainty
- Clear blockers
- Calm degraded states

### Trust / Readiness Surfaces

These include trust state, readiness, source coverage, and verifier-style surfaces.

Purpose:
- Explain why a profile is ready, partial, or degraded
- Show where truth came from

Emotional goal:
- “The system is honest with me.”

Operational goal:
- Support source-backed evaluation, not just cosmetic confidence

What matters most:
- Source-backed language
- Verified / pending / degraded distinction
- Proceed / review / wait semantics

## 3. Trust Model

The trust model has been intentionally simplified and humanized.

### Source-backed verification

VitalCV does not try to make every surface look fully complete all the time. It distinguishes what is actually source-backed from what is still pending or degraded.

That means the product can say:
- Source-backed
- Waiting on sources
- Review recommended
- Ready to proceed

without pretending the system knows more than it does.

### Readiness states

Readiness is the operational answer to “can this person move forward?”

The codebase treats readiness as a user-facing state, not just an internal score.

Typical semantics:
- Verified or source-backed: the system has enough confidence to proceed
- Pending: more source work is still needed
- Degraded: something is incomplete or unavailable, but the surface should stay usable and truthful

### Verified vs pending vs degraded

These states should feel calm and transparent.

- Verified means the system has enough source-backed truth to support action.
- Pending means more evidence is still coming together.
- Degraded means the system is partially unavailable or incomplete, but still readable.

The product should never turn degraded into panic. It should read as operationally honest.

### Operational trust posture

Trust posture is the short-form answer to “how safe is it to proceed?”

It should remain concise and readable:
- Ready to proceed
- Review recommended
- Waiting on sources
- Readiness progressing

This is more important than verbose explanation on the first read.

### Proceed / review / wait semantics

The product needs to support three practical decisions:
- Proceed
- Review
- Wait

That decision framing is the real value of the trust model. It is the bridge between technical verification and actual movement in the hiring or credentialing workflow.

## 4. Current Product Direction

The product is simplifying for a reason.

### Why the product is simplifying

The team is reducing the visible infrastructure burden so the product feels like a real professional tool, not a lab.

That means:
- less jargon
- less topology exposure
- less dashboard clutter
- more readable outcomes

### Why onboarding momentum matters

If the user feels blocked too early, the product loses the professional motion it is supposed to create.

The best experience is:
- quick recognition
- immediate value
- clear next step
- calm progress

### Why the homepage is becoming identity-first

The homepage needs to answer a simple emotional question:

“Is this for me?”

Making it identity-first reduces cognitive load and encourages immediate action.

### Why dashboard energy is being removed

Dashboard energy makes the product feel like an internal admin console.

This product should feel like a professional trust experience, not an operations center.

### Why infrastructure complexity is being hidden

Users do not buy infrastructure. They buy confidence, clarity, and movement.

Infrastructure still exists in the codebase, but the product surface should not force users to understand it.

## 5. Codebase Organization

### Major app areas

The main web application lives in `apps/web`.

Important route groups:
- `apps/web/app/page.tsx` for the homepage
- `apps/web/app/passport/` for passport surfaces
- `apps/web/app/onboarding/` for onboarding flows
- `apps/web/app/review/` and `apps/web/app/employer/` for employer decision flows
- `apps/web/app/trust/` for trust-state and schema surfaces
- `apps/web/app/ops/` for operational visibility
- `apps/web/app/api/` for route handlers that back these experiences

There are also older and broader surfaces in the repo that still support the system, but the current product direction is narrower and more focused.

### Activation and runtime logic

Activation support lives primarily in:
- `apps/web/lib/runtime/getRuntimeActivationState.ts`
- `apps/web/app/api/runtime/activation/route.ts`
- `apps/web/app/api/runtime-health/route.ts`
- `apps/web/components/ops/RuntimeActivationBoard.tsx`

This layer turns environment and deployment conditions into a readable activation story.

### Passport rendering

Passport rendering is spread across:
- `apps/web/app/passport/page.tsx`
- `apps/web/app/passport/[id]/page.tsx`
- `apps/web/app/passport/[id]/PassportEntityClient.tsx`
- `apps/web/components/passport/*`

This is where the trust snapshot becomes something a clinician or employer can scan quickly.

### Deployment / runtime structure

The runtime and deployment-related handlers are meant to keep operators informed without exposing implementation noise.

The important idea is not “how many subsystems exist,” but:
- what is live
- what is stale
- what is deployable

### Trust-state packages

The trust model is concentrated in:
- `packages/trust-state`
- `packages/trust-state/sourceCoverage.ts`
- `packages/trust-state/TrustStateResolver.ts`

These packages define how source-backed truth is classified and summarized.

### Onboarding flow structure

Onboarding logic and UI live primarily in:
- `apps/web/app/onboarding/*`
- `apps/web/components/onboarding/*`

The onboarding flow is designed to keep momentum, not to feel like a compliance maze.

## 6. Deployment Topology

The canonical production Vercel project is `vcv-web`.

The deprecated or stale project name is `vitalcv`.

Going forward:
- Treat `vcv-web` as canonical
- Treat `vitalcv` as historical or stale unless explicitly proven otherwise

Why this matters:
- Split topology creates false confidence
- It can make engineers check the wrong deployment
- It can make runtime truth look inconsistent

The product needs a single operational truth surface, and deployment naming is part of that.

## 7. Design Philosophy

The product is moving toward institutional calm.

That means:
- enterprise composure
- whitespace discipline
- restrained motion
- verdict-first hierarchy
- emotionally readable trust
- momentum without clutter

The intended feel should be closer to:
- Stripe
- Plaid
- Apple Health

and not like a legacy credentialing portal or a systems dashboard.

The user should feel guided, not analyzed.

## 8. What Should Happen Next

The highest-leverage work is still product-shaped:

1. Homepage conversion
2. Activation momentum
3. Passport readability
4. Employer confidence
5. Enterprise composure
6. Emotional trust
7. Removing prototype or dashboard energy

What should not expand further:
- infrastructure sprawl
- new services
- topology complexity
- standards-lab style surface area
- unnecessary runtime sophistication

The next changes should keep making the product calmer, faster to understand, and easier to trust.

## Bottom Line

VitalCV is becoming a professional identity and trust activation platform for healthcare workers.

The codebase should be read as a system that helps clinicians move forward and helps employers move safely.

If a surface does not improve onboarding momentum, trust readability, or operational confidence, it is probably not central to the product direction.
