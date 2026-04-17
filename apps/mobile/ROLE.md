# Mobile Role Contract — wave-121
**Locked. Do not expand without explicit wave authorization.**

---

## Mobile IS:

| Role | Description |
|------|-------------|
| Entry point | Clinician enters NPI and sees readiness immediately |
| Readiness monitor | Shows current posture + per-lane system state |
| Action trigger | Shows next step; links to web for execution |
| Notification surface | (future) push alerts when a lane status changes |

---

## Mobile IS NOT:

| Forbidden | Reason |
|-----------|--------|
| Full passport editor | Too complex for mobile; web owns this |
| Full employer review system | Employer actions require audit trail and full UI |
| Full verification UI | Source verification happens server-side |
| Feature playground | Any new screen requires wave authorization |
| Parallel product | Mobile must not introduce concepts not on web |

---

## Truth Contract (non-negotiable)

Mobile must use identical:
- Posture labels (from `trust-contract/src/enums.ts`)
- Score gating (null when 0 verified lanes)
- Blocker logic (ADVERSE only — not unavailable/pending)
- State labels (system state, not user judgment)

Divergence from web truth = immediate freeze.

---

## Deployment Gate

Mobile does not ship until:
- [ ] VALIDATION.md sessions completed (3 real clinicians)
- [ ] Zero freeze triggers hit
- [ ] Web and mobile show identical posture for same NPI
- [ ] No score shown without verified evidence
