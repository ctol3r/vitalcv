# Mobile-First Requirement for All Future VCV Waves

Status: baked
Applies to: every future wave, task bundle, product spec, implementation pass, and design decision

## Rule

Going forward, every desktop/web app development effort for VitalCV must include the corresponding mobile app development path.

This applies every time, for every:
- wave
- task bundle
- product spec
- implementation plan
- design review
- feature discussion

## What this means in practice

Every future deliverable must explicitly include:
- web / desktop surface implications
- mobile surface implications
- responsive behavior
- native app or app-shell implications where relevant
- mobile sharing flow
- mobile onboarding flow
- mobile interview-mode flow
- mobile Passport flow

## Minimum expectation

For every new feature or flow, planning must state:
1. what the desktop/web experience is
2. what the mobile experience is
3. whether the feature ships as:
   - responsive web
   - PWA-capable surface
   - native app feature
   - all three over time
4. what can ship fastest without violating product quality

## Product principle

VitalCV should feel native to where providers actually live.
That means mobile cannot be an afterthought or follow-up backlog item.

## Jobs discipline

If a feature feels magical only on desktop, it is incomplete.
If a feature cannot be clearly and beautifully expressed on mobile, it is not yet designed well enough.

## Planning instruction for OpenClaw and future contributors

Every future task bundle and wave must include mobile implementation considerations by default.
No separate reminder should be necessary.
