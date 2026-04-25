# Claude Terminal Wave Template

**Mission:** [Define the heavy application build goal]
**Branch:** [Define target branch]
**Scope:** [List explicit boundaries]

## Pre-Flight Check
- [ ] Received handoff from OpenClaw (Release Captain).
- [ ] Confirmed branch matches OpenClaw's target.

## Do-Not List
- Do not modify `HEARTBEAT.md`.
- Do not modify `vitalcv-completion-board.md`.
- Do not invent sources or features outside the defined wedge.

## Validation
- [ ] Run `pnpm exec tsc --noEmit` and ensure no new errors.
- [ ] Run targeted `vitest` for the touched modules.
- [ ] Run `next build` if touching `apps/web`.

## Handoff
Return control to OpenClaw with a summary of files changed and tests run so OpenClaw can update the Board and Graph.

## Final Verdict
`VERDICT: TERMINAL BUILD COMPLETE - RETURNING TO OPENCLAW`
