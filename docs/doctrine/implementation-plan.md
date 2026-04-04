## Build Sequence

This plan is built around one rule:

Do not ship more information.
Ship faster decisions.

The company should execute in this sequence.

## Phase 0: Lock the company doctrine

### Step 1: Freeze the product sentence
Write and approve one sentence:

"VitalCV helps employers decide if a clinician can move forward, using source-backed readiness from NPI."

This sentence governs:
- homepage
- product
- sales
- API language
- internal prioritization

Output:
- approved product sentence

### Step 2: Freeze the hierarchy
Set the product order:

1. Employer Decision Surface
2. Passport
3. Readiness
4. Source truth
5. Everything else later

Output:
- approved hierarchy doc

### Step 3: Kill non-core language
Remove or demote:
- platform
- ecosystem
- network
- intelligence layer
- developer story

These are not first-class yet.

Output:
- forbidden and deprioritized language list

### Step 4: Define Live / Pilot / Future
Create the public truth table.

#### LIVE NOW
- NPPES
- OIG
- readiness partial
- passport partial

#### PILOT
- FSMB / Nursys where available
- employer acceptance flow

#### FUTURE
- NPDB
- DEA
- ABMS
- monitoring
- graph
- intelligence

Output:
- truth disclosure framework

## Phase 1: Build the trust foundation

### Step 5: Create the Truth Contract
Every claim must have:
- source
- freshness
- confidence level
- decision-grade yes/no
- failure state

No exceptions.

Output:
- truth contract schema
- approved status vocabulary

### Step 6: Standardize product vocabulary
Approved status labels:
- Verified
- Not verified
- Requires institutional access
- Stale
- Unavailable
- Contradicted

Approved decision labels:
- Ready
- Partial
- Blocked

Approved action labels:
- Accept as head start
- Request update
- Route to credentialing

Output:
- language system

### Step 7: Define safe actions
For each decision state, define what a reviewer can safely do.

Example:
- Ready → proceed
- Partial → proceed with caution or route
- Blocked → do not proceed

Output:
- safe action matrix

## Phase 2: Design the actual product

### Step 8: Design homepage around one promise
The homepage must answer:
"What happens if I enter an NPI?"

Required order:
1. Hero
2. NPI input
3. readiness preview
4. 5-step flow
5. source truth panel
6. pilot CTA

Output:
- homepage wireframe
- homepage copy

### Step 9: Design Source Truth Panel first
This is non-negotiable.

It must show, by category:
- source
- current status
- last checked
- decision-grade yes/no
- access limitation if any

Output:
- source truth component
- truth-state variants

### Step 10: Design Employer Decision Surface second
This is the revenue surface.

Top block must include:
- Ready / Partial / Blocked
- can proceed or not
- estimated delay if known
- blockers
- next step

Then:
- verified vs missing
- timestamps
- evidence links

Then:
- actions

Output:
- employer surface wireframe
- employer action model

### Step 11: Design Passport third
The passport exists to preserve and share a reusable decision state.

It must include:
- decision posture
- evidence summary
- missing items
- provenance
- freshness
- share scope

Output:
- passport wireframe
- passport share flow

### Step 12: Design Readiness fourth
This supports the passport and employer surface.

It should summarize:
- what is known
- what is not
- what is safe to act on

Output:
- readiness page wireframe

## Phase 3: Define data and operations

### Step 13: Model the core objects
Required objects:
- Clinician
- Claim
- SourceRecord
- DecisionReadinessState
- Passport
- EmployerReview
- AuditEvent

Output:
- conceptual data model
- field definitions

### Step 14: Define source rules
For each source define:
- what it can prove
- what it cannot prove
- refresh cadence
- failure state
- decision-grade value

Output:
- source capability matrix

### Step 15: Define degraded states
Design explicit states for:
- source down
- source stale
- access required
- contradiction
- partial profile
- refresh in progress

Output:
- degraded state map
- UI copy set

## Phase 4: Build the MVP in the right order

