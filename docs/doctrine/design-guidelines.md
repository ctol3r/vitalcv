## Emotional Tone

Feels like a calm decision cockpit for high-stakes hiring.

Minimal.
Precise.
Evidence-first.
Quietly confident.

The product should not feel like a glossy health-tech platform.
It should feel like a system that tells the truth clearly enough for someone to act.

## Design Doctrine

### Primary emotional goal
Reduce uncertainty.

### Primary visual goal
Make the next action obvious.

### Primary UX goal
Turn evidence into decision posture.

Every major screen should answer:
- Can I move forward?
- What blocks me?
- What do I do next?

## System Hierarchy

### First-class surface
Employer Decision Surface

### Supporting surfaces
- Passport
- Readiness
- Source Truth Panel

### Hidden for now
- graph
- intelligence
- developer concepts
- platform concepts

Design must reflect this hierarchy.

## Visual System

### Style anchors
- Apple Human Interface for restraint
- Linear for precision
- shadcn/ui for component discipline

### Interface character
The UI should feel like:
- a cockpit, not a profile
- a trust console, not a marketing showcase
- an operational system, not a speculative platform

### Visual principles
- less chrome
- stronger hierarchy
- no decorative ambiguity
- high signal density without clutter
- evidence before storytelling

## Typography

Use typography to express operational confidence.

### Type direction
Primary font:
- clean geometric or neo-grotesque sans-serif

Secondary accent:
- monospace only for evidence labels, IDs, timestamps, and source references

### Typographic hierarchy

#### H1
- 40px
- 700
- 48px line height

#### H2
- 32px
- 650
- 40px line height

#### H3
- 24px
- 600
- 32px line height

#### H4
- 18px
- 600
- 28px line height

#### Body Large
- 16px
- 400
- 26px line height

#### Body
- 15px
- 400
- 24px line height

#### Body Small
- 13px
- 400
- 20px line height

#### Caption
- 12px
- 500
- 16px line height

### Typography rules
- body copy stays highly readable
- avoid long paragraphs in app UI
- use bold for hierarchy, not decoration
- timestamps and source names must be easy to scan
- keep text widths controlled

## Color System

The palette must support truth, not branding theater.

### Core neutrals

#### Ink
- Hex: `#111827`
- RGB: `17, 24, 39`

#### Slate
- Hex: `#334155`
- RGB: `51, 65, 85`

#### Mist
- Hex: `#E5E7EB`
- RGB: `229, 231, 235`

#### Cloud
- Hex: `#F8FAFC`
- RGB: `248, 250, 252`

#### Paper
- Hex: `#FFFFFF`
- RGB: `255, 255, 255`

### Action and brand colors

#### Primary
- Hex: `#1D4ED8`
- RGB: `29, 78, 216`
- Use for primary actions and active states

#### Secondary
- Hex: `#0F766E`
- RGB: `15, 118, 110`
- Use for stable support states

#### Accent
- Hex: `#C084FC`
- RGB: `192, 132, 252`
- Use sparingly for emphasis only

### Semantic colors

#### Verified / Success
- Hex: `#15803D`
- RGB: `21, 128, 61`

#### Caution / Partial / Stale
- Hex: `#B45309`
- RGB: `180, 83, 9`

#### Blocked / Contradicted / Critical
- Hex: `#B91C1C`
- RGB: `185, 28, 28`

#### Access Required / Informational
- Hex: `#0369A1`
- RGB: `3, 105, 161`

#### Neutral / Unavailable
- Hex: `#64748B`
- RGB: `100, 116, 139`

### Truth-state mapping
Every trust state needs:
- color
- icon
- label
- supporting copy

States:
- Verified
- Not verified
- Requires institutional access
- Stale
- Unavailable
- Contradicted

### Accessibility rules
- never rely on color alone
- minimum WCAG AA contrast
- decision states must remain clear in light and dark mode

## Spacing & Layout

### Grid
Use an 8pt system.

### Design feel
- structured
- breathable
- fast to scan
- not dense for the sake of density

### Page priorities

#### Homepage
Flow:
1. Hero
2. NPI input
3. readiness preview
4. 5-step process
5. source truth panel
6. CTA

#### Employer Decision Surface
Flow:
1. top decision block
2. blockers
3. next step
4. verified vs missing
5. timestamps and evidence
6. actions

#### Passport
Flow:
1. decision posture
2. evidence summary
3. source truth
4. freshness
5. sharing controls

### Component spacing
- card padding: 20–24px
- stacked card gaps: 16–24px
- section gaps: 24–32px
- tables: 48–56px row heights

### Breakpoints

#### Mobile
- summary first
- stack all secondary detail
- keep action posture at the top

#### Tablet
- selective two-column layouts

#### Desktop
- primary design target
- decision block and source truth visible quickly

