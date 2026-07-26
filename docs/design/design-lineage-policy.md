# Design Lineage Policy

**Effective 2026-07-01 (owner directive). Applies to every product PR.**

The goal is traceability: every design-led implementation must have visible lineage from
**handoff file → production component → route → test → production verification**.

## The handoff bundle

The canonical Claude Design handoff lives in the repo at
`design-handoff/claude-design-2026-06-26/` (650 files; see the committed ingestion artifact
[claude-design-handoff-index.md](claude-design-handoff-index.md) for the folder map, the primary
entrypoint `vitalcv/project/wave1400/index.html`, its imports, and the
canonical / superseded / duplicate / deferred / not-implemented classification).

Per the bundle's own README: the design files are HTML/CSS/JS **prototypes, not production code**.
Implement by matching the visual output in the target stack; do not copy prototype internals. Read
the source directly — dimensions, colors, and layout rules are spelled out in it.

## Rules

1. **Every product PR body must contain a section titled `Design Handoff References`.**
2. If handoff files informed the PR, list them with exact repo-relative paths, e.g.:
   - `design-handoff/claude-design-2026-06-26/vitalcv/project/wave1400/view-operations.jsx`
   - `design-handoff/claude-design-2026-06-26/vitalcv/project/Clinician Profile.html`
   - `design-handoff/claude-design-2026-06-26/vitalcv/project/Readiness Report.html`
   - `design-handoff/claude-design-2026-06-26/vitalcv/project/Career Evidence Graph W220.html`
3. If no handoff file influenced the PR, the section must say exactly:
   > No Claude Design handoff file used for this PR.
4. **Never claim a feature is design-aligned without naming the specific handoff files used.**
   A file may only be cited as design authority if it was actually read for that PR.
5. Do not implement from a file the index classifies as **superseded** or **duplicate**; when a
   newer file exists, cite and use the canonical one.
6. Truth-contract rules still dominate: prototype copy that conflicts with the banned-strings list
   or the source-coverage honesty vocabulary (`CLAUDE.md`) must be adapted, and the PR should note
   the deviation next to the file reference.
7. New handoff bundles get their own dated directory under `design-handoff/` and a refreshed
   ingestion index before use.

## Verification chain

A design-led PR should make each hop checkable: the PR body names the handoff file(s); the
component/route it produced; the test pinning the behavior or copy; and the production check
performed after deploy. If any hop is missing, say so in the PR rather than implying it.
