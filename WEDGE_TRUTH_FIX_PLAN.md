# WEDGE TRUTH + CONTINUITY FIX EXECUTION PLAN

This plan adapts the master prompt into a strict execution sequence, prioritizing P0 survival fixes for the NPI → Readiness → Passport flow, eliminating fake states, and fixing backend tenant blockers.

## PART 1: REMOVE FAKE DEMO THEATER (P0)
1. **`/partners` and `/investors`**: Remove hardcoded `DEMO_METRICS` and fake logos (Epic, Cerner).
2. **Readiness Dashboard**: Remove synthetic identity replacement ("Sarah Chen, MD"). If the backend is degraded, the UI must show the *entered NPI* and an explicit "Degraded preview" state.

## PART 2: ENABLE ANONYMOUS WEDGE PATH (P0)
1. **Backend Routing (`apps/api/backend/src/routes/`)**: Modify `/api/identity`, `/api/ingest`, `/api/readiness`, and `/api/passport` to allow anonymous access (no `organization_context_required`).
2. **Gating**: Ensure that only `share`, `employer review`, and `export` actions strictly enforce the organization/tenant context guards.

## PART 3: FIX PASSPORT BREAK & CONTINUITY (P0)
1. **Error Interception**: In `/passport` or `/review`, intercept `organization_context_required` errors and replace them with a clean UI state: "Sign in to generate your full passport" or "Limited preview — full packet requires sign-in".
2. **Context Persistence**: Ensure the NPI carries through from Homepage → Readiness → Passport without dropping state or breaking routing.

## PART 4: FIX /REVIEW SURFACE & EMPLOYER ENTRY (P1)
1. **Layout Repair**: Restore the navigation bar and fix the compressed left-rail layout on the `/review` surface.
2. **Employer Workspace Setup**: If an employer hits `/review` or `/review/request` without setup, show a clear "Set up employer workspace" call-to-action instead of a generic backend error.

## PART 5: FIX SIGN-IN FLOW (P1)
1. **Auth UX**: Remove the "View Interrupted" error state during sign-in. Ensure the callback URL correctly routes the user back into the active wedge flow (not the homepage).

---
*Execution will occur in an isolated worktree to prevent colliding with any parallel operations, ensuring zero uncommitted state leaks.*
