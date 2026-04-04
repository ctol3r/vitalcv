## 30-Second Elevator Pitch

VitalCV is a decision engine for clinician hiring readiness.

A user enters an NPI. VitalCV turns source-backed checks into a clear employer decision state: what is verified, what is missing, what blocks progress, and what to do next.

The goal is not to display more information.
The goal is to remove delay between "we want this clinician" and "they can start."

## Problem & Mission

### Problem

Clinician hiring and credentialing slow down because decision-makers do not get a clear answer fast enough.

Most systems produce fragments:
- profile data
- source data
- partial verification
- manual follow-up
- scattered blockers

That creates the real problem:
- employers keep asking more questions
- clinicians repeat work
- start dates slip
- trust is implied before it is earned

VitalCV must avoid shipping confidence without certainty.

### Mission

Tell the truth clearly enough for someone to act.

VitalCV should help an employer answer:
- Can I move forward right now?
- What blocks me?
- What is safe to do next?

## Product Thesis

VitalCV is not:
- a platform
- a network
- a broad intelligence layer
- a better CV

VitalCV is:
- the layer where hiring decisions stop being delayed

The core flow is:

NPI → readiness → passport → employer review → decision → start

But the real product is not the passport.

The real product is the moment an employer stops asking questions.

## Strategic Positioning

### From information product to decision product

#### Information product
- shows data
- shows sources
- shows readiness

#### Decision product
- tells employer if they can move forward
- shows blockers clearly
- recommends the next action
- reduces repeated verification work

VitalCV must be built as a decision product.

## Target Audience

### Primary user

Employer-side reviewer.

This includes:
- recruiters
- credentialing teams
- hiring managers
- operations staff
- compliance reviewers

This is the first-class user.

### Secondary user

Clinician.

The clinician side matters because it feeds the employer decision surface:
- identity
- readiness
- passport sharing
- correction or follow-up

### Internal user

Admin or operations user managing:
- source coverage
- truth states
- audit rules
- system health

## Product Hierarchy

### Layer 1: Employer Decision Surface
This is the product.

Everything else exists to support this layer.

### Layer 2: Supporting objects
- Passport
- Readiness summary
- Source coverage truth

### Layer 3: Hidden for now
- Graph
- AI
- Platform story
- Developer story
- Intelligence layer

### Operating rule

If it does not help an employer decide faster, it is not first-class.

## Core Features

### 1. NPI Entry
- Search by NPI
- Start the workflow immediately
- Reach first value in seconds

### 2. Decision Readiness Summary
Top-level employer answer.

Shows:
- Ready / Partial / Blocked
- Can proceed / cannot proceed
- key blockers
- next best action
- freshness

This replaces vague confidence with usable decision posture.

### 3. Source Coverage Panel
Primary UI object.

Shows, by category:
- verified
- not verified
- requires institutional access
- stale
- unavailable
- contradicted

Example categories:
- Identity
- Sanctions
- Licensure
- DEA
- Board certification

### 4. Readiness View
Clinician-facing and reviewer-facing summary of current status.

Shows:
- what is verified
- what is not
- what can be acted on
- what still requires follow-up

### 5. Passport
A reusable decision state.

Not just a profile.
Not just a data packet.

The passport should capture:
- current decision posture
- supporting evidence
- missing items
- provenance
- freshness
- share scope

### 6. Employer Decision Surface
The commercial core.

Must answer in under a minute:
- Can I move forward?
- What blocks me?
- What is proven?
- What is missing?
- What should I do next?

Actions:
- Accept as head start
- Request update
- Route to credentialing

### 7. Truth Contract Engine
Every visible claim must map to:
- source
- freshness
- confidence level
- decision-grade yes/no
- failure state

This must govern:
- UI
- API
- exports
- marketing language

### 8. Live / Pilot / Future State Disclosure
The product must visibly separate:
- what is live now
- what is pilot-only
- what is future-state

Visible truth builds trust faster than fake completeness.

## Live Product Framing

### LIVE NOW
- NPPES
- OIG
- readiness (partial)
- passport (partial)

### PILOT
- FSMB / Nursys where available
- employer acceptance workflow

### FUTURE
- NPDB
- DEA
- ABMS
- monitoring
- graph
- intelligence

This framing must appear in product and marketing.

## High-Level Tech Stack

### Web app
Why:
- employer review is dense
- decision-making is desktop-heavy
- trust surfaces need room for evidence and actions

### Component-based design system
Why:
- trust states must stay consistent
- decision patterns must repeat cleanly
- status language cannot drift

### Secure backend API
Why:
- centralizes truth logic
- enforces claim rules
- supports future source integrations

