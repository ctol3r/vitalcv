# VitalCV Full-System Reconciliation Audit
## Task Bundle — 2026-04-22
**Skill:** `vitalcvtask-bundler`
**Objective:** Audit all VitalCV-related files across `/Users/christoler/` and consolidate everything that belongs into `/Users/christoler/vitalcv`.

---

## Pre-Audit Intelligence (Cowork Recon)

**System Risk Level: CRITICAL — FRAGMENTED**

Cowork recon identified **44 VitalCV-related directories** outside the canonical repo at `/Users/christoler/vitalcv`. This is not noise — these are real codebases, worktrees, experiment branches, and agent-generated expansions that may contain recoverable architecture, prompts, and implementation work.

### Directories Outside Repo (confirmed):
| Directory | Suspected Type |
|---|---|
| `vitalcv-backend/` | AI-expanded backend (BATCH_xxx series — hundreds of docs) |
| `vitalcv-wallet/` | Clone/worktree of main repo |
| `vitalcv-passport/` | Clone/worktree of main repo |
| `vitalcv-decision-engine/` | Standalone decision engine experiment |
| `vitalcv-control-plane/` | Ops control plane experiment |
| `vitalcv-ai-sandbox/` | AI experimentation space |
| `vitalcv-autonomous-execution/` | Autonomous agent execution context |
| `vitalcv-ci-lane-stability/` | CI lane hardening branch |
| `vitalcv-consolidation-2/` | Prior consolidation attempt |
| `vitalcv-continuous-verification/` | Continuous verification experiment |
| `vitalcv-conversion-distribution/` | GTM/distribution experiment |
| `vitalcv-defensibility-moat/` | Strategy/moat research |
| `vitalcv-distribution-integration/` | Distribution integration work |
| `vitalcv-engineering-discipline/` | Eng discipline docs |
| `vitalcv-engineering-discipline-2/` | Eng discipline iteration |
| `vitalcv-gtm-revenue/` | GTM/revenue work |
| `vitalcv-hybrid-loader/` | Hybrid source loader |
| `vitalcv-market-domination/` | Competitive strategy |
| `vitalcv-marketplace/` | Marketplace experiment |
| `vitalcv-network-effect/` | Network effect modeling |
| `vitalcv-omega4f-trigger/` | Omega-4f trigger system |
| `vitalcv-pilot-intake-clean/` | Pilot intake flow |
| `vitalcv-pilot-launch-workspace/` | Pilot launch workspace |
| `vitalcv-pr85-verify/` | PR verification branch |
| `vitalcv-pr87-verify/` | PR verification branch |
| `vitalcv-revenue-conversion/` | Revenue conversion work |
| `vitalcv-runtime-stability/` | Runtime stability hardening |
| `vitalcv-security-hardening/` | Security hardening branch |
| `vitalcv-system-1/` | System iteration |
| `vitalcv-system-closure/` | System closure work |
| `vitalcv-time-to-start-engine/` | TTS engine experiment |
| `vitalcv-trustgraph-explorer/` | Trust graph explorer |
| `vitalcv-usage-activation/` | Usage activation |
| `vitalcv-venv/` | Python virtual environment |
| `vitalcv-wallet/` | Wallet standalone |
| `backend/` | Legacy backend (BATCH_200+ series) |
| `substrate/` | Substrate blockchain (should be in repo at `blockchain/substrate/`) |
| `claw-code/` | OpenClaw agent (Rust, CLAW.md) — agent prompts & source |
| `chai-vc-platform/` | Alternate VC platform (possible legacy) |
| `v0-vital-cv-frontend-mvp/` | V0 MVP frontend (likely pre-monorepo) |
| `VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md` | Prior audit (standalone file at root) |
| `_trash-2026-04-20/` | Prior consolidation trash |
| `tasks/` | Possibly VitalCV task tracking |
| `dev/`, `projects/` | May contain VitalCV experiment branches |

