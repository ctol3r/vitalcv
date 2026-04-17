# Mobile Validation Protocol — wave-121
**Status: AWAITING EXECUTION — human required**

---

## Required Before Mobile Ships

Run 3 real clinicians through the mobile wedge. Record outcomes.
If ANY session hits a freeze trigger, halt mobile deployment.

---

## Session Script (< 5 min per clinician)

1. Open app
2. Enter your NPI
3. Read what you see — describe aloud what it means to you
4. What would you do next?
5. Does anything feel wrong or unclear?

---

## Capture Fields (fill per session)

| Field | Session 1 | Session 2 | Session 3 |
|-------|-----------|-----------|-----------|
| NPI used | | | |
| Time to first result (sec) | | | |
| Posture shown | | | |
| Score shown (y/n) | | | |
| Confusion point (if any) | | | |
| Drop-off step | | | |
| Trust break (y/n) | | | |
| "What does this mean?" answered | | | |

---

## Freeze Triggers (stop immediately if any hit)

- [ ] Clinician believes PENDING = they did something wrong
- [ ] Clinician sees a score with 0 verified lanes
- [ ] Clinician does not know what to do next
- [ ] Clinician believes they are BLOCKED when no adverse evidence exists
- [ ] App shows different state than web for same NPI
- [ ] Next step is unclear or missing

---

## Pass Criteria

All 3 sessions must:
- Complete NPI entry without confusion
- Understand what the posture label means
- Know what to do next
- Not misread pending/unavailable as their fault

---

## Owner

Chris — must run sessions before mobile goes to any employer pilot.
