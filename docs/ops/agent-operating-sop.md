# VitalCV Agent Operating SOP

The canonical pattern for semi-autonomous wave-based execution across every AI tool that touches VitalCV. **All timestamps in operator reports use Pacific / San Jose time.** All percentage moves on the completion board follow the rules in §5. All safety constraints in §8 are binding.

This SOP is doctrine. Tools and waves may change; the doctrine does not.

## 1. VitalCV execution doctrine

Tool roles, in priority order:

| Tool | Role | Default state |
|---|---|---|
| 🤖 **Claude Code** | Primary builder + auditor. Owns: reading code, writing code, running validation, opening PRs, executing local audit gate, merging via `gh pr merge`. | **always active** |
| 🎨 **Claude Design** | Design review + visual spec authoring + screen composition. Always included in design conversations. | **always active** |
| 🌐 **Claude Browser** | Live verification only. Read-only against deployed services. Cannot create accounts, cannot enter credentials, cannot click mutating buttons unless explicitly authorized. Used for: `/health` polling, Railway active-deployment confirmation, post-deploy SSE smoke (within operator-signed-in browser session). | active for verification |
| 🖥 **Claude Desktop** | Strategic planning + cross-tool orchestration. Use for: deciding next wave, reading docs across files, drafting roadmaps, picking modes. | active for planning |
| 🟧 **OpenClaw** | Specialized tool. Only when **explicitly requested** by operator. Never default. | **disabled by default** |
| ⏸ **Codex** | Originally the merge-gate auditor. **Currently disabled** per operator instruction (account quota / cost). Local Claude Code audit replaces the merge gate. Re-enable only on explicit operator direction. | **disabled by default** |

When Codex is disabled, every PR's merge gate is **Local Claude Code audit**. The audit checklist mirrors the constraints in §8 and lives in §6 of the per-wave template (`docs/ops/wave-batch-template.md`).

## 2. 20-task wave batch format

A **wave batch** is a single operator-driven session that ships up to 20 discrete tasks, each scoped to one branch and one PR. Each task is one row in the batch table.

```
Wave batch N — <theme>
 1. <mission>           branch: <feat|docs|fix>/<slug>          mode: <money|design|backend|pilot>
 2. <mission>           branch: …                                mode: …
…
20. <mission>           branch: …                                mode: …
```

Rules:

- **One mission per row.** No row can contain "and then also". If it does, split it.
- **One branch per row.** A row may produce more than one commit on its branch but never spans multiple branches.
- **20 max.** If the batch exceeds 20, split into N + 1.
- **Sequenced if dependent.** When task K+1 depends on task K landing on `main`, mark task K+1 as `blocked: task K`. The wave runner does not start K+1 until K is merged.
- **Independent rows ship in parallel.** Multiple `feat/*` branches with no shared files can be in flight simultaneously.

See `docs/ops/wave-batch-template.md` for the full table template, the per-task audit checklist, and the failure-class taxonomy.

## 3. Mode system

A wave's **mode** determines its strategic bias and what kinds of risk it can take.

| Mode | Bias | Acceptable risk | Forbidden |
|---|---|---|---|
| 💰 **money mode** | Revenue, pilots, conversion, sales collateral. | Marketing copy refresh; pricing surface tweaks; persona-routed landing pages; pilot-intake forms; light Slack-hook integrations. | Any product-truth-contract weakening. Any banned-phrase reintroduction. Any deployment-config change without explicit approval. |
| 🎨 **design mode** | Visual quality, calm chrome, component library, screen composition. | New design-system components; chip family expansions; route layout refactors; copy refinements within the banned-strings contract. | Backend logic changes. Auth-flow changes. Any false source promotion. |
| 🧱 **backend mode** | API correctness, persistence, source-adapter integrity. | Backend route handlers, services, source adapters, observability hooks. | Frontend route changes outside the API surface. Any product-copy change. |
| 🚀 **pilot mode** | Live verification, deploy validation, real-NPI smoke, operator runbooks. | Read-only HTTP probes against deployed services; SSE stream subscription within an operator-authenticated session; Railway active-deployment inspection. | Any modification of Railway / DNS / env / secrets. Any account creation. Any credential surfacing. |

