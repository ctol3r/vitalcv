# Secret Scan & Triage — 2026-07-06 (M0-3)

**Tool:** gitleaks 8.30.1 (`gitleaks git`, full history)
**Scope:** 3,039 commits, ~394 MB
**Raw report:** `docs/security/gitleaks-report-2026-07-06.json`

## Result: no live production secrets. No rotation required.

192 findings, all triaged as non-secrets (test fixtures, placeholders, docs
examples, generated/backup dirs).

| Rule | Count | Disposition |
|---|---|---|
| generic-api-key | 162 | Test fixtures, docs examples, `.backup`/`.next` generated dirs |
| curl-auth-header | 17 | Docs curl examples (`docs/api/`, `apps/docs/`) |
| jwt | 5 | Test JWTs in `__tests__` (sdJwt, verifyCredential, eudiIssuer) |
| stripe-access-token | 4 | Literal placeholder `sk_live_1234567890abcdef` in `.backup` tefca test |
| linkedin-client-secret | 2 | False positive on variable name `portfolioCha…` in a historical ProfileSurface commit |
| private-key | 2 | `TEST_PRIVATE_KEY_PEM` fixture in `tests/fixtures/issuer.ts` (intentional test key) |

### High-risk classes verified individually
- **stripe-access-token** → `apiKey: 'sk_live_1234567890abcdef'` — obvious placeholder, not a real key.
- **private-key** → `export const TEST_PRIVATE_KEY_PEM = ...` — deliberate test fixture, P-256 test keypair.
- **linkedin-client-secret** → matched a `portfolioCha…` identifier, not a credential.

## Remediation performed
1. `apps/api/backend/.env.production` (comment-only template, no live secrets) **removed from git tracking**; preserved as tracked `.env.production.example`.
2. `.gitignore` hardened: ignore all `.env` / `.env.*`, allow only `*.example`.
3. `.gitleaks.toml` added with an allowlist for the fixture/docs/backup paths above, so a clean run is CI-gateable (see M3-8 / M1-8).

## Follow-ups (later waves)
- Wire `gitleaks` as a CI gate on protected paths (M3-8).
- History rewrite is **not** warranted — no live secrets were ever committed.
