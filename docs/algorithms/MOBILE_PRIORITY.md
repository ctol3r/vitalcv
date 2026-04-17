# VitalCV Mobile Priority Lock

## 1. Mobile Surfaces First
The system's core product surface is the **Clinician Passport** and the **Employer Decision View** accessed via mobile devices.
All architectural and UX decisions must prioritize these mobile surfaces.
- **In-Scope**: Homepage (NPI entry), Passport View, Decision/Action View.
- **Ignored (Secondary)**: Developer Portal, Explore/Marketplace Complexity, Admin Surfaces.

## 2. Reduction Rules
On mobile viewports:
- **One Primary Action**: Every screen must have exactly ONE dominant action button.
- **No Dense Layouts**: Tables and complex grids are forbidden. Use vertical stacking.
- **No Side-by-Side Panels**: Split-pane or side-by-side data reveals are disallowed on mobile contexts.

## 3. Strict Mobile Flow
The user journey must follow a deterministic, linear flow:
`NPI Input` → `Passport Rendered` → `Decision Displayed` → `Action Taken`

**NO branching** is permitted within the core mobile loop.
