# Wave 68: Infrastructure Interface Redesign

## OBJECTIVE
Transform VitalCV's UI into a scientific infrastructure interface. The interface must communicate system intelligence, trust propagation, and operational control.

Design inspiration:
- Palantir Foundry
- Antigravity
- Obsidian Graph
- Andy Matuschak knowledge UI
- Stripe motion system

Do NOT modify backend logic. All changes are frontend only (apps/web).

## IMPORTANT CONTEXT
- Stack: Next.js 15, React 19, Tailwind CSS v4 (CSS-based @theme in globals.css, NO tailwind.config.ts), Framer Motion, TypeScript
- Frontend lives at: apps/web
- Existing components may exist from prior waves — check before creating duplicates
- Build must pass: `pnpm --filter web build`
- Target 60fps animations, no hydration errors

---

## TASK 1 — BACKGROUND FIELD
Create component: `apps/web/src/components/ui/BackgroundField.tsx`

Features:
- Soft gradient mesh background (CSS gradients or canvas)
- Floating particles (subtle, low count ~30-50)
- Cursor distortion effect (slight warp near cursor position)
- Should be a layout wrapper component usable on any page
- Performance: use requestAnimationFrame, avoid re-renders

## TASK 2 — CURSOR PHYSICS
Create: `apps/web/src/components/ui/CursorPhysics.tsx`

Features:
- Magnetic pull effect on interactive elements
- Soft glow following cursor
- Cursor gravity (elements subtly attract toward cursor)
- Use Framer Motion spring physics
- Must be a provider/context component wrapping the app

## TASK 3 — SYSTEM HERO
Create: `apps/web/src/components/hero/SystemConsole.tsx`

Replace the current hero section on the homepage with a system console display showing:
- Network status (online nodes, connected issuers)
- Verification throughput (animated counter)
- Trust artifact count
- Style: monospace font, terminal-inspired but clean/modern
- Animated typing effect for initial display
- Update the homepage to use this instead of the old hero

## TASK 4 — GRAPH FIRST UI
Make the trust graph the primary interface element.

Node types to display:
- clinician
- issuer  
- credential
- decision
- employer

Create or enhance: `apps/web/src/components/graph/TrustGraphPrimary.tsx`
- Large, interactive force-directed graph
- Distinct visual treatment per node type (color, icon, shape)
- Smooth physics simulation
- Should be prominently placed on the homepage

## TASK 5 — KNOWLEDGE PANEL
Create: `apps/web/src/components/graph/KnowledgePanel.tsx`

When clicking a graph node, open a side panel showing:
- Related credentials
- Related decisions
- Related issuers
- Animated slide-in from right
- Clean typography, structured data display

## TASK 6 — PACKET ANIMATIONS
Create: `apps/web/src/components/animations/PacketAnimations.tsx`

Animate along graph edges:
- Verification packets (blue pulse traveling along edge)
- Revocation signals (red pulse)
- Attestation flow (green pulse)
- Use SVG or canvas overlaid on the graph
- Configurable speed and frequency

## TASK 7 — LIGHT DESIGN SYSTEM
Replace dark theme with light infrastructure palette.

Update `apps/web/src/app/globals.css` @theme section:
- Light backgrounds (white, off-white, light gray)
- Accent colors: deep blue for trust, red for revocation, green for attestation
- Clean typography scale
- Subtle borders and shadows instead of dark contrasts
- Ensure all existing components work with the new palette

## TASK 8 — SCROLL MOTION
Create: `apps/web/src/components/motion/ScrollMotion.tsx`

Scroll-triggered animations:
- Section reveal (fade up + scale)
- Graph expansion on scroll into view
- Terminal typing animation for text sections
- Use Framer Motion `useInView` and `useScroll`
- Export reusable wrapper components

## TASK 9 — DEMO EXPERIENCE
Enhance `/demo` page to be the main interactive experience.

Flow:
1. Enter NPI number
2. Trust engine runs (animated processing)
3. Graph expands showing discovered trust relationships
4. Decision capsule appears with verdict
5. Revocation simulation option

Wire up existing demo components with the new UI system. Use mock data if real endpoints aren't available.

## TASK 10 — BUILD & QUALITY
- Ensure 60fps animations (use `will-change`, GPU-accelerated transforms)
- No hydration errors (use `"use client"` directives properly)
- Clean build: `pnpm --filter web build` must pass with zero errors
- No TypeScript errors
- Test all pages render correctly

---

## COMPLETION

When completely finished with all tasks and the build passes, run this command:
```
openclaw system event --text "Done: Wave 68 Infrastructure Interface Redesign complete — all 10 tasks implemented, build passing" --mode now
```