### Canonical Repo Status:
- `docs/specs/` — 14 spec files present ✅
- `docs/` — extensive structure present ✅
- `blockchain/substrate/` — present in repo but `substrate/` also exists standalone ⚠️
- `apps/mobile/` — empty (Wave Wallet not built) ⚠️
- `packages/` — all core packages present ✅

---

## WAVE A — Reconnaissance & Inventory
> **Executor:** Claude Code
> **Dependency:** None (start here)
> **Goal:** Generate a complete machine-readable inventory of everything outside the canonical repo.

---

### TASK A1 — Deep Scan: All VitalCV Directories Outside Repo
**Executor:** Claude Code
**Priority:** P0 — Must complete first
**Input:** `/Users/christoler/` filesystem
**Output:** `docs/reconciliation/EXTERNAL-INVENTORY.md`

```
TASK A1: Deep Scan — External VitalCV Directories

Scan the following directories and for each, produce:
- Total file count
- Directory tree (depth 2)
- Git status (is it a git repo? what branch? how many commits?)
- README.md or MASTER_PROMPT.md summary (first 20 lines)
- Last modified date

Directories to scan:
  /Users/christoler/vitalcv-backend/
  /Users/christoler/vitalcv-wallet/
  /Users/christoler/vitalcv-passport/
  /Users/christoler/vitalcv-decision-engine/
  /Users/christoler/vitalcv-control-plane/
  /Users/christoler/vitalcv-ai-sandbox/
  /Users/christoler/vitalcv-autonomous-execution/
  /Users/christoler/vitalcv-ci-lane-stability/
  /Users/christoler/vitalcv-consolidation-2/
  /Users/christoler/vitalcv-continuous-verification/
  /Users/christoler/vitalcv-conversion-distribution/
  /Users/christoler/vitalcv-defensibility-moat/
  /Users/christoler/vitalcv-distribution-integration/
  /Users/christoler/vitalcv-engineering-discipline/
  /Users/christoler/vitalcv-engineering-discipline-2/
  /Users/christoler/vitalcv-gtm-revenue/
  /Users/christoler/vitalcv-hybrid-loader/
  /Users/christoler/vitalcv-market-domination/
  /Users/christoler/vitalcv-marketplace/
  /Users/christoler/vitalcv-network-effect/
  /Users/christoler/vitalcv-omega4f-trigger/
  /Users/christoler/vitalcv-pilot-intake-clean/
  /Users/christoler/vitalcv-pilot-launch-workspace/
  /Users/christoler/vitalcv-pr85-verify/
  /Users/christoler/vitalcv-pr87-verify/
  /Users/christoler/vitalcv-revenue-conversion/
  /Users/christoler/vitalcv-runtime-stability/
  /Users/christoler/vitalcv-security-hardening/
  /Users/christoler/vitalcv-system-1/
  /Users/christoler/vitalcv-system-closure/
  /Users/christoler/vitalcv-time-to-start-engine/
  /Users/christoler/vitalcv-trustgraph-explorer/
  /Users/christoler/vitalcv-usage-activation/
  /Users/christoler/vitalcv-wallet/
  /Users/christoler/backend/
  /Users/christoler/substrate/
  /Users/christoler/claw-code/
  /Users/christoler/chai-vc-platform/
  /Users/christoler/v0-vital-cv-frontend-mvp/
  /Users/christoler/_trash-2026-04-20/
  /Users/christoler/tasks/
  /Users/christoler/dev/ (VitalCV-related subdirs only)
  /Users/christoler/projects/ (VitalCV-related subdirs only)

Write output to:
  ~/vitalcv/docs/reconciliation/EXTERNAL-INVENTORY.md

Format: Markdown table + per-directory section with tree output.
```

---

### TASK A2 — Canonical Repo Internal State Scan
**Executor:** Claude Code
**Priority:** P0
**Dependency:** None (parallel with A1)
**Output:** `docs/reconciliation/CANONICAL-INVENTORY.md`

