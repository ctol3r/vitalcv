# DL-001 — measurements

Method: Playwright chromium, iPhone 14 device profile (390pt viewport) and desktop
1440×900. Before = production `vitalcv.com/onboarding` 2026-08-07. After = this
branch on a local dev server, same measurement code.

## Before (production)

```json
{
  "signinRect":   { "x": 256.83, "y": 606.13, "w": 41.67, "h": 17 },
  "feedbackRect": { "x": 256.58, "y": 596,    "w": 109.42, "h": 44 },
  "intersects": true,
  "signinClickBlocked": true
}
```

`document.elementFromPoint` at the Sign-in link's center resolved to the feedback
chip — the tap opened the reporter, not sign-in.

## After (this branch, mobile)

```json
{
  "chipRect": { "x": 322, "y": 596, "w": 44, "h": 44 },
  "tapFloorMet": true,
  "labelVisibleOnMobile": false,
  "chipCoversProductionSigninCenter": false,
  "clearanceFromProdSigninRightEdge": 23.5
}
```

## After (this branch, desktop 1440)

```json
{ "rect": { "w": 109.42, "h": 44 }, "labelVisible": true, "text": "Feedback" }
```

Desktop geometry and label are byte-identical to production. The accessible name
(`aria-label="Send feedback"`) is unchanged on every viewport, so collapsing the
visible label does not rename the control.

Local caveat: the after-capture on `/onboarding` shows the degraded
"Couldn't check your workspace" state because local dev has no Clerk
middleware — a local-environment artifact, not part of this change. The chip is
global chrome; its geometry is identical on every route
(`after-mobile-trust-chip-44px.png` shows a fully-rendered page).