### Relational database
Why:
- structured fit for clinicians, claims, sources, passports, reviews, and audit events
- easier operational auditability

### Secure file and export storage
Why:
- supports passport sharing
- supports audit packets
- supports decision snapshots

### Role-based authentication
Why:
- employer, clinician, and admin need distinct access
- sharing must be scoped and traceable

## Conceptual Data Model

### 1. Clinician
Identity anchored to NPI.

### 2. Claim
A statement presented by the product.

Examples:
- identity verified
- OIG clear
- license not verified
- DEA missing

Each claim includes:
- status
- source
- freshness
- confidence level
- decision-grade yes/no
- failure state

### 3. Source Record
Tracks where a claim came from.

Includes:
- source name
- retrieval time
- access type
- source result
- freshness window

### 4. Decision Readiness State
The current action posture for a clinician.

Examples:
- Ready
- Partial
- Blocked

Includes:
- safe actions
- unsafe actions
- blockers
- required follow-up

### 5. Passport
A reusable shareable decision state.

Includes:
- summary
- supporting claims
- timestamps
- share scope
- employer-facing context

### 6. Employer Review
Action taken by reviewer.

Includes:
- current posture
- action selected
- notes
- timestamp
- escalation path

### 7. Audit Event
Tracks:
- searches
- shares
- state changes
- review actions
- exports
- admin overrides

## UI Design Principles

### Lead with the decision
Do not start with profile details.

Start with:
- can proceed?
- blockers
- next step

### Make source truth visible
Source coverage is not secondary.
It is a first-class object.

### Separate current capability from future ambition
Never blur pilot or future features into the live promise.

### Show safe action boundaries
If the system cannot support immediate start, say so clearly.

### Use operational language
Favor:
- can proceed
- requires review
- not decision-grade

Avoid:
- comprehensive
- complete
- fully verified
unless fully earned

### Design like a cockpit
The employer screen should feel like a control surface, not a profile page.

### Reduce uncertainty on every screen
Every page should answer:
- what is true
- what is missing
- what can happen next

## Security & Compliance Notes

### Core requirements
- encryption in transit and at rest
- role-based access control
- audit logging
- scoped sharing
- export controls
- admin visibility into source health

### Compliance posture
Assume:
- strong privacy review
- minimum necessary data use
- traceable provenance
- retention rules
- deletion rules
- disclosure of incomplete or limited checks

### Truth requirement
No claim should appear in the product unless it has:
- source mapping
- freshness rule
- user-facing failure state
- decision-grade definition

## Phased Roadmap

### MVP
Goal:
prove that one recruiter can move faster with one clinician.

Includes:
- NPI entry
- source truth panel
- decision readiness summary
- passport
- employer decision surface
- basic actions
- audit trail
- visible live/pilot/future framing

Success signal:
A recruiter sees the output and says, "Yes, I can move forward," or clearly explains what is missing.

### V1
Goal:
strengthen operational use.

Includes:
- better blocker logic
- conditional proceed paths
- richer exports
- improved source monitoring
- better routing to credentialing
- stronger pilot integrations

Success signal:
Decision time decreases and follow-up becomes more structured.

### V2
Goal:
expand coverage without losing truth clarity.

Includes:
- more source integrations
- monitoring
- deeper organizational workflows
- controlled intelligence features
- team dashboards

Success signal:
VitalCV becomes the default decision layer for clinician readiness.

## Risks & Mitigations

### Risk: implied certainty
The UI sounds more complete than the evidence supports.

Mitigation:
- source truth panel first
- visible live/pilot/future framing
- decision-grade labeling

### Risk: product sprawl
Too many ideas compete with the wedge.

Mitigation:
- employer decision surface stays first-class
- hide graph, AI, platform, and developer concepts for now

### Risk: unclear actionability
Users still do not know what to do next.

Mitigation:
- top-of-screen action posture
- safe vs unsafe actions
- next step always visible

### Risk: source limitations damage trust
Missing or inaccessible sources feel like product weakness.

Mitigation:
- make limitations visible
- make degraded states intentional
- tell the truth directly

## Future Expansion Ideas

Only expand after the decision surface is boringly strong.

- conditional onboarding workflows
- team routing and approvals
- monitoring and alerts
- wider source coverage
- org dashboards
- AI summarization that never hides evidence
- partner API access

## Final Operating Doctrine

VitalCV becomes powerful when it behaves like a system that tells the truth clearly enough for someone to act.

Every screen must reduce uncertainty.

Every claim must earn its confidence.

Every workflow must move the employer closer to "yes," "not yet," or "route it."