```
TASK A2: Canonical Repo Internal Inventory

Perform a complete structural scan of ~/vitalcv/ and produce:

1. Full directory tree (depth 3, excluding node_modules, dist, .git)
2. apps/ — for each app: package.json name, build status, last commit
3. packages/ — for each package: index.ts exports, build output present?
4. docs/ — all markdown file names, organized by subdirectory
5. services/ — list with brief description
6. blockchain/ — what's present vs what's expected (substrate/)
7. scripts/ — list all scripts with description from header comments
8. Root-level markdown files — list all, note which are canonical vs generated

Flag:
- Any empty directories
- Any apps/ subdirs with no package.json
- Any packages/ with no index.ts or package.json
- Any docs/ files that appear to be duplicates (same name different path)

Write output to:
  ~/vitalcv/docs/reconciliation/CANONICAL-INVENTORY.md
```

---

### TASK A3 — Read Prior Audit
**Executor:** Claude Code
**Priority:** P1
**Dependency:** None (parallel)
**Note:** A prior consolidation audit exists at `/Users/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md`. Read and summarize it — do not repeat work it already did.

```
TASK A3: Read and Summarize Prior Consolidation Audit

Read: /Users/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md

Produce a summary of:
1. What was already audited (2 days ago)
2. What actions were recommended
3. What was moved to _trash-2026-04-20/
4. What was left unresolved
5. Any open risks flagged in the prior audit

Write output to:
  ~/vitalcv/docs/reconciliation/PRIOR-AUDIT-SUMMARY.md
```

---

## WAVE B — Classification
> **Executor:** Claude Code
> **Dependency:** A1, A2, A3 complete
> **Goal:** Classify every external directory into one of 4 categories.

---

### TASK B1 — Classify External Directories
**Executor:** Claude Code
**Priority:** P0
**Dependency:** A1, A3
**Output:** `docs/reconciliation/CLASSIFICATION-TABLE.md`

```
TASK B1: Classify All External VitalCV Directories

Using the inventory from EXTERNAL-INVENTORY.md and PRIOR-AUDIT-SUMMARY.md,
classify each external directory into exactly one of:

  1. CORE_SYSTEM     — Contains unique code/logic not in canonical repo. Must be merged.
  2. SUPPORTING_DOC  — Docs, specs, prompts, research. Should be moved to docs/ or prompts/.
  3. LEGACY_CLONE    — A clone/worktree of the canonical repo. No unique content. Safe to archive.
  4. NEEDS_REVIEW    — Unclear. Requires human decision before action.

Classification criteria:
- Is it a git repo? → If yes, does it have commits not in ~/vitalcv?
- Does it contain unique source files (.ts, .tsx, .go, .rs) not present in ~/vitalcv?
- Does it contain documentation with unique content (not duplicated in docs/)?
- Is it just a copy of the monorepo?

Output: Markdown table with columns:
  Directory | Classification | Reason | Unique Files Count | Recommended Action

Write output to:
  ~/vitalcv/docs/reconciliation/CLASSIFICATION-TABLE.md
```

---

### TASK B2 — Special Classification: substrate/, claw-code/, backend/
**Executor:** Claude Code
**Priority:** P0
**Dependency:** A1
**Note:** These three deserve individual deep-dive treatment.

```
TASK B2: Deep Classification — substrate/, claw-code/, backend/

For each of these three directories, perform deep analysis:

/Users/christoler/substrate/
  - Is this a newer version of ~/vitalcv/blockchain/substrate/?
  - Run: diff -rq ~/vitalcv/blockchain/substrate/ ~/substrate/ --exclude=node_modules
  - Output: list of files that differ, files only in standalone/, files only in repo version

/Users/christoler/claw-code/
  - Read CLAW.md — what is OpenClaw?
  - List all source files and their purposes
  - Determine: should this live in ~/vitalcv/tools/claw/ or as a separate repo?
  - Note: This is a Rust-based agent. It may have legitimate reasons to be standalone.

/Users/christoler/backend/
  - Count BATCH_xxx_*.md files
  - Are these implementation docs from a prior AI execution run?
  - Is the source code in backend/ diverged from ~/vitalcv/apps/api/?
  - Run: diff -rq ~/vitalcv/apps/api/backend/src/ ~/backend/src/ 2>/dev/null | head -50

Write output to:
  ~/vitalcv/docs/reconciliation/DEEP-CLASSIFICATION-SPECIALS.md
```

