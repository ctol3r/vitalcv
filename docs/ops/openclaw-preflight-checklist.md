# OpenClaw Preflight Checklist
**Authority:** openclaw-governance-hardening.md  
**Updated:** 2026-05-07  
**Use:** Run before generating any Claude Code Terminal task package

---

## When This Is Required

Run preflight when OpenClaw is about to generate a task package targeting product code (`apps/`, `packages/`, `services/`).

Not required for: docs-only analysis, PR triage, memory updates, read-only operations.

---

## Preflight Checklist

Work through each section in order. Stop immediately on any HARD_BLOCK.

---

### BLOCK 1 — HARD_BLOCK Conditions (check first)

- [ ] **B1.1** Does the task target `CLAUDE.md` or `MASTER_PROMPT.md`?  
  → YES = **HARD_BLOCK. Stop. Surface to founder.**

- [ ] **B1.2** Does the task target `apps/web/prisma/schema.prisma` or add any `.sql` migration file?  
  → YES = **HARD_BLOCK. Must have explicit founder approval in this session before proceeding.**

- [ ] **B1.3** Does the task text contain any banned string?  
  Banned: `automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`  
  → YES = **HARD_BLOCK. Rewrite the task. Never generate a task containing banned strings.**

- [ ] **B1.4** Does the task reference NPDB, DEA integration, ABMS, SAM.gov, or Doximity as a data source?  
  → YES = **HARD_BLOCK. These are unintegrated. Remove the reference.**

- [ ] **B1.5** Does the task remove a demo structural marker (`_demo: true`, `recordedBy: 'demo'`, demo banner) without replacing it with real data?  
  → YES = **HARD_BLOCK. Demo markers can only be removed when a real data path exists.**

- [ ] **B1.6** Does the task remove an existing auth guard from `middleware.ts`?  
  → YES = **HARD_BLOCK. Auth guards may only be added, never removed, in routine PRs.**

- [ ] **B1.7** Does the task remove or weaken `banned-strings-gate.yml` or `ci.yml` gates?  
  → YES = **HARD_BLOCK. CI gates are permanent. Only the founder can modify them.**

- [ ] **B1.8** Does the task remove an `AuditEvent` write from a mutating endpoint?  
  → YES = **HARD_BLOCK. Every mutating endpoint must write an AuditEvent before 2xx.**

- [ ] **B1.9** Does the task change `decisionGrade` from `false` or `proofTier` from `'receipt_candidate'` on receipt candidate output?  
  → YES = **HARD_BLOCK. These are frozen literals. See CLAUDE.md.**

---

### BLOCK 2 — FOUNDER_REQUIRED Conditions

- [ ] **F2.1** Does the task touch `apps/web/prisma/schema.prisma`?  
  → YES = **FOUNDER_REQUIRED. Tag the task. Do not proceed without approval.**

- [ ] **F2.2** Does the task include `prisma migrate` in any form?  
  → YES = **FOUNDER_REQUIRED. Separate migration from feature. Await founder approval.**

- [ ] **F2.3** Does the task change the meaning or names of any of the 9 canonical coverage states?  
  (`checked`, `stale`, `pending`, `gated`, `unavailable`, `accessRequired`, `reviewRequired`, `notDecisionGrade`, `previewOnly`)  
  → YES = **FOUNDER_REQUIRED. Coverage state semantics are frozen.**

- [ ] **F2.4** Does the task change the 5-gate policy review flow in `policyReview.ts`?  
  → YES = **FOUNDER_REQUIRED. Issuer policy gates are frozen.**

- [ ] **F2.5** Does the task delete a service, package, or major route group?  
  → YES = **FOUNDER_REQUIRED. Deletions require explicit founder sign-off.**

---

### BLOCK 3 — HIGH_RISK Conditions (require architectural justification)

- [ ] **H3.1** Does the task touch `packages/crs/` (CRS scoring)?  
  → YES = HIGH_RISK. State: which scoring dimension, what the cap changes to, which invariants are preserved.

- [ ] **H3.2** Does the task touch `packages/source-adapters/` (OIG, NPPES, state-board adapters)?  
  → YES = HIGH_RISK. State: which adapter, what the confidence output changes to, which lanes are affected.

- [ ] **H3.3** Does the task touch `packages/trust-state/` (TrustStateResolver, coverage states)?  
  → YES = HIGH_RISK. State: which state transition changes, which callers are affected.

- [ ] **H3.4** Does the task touch `apps/web/middleware.ts`?  
  → YES = HIGH_RISK. Confirm: only adding guards, never removing. List the routes being protected.

- [ ] **H3.5** Does the task touch `lib/auth/` (roles, RBAC, invitations)?  
  → YES = HIGH_RISK. State: which role boundaries change, confirm timing-safe comparisons preserved.

- [ ] **H3.6** Does the task touch `lib/issuer-verification/` (receipt candidate, policy review, PSV reuse)?  
  → YES = HIGH_RISK. State: which gates remain, confirm decisionGrade:false preserved.

- [ ] **H3.7** Does the task touch `next.config.mjs` security headers or CSP?  
  → YES = HIGH_RISK. CSP may only be tightened, never relaxed.

For any HIGH_RISK condition: write the architectural justification before generating the task package.

---

### BLOCK 4 — Scope Checks (all tasks)

- [ ] **S4.1** File count: how many files does this task change?  
  → > 15 files = GUARDED. Split the task or write explicit scope justification.

- [ ] **S4.2** Domain crossing: does this task span more than one product domain?  
  (Domains: auth, scoring/CRS, source adapters, issuer/PSV, employer review, clinician UI, design system, CI, docs)  
  → Crossing > 1 domain = GUARDED. Consider splitting.

- [ ] **S4.3** Does the task include file deletions?  
  → YES = GUARDED. List each file to be deleted and confirm it is not load-bearing.

- [ ] **S4.4** Does the task include env/config file changes?  
  → YES = GUARDED. Confirm no secrets are added. Confirm Zod schema is updated.

- [ ] **S4.5** Is there an existing PR in the queue that touches the same files?  
  → YES = GUARDED. Sequence this task after that PR merges, or note the dependency explicitly.

---

### BLOCK 5 — Task Package Quality (all tasks)

- [ ] **Q5.1** Does the task specify exact files to change? (Not "files in the auth module" — exact paths)  
  → NO = Incomplete task. Specify exact paths before generating.

- [ ] **Q5.2** Does the task specify files NOT to change?  
  → NO = Add explicit "do not touch" list.

- [ ] **Q5.3** Does the task include specific test requirements?  
  → NO = Add: which test file, what it must assert.

- [ ] **Q5.4** Does the task include a Codex audit prompt?  
  → NO = Generate the Codex prompt alongside the task package.

- [ ] **Q5.5** Is the task implementable in a single PR? (One logical concern, max 15 files)  
  → NO = Split the task.

---

## Preflight Outcome

| Outcome | Meaning |
|---|---|
| All HARD_BLOCKs: NO, All FOUNDER_REQUIRED: NO | Proceed to task generation |
| Any FOUNDER_REQUIRED: YES | Tag task. Surface to founder. Await explicit approval. |
| Any HARD_BLOCK: YES | Stop. Rewrite or escalate. Do not generate task. |
| Any HIGH_RISK: YES | Write architectural justification. Optionally invoke Claude Desktop. Then proceed. |
| Any GUARDED: YES | Write scope lock. Confirm with founder. Then proceed. |
