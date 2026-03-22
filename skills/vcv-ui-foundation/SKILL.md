# VCV UI Foundation

Use this skill when working inside the VitalCV monorepo to implement the locked UI doctrine quickly and without drifting into a mixed design stack.

## Mission

Implement the VitalCV UI foundation so the product converges on:
- owned Radix/Tailwind primitives as the main runtime layer
- a single coherent visual language across public and clinician-facing surfaces
- Blueprint confined to dense internal workbench use cases
- Carbon-level accessibility discipline for tables and charts
- Ant-level enterprise workflow clarity for review states, forms, and operational flows
- Mantine-inspired interaction ergonomics without adopting Mantine as the dominant runtime layer

## Repo assumptions

- Monorepo root contains `apps/web`
- Web stack uses Next.js 15, React 19, Tailwind 4, Radix primitives, and local components
- Blueprint dependencies may already exist in `apps/web/package.json`
- Antigravity is a binding product constraint

## Hard rules

1. Do not introduce another dominant component framework.
2. Prefer local shared components in `apps/web/components/ui`.
3. Do not let Blueprint visual language leak into public, homepage, or clinician wallet routes.
4. Preserve the existing Antigravity token direction unless explicitly replacing it with a clearly superior owned system.
5. Do not add dashboard-first flows that violate `ANTIGRAVITY.md`.
6. Optimize for fewer primitives used more consistently.

## Primary objective

Create a practical migration path from the current mixed state toward a stable VCV UI foundation.

## Work order

### Step 1 — inventory
Audit `apps/web` for:
- Blueprint imports
- duplicated button/card/badge/input patterns
- routes using inconsistent chrome
- places where dense workbench behavior is truly necessary

Produce a compact summary before changing broad architecture.

### Step 2 — define shared primitives
Standardize or create owned primitives for:
- button
- badge
- card
- input
- textarea
- select/combobox shell
- tabs
- dialog
- sheet/drawer
- table shell
- empty state
- loading state
- status pill
- page header
- section header

Keep APIs simple and composable.

### Step 3 — define shell variants
Create clear layout guidance for four shell types:
- public shell
- clinician shell
- verifier shell
- ops shell

Each shell should declare:
- nav pattern
- page width behavior
- header behavior
- action zone pattern
- acceptable component density

### Step 4 — migrate high-visibility surfaces first
Prioritize:
1. homepage / core acquisition routes
2. NPI-first holder flow / readiness passport surfaces
3. verifier acceptance / review surfaces
4. ops workbench surfaces

### Step 5 — confine Blueprint
Where Blueprint remains, keep it behind internal/workbench boundaries.
If a Blueprint component is being used only because no local primitive exists, replace it with an owned primitive instead of expanding Blueprint usage.

### Step 6 — accessibility and consistency pass
Review:
- keyboard navigation
- focus states
- semantic tables
- readable status signals
- consistent spacing and typography
- empty/loading/error states

## Execution style

Be decisive. Avoid speculative rewrites. Prefer small, reviewable patches that move the UI toward consistency.

## Output format for each implementation pass

For each pass, provide:
1. what you changed
2. why it aligns with the doctrine
3. what remains inconsistent
4. next highest-leverage patch

## First concrete task

Start by auditing `apps/web` and produce a focused implementation plan that identifies:
- current Blueprint usage
- current owned primitives
- which routes are public vs clinician vs verifier vs ops
- the first 3 files or components to change for fastest visible improvement