---

## WAVE C — Gap Analysis
> **Executor:** Claude Code
> **Dependency:** B1, B2
> **Goal:** Identify what the canonical repo is missing that exists outside.

---

### TASK C1 — Gap Analysis: Missing Prompts & Agent Configs
**Executor:** Claude Code
**Priority:** P1
**Dependency:** B1

```
TASK C1: Gap Analysis — Prompts and Agent Configurations

Search all external directories for files matching:
  - *PROMPT*.md, *prompt*.md
  - *CLAW*.md, *OPENCLAW*.md
  - *CODEX*.md, *codex*.md
  - *AGENT*.md, *agent*.md
  - *.system.md, *MASTER*.md
  - claude-instructions.md, CLAUDE.md
  - Any .json files with "system_prompt" or "instructions" keys

Cross-reference against ~/vitalcv/docs/specs/ and ~/vitalcv/docs/

For each prompt/agent config found OUTSIDE the repo:
  - Is an equivalent version in the repo?
  - Which is newer?
  - Is the external version more complete?

Output a gap table: File | Location | In Repo? | Action

Write to: ~/vitalcv/docs/reconciliation/PROMPT-GAP-ANALYSIS.md
```

---

### TASK C2 — Gap Analysis: Missing Implementation Code
**Executor:** Claude Code
**Priority:** P0
**Dependency:** B1, B2

```
TASK C2: Gap Analysis — Unique Source Code Outside Repo

For each CORE_SYSTEM classified directory from B1:
  1. List all .ts, .tsx, .js, .py, .rs, .go source files
  2. For each, check if a file with the same name exists anywhere in ~/vitalcv/
  3. If yes, compare (diff first 50 lines) to detect which is newer/more complete
  4. If no, flag as MISSING FROM REPO

Special attention to:
  - Any new domain models or Prisma schema additions
  - Any new API routes not in ~/vitalcv/apps/api/backend/src/routes/
  - Any new trust-state or CRS logic not in ~/vitalcv/packages/
  - Any wallet/mobile code (since apps/mobile/ is empty)

Write to: ~/vitalcv/docs/reconciliation/CODE-GAP-ANALYSIS.md
```

---

### TASK C3 — Gap Analysis: Missing Documentation
**Executor:** Claude Code
**Priority:** P1
**Dependency:** B1

```
TASK C3: Gap Analysis — Documentation Outside Repo

Search all external directories for .md files with unique content:
  - Audit reports
  - Architecture decisions
  - Wave/batch implementation summaries
  - Pilot notes and runbooks
  - Research artifacts

Cross-reference against ~/vitalcv/docs/ and ~/vitalcv/docs/specs/

Identify docs that should be in the repo but aren't.

Special flag: The BATCH_xxx series docs in vitalcv-backend/ and backend/ —
determine if these contain implementation decisions that should be archived
in ~/vitalcv/docs/archive/ for traceability.

Write to: ~/vitalcv/docs/reconciliation/DOC-GAP-ANALYSIS.md
```

---

## WAVE D — Duplication Detection
> **Executor:** Claude Code
> **Dependency:** B1, B2
> **Goal:** Find conflicting versions and parallel implementations.

---

### TASK D1 — Detect Duplicate Source Files
**Executor:** Claude Code
**Priority:** P1
**Dependency:** C2