### Step 16: Build NPI entry
- input
- validation
- immediate routing into clinician state

Checkpoint:
user reaches first useful screen fast

### Step 17: Build Source Truth Panel
Build this before broader profile details.

Checkpoint:
user can see what is and is not actually verified

### Step 18: Build Decision Readiness summary
Top-level decision state becomes visible.

Checkpoint:
user understands current action posture in seconds

### Step 19: Build Employer Decision Surface
Add:
- blockers
- next step
- action controls

Checkpoint:
reviewer can choose an action without additional explanation

### Step 20: Build Passport
Add:
- reusable share view
- export
- scoped sharing

Checkpoint:
decision state is portable

### Step 21: Build audit events
Track:
- NPI search
- truth panel exposure
- share
- review action
- export
- admin override

Checkpoint:
all decision-relevant actions are traceable

## Phase 5: Validate with real humans

### Step 22: Run the only test that matters first
Take one clinician.
Generate one passport.
Show one recruiter.

Ask:
"Would you move forward based on this?"

Then ask:
"What is missing for you to say yes?"

Output:
- real blocker list
- real roadmap inputs

### Step 23: Run monthly 3-user test
Use:
- one recruiter
- one credentialing or operations person
- one clinician

Ask them to:
- review the decision state
- interpret source truth
- choose a next action

Log:
- where they hesitate
- which claim they distrust
- what they still ask for

Output:
- monthly confusion log
- top 3 fixes

## Timeline With Checkpoints

### Weeks 1–2
- product sentence
- hierarchy
- truth disclosure
- truth contract

Checkpoint:
company knows exactly what it is building

### Weeks 3–4
- homepage
- source truth panel
- employer decision surface
- passport wireframes

Checkpoint:
main surfaces are clear in low fidelity

### Weeks 5–8
- NPI flow
- source truth panel
- decision readiness
- employer surface
- passport
- audit events

Checkpoint:
one recruiter can use the product end to end

### Weeks 9–10
- degraded states
- exports
- permissions
- wording QA

Checkpoint:
the product tells the truth even when data is incomplete

### Weeks 11–12
- recruiter testing
- usability fixes
- pilot launch prep

Checkpoint:
a pilot user can answer "move forward or not" quickly

## Team Roles

### CEO / product lead
Owns:
- doctrine
- wedge discipline
- scope cuts
- recruiter interviews

### Designer
Owns:
- source truth panel
- employer surface clarity
- action hierarchy
- degraded states

### Frontend engineer
Owns:
- stateful UI
- surface consistency
- decision flows

### Backend engineer
Owns:
- truth contract enforcement
- source logic
- audit events
- exports

### Operations / compliance advisor
Owns:
- claim validity
- source interpretation
- language risk review

## Operating Rituals

### Weekly doctrine review
Ask:
- did we build decision power or just more display?
- did we add anything that is not first-class?

### Weekly recruiter feedback review
Read verbatim what recruiters still need before saying yes.

### Bi-weekly truth audit
Review:
- source mapping
- freshness
- decision-grade logic
- failure states

### Monthly usability session
Three users.
Thirty minutes.
Top three confusions fixed first.

## Optional Integrations

Only after the core surface is trusted.

- credentialing systems
- ATS / HRIS
- notifications
- partner exports
- source expansion

Rule:
no integration can blur the truth model

## Stretch Goals

Pursue only after the employer surface wins.

### 1. Conditional onboarding workflows
### 2. Team routing and approval chains
### 3. Monitoring and alerts
### 4. Evidence summarization
### 5. API access

## Definition of MVP Done

The MVP is done when:
- a recruiter can view one clinician and make a next-step decision fast
- source truth is visible without digging
- missing data is explicit
- safe vs unsafe actions are clear
- the passport is reusable
- incomplete coverage does not feel deceptive
- the product passes the one-clinician, one-recruiter test

## Final Execution Rule

Sequence matters.

Build:
1. truth
2. decision
3. portability
4. scale

Not the other way around.
