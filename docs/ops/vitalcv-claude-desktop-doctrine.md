# VitalCV Claude Desktop Doctrine
**Authority:** CLAUDE.md  
**Updated:** 2026-05-07  
**Role:** Strategic reasoning, architectural review, synthesis, doctrine

---

## Section C — Claude Desktop Operating Model

Claude Desktop is the synthesis layer. It reads widely, reasons deeply, and writes doctrine.  
It does not implement. It does not merge. It does not replace Codex.  
Its output is always a document, a review, or a prompt — never a code change.

---

## C.1 — Ideal Session Structure

Every Claude Desktop session should begin with the same three reads:

```
1. CLAUDE.md — what is forbidden, what is frozen, what is the truth contract
2. docs/architecture/vitalcv-knowledge-trust-graph.md — the current knowledge boundary
3. docs/ops/vitalcv-completion-board.md — the current honest score
```

Then: read the specific artifact under review (PR diff, wave plan, copy, architecture doc).

**Session types:**
- **Pre-wave review:** Read wave plan → identify architectural risks → output a risk note
- **Post-wave coherence check:** Read all PRs in a wave → confirm they cohere → output a coherence report
- **Launch readiness review:** Read launch-blockers.md → score each criterion → output honest verdict
- **Investor-readiness review:** Read product claims → verify each against code → output gap analysis
- **Trust-path trace:** Trace NPI → passport → review → accept end-to-end → output broken links
- **Doctrine writing:** Produce or update a canonical operating doc

---

## C.2 — Ideal Prompt Style

Claude Desktop prompts should:
- Be long, context-rich, and specific
- Include direct quotes from the files under review
- Ask for structured output (tables, numbered findings, yes/no verdicts)
- Explicitly forbid hedging ("say what you actually think — not 'it depends'")
- Reference specific line numbers when asking about code
- Ask for a final verdict before explanation, not after

**Anti-patterns to avoid:**
- "Can you review the architecture generally?" → Too vague. Specify the exact architectural question.
- "Is this good?" → Ask: "Does this implementation violate any of the 28 Knowledge Trust Graph boundaries?"
- "What do you think about X?" → Ask: "Find every claim in X that is not backed by evidence in the repo. List each one with the file where the unsupported claim appears."

---

## C.3 — Canonical Prompts

### Architecture Review Prompt

```
You are reviewing the VitalCV architecture for a specific wave/PR.

First, read:
- CLAUDE.md (frozen invariants)
- docs/architecture/vitalcv-knowledge-trust-graph.md (boundaries 1-28)
- [paste or specify the PR diff / wave plan under review]

Then answer:
1. Does this change violate any frozen invariant in CLAUDE.md? If yes: which one and how?
2. Does this change add or modify any of the 28 Knowledge Trust Graph boundaries? If yes: which ones?
3. Does this change create any architectural drift from the canonical path (Recognition → Acceptance → Start)?
4. Are any new dependencies introduced that create a circular dependency or coupling risk?
5. Are any server-only modules now reachable from client components?
6. Does this change introduce any state that cannot be audited or replayed?

Output: a numbered finding list. For each finding: severity (BLOCKING / CRITICAL / HIGH / LOW), file:line, and the specific rule it violates.

Final verdict: SAFE TO PROCEED / NEEDS REVISION / BLOCKING ISSUE FOUND
```

---

### Launch Readiness Review Prompt

```
You are reviewing VitalCV's launch readiness against the 20-criterion definition of "100%".

Read:
- docs/ops/launch-blockers.md
- docs/ops/vitalcv-completion-board.md
- docs/ops/current-state-map-2026-05-07.md (or latest)

For each of the 20 criteria (from the 100% definition), give:
- Status: PASS / FAIL / PARTIAL / NOT_CHECKED
- Evidence: specific file or route that proves or disproves it
- If FAIL or PARTIAL: what is the minimum fix needed?

Be honest. Do not give PASS unless you have evidence. Do not give PARTIAL when the truth is FAIL.

End with:
- Tier 1 (Safe to Demo): PASS / FAIL — with the specific blockers if FAIL
- Tier 2 (Safe to Pilot): PASS / FAIL — with the specific blockers if FAIL
- Tier 3 (Safe to Sell at Scale): PASS / FAIL — with the specific blockers if FAIL

One-sentence verdict: [Safe to demo / Not yet safe to demo] because [specific reason].
```

---

### Investor-Readiness Review Prompt

```
You are auditing every public-facing claim on VitalCV for investor readiness.

For each claim on the homepage, /employers, /pilot, /pricing, and /status:
1. Quote the exact claim
2. Rate: BACKED (evidence in code) / OVERSTATED (partially true) / FALSE (not in code)
3. For OVERSTATED or FALSE: quote the specific file and line where the gap is

Apply these rules:
- "NPPES verified" = BACKED (live HTTP call exists)
- "OIG cleared" = check: does the OIG adapter actually run? What does it return?
- "all 50 states" = FALSE unless Nursys is live
- "instant" or "hire instantly" = FALSE
- "SOC 2 certified" or "NCQA certified" = FALSE
- "HIPAA compliant" = FALSE (say "HIPAA-aligned")
- "zero-trust ledger" = FALSE (banned string)

Output: a table with columns: Claim | Location | Status | Minimum Fix
```

---

### "Find Fake Certainty" Prompt

```
You are auditing VitalCV for fake certainty: any surface that implies more confidence, verification, or completeness than the system actually provides.

Scan:
- [paste the component or route output under review]

Look for:
1. Status labels that say "Verified" without a source receipt
2. Scores or percentages presented without disclosing what they measure
3. Source names displayed for sources that are access_required or unintegrated
4. "Loading..." states that imply a real check is in flight when none is
5. Green checkmarks on items that are not actually confirmed
6. Demo data presented without a structural disclaimer
7. Roadmap language ("coming soon", "integration pending") in downloadable artifacts
8. Time claims ("saves 14 days") that are estimated not measured

For each instance: [file:line] [what it implies] [what is actually true] [fix]
```

---

## C.4 — What Claude Desktop Should NOT Do

| Don't | Why |
|---|---|
| Write product code directly | It hallucinates file paths; Claude Code Terminal is more reliable for this |
| Issue Codex verdicts | It is not Codex; its "SAFE" is not a merge gate |
| Generate bulk documentation | OpenClaw is more efficient for structured doc generation |
| Run builds or tests | It has no direct access to the runtime |
| Approve Prisma migrations | Only the founder can approve migrations |
| Review individual test files for correctness | That's Codex's job |

---

## C.5 — Cross-PR Coherence Review

When multiple PRs have merged in a wave, Claude Desktop should run a coherence check:

```
Read the following merged PRs: [list PR numbers and their main changed files]

Coherence questions:
1. Do any of these PRs contradict each other? (e.g. one adds a route, another removes it)
2. Do any of these PRs introduce a shared dependency that wasn't coordinated?
3. Do any of these PRs modify the same file in ways that might create runtime conflicts?
4. Together, do these PRs advance the completion board in the stated direction?
5. Are any of the claimed completion percentages now inconsistent with the actual merged code?

Output: coherence verdict + any discovered conflicts.
```
