# AI Tool Routing Matrix

The authoritative table of which AI tool handles which class of work for VitalCV. See `docs/ops/agent-operating-sop.md` for the doctrine; this file is the lookup table.

## Tools at a glance

| Tool | Default | Owns | Cannot |
|---|---|---|---|
| 🤖 **Claude Code** | active | Build, edit, audit, test, merge, ship | Render visuals; mutate Railway via UI |
| 🎨 **Claude Design** | active | Visual review, screen composition, component spec | Run code; merge PRs |
| 🌐 **Claude Browser** | active (read-only) | Live `/health` probes, deployed-page visual QA, Railway active-row read | Modify settings; create accounts; enter credentials |
| 🖥 **Claude Desktop** | active (strategic) | Cross-file planning, doctrine drafts, mode selection | Execute Bash / make commits |
| 🟧 **OpenClaw** | disabled by default | Specialized one-off tasks **only on explicit operator request** | Anything as default |
| ⏸ **Codex** | **disabled** per operator instruction | Originally: merge-gate audit. Now replaced by Local Claude Code audit. | Re-engage without explicit operator green-light |

## Per-task routing

| Task class | Tool | Notes |
|---|---|---|
| Read repository files | 🤖 Claude Code | `Read` for known paths; `Grep` for searches |
| Write or edit code | 🤖 Claude Code | `Write` / `Edit` tools; never paste into chat as substitute |
| Run `pnpm install`, `pnpm turbo run build`, `vitest`, `tsc`, `lint` | 🤖 Claude Code | `Bash` tool; always validate before commit |
| Open a PR | 🤖 Claude Code | `gh pr create` |
| Merge a PR after local audit SAFE | 🤖 Claude Code | `gh pr merge <N> --squash --delete-branch=false` |
| **Merge-gate audit** | 🤖 **Local Claude Code audit** | Codex is disabled; this is the replacement. Checklist lives in `docs/ops/wave-batch-template.md`. |
| Visual QA on rendered surfaces (deployed pages) | 🌐 Claude Browser | Read-only; classify per the 5-class taxonomy in `docs/ops/authenticated-sse-smoke-runbook.md` |
| Inspect Railway active deployment row | 🌐 Claude Browser | Read-only; never click "Apply changes" / "Deploy" / restart buttons |
| Confirm `/health` SHA matches the latest merge | 🌐 Claude Browser **or** 🤖 Claude Code (`curl`) | Either tool; agent must use cache-busting `?cb=…` to avoid CDN staleness |
| **Authenticated SSE smoke for NPI 1699264564** | 🌐 Claude Browser **within operator-signed-in session** | Operator does sign-in themselves; agent never enters credentials |
| Live behavior validation (real client data) | 🌐 Claude Browser | Read-only; never mutate state |
| Visual design review / palette / spacing / hierarchy | 🎨 Claude Design | Outputs go into `docs/design/` |
| Component API design / screen composition recipes | 🎨 Claude Design + 🤖 Claude Code | Design specifies; Code implements |
| Cross-file roadmap drafting | 🖥 Claude Desktop | Then handed to Claude Code for implementation |
| Mode selection / batch theme / strategic question | 🖥 Claude Desktop or 🤖 Claude Code | Either; document the chosen mode in batch header |
| Specialized one-off task on explicit operator request | 🟧 OpenClaw | Only when operator names the tool by name. Never default. |
| Codex re-audit | ⏸ **Disabled** | Do not invoke. If operator wants Codex back, they say so explicitly. |

## Hard prohibitions per tool

### 🤖 Claude Code

- ❌ Never push directly to `main`; always via PR + audit + merge.
- ❌ Never commit secret values, `.env*` files with real values, or session tokens.
- ❌ Never run `pnpm publish` or anything that ships to a registry.
- ❌ Never `gh pr merge --admin` to bypass branch protection (branch protection on `main` is currently empty, but the prohibition stands).
- ❌ Never `--no-verify`, `--no-gpg-sign`, or otherwise skip hooks.

### 🎨 Claude Design

- ❌ Never claim source connectivity that backend has not validated.
- ❌ Never recommend a label that the chip vocabulary does not have a state for. Add a new state through the wave process; don't smuggle.

### 🌐 Claude Browser

- ❌ Never click `Deploy` / `Apply changes` / `Restart` / `Promote` / `Rollback` / `Pause` / `Resume` buttons unless explicitly authorized.
- ❌ Never sign in. Never create an account. Never enter credentials.
- ❌ Never paste a cookie, JWT, `x-clerk-user-id`, or any session material into a chat message.
- ❌ Never re-auth the operator's session in a different tab/window.

### 🖥 Claude Desktop

- ❌ Never execute shell commands directly. If a command needs to run, hand it to Claude Code.
- ❌ Never edit code files. Editing is Claude Code's lane.

### 🟧 OpenClaw

- ❌ Never used unless operator named it explicitly in the current message.

### ⏸ Codex

- ❌ Disabled. Do not invoke. If invoked accidentally, treat the result as informational only — the merge gate is Local Claude Code audit.

## When tool routing is ambiguous

Default order:

1. **Claude Code** if the task involves reading or writing repo files, running validation, or shipping a PR.
2. **Claude Browser** if the task involves a deployed-page observation.
3. **Claude Design** if the task involves visual judgement on a screen, mockup, or component composition.
4. **Claude Desktop** if the task is strategic planning across files / tools.

If still ambiguous, the operator picks. Agents do not silently broaden their lane.

## Audit gate routing (current)

```
PR opened
   ↓
Claude Code: run local audit checklist (docs/ops/wave-batch-template.md)
   ↓
Claude Code: classify SAFE / UNSAFE-<class>
   ↓
   ├── SAFE → Claude Code: gh pr merge <N> --squash --delete-branch=false
   └── UNSAFE → Claude Code: stop and report; operator decides next move
```

When Codex is re-enabled (future), it slots in **between** "PR opened" and the local audit step. The local audit then becomes a redundant double-check rather than the primary gate. The merge-protection hook (per `CLAUDE.md`) currently expects a real audit verdict in the transcript; the Local Claude Code audit satisfies that requirement.

## Cross-tool handoffs

Common patterns:

| From | To | Trigger |
|---|---|---|
| 🤖 Claude Code | 🌐 Claude Browser | Web-side change merged; needs visual QA on deployed surface |
| 🌐 Claude Browser | 🤖 Claude Code | Browser surfaces a classification (AUTH BLOCKED, RUNTIME FAILURE, etc.) that needs a code fix |
| 🎨 Claude Design | 🤖 Claude Code | New component spec → implementation wave |
| 🤖 Claude Code | 🎨 Claude Design | Component built; design reviews rendered output |
| 🖥 Claude Desktop | 🤖 Claude Code | Strategy chosen → execution begins |

Every handoff is logged in the wave's report (`Next Direction` block or per-task report).

## Re-enabling Codex (future)

If the operator decides to re-enable Codex (account quota restored, cost approved):

1. Operator declares re-enablement in a wave header.
2. Subsequent PR audits route through `codex exec review --base origin/main` per the original CLAUDE.md pattern (three audits: implementation / diff / copy).
3. Local Claude Code audit becomes the backup, not the primary gate.

Until that declaration is made, **Codex remains disabled**. Every PR ships through the Local Claude Code audit.
