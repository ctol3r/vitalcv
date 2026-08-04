# GitHub security controls hardening — 2026-08-02

Owner: platform security · Applied via API on 2026-08-02 (receipts below), with
the repo-side halves shipped in this PR.

The repository is **public**. Every control below is judged against that fact.

## What changed (applied live, 2026-08-02)

| Control | Before | After | Why |
|---|---|---|---|
| Secret scanning | **disabled** | **enabled** | Public repo with an active agent fleet pushing branches; a leaked Railway/Clerk/Stripe token would otherwise be discovered by crawlers before us. |
| Secret scanning: push protection | **disabled** | **enabled** | Blocks the credential at `git push` time instead of alerting after exposure. |
| Private vulnerability reporting | **disabled** | **enabled** | Gives external reporters a disclosure channel that is not a public issue. |
| Required status checks on `main` | 5 contexts | **13 contexts** (14 after this PR merges) | Live protection had drifted **behind** the committed contract in `scripts/check-workflow-path-filters.js` — 4 of the 9 checks that file documents as "promoted to required 2026-07-26" were not actually required on main. Re-synced and extended to every gate that runs on all PRs. |
| Dependabot security updates | enabled | enabled (unchanged) | — |
| Actions default token permissions | `read` | `read` (unchanged) | Already least-privilege. |
| `can_approve_pull_request_reviews` | false | false (unchanged) | Actions cannot self-approve. |

### Required checks on `main` — after

The 13 live now, all verified to run on **every** PR (no `paths:` on
`pull_request` — the #806/#811/#871 trap):

1. `SCA — critical-only gate`
2. `Rust SCA — critical-only gate`
3. `Web E2E (Playwright)`
4. `Web E2E (real auth)` *(new)*
5. `Web Quality`
6. `axe WCAG 2.2 AA` *(new — was in the committed contract, not live)*
7. `Identity-header trust ratchet` *(new)*
8. `Canonical Source Adapter Gate` *(new)*
9. `check-design-lint`
10. `check-copy-source-liveness` *(new — was in the committed contract, not live)*
11. `check-public-claims` *(new — was in the committed contract, not live)*
12. `check-route-guards` *(new)*
13. `check-workflow-contract` *(new — was in the committed contract, not live)*

**14th, staged in this PR:** `Backend Tests (Postgres)`. Its workflow was
path-filtered on `pull_request`, which is disqualifying for a required check;
this PR removes the filter (push filtering stays — it cannot affect PR check
runs). **After this PR merges**, add it to live protection:

```bash
gh api -X PATCH repos/ctol3r/vitalcv/branches/main/protection/required_status_checks \
  --input - <<'JSON'
{"contexts": ["SCA — critical-only gate","Rust SCA — critical-only gate","Web E2E (Playwright)","Web E2E (real auth)","Web Quality","axe WCAG 2.2 AA","Identity-header trust ratchet","Canonical Source Adapter Gate","check-design-lint","check-copy-source-liveness","check-public-claims","check-route-guards","check-workflow-contract","Backend Tests (Postgres)"]}
JSON
```

then prove both directions of the contract:

```bash
node scripts/check-workflow-path-filters.js --verify-protection
```

### Protection settings left as-is (deliberate)

- `enforce_admins: true` — stays. Admin merges obey the same gates.
- `strict: false` (branches need not be up to date) — stays. With this many
  concurrent lanes, mandatory rebase-before-merge would serialize the fleet;
  CI already builds the PR merged with main (see memory: green local ≠ green CI).
- **No required reviews** — stays. Single-maintainer repo; a review requirement
  would deadlock solo merges. Revisit when a second human maintainer exists.
- `allow_force_pushes: false`, `allow_deletions: false` — already safe.

## Gaps that need the founder (cannot be done from this seat)

1. **`RAILWAY_API_TOKEN` / `RAILWAY_TOKEN` repo secrets are empty.** The
   `deploy-web.yml` "Exact-SHA web deployment" convergence audit fails on
   **every** push to main ("RAILWAY_API_TOKEN or RAILWAY_TOKEN is required") —
   the web service still deploys via Railway's own GitHub integration, so the
   red run is *pure noise that trains blindness* to real deploy failures.
   Fix: create a Railway project token (Railway → project settings → Tokens)
   and `gh secret set RAILWAY_API_TOKEN`. Agent policy forbids agents moving
   credentials; this is a human step.
2. **`required_conversation_resolution`** — recommended `true`; the granular
   API endpoint doesn't exist and the full-protection PUT is above this seat's
   permissions. One click in Settings → Branches → main.
3. **Secret-scanning backlog triage.** Scanning was just enabled on a repo
   with 8 months of public history; when the initial scan lands, review
   Security → Secret scanning alerts. Anything live must be rotated at the
   provider, not just closed.
4. Optional, worth weighing: `delete_branch_on_merge` (hygiene; hundreds of
   merged remote branches exist), squash-only merge methods (history is
   already squash-shaped), and Actions `sha_pinning_required`.

## Open-PR disposition

The 258 open PRs are dispositioned in
[`open-pr-disposition-2026-08-02.md`](open-pr-disposition-2026-08-02.md).
