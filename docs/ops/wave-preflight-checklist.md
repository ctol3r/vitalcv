# Wave Pre-Flight Checklist

Execute this checklist before commencing any product modification wave.

- [ ] **Canonical repo root confirmed:** Ensure execution is happening in `/Users/christoler/vitalcv`.
- [ ] **Current branch confirmed:** Ensure you are on the correct `feature/` or `fix/` branch.
- [ ] **Dirty state reviewed:** Ensure working tree is clean or changes are intentionally tracked.
- [ ] **Live deploy status known:** Understand what is currently running in production before breaking it.
- [ ] **Production impact classified:** (e.g., Safe, High Risk, Requires Downtime).
- [ ] **Target files identified:** Identify exactly which `apps/` or `packages/` are in scope.
- [ ] **Primary writer chosen:** Will OpenClaw do this (small ops/docs) or Claude Terminal (heavy code)?
- [ ] **Codex role constrained:** Is Codex needed for test repair?
- [ ] **Browser/Cowork need assessed:** Will we need a post-deploy visual audit?
- [ ] **Completion Board baseline loaded:** Read current metrics from `docs/ops/vitalcv-completion-board.md`.
- [ ] **Knowledge Trust Graph impact predicted:** Will this change how evidence or truth flows?