#### Large desktop
- increase whitespace, not density

## Motion & Interaction

Motion should communicate control.

### Motion tone
- calm
- exact
- purposeful

### Motion rules
- micro interactions: 150–200ms
- standard transitions: 200–250ms
- panel transitions: 240–300ms

### Interaction philosophy
Use motion to:
- confirm state change
- preserve context
- reduce stress
- make failure states feel intentional

Avoid:
- playful bounce
- decorative flourish
- dramatic shake

### Important motion patterns

#### NPI search
- immediate response
- purposeful loading
- stable layout while results load

#### State change
- chip transition fades cleanly
- no abrupt page shift

#### Share action
- calm success confirmation
- next action offered immediately

#### Error or degraded source
- clear inline explanation
- no alarmist animation

## Voice & Tone

The product voice must sound:
- exact
- operational
- calm
- supportive

It must not sound:
- futuristic
- inflated
- overconfident
- vague

### Writing rules
- tell the truth plainly
- state limitations visibly
- use action language
- write for stressed users
- do not market inside operational surfaces

### Microcopy examples

#### Hero
"Check if a clinician is ready to start — from NPI in seconds."

#### Source limitation
"This source requires institutional access."

#### Partial decision state
"Can proceed with caution. Two items still need review."

#### Blocked state
"Not safe to move forward yet. Critical verification is still missing."

#### Share success
"Readiness packet shared with current source status and timestamps."

## System Consistency

### Recurring patterns
- decision block
- blockers panel
- next-step panel
- source truth rows
- verified vs missing split
- evidence drawer
- action footer

### Terminology rules
One label per concept.

Use:
- Decision Readiness
- Passport
- Verified
- Not verified
- Requires institutional access
- Stale
- Unavailable
- Contradicted
- Ready
- Partial
- Blocked

Do not drift into synonyms.

### Decision-grade distinction
Visually distinguish:
- decision-grade evidence
- supporting context

This distinction should appear in:
- labels
- row styling
- summaries
- exports

## Accessibility

Accessibility is part of trust.

### Structural requirements
- semantic headings
- landmarks
- accessible tables
- accessible status chips
- announced expand/collapse states

### Keyboard requirements
- all major tasks keyboard accessible
- focus order follows visible hierarchy
- action buttons easy to reach

### Focus rules
- high-contrast visible rings
- no hidden focus states

### Comfort rules
- respect reduced motion
- support zoom
- maintain readable line lengths
- avoid visual overload in dense views

## Emotional Audit Checklist

- Does this screen reduce uncertainty?
- Does the answer appear before the detail?
- Is the source truth visible enough?
- Does the screen feel like a decision tool, not a profile?
- Are blockers impossible to miss?
- Would a recruiter know what to do next?
- Are limitations stated without embarrassment or hedging?

## Technical QA Checklist

- typography follows scale
- 8pt grid applied consistently
- contrast meets WCAG AA+
- trust states use icon + label + color
- decision-grade evidence is visually distinct
- motion stays within defined range
- reduced motion respected
- degraded states look intentional
- summary-first hierarchy preserved across breakpoints

## Adaptive System Memory

If previous VitalCV directions exist, preserve continuity where it strengthens trust.

Prefer reuse for:
- status colors
- decision block layout
- passport summary structure
- source truth row design

Change only when clarity improves.

## Design Snapshot Output

### Color palette preview

```txt
Ink         #111827
Slate       #334155
Mist        #E5E7EB
Cloud       #F8FAFC
Paper       #FFFFFF

Primary     #1D4ED8
Secondary   #0F766E
Accent      #C084FC

Verified    #15803D
Caution     #B45309
Critical    #B91C1C
Info        #0369A1
Neutral     #64748B
```

### Typographic scale

| Style      | Size | Weight | Line Height |
| ---------- | ---: | -----: | ----------: |
| H1         | 40px |    700 |        48px |
| H2         | 32px |    650 |        40px |
| H3         | 24px |    600 |        32px |
| H4         | 18px |    600 |        28px |
| Body Large | 16px |    400 |        26px |
| Body       | 15px |    400 |        24px |
| Body Small | 13px |    400 |        20px |
| Caption    | 12px |    500 |        16px |

### Spacing & layout summary

- 8pt grid
- 20–24px card padding
- 16–24px vertical gaps
- summary-first page structure
- desktop-first employer surface

### One-sentence emotional thesis

A calm decision cockpit that turns incomplete verification into clear action posture.

## Design Integrity Review

The design intent and technical system align when the interface behaves like a truth-first control surface instead of a broad product showcase. The strongest move is the elevation of source truth and decision posture above profile detail.

One improvement would strengthen harmony further:
create a dedicated visual pattern for "safe to act on" versus "informational only" evidence so actionability becomes instantly scannable.
