# VCV Live Activation and Share System

Status: baked
Priority: immediate
Applies to: product, web, mobile, share flow, deployment visibility, interview mode, passport, employer handoff

This document locks in the latest activation and share-system priorities so they remain part of VitalCV going forward.

## Core principle

VitalCV must not remain an abstract product or a hidden product.
VitalCV must be:
- visible
- live
- demoable
- continuously updated
- connected to real-world trust transmission events

## Part 1 — Live activation is now a requirement

VitalCV must continuously expose meaningful product progress through the live product surface.

This includes:
- stable production experience on `vitalcv.com`
- visible preview / update awareness
- visible Interview Mode entry
- visible Passport entry
- visible updates surface
- visible labs / experiments surface
- accurate deploy context where appropriate

### Required live surfaces
- `/updates`
- `/labs`
- `/interview`
- `/passport`
- deploy visibility indicator

### Product rule
If a major new capability exists but cannot be seen or demoed easily from the live product, it is incomplete.

## Part 2 — Interview Mode and Passport must become real, not conceptual

The current visible entry points are important, but they are only the beginning.

### Interview Mode must evolve from demo to real system
Required next-stage behavior:
- detect authenticated clinician session
- fetch real trust state / readiness data
- show actual provider readiness, not just mock data
- expose a real share path
- connect directly to the Apply with VitalCV flow

### Passport must evolve from concept page to working object
Required next-stage behavior:
- fetch real provider identity / readiness / proof data
- represent the three visible objects clearly:
  - Passport
  - Proof
  - Start
- support mobile-first viewing and sharing

## Part 3 — Apply with VCV must become a real trust transmission event

The share flow must not remain a UI-only gesture.
It must become a structured, logged, recipient-aware event.

### Required organization context
Every share event must require:
- organization_id
- organization_name
- callback_url or equivalent destination
- purpose_of_use

### On Sign & Share, the system must:
1. create a signed readiness artifact
2. persist the event
3. trigger delivery to the requesting organization
4. fall back to email if webhook/callback is unavailable
5. confirm to the provider what was shared and where
6. return a structured status payload

### Provider confirmation must show
- shared with which organization
- when it was shared
- current delivery / acceptance status
- revoke option when supported

### Logging requirements
Every share event must record:
- who shared
- what was shared
- where it was sent
- when it was sent
- purpose_of_use
- delivery status

### Structured response shape
The share flow should resolve to an object shaped like:
- success
- recipient
- status
- artifact / event id
- timestamp

## Part 4 — Mobile-first is mandatory here too

Every activation and share surface must be mobile-capable.
This includes:
- Interview Mode
- Passport
- /updates
- /labs
- share confirmation
- share revoke flow

### Product rule
If a provider cannot clearly use or demonstrate VitalCV from a phone, the feature is incomplete.

## Part 5 — Demo doctrine

The one magical moment remains:
A clinician shares one thing.
An employer instantly sees what is proven, what is missing, and what can proceed.

Everything in this activation and share system must strengthen that moment.

## Part 6 — What is intentionally left out

The following are not priorities unless they directly support activation, Interview Mode, Passport, or the trust transmission system:
- extra decorative dashboard surfaces
- large CMS work
- speculative labs features without demo value
- broad backend expansions unrelated to real trust-state display or share delivery
- social mechanics or noisy feeds

## Part 7 — Immediate execution priorities

### Priority 1
Bind `/interview` to real authenticated trust-state data.

### Priority 2
Bind `/passport` to real authenticated Passport data.

### Priority 3
Complete the Apply with VitalCV event system:
- organization context
- artifact creation
- persistence
- webhook/email delivery
- provider confirmation
- delivery status

### Priority 4
Ensure the live product always surfaces what changed and what is being tested.

## Canonical statement

VitalCV must be visible on the live site, useful in real clinician moments, and capable of transmitting trust to real employer recipients with structured, logged, auditable delivery.
