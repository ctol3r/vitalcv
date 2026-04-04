## Site Map

### Public
- Homepage
- Source Coverage
- Pilot / Contact

### App
- NPI Entry
- Decision Surface
- Passport
- Readiness Detail
- Review Queue
- Admin Source Monitor
- Audit Log

## Purpose of Each Page

### Homepage
Explain the wedge in one sentence and drive NPI-based evaluation.

### Source Coverage
Show exactly what VitalCV can verify now, what is limited, and what requires institutional access.

### Pilot / Contact
Capture employer and pilot interest without broad platform storytelling.

### NPI Entry
Start the workflow fast and route into a clinician decision state.

### Decision Surface
Primary employer review cockpit. Shows whether the employer can move forward and what to do next.

### Passport
Reusable decision state that can be shared across employers or teams.

### Readiness Detail
Expanded view of claims, source truth, freshness, and missing items.

### Review Queue
Employer-side list of clinicians awaiting decision or follow-up.

### Admin Source Monitor
Internal view of source health, freshness, outages, and trust risks.

### Audit Log
Trace decision-relevant actions across searches, shares, reviews, and overrides.

## User Roles and Access Levels

### Employer Reviewer
Can:
- search by NPI
- view decision surface
- view passport
- view readiness detail
- choose next action
- add notes

Cannot:
- alter truth rules
- override source definitions

### Employer Admin
Can:
- do everything employer reviewer can
- manage team access
- route to credentialing
- review queue state
- review exports

### Clinician
Can:
- view own readiness
- view passport
- share passport
- respond to update requests where supported

Cannot:
- modify source truth directly
- change employer review state

### Internal Admin
Can:
- manage source configurations
- review outages and stale states
- audit system health
- review truth contract mappings
- inspect audit events

## Primary User Journeys

### Journey 1: Employer decides whether to move forward
1. Enter NPI
2. Review Decision Surface
3. Accept as head start, request update, or route to credentialing

### Journey 2: Clinician shares reusable decision state
1. Open passport
2. Review current decision posture and missing items
3. Share readiness packet

### Journey 3: Employer checks what is actually verified
1. Open Source Truth section
2. Scan verified, missing, and access-limited categories
3. Decide whether current evidence is enough to proceed

### Journey 4: Admin handles trust degradation
1. Open Admin Source Monitor
2. Review stale, unavailable, or failing sources
3. update rules or communicate impact internally

## Page-Level Flow Notes

### Homepage flow
1. Hero: "Check if a clinician is ready to start — from NPI in seconds"
2. NPI input
3. readiness preview
4. 5-step explanation
5. source truth panel
6. pilot CTA

### Decision Surface flow
1. Ready / Partial / Blocked
2. can proceed or not
3. blockers
4. next step
5. verified vs missing
6. timestamps and evidence
7. action buttons

### Passport flow
1. decision posture
2. evidence summary
3. source truth
4. freshness
5. sharing controls

### Readiness Detail flow
1. current readiness state
2. claim-by-claim status
3. source mapping
4. decision-grade labels
5. missing items and follow-up

## Product Rules Reflected in the Flow

- employer decision comes first
- source truth is always visible
- passport supports decision reuse
- readiness supports understanding
- future platform ideas stay out of the primary flow
- every major page ends in a clear next action