```
TASK D1: Duplicate Source File Detection

Using find + md5sum (or equivalent), detect files with:
  a) Identical names in multiple locations (inside and outside repo)
  b) Identical content in different paths

Run:
  find /Users/christoler/ -name "*.ts" -not -path "*/node_modules/*" \
    -not -path "*/.git/*" | sort > /tmp/all-ts-files.txt
  
Then for common filenames (passportService.ts, readinessEngine.ts, 
TrustStateResolver.ts, PSVReceipt.ts, sourceCatalog.ts), 
compare versions across all locations.

Output: Table of conflicting/duplicate files with:
  - Path A | Path B | Size A | Size B | Modified A | Modified B | Verdict

Verdict options: CANONICAL_WINS | EXTERNAL_NEWER | IDENTICAL | NEEDS_HUMAN_REVIEW

Write to: ~/vitalcv/docs/reconciliation/DUPLICATE-DETECTION.md
```

---

### TASK D2 — Detect Conflicting Prisma Schemas
**Executor:** Claude Code
**Priority:** P0
**Dependency:** A1

```
TASK D2: Prisma Schema Conflict Detection

The canonical schema is at:
  ~/vitalcv/apps/api/backend/prisma/schema.prisma

Search all external directories for schema.prisma files:
  find /Users/christoler/ -name "schema.prisma" -not -path "*/node_modules/*"

For each found:
  1. Diff against canonical schema
  2. List models present in external but NOT in canonical
  3. List models in canonical but NOT in external
  4. Note any field-level differences

This is CRITICAL — orphaned Prisma models could represent unmerged Wave work.

Write to: ~/vitalcv/docs/reconciliation/SCHEMA-CONFLICTS.md

⚠️ DO NOT run prisma migrate. DO NOT modify any schema. Audit only.
```

---

## WAVE E — Recommendation & Consolidation Plan
> **Executor:** Claude Code
> **Dependency:** All of C and D complete
> **Goal:** Produce actionable move/archive/delete recommendations.

---

### TASK E1 — Generate Consolidation Recommendation Report
**Executor:** Claude Code
**Priority:** P0
**Dependency:** C1, C2, C3, D1, D2

```
TASK E1: Full Consolidation Recommendation Report

Read all outputs from Waves A–D and produce the master recommendation:

For EACH external directory, output a section with:

  ┌──────────────────────────────────────────────────┐
  │ Directory: vitalcv-backend/                      │
  │ Classification: CORE_SYSTEM / LEGACY_CLONE / etc │
  │ Unique Files: 23                                 │
  │ Recommended Action: MERGE / ARCHIVE / DELETE     │
  │ Specific files to move:                          │
  │   ~/backend/src/services/X.ts → ~/vitalcv/...   │
  │ Risk if ignored: HIGH / MEDIUM / LOW             │
  └──────────────────────────────────────────────────┘

Then produce:
  1. MOVE LIST — exact cp/mv commands (do not execute — print only)
  2. ARCHIVE LIST — directories to move to ~/vitalcv/archive/
  3. DELETE CANDIDATES — directories that are pure duplicates (require human confirmation)
  4. IGNORE LIST — non-VitalCV directories confirmed clean

Write to: ~/vitalcv/docs/reconciliation/CONSOLIDATION-RECOMMENDATIONS.md
```

---

### TASK E2 — Generate Final Ideal Structure
**Executor:** Claude Code (document generation)
**Priority:** P1
**Dependency:** E1

```
TASK E2: Ideal Repository Structure Map

Based on all reconciliation work, output the target state structure:

vitalcv/
├── apps/
│   ├── web/          (Next.js 15, React 19)
│   ├── api/          (Express + Prisma)
│   ├── marketing/    (fix: dead /clinician CTA)
│   ├── issuer-api/   (credential issuance)
│   ├── verifier-api/ (OID4VP)
│   ├── mobile/       (Wave Wallet — not yet built)
│   └── admin-api/
├── packages/
│   └── [all domain packages]
├── services/
│   ├── decision-engine/
│   └── investigator-engine/
├── blockchain/
│   └── substrate/    (confirm standalone substrate/ is same or absorbed)
├── docs/
│   ├── specs/        (canonical specs)
│   ├── canon/        (doctrine files)
│   ├── audits/       (all audit outputs)
│   ├── prompts/      (agent prompts — NEW: migrate from scattered locations)
│   ├── research/     (NEW: PDFs, notes, research inputs)
│   └── archive/      (BATCH_xxx docs, legacy experiments)
├── tools/
│   └── claw/         (NEW: OpenClaw agent if absorbed from claw-code/)
└── scripts/

Mark each node: EXISTS | MISSING | NEEDS_WORK

Write to: ~/vitalcv/docs/reconciliation/IDEAL-STRUCTURE.md
```

