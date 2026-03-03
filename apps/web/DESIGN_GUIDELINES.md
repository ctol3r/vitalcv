# VitalCV DESIGN_GUIDELINES

## The Antigravity Principle

The Antigravity UI/UX System (codename "Liquid Glass") is designed to reduce friction and inspire absolute trust. It relies on smooth transitions, structural depth through transparency (glassmorphism), and a warm minimalist palette to guide the user naturally through their verifying flows.

## Global Style Rules

1. **Colors and Semantic Meaning**:
   - Instead of stark white, backgrounds are warm "Cloud Dancer" `oklch(0.957 0.008 90)`.
   - Instead of pure black, text is "Warm Charcoal" `oklch(0.22 0.01 60)`.
   - The Trust Band maps to verified levels (L0 to L3). Ensure Red (`--trust-red`), Yellow (`--trust-yellow`), and Green (`--trust-green`) are strictly matched with compliance and verifiable statuses, not randomly used.

2. **Depth over Outlines**:
   - Utilize `.glass` and `.glass-heavy` utility classes for surfaces. Do not use stark borders unless grouping interactive list items.
   - Combine `.motion-glass-card` for an elite interactive lift transition.

3. **Motion Constraints**:
   - Stagger layout elements on mount using `useScrollReveal` or Framer Motion variant stagger patterns.
   - Use `easings.easeOut` `(0.2, 0.8, 0.2, 1)` for general lift semantics (like hovering cards).
   - Durations should adhere to `durations.normal` (340ms) for most elements to match CSS utility transitions.

4. **Typography hierarchy**:
   - Large hero titles: Setup to `font-heading` (`font-fraunces`).
   - Normal UI: `font-sans` (`font-inter`).
   - Ensure a robust contrast ratio inside dark modes, which swap to a softer "Warm Near-Black" surface (`oklch(0.18 0.012 60)`).

5. **Responsiveness and Layout**:
   - Adhere to Tailwind breakpoints.
   - For vertical lists of high trust elements (timelines, verifier logs), ensure padding follows `gap-4` or `gap-6` standard increments.

## Tailwind Implementation

We use Tailwind v4 (`@theme inline`), which bypasses the rigid `tailwind.config.js` token generation in favor of defining native CSS variables that dynamically generate utility classes. Always declare tokens in `@theme inline` within `globals.css` if they map strictly to CSS native features, and map into TypeScript via `design/tokens.ts` for raw math/Framer Motion.

## Snippet Examples

**Creating a Glass Card with Framer Motion (Example)**:

```tsx
import { motion } from 'framer-motion';
import { cardReveal } from '@/animations/motionVariants';

function MyDynamicCard() {
  return (
    <motion.div
      variants={cardReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      className="glass motion-glass-card p-6 rounded-2xl"
    >
      <h3>Premium Component</h3>
    </motion.div>
  );
}
```
