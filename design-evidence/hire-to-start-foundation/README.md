# Hire-to-start category foundation — visual evidence

- Date: 2026-08-14
- Creative owner: Codex, implementing the founder-selected hire-to-start category and copy contract
- Baseline: `c95e01b7a38e458008bf6022caceeef82d7f9463`
- Routes: `/employers`, `/pilot`
- Scope: copy and metadata inside the existing approved compositions; no shared chrome, component, motion, or layout system changes

## Claim check

Open and recently merged pull requests plus remote branches were searched for the hire-to-start category, canonical transaction, start mission, and integration-contract intents. The canonical decision and StartMission foundations were already merged; no open pull request owned this category-contract slice.

## Before and after

### Employers

| View | Before | After |
| --- | --- | --- |
| 1440 × 900 | [before desktop](before/employers-desktop.png) | [after desktop](after/employers-desktop.png) |
| 390 × 844 | [before mobile](before/employers-mobile.png) | [after mobile](after/employers-mobile.png) |

Additional final evidence: [768 × 1024](after/employers-tablet.png), [1728 × 1117](after/employers-wide.png), [reduced motion](after/employers-reduced-motion.png), [200% zoom equivalent](after/employers-zoom-200.png), and [keyboard focus](after/employers-keyboard-focus.png).

### Pilot

| View | Before | After |
| --- | --- | --- |
| 1440 × 900 | [before desktop](before/pilot-desktop.png) | [after desktop](after/pilot-desktop.png) |
| 390 × 844 | [before mobile](before/pilot-mobile.png) | [after mobile](after/pilot-mobile.png) |

Additional final evidence: [768 × 1024](after/pilot-tablet.png), [1728 × 1117](after/pilot-wide.png), [reduced motion](after/pilot-reduced-motion.png), [200% zoom equivalent](after/pilot-zoom-200.png), and [keyboard focus](after/pilot-keyboard-focus.png).

## Runtime verification

Both routes were loaded from the local production build. At 1440 × 900 and 390 × 844, each route measured zero horizontal overflow. Playwright reported zero browser console errors or warnings. Keyboard focus exposed the existing visible skip-link treatment. No motion behavior changed, so recordings are not applicable.

Deployment and exact-SHA production verification remain separate release gates.