---

## WAVE F — Risk Assessment & Final Verdict
> **Executor:** Claude Code
> **Dependency:** E1, E2
> **Goal:** Final risk rating and go/no-go for development safety.

---

### TASK F1 — System Risk Assessment
**Executor:** Claude Code
**Priority:** P0
**Dependency:** E1, E2

```
TASK F1: System Risk Assessment

Produce a final risk assessment with these dimensions:

1. COMPLETENESS RISK
   - Are any critical system components only outside the repo?
   - Is any production code uncommitted?
   - Are there missing canonical docs?

2. COHERENCE RISK  
   - Are there conflicting versions of the same file?
   - Are there schema divergences that could cause migration conflicts?
   - Are there multiple "main" implementations of the same feature?

3. REPRODUCIBILITY RISK
   - Could a new developer clone ~/vitalcv/ and reproduce the full system?
   - Are there undocumented dependencies on external directories?
   - Are environment configs captured in the repo?

4. SECURITY RISK
   - Are there .env files outside the repo containing secrets?
   - Are there API keys in scattered markdown files?

Final verdict:
  ✅ CLEAN     — Repo is self-contained. External dirs are safe to archive.
  ⚠️ FRAGMENTED — Critical content outside repo. Consolidation required before development.
  🔴 CRITICAL  — Production code not in repo. System cannot be reproduced. STOP AND CONSOLIDATE.

Write to: ~/vitalcv/docs/reconciliation/RISK-ASSESSMENT.md
```

---

### TASK F2 — Create Reconciliation Index
**Executor:** Claude Code
**Priority:** P2
**Dependency:** All of F

```
TASK F2: Create Reconciliation Master Index

Create an index document that links all reconciliation outputs:

~/vitalcv/docs/reconciliation/README.md

Contents:
- Audit date: 2026-04-22
- Auditor: Claude Code (triggered by Cowork)
- Prior audit: 2026-04-20 (summary in PRIOR-AUDIT-SUMMARY.md)
- System risk verdict: [from F1]
- Links to all output files
- Top 5 immediate actions required
- Estimated effort to reach CLEAN status

This file becomes the entry point for the consolidation effort.
```

---

## WAVE G — Execution (After Human Review of E1)
> **Executor:** Claude Code (with human approval at each step)
> **Dependency:** Human reviews E1 and confirms recommendations
> **Note:** DO NOT RUN WAVE G until Wave E output has been reviewed and approved.

---

### TASK G1 — Create reconciliation/ directory structure
**Executor:** Claude Code
**Priority:** BLOCKED on human review
**Dependency:** E1 approved

```
TASK G1: Create Output Directory

mkdir -p ~/vitalcv/docs/reconciliation/

This is the target for all audit outputs from Waves A–F.
Create this first so all tasks can write there.

Note: This task should actually be run BEFORE Wave A starts.
```

---

### TASK G2 — Execute Approved Moves (Docs Only)
**Executor:** Claude Code
**Priority:** BLOCKED on human review
**Dependency:** E1 approved, G1 done

```
TASK G2: Move Approved Documentation Into Repo

For each item in the MOVE LIST from E1 classified as SUPPORTING_DOC:
  Execute the specific cp commands listed in CONSOLIDATION-RECOMMENDATIONS.md
  
  Target locations:
  - Research / PDFs → ~/vitalcv/docs/research/
  - Agent prompts → ~/vitalcv/docs/prompts/
  - Audit reports → ~/vitalcv/docs/audits/
  - BATCH_xxx implementation summaries → ~/vitalcv/docs/archive/batch-history/

After each move, verify the file exists at the target path.
DO NOT delete source files until verified.
```

