# Wave Post-Flight Checklist

Execute this checklist before closing a wave.

- [ ] **Files changed match scope:** Ensure no unintended files were modified.
- [ ] **Validation complete:** `pnpm exec tsc --noEmit`, `vitest run`, and `next build` executed successfully for touched areas.
- [ ] **Inherited failures classified:** Explicitly note if any red tests are legacy/inherited (e.g., OIG network timeouts) vs caused by this wave.
- [ ] **Deploy impact verified:** Confirm if changes are safe to push to the `vcv-web` Vercel project.
- [ ] **Browser audit complete:** If the live UX was affected, ensure Claude Browser has verified it (or flag that it is required).
- [ ] **Completion Board updated:** `docs/ops/vitalcv-completion-board.md` reflects honest, non-inflated metrics.
- [ ] **Knowledge Trust Graph impact recorded:** `docs/architecture/vitalcv-knowledge-trust-graph.md` updated with new nodes/edges.
- [ ] **HEARTBEAT updated:** `HEARTBEAT.md` contains the new baseline and next recommended wave.
- [ ] **Merge/park/continue decision made:** Determine what happens to the branch.
- [ ] **Next wave recommended:** Logically determine the next highest-leverage action.
