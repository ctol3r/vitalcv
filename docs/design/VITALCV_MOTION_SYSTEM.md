# VitalCV Motion System — Evidence in Motion

**Status:** Founder-directed design contract  
**Date:** 2026-07-29  
**Branch:** `feat/npi-profile-composer`

## Intent

VitalCV should use cinematic, systems-oriented motion to make complex healthcare career and credential operations understandable.

The reference is the motion grammar used on Palantir's Foundry platform page: diagrams behave like living systems, relationships become visible, and scroll progression reveals how data becomes action. VitalCV must adopt that level of clarity and confidence without copying Palantir's visual assets, timing, layouts, code, or brand expression.

Motion is not decoration. Every animation must explain one of four product events:

1. evidence arrived from a named source;
2. provenance moved with a fact;
3. a blocker was resolved or escalated;
4. a clinician advanced toward an application, acceptance, renewal, license, or start.

## Creative principle

**A record that moves.**

VitalCV begins as a warm paper record, then reveals the living network around it: clinician, source, issuer, employer, requirement, consent, decision, and start.

The visual contrast is deliberate:

- the record is calm, legible, and document-like;
- the system around it is kinetic, responsive, and operational;
- source-confirmed state uses green only after a real source result;
- indigo remains the interaction and editorial accent;
- motion never changes or implies provenance by itself.

## Signature motion language

### 1. Evidence trails

A thin line draws from a named source node into the clinician record. The line carries a small receipt marker containing source, observation time, and status.

Use for:

- NPPES profile composition;
- state-board license checks;
- OIG/LEIE and PECOS reads;
- issuer responses;
- document-to-field extraction;
- employer packet assembly.

Rules:

- the source label appears before the destination changes;
- the destination field does not turn source-confirmed until the response is complete;
- failed and unavailable sources end in a visible neutral or blocked state, never a false success.

### 2. Provenance pulse

When a field is added or updated, the field and its provenance badge animate as one unit. The badge cannot appear later as an unrelated flourish.

Recommended sequence:

1. source or author becomes visible;
2. connector draws;
3. value resolves;
4. provenance badge settles;
5. limitation remains inspectable.

### 3. Mission path

A start, renewal, licensing, or application mission is shown as a connected operational path rather than a generic progress bar.

Nodes:

- clinician action;
- VitalCV action;
- issuer action;
- employer action;
- external source read;
- decision;
- start or completion.

Edges may animate only while work is actually active. Completed paths become calm and static.

### 4. Blocker illumination

VitalCV should make the next constraint visually obvious.

- unresolved blocker: outlined amber/neutral node with a restrained pulse;
- active escalation: a single traveling indicator along the relevant edge;
- resolved blocker: pulse stops, evidence receipt appears, downstream path opens;
- system outage: motion stops and the interface names the system state.

Never use alarming red animation for ordinary missing information.

### 5. Packet assembly

The employer packet should assemble from independently attributed evidence lanes.

Sequence:

1. identity spine enters;
2. source receipts align beside their facts;
3. clinician-selected disclosure boundary closes around the packet;
4. issuer requests still in flight remain outside the completed boundary;
5. employer review view opens with gaps, limitations, and suggested order intact.

The animation must communicate that the employer receives a head start, not a final credentialing decision.

### 6. Agent orchestration

The Vital Agent should be shown as a coordinator across existing objects, not a glowing chatbot orb.

- the agent proposes a plan;
- affected mission nodes highlight;
- planned actions appear before execution;
- actions requiring consent pause visibly;
- executed actions produce receipts;
- failures remain on the graph with reason and owner.

MATCHA opportunity intelligence uses the same system: preference, evidence, requirement, opportunity, and application are connected rather than presented as unexplained AI magic.

## Surface-specific direction

### Homepage

Preserve the NPI-first hero. After a valid NPI lookup, the result should transition into a compact living record:

- source line draws from NPPES;
- identity fields resolve in sequence;
- the four-step spine activates without auto-advancing;
- the final hospital-review scene shows a consented packet crossing into review.

The homepage remains readable and complete with JavaScript disabled.

### NPI profile composer

The compose experience should feel like VitalCV is building an honest first draft in front of the clinician.

