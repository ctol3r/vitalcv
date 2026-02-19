# ANTIGRAVITY CONTRACT — VitalCV

VitalCV exists to **remove workflow friction — not add it**.

This contract governs how the system behaves, how it is designed, and when it is allowed to appear.

---

## CORE PRINCIPLES

### 1. Appear Only at Unavoidable Friction

VitalCV must only present itself at moments where progress *cannot* continue without it.

Allowed appearance moments include:

- An employer **cannot start** a clinician due to missing or unverifiable credentials.
- A verifier needs **proof of authority** that cannot otherwise be established.
- A decision must be **auditable** and tied to a verifiable event.

VitalCV must **not** appear:

- During optional steps
- As a standalone dashboard
- As an entry point users "visit"
- As a parallel workflow

---

## THE CANONICAL ACTION

VitalCV performs exactly one *irreversible* replacement:

> **A clinician presents verified authority →
> An employer accepts it →
> Progress continues without re-verification.**

Everything else is auxiliary or supportive.

---

## FORBIDDEN GRAVITY

VitalCV must never introduce:

- Duplicate data entry
- Optional or parallel workflows
- Manual re-entry of already verified information
- "Just in case" screens, dashboards, or buttons
- Visible UI that does not directly resolve a block

If removing VitalCV does *not* break a workflow, VitalCV was misplaced.

---

## DESIGN TEST

If removing VitalCV does **not** force users back into a blocked state, then:

> **VitalCV is in the wrong place.**

It must be redesigned or removed.

---

## IMPLEMENTATION RULE

- **Replace steps. Never add steps.**
- If a step adds optics without removal of friction, it is a violation.
- Valid flows always reduce the work a user must do.

---

## TECHNICAL RULES (ENFORCEMENT)

These are not suggestions — they are requirements:

- No duo of screens that ask users to re-enter previously verified facts.
- No dashboards that exist outside moments of blocking.
- No optional features that look like progress but aren't.
- No integration unless it replaces a blocking path.

If the codebase introduces a "step" that does not remove existing friction — it must be removed.

---

## ACCEPTANCE CRITERION

VitalCV is "antigravity live" when:

> **A clinician can be started without re-verification**
> via a single VitalCV action.

All other features remain auxiliary until this criterion is met.

---

## FAILURE MODE

Any of the following indicates gravity, not antigravity:

- "Sign-in screens before action"
- "Dashboard first"
- "Setup wizards before task"
- "Checklists unrelated to a block"
- "Feature tours instead of unblock paths"

If any exist → revert, delete, or reconfigure.

---

## SUMMARY PRINCIPLE

VitalCV is not a *place* you go
VitalCV is the *force* that lets you go.

Replace steps, don't add them.
