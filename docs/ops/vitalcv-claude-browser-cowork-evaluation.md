# VitalCV Claude Browser + Cowork Evaluation
**Authority:** CLAUDE.md  
**Updated:** 2026-05-07

---

## Section D — Browser and Cowork Evaluation

The default answer for any additional agent surface is NO unless it solves a real gap that the existing stack cannot cover.

---

## D.1 — Claude Browser

### Recommendation: CONDITIONAL YES (narrow use case)

**Use it for:**
- Reading live web specs that are not in the repo: HAIP 1.0, OID4VCI, OID4VP, W3C VC Data Model, CMS §482.12 text, NCQA CR1-CR5 criteria, Nursys API documentation
- Competitor teardowns (Verisys, symplr, Modio, Medallion) when a live product review is needed
- Checking whether a Vercel CVE patch is already included in a given Next.js release
- Checking CMS PECOS quarterly release dates
- Checking OIG LEIE data freshness (when was last update?)

**Do not use it for:**
- Implementing features (it cannot write to the repo)
- Synthesizing architecture (Claude Desktop does this better with the repo context loaded)
- Planning waves (OpenClaw does this with full repo knowledge)
- Generating task packages (OpenClaw has the context; Browser does not)

**When to trigger it:**
- OpenClaw or Claude Desktop references an external standard and needs the actual text
- A PR involves a third-party API and the current docs in the repo are stale
- The founder asks "what does [spec] actually say about X?"

**Failure modes:**
- Browser fetches stale cached versions of specs — always verify the date on the page
- Browser cannot read gated/paywalled standards bodies (NCQA, Joint Commission) — do not pretend it can

**Verdict:** Use Browser as a targeted research tool, invoked on demand. Never as a primary session tool.

---

## D.2 — Claude Cowork

### Recommendation: NO — not justified for VitalCV

**Why not:**

1. **Context fragmentation.** VitalCV's critical constraint is maintaining context coherence across agents. Cowork adds another context boundary without adding a differentiated capability. The result is two agents that both think they're reasoning about the same repo but diverge because they don't share a live state view.

2. **Redundant with existing stack.** The tasks Cowork might do are already covered:
   - Massive context synthesis → Claude Desktop with long context
   - Parallel doc drafting → OpenClaw with subagents
   - Design review → Claude Desktop
   - Cross-PR comparison → Claude Desktop with specific PRs loaded

3. **No write discipline.** Cowork sessions that produce docs need a discipline for where those docs land. Without that, outputs drift into ad-hoc Notion docs or Google Docs that become stale — exactly the problem VitalCV's ops docs framework is designed to avoid.

4. **"Too many copilots" failure mode.** CLAUDE.md explicitly warns against this. Every agent that touches VitalCV's truth-contract domain must understand the full invariant set. Adding a Cowork session means onboarding another agent to the full context stack — a cost that compounds over time.

**The one exception where Cowork might be justified:**
- A specific multi-party design review session where the founder, a Claude Desktop session, and a subject-matter-expert all need to interact in real time. Even then, the output must be distilled into a `docs/ops/` document by OpenClaw before any implementation begins.

**Verdict: DO NOT USE Cowork for VitalCV in the current phase.** Re-evaluate when the team scales beyond the founder.

---

## D.3 — What Fills the Apparent Gap

| Temptation | Actually covered by |
|---|---|
| "I need a very long context for synthesis" | Claude Desktop — use large context directly |
| "I need parallel doc writing" | OpenClaw subagents (already in use) |
| "I need web research while building" | Claude Browser on demand |
| "I need two agents thinking about the same problem" | Claude Desktop for strategy, Claude Code Terminal for implementation — clear separation |
| "I need group collaboration" | Docs in `docs/ops/` serve as the shared state; agents read them |