A wave row's mode is declared by the operator. The agent honors the mode's forbidden list.

## 4. Default strategic bias

When the operator does not specify a mode, the agent picks the next-best action from this priority order:

1. **Truth contract** — banned-strings + no-false-promotion is bedrock. If a task threatens it, refuse.
2. **Deployable code** — code that ships is worth more than code that doesn't. Build, tsc, lint, tests must be green before merge.
3. **Beautiful product** — UI that is calm, honest, and operator-grade. Design system over ad-hoc spans.
4. **Live source validation** — SSE smoke, `/health` polling, Railway active-row verification turn "deployed" into "validated live".
5. **Enterprise persistence / security** — TRUST-PERSIST-1 cutover (in-memory → DB writers) is the largest single board blocker. Tenant isolation, hash binding, auth scope, audit replay.
6. **Revenue / pilots** — pilot-intake forms, persona pages, pricing surfaces, GTM funnel.
7. **Workflow automation** — make the next session faster: SOP updates, ledger templates, scheduled workflows.

If two priorities tie, pick the one with the closest "deployed → validated live" gate.

## 5. Completion Board update rules

Source of truth: `docs/ops/vitalcv-completion-board.md`.

Hard rules:

- **High-end waves left only.** A range like "8–14 waves" reports as **14**. Never report the low end.
- **No percentage inflation for unmerged PRs.** A PR being open is not a percentage move.
- **Raise only after one of:** ✅ committed-and-tested merged code, 🚢 deployed-to-production, 🧪 validated-live against a real client, 💰 pilot revenue or signed-pilot evidence.
- **Allowed +1 moves** when the corresponding event lands:

| Event | Allowed move |
|---|---|
| TruthStateChip-class foundation merged + tested | Trust/Proof +1, Frontend UX +1 |
| Visual docs implementation-ready (merged) | Frontend UX +1, Interop +1 |
| Passport visual upgrade merged + tested | Core Workflow +1, Frontend UX +1 |
| Homepage role-doors merged + tested | Frontend UX +1, Demo/Sales +1 |
| Auth disclosure merged + tested | Auth/Onboarding +1 |
| Status/Attribution receipts merged + tested | Trust/Proof +1, Interop +1 |
| Visual QA PASS / LIMITED PASS | Frontend UX +1 |
| SSE smoke proves NPPES truth-state live | Product Truth Contract +2, Source Integrations / PSV +2 |
| Pilot signed | Business / GTM +5, Demo / Sales +3 |
| Pilot revenue collected | Business / GTM +10 |

- **Held dimensions:** Source Integrations / PSV cannot rise above current baseline until SSE smoke is validated live. Business / GTM cannot rise without real pilot evidence. Auth / Onboarding cannot rise without a merged + tested auth UX wave.
- **Emoji markers** (see §10) tag every board row's state at a glance.

## 6. Next Direction Options A–E format

Every wave report ends with a **Next Direction** block. Five options, every time:

```
Next Direction
A) <specific strategic task tied to the closest-to-done bottleneck>
B) <specific strategic task tied to the largest single board blocker>
C) <specific strategic task in design / GTM / persistence — pick the
    weakest non-blocked dimension>
D) <specific strategic task in operator-side hygiene (CRON_SECRET,
    archive sweep, dead-import cleanup, etc.)>
E) Continue to next task / next wave batch.
```

**A, B, C, D must be concrete:** "Run the SSE smoke runbook against api.vitalcv.com for NPI 1699264564" is concrete. "Improve persistence" is not.

**E is always option 5**, no exceptions. The operator picks A/B/C/D for divergence or E to keep the current wave train rolling.

## 7. Tool routing matrix

