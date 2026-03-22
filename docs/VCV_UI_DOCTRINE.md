# VCV UI Doctrine

Status: locked
Owner: product + engineering
Purpose: define the runtime UI foundation and the non-negotiable implementation rules for VitalCV.

## Core decision

VitalCV will use **shadcn-style owned components on top of Radix + Tailwind** as the primary runtime UI foundation.

VitalCV will selectively borrow from other systems without turning the product into a mixed visual stack:

- **shadcn/ui** -> owned primitives, composition, code-level control
- **Mantine** -> interaction patterns, hooks mindset, combobox/search ergonomics
- **Blueprint** -> dense desktop workbench behavior for operations and verifier review only
- **Ant Design** -> enterprise information architecture, empty states, multistep review patterns
- **Carbon** -> accessibility rigor, semantic tables, chart governance

## Repo-grounded truth

The current web app already runs on Next.js 15, React 19, Tailwind 4, Radix primitives, and a custom Antigravity token layer. Blueprint is already installed in the web package and should be treated as an internal-workbench dependency rather than the main product language.

## Non-negotiable rules

### 1. One runtime visual language
The public product, clinician wallet, and primary shared surfaces must feel like one system.

Rules:
- no mixed vendor aesthetics on the same screen
- no Ant-style visual chrome as the default brand language
- no Blueprint visual chrome on public or clinician-facing routes
- no Carbon component imports solely for aesthetics

### 2. Antigravity stays in force
VitalCV does not earn the right to add ornamental surfaces.

Rules:
- replace friction instead of adding steps
- do not introduce dashboard-first flows that violate the antigravity contract
- every new UI surface must resolve a blocked moment, accelerate a decision, or expose reusable trust evidence

### 3. Owned component layer first
New shared UI must land in locally owned components.

Rules:
- prefer local components under `apps/web/components/ui`
- compose from Radix + Tailwind + class-variance-authority where needed
- treat external design systems as references, not masters

### 4. Blueprint is internal-only by default
Blueprint stays reserved for dense operational surfaces.

Allowed uses:
- verifier review workbench
- trust inspection consoles
- dense operations tables
- admin-only monitoring and analysis views

Not allowed:
- homepage
- clinician wallet
- primary onboarding flow
- public marketing surface

### 5. Mantine ideas, not Mantine takeover
Mantine should influence interaction design and utilities.

Allowed uses:
- combobox/search behavior
- hotkey thinking
- disclosure and interaction helpers
- responsive ergonomic patterns

Default rule:
- do not introduce Mantine as the dominant visual runtime layer

### 6. Carbon governs accessibility and charts
Carbon should shape how VitalCV handles semantic data displays.

Rules:
- tables must remain accessible and structurally correct
- charts must have clear labels, summaries, and tabular alternatives where appropriate
- complex data views must optimize clarity over decoration

### 7. Ant governs enterprise workflow discipline
Use Ant patterns where teams often get sloppy.

Rules:
- strong empty, loading, error, and extreme states
- clear review/confirm screens
- consistent form hierarchy and labeling
- predictable admin flows

## Product surface map

### Public marketing and employer-facing acquisition
Foundation:
- local owned primitives
- Antigravity token layer
- black/white infrastructure aesthetic

Must feel:
- minimal
- clear
- security-forward
- not toy-like
- not dashboard-heavy

### Clinician wallet / readiness passport
Foundation:
- local owned primitives
- Radix + Tailwind components
- Mantine-inspired search and input ergonomics
- Carbon accessibility discipline

Must feel:
- calm
- fast
- comprehensible
- obviously useful within seconds

### Verifier / employer / ops workbench
Foundation:
- same token layer and component ownership
- Blueprint-inspired dense desktop behaviors where justified
- Ant-style enterprise review patterns
- Carbon table and chart discipline

Must feel:
- efficient
- keyboard-friendly
- audit-ready
- decision-first

## Implementation rules for engineering

### Immediate keep
- Next.js 15
- React 19
- Tailwind 4
- Radix primitives
- class-variance-authority
- local token system
- local `components/ui` ownership

### Immediate avoid
- adding Mantine as the main component runtime
- adding Ant Design as the main component runtime
- adding Carbon components wholesale
- expanding Blueprint across the public product
- introducing a second token system

### Migration rule
If an existing screen is visually inconsistent, migrate it toward the owned component layer instead of importing another large UI framework to patch the problem.

## Phase order

### Phase 1 — foundation
- audit current Blueprint usage in `apps/web`
- identify shared primitives already present in `apps/web/components/ui`
- standardize button, card, badge, input, tabs, dialog, sheet, table, toast, command palette primitives
- define shell variants: public, clinician, verifier, ops

### Phase 2 — public and holder cleanup
- migrate homepage and core CTA flows to the owned component system
- simplify clinician-facing NPI-first flows
- remove mixed visual language from public and holder screens

### Phase 3 — workbench specialization
- confine Blueprint-heavy behavior to ops and verifier review surfaces
- build dense compare, inspect, and bulk action patterns where they materially improve speed

### Phase 4 — governance
- add accessibility checks for key tables and forms
- add storybook or visual review coverage for shared primitives
- document which components are canonical and which are legacy

## Definition of done
A UI change is done only when:
- it uses the shared owned component system or clearly justified workbench exceptions
- it does not violate the antigravity contract
- it improves clarity or speed for a blocked workflow
- it does not introduce a second visual language onto the same surface
- it remains accessible and testable

## One-line doctrine

VitalCV will be built on an owned Radix/Tailwind component system, guided by Antigravity, with Blueprint reserved for dense internal workbenches, Mantine influencing interaction ergonomics, Ant shaping enterprise workflow discipline, and Carbon governing accessibility and data visualization.