- source-backed identity resolves first;
- AI narrative appears second and is visibly labeled `AI_DRAFT`;
- unknowable sections remain outlined gaps;
- approve, edit, reject, and hide actions produce explicit state transitions;
- nothing animates into a verified state because the clinician approved AI-written text.

### Clinician vault

Documents enter a calm intake lane, are classified, and then branch into extracted candidate fields. A confidence indicator may animate, but every extracted field remains pending clinician review until confirmed.

### Licensing intelligence

State comparisons should use an animated requirement graph and route map:

- current licenses anchor the view;
- target states reveal requirements;
- reusable evidence connects automatically;
- gaps remain separate;
- cost and elapsed-time estimates appear as contextual labels, not certainty.

### Employer Start Mission

The employer view should feel like an operational command room without becoming visually noisy.

- one clinician, one mission, one next blocker;
- issuer and source status update in place;
- the start-date risk path is visible;
- accepted evidence becomes calm;
- exceptions stay highlighted until owned or resolved.

### Issuer Exchange

Communication events should animate as a durable thread:

request sent → delivered → opened → acknowledged → response received → reconciled → closed.

Retries and channel changes branch from the original request rather than replacing history.

### Opportunity marketplace

Use restrained motion for result changes, comparison, readiness matching, and Apply with VitalCV packet preparation. Do not animate every card or create a swipe-only experience.

## Motion tokens

Use CSS custom properties as the default implementation layer.

```css
:root {
  --vt-motion-instant: 90ms;
  --vt-motion-fast: 160ms;
  --vt-motion-standard: 280ms;
  --vt-motion-deliberate: 520ms;
  --vt-motion-scene: 900ms;
  --vt-motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --vt-motion-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --vt-motion-path: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Guidelines:

- micro-feedback: 90–160ms;
- panel and field transitions: 160–280ms;
- path drawing and relationship changes: 280–520ms;
- narrative scene transitions: up to 900ms;
- avoid continuous looping except an active, real operation;
- never block user input until a cinematic sequence ends.

## Interaction requirements

- scroll-linked motion must not hijack scrolling;
- no mandatory horizontal scroll;
- keyboard interaction must expose the same states as pointer interaction;
- focus must never be moved only for animation;
- animation may not hide an action or result from assistive technology;
- server and no-JavaScript output must contain the complete reading order;
- route changes should prioritize immediate content paint over page-transition spectacle.

## Reduced-motion contract

Under `prefers-reduced-motion: reduce`:

- all path drawing resolves immediately;
- parallax and camera movement are removed;
- staged sequences become simple opacity changes or no animation;
- loading states remain understandable without motion;
- no element loops, pulses, floats, or travels;
- status and provenance remain fully visible.

Reduced motion is a first-class version of the design, not a fallback afterthought.

## Performance contract

- prefer CSS transforms, opacity, SVG stroke-dash animation, and lightweight Canvas only where it clearly adds meaning;
- avoid shipping a heavy 3D engine for decorative homepage motion;
- lazy-load below-fold scene assets;
- pause observers and animations when off-screen;
- maintain stable layout and avoid cumulative layout shift;
- target 60fps on modern mobile hardware and graceful static rendering on low-power devices;
- animation errors must never prevent profile, evidence, or mission content from rendering.

## Implementation order

1. NPI composer source-to-record animation.
2. Homepage four-step evidence path refinement.
3. Packet assembly and employer handoff scene.
4. Vault Smart Import review animation.
5. Mission path and blocker illumination.
6. Issuer communication timeline.
7. Vital Agent plan/approval/receipt visualization.
8. Licensing comparison and requirement graph.

## Acceptance tests

Every animated surface must pass:

- desktop and 360px mobile;
- keyboard-only operation;
- reduced-motion mode with zero nonessential running animation;
- no-JavaScript complete reading order where the route is public or progressively enhanced;
- no horizontal overflow;
- source failure and unknown-state behavior;
- animation timing assertions for dependent sequences;
- performance budget and layout-shift checks.

## Non-goals

- copying Palantir's assets, proprietary diagrams, page structure, or code;
- decorative particle fields or glowing AI clichés;
- auto-advancing carousels;
- motion that implies verification, completion, or certainty not supported by the underlying state;
- making a high-pressure credentialing workflow harder to scan.