| Task type | Primary tool | Allowed | Forbidden |
|---|---|---|---|
| Read existing code | Claude Code (Read / grep) | Claude Desktop (read-only context) | Browser (cannot read repo files) |
| Write new component / function | Claude Code (Write + Edit) | — | Browser (cannot write files) |
| Run vitest / tsc / lint / build | Claude Code (Bash) | — | Browser (cannot execute repo commands) |
| Open PR / merge PR | Claude Code (Bash + `gh`) | — | Browser (cannot run `gh`) |
| Inspect Railway active deployment | Claude Browser (read-only) | Claude Code (curl `/health`) | Tool that modifies Railway settings |
| Run authenticated SSE smoke | Claude Browser **within operator-signed-in session** | — | Any agent attempting to sign in |
| Visual QA on rendered pages | Claude Browser | Claude Design (review screenshots) | Claude Code (cannot render visuals) |
| Strategic planning across multiple files | Claude Desktop | Claude Code (file reading) | — |
| Specialized one-off task | OpenClaw (only when explicitly requested) | — | OpenClaw as default |
| Merge-gate audit | Local Claude Code audit | — | **Codex (disabled)** |

The merge-protection hook (per CLAUDE.md) expects a real audit verdict in the transcript. With Codex disabled, that verdict is a **Local Claude Code audit** following the checklist in `docs/ops/wave-batch-template.md`.

## 8. Safety rules (binding)

Non-negotiable. Apply across every tool, every mode, every wave.

| Rule | Enforcement |
|---|---|
| **No unsupported compliance claims** ("HIPAA compliant", "SOC2 certified", "NCQA certified", "Get verified") | Banned-strings regex test in `apps/web/__tests__/truth-state-chip.test.tsx`; banned-strings list in `CLAUDE.md`. |
| **No bare "Verified" status label** | Type system pins state vocabularies; chip metadata asserts no `\bverified\b/i` in any visible label. |
| **No final-credentialing claims** ("complete credentialing", "instant credentialing", "guaranteed verification", "automatically verified", "legally accepted", "risk transferred") | Same banned-strings enforcement. |
| **No source promotion without backend evidence** | NPPES `source-backed` requires the four-field gate in `deriveSourceCompleteStatus` (PR #423). OIG/LEIE/PECOS/STATE_BOARD/FSMB/NURSYS stay `connector-not-live` until adapter wires up. |
| **No secrets in chat or logs** | Operator never pastes cookies, JWTs, `x-clerk-user-id`, or session material into agent context. Agent never asks for them. PR descriptions never contain env values. |
| **No accounts created by agents** | Agents never run signup flows for the operator. Operator signs in themselves; agent works within that authenticated browser session. |
| **No Railway / DNS / env / secrets mutation** unless operator explicitly requests | Hard rule in every wave's "Hard constraints" block. |
| **No Prisma migrations** unless approved | Same — gating phrase: "No Prisma migrations" appears in every wave spec. |
| **No stubs that hide runtime errors** | Restored modules must be substantive; no `return undefined as any` fail-quiet patterns. |

If a wave hits a constraint, the agent's response is **stop and report**. Never bypass.

## 9. Output timestamp rule

Every operator report includes a **Pacific / San Jose timestamp** in the form `YYYY-MM-DD HH:MM PDT` (or PST in winter). Use `date '+%Y-%m-%d %H:%M:%S %Z'` to pull from the host clock. Cross-reference with UTC when reporting GitHub event times (PR merges, deploy events) so operator can match against external logs.

## 10. Emoji workflow markers

For scannability across long ledgers and reports:

| Emoji | Meaning |
|---|---|
| ✅ | done / complete |
| 🟡 | in progress |
| 🔴 | blocked (operator action required) |
| 🚢 | merged to main / deployed |
| 🧪 | validated (tests pass / live behavior confirmed) |
| 🎨 | design / visual system work |
| 🧱 | infrastructure / persistence / build |
| 🔐 | auth / security |
| 💰 | revenue / pilots / GTM |
| 🤖 | agent / automation work |
| 🌐 | browser / live deploy |
| ⏸ | paused / waiting |

Use sparingly — emoji should clarify, not decorate.

## How this SOP gets updated

When the doctrine changes (a new tool, a new mode, a new safety rule), open a `docs/agent-sop-update-NN` branch with the diff and route through the same audit gate as any other docs PR. The SOP is not above the SOP.