---

### TASK G3 — Execute Approved Code Merges
**Executor:** Claude Code + human pairing
**Priority:** BLOCKED — requires architect review of each merge
**Dependency:** C2 reviewed, D1 reviewed

```
TASK G3: Merge Unique Code Into Canonical Repo

For each file flagged as MISSING FROM REPO in C2:
  1. Carefully review the file for conflicts with existing canonical code
  2. Propose the exact target path in ~/vitalcv/
  3. Copy the file
  4. Run: pnpm tsc --noEmit from the affected package to verify no type errors
  5. Run: pnpm --filter @vitalcv/api build (if backend file)
  6. Commit with message: "reconciliation: absorb [filename] from [source-dir]"

⚠️ Do NOT merge Prisma schema changes without explicit approval.
⚠️ Do NOT merge without type-checking first.
⚠️ Merge one file at a time. Do not batch.
```

---

### TASK G4 — Archive Legacy Directories
**Executor:** Claude Code
**Priority:** BLOCKED on human confirmation of DELETE CANDIDATES list
**Dependency:** G2, G3 complete

```
TASK G4: Archive Legacy Directories

For each directory classified LEGACY_CLONE and confirmed by human:
  mv /Users/christoler/[dir] ~/vitalcv/archive/external-dirs/[dir]-archived-2026-04-22/

Do NOT delete. Move to archive only.
Track all moves in: ~/vitalcv/docs/reconciliation/ARCHIVE-LOG.md

After all moves complete, run full repo build to confirm nothing was broken:
  cd ~/vitalcv && pnpm --filter @vitalcv/api build && pnpm --filter web build
```

---

## Execution Order Summary

```
Wave A (Parallel):     A1 + A2 + A3    ← Start here. No dependencies.
Wave B (Sequential):   B1 → B2         ← Depends on A complete
Wave C (Parallel):     C1 + C2 + C3    ← Depends on B complete
Wave D (Parallel):     D1 + D2         ← Depends on B complete, parallel with C
Wave E (Sequential):   E1 → E2         ← Depends on C + D complete
Wave F (Sequential):   F1 → F2         ← Depends on E complete

⛔ STOP: Human reviews F1 risk verdict and E1 recommendations before proceeding.

Wave G (Gated):        G1 → G2 → G3 → G4   ← Only after human approval
```

---

## Tooling Notes

| Task | Best Executor | Why |
|---|---|---|
| A1, A2, A3 | Claude Code | File system traversal, git commands, diff |
| B1, B2 | Claude Code | Classification logic, diff operations |
| C1, C2, C3 | Claude Code | Cross-reference search, content comparison |
| D1, D2 | Claude Code | md5sum, diff, schema parsing |
| E1, E2 | Claude Code | Report generation from structured inputs |
| F1, F2 | Claude Code | Synthesis + risk scoring |
| G1–G4 | Claude Code + Human pairing | Destructive-adjacent operations require oversight |

---

## Context Notes for Claude Code Executor

When running this bundle in Claude Code:

1. **Working directory:** `~/vitalcv`
2. **Do NOT modify any source code** during Waves A–F. Audit only.
3. **Do NOT run `prisma migrate`** at any point.
4. **Do NOT delete anything** during Waves A–F.
5. **All outputs go to** `~/vitalcv/docs/reconciliation/`
6. The `node_modules/`, `.git/`, and `dist/` directories should be excluded from all scans.
7. The prior audit at `/Users/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md` is a key input — read it in A3 before repeating any work.
8. The `_trash-2026-04-20/` directory should be inventoried but NOT touched — it was deliberately moved there in the prior audit.

---

*Task bundle generated: 2026-04-22 by VitalCV Cowork operator.*
*Skill: vitalcvtask-bundler | Mission: Full-system reconciliation audit*
*Prerequisite skills consulted: vitalcvrepo-map, vitalcvcurrent-state, vitalcvgap-analysis, vitalcvdocs-and-ops*
