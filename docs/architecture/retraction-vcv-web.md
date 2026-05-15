# Retraction — `vcv-web` as canonical Vercel project (INVALID)

**Date:** 2026-05-15 (B18 wave).
**Status:** Retracts a load-bearing claim in the prior B16/B17
convergence documents.

## What was claimed

The following documents in this PR (#363, branch `wave/b16-convergence-final`)
named `vcv-web` as the canonical Vercel project for VitalCV apex:

- `vercel-convergence-diagnosis.md`
- `signing-identity-convergence-report.md`
- `final-deployment-sequence.md`
- `preview-runtime-safety-audit.md`
- `b16-executive-convergence-summary.md`

The basis for that claim was an inference from prior session memory.
The claim was NOT verified against Vercel dashboard reality.

## What was discovered

External verification confirmed:

- **`vcv-web.vercel.app` does NOT belong to VitalCV.** It is an unrelated third-party Vercel project.
- **`vitalcv.com` (apex) currently returns HTTP 402** "This deployment is temporarily paused."
- **The actual canonical Vercel project is unknown** until the operator confirms it in the Vercel dashboard.

## Resulting invalid actions to avoid

Per the user's B18 directive, the following are now forbidden until
the real canonical project is identified:

- DO NOT alias `vitalcv.com` to `vcv-web`.
- DO NOT redeploy toward `vcv-web`.
- DO NOT update DNS toward `vcv-web`.
- DO NOT document `vcv-web` as canonical.
- DO NOT continue convergence assumptions that depend on `vcv-web` being VitalCV.

## What replaces the invalid claim

Three new documents in this PR (B18 wave):

1. `production-restore-sequence.md` (B18-TRUTH-04) — minimum path to restore externally reachable production. **Begins with operator-side discovery of the canonical Vercel project; does not presume any specific name.**
2. `pause-root-cause-report.md` (B18-TRUTH-02) — diagnostic for resolving the HTTP 402 pause.
3. `domain-topology-audit.md` (B18-TRUTH-03) — diagnostic for verifying domain attachment and detecting stale project claims.

## Disposition of the original five docs

Each of the five affected docs has been updated with:

- A "RETRACTION HEADER" at the top pointing to this notice.
- Replacement of every `vcv-web` reference with `<canonical-project-TBD>` or generic "the canonical Vercel project (per `production-restore-sequence.md` §1)".

The body content remains otherwise intact for audit-trail purposes —
the operational guidance about env vars, fail-closed guards, and
verification commands is still valid; only the project-name
assignment was wrong.

## What is NOT retracted

These claims from the original convergence docs remain valid (they
are code-level facts independent of which Vercel project deploys
them):

- The fail-closed signing-identity guard in `apps/web/lib/crypto/receiptIssuer.ts` is structurally correct.
- The three former leakage paths are confirmed closed at code level.
- `force-dynamic` on `/api/.well-known/jwks.json` and `/.well-known/did.json` is correct.
- The `/api/receipt/[lineageKey]:120` env-resolved kid is correct.
- The replay persistence stack (PR-α/β/γ) is on origin/main.
- The expected canonical kid value `vcv-es256-1` (for `RECEIPT_KID`) remains the target.

The retraction is scoped strictly to the **Vercel project name
identification**, not to any other claim.

## Lessons for future convergence work

- Do not name external infrastructure in convergence docs based on session memory or inferred patterns.
- Always require operator-side dashboard confirmation before pinning project / team / domain names.
- Project names in third-party platforms are not derivable from repo state; they must be observed live.

This retraction is the kind of correction that a healthy
documentation process should make easy. The fix is small and
isolated; the underlying code-level claims are unaffected.
