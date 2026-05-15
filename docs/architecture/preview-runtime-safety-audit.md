# Preview Runtime Safety Audit

**B17-CODE-02 deliverable.** Verifies preview deployments cannot
emit misleading institutional trust posture, given that Vercel
preview deploys run under `NODE_ENV=production`.

## §1 — The preview/production NODE_ENV gotcha

Vercel sets `NODE_ENV=production` for both production AND preview
deployments. Only local `vercel dev` and explicit dev branches use
`development`. This means:

| Code that branches on `NODE_ENV === 'production'` | Fires in production | Fires in preview |
|---|---|---|
| Receipt issuer fail-closed guard (`apps/web/lib/crypto/receiptIssuer.ts`) | Yes | Yes |
| `/api/receipt/[lineageKey]` route — env-resolved kid (vs `'vcv-es256-dev'`) | Yes | Yes |
| `/api/receipt/[lineageKey]` `isDev()` dev-mock branch | No | No |
| `/api/health` config posture booleans | (env-derived) | (env-derived) |

**Consequence:** without Preview-scope env vars, preview deploys
behave like production with missing env — JWKS/DID return 500,
`/api/status` reports `degraded`. This is **safer than dev-key
leakage** but breaks preview testing of signing surfaces.

## §2 — Per-surface preview safety verdict

| Surface | Preview behavior without env | Verdict |
|---|---|---|
| `/api/.well-known/jwks.json` | 500 (fail-closed throw) | SAFE — refuses to publish |
| `/.well-known/did.json` | 500 | SAFE |
| `/api/status` | 200; `runtime_continuity.signing_key_id: null`, `runtime_continuity.status: "degraded"` | SAFE — honest signal |
| `/api/receipt/[lineageKey]` | 200; `signingKeyId: "vcv-es256-1"` (env-resolved default) | SAFE — emits canonical production default, never `"vcv-es256-dev"` |
| ES256 receipt JWT signing (`signIssuerReceipt`) | Throws on first invocation | SAFE |
| `/api/health` | 200; `clerk.enabled: false`, `apiBase: false` | SAFE — honest signal |
| Homepage `/` and `/passport` | Render normally (no signing dependency on page load) | SAFE |
| `/api/replay/*` (when migration applied) | Returns 503 `replay_infrastructure_unavailable` if Prisma table missing on preview DB | SAFE — stable error code |

## §3 — Wording / posture audit

Even when env is missing on preview, no surface emits language that
implies the preview environment IS production. Specifically checked:

| Surface | Status | Wording check |
|---|---|---|
| `/api/health` | Returns `service: "web"` literal — same in preview and production. This is the runtime identifier, not an environmental claim. | OK |
| `/api/status` | Returns `environment: process.env.VITALCV_ENV_LABEL ?? process.env.NODE_ENV ?? 'unknown'`. If preview sets `VITALCV_ENV_LABEL=preview`, the status surface reports that label honestly. If unset, it reports `"production"` (because `NODE_ENV=production` on preview). Operator should set `VITALCV_ENV_LABEL=preview` on Preview scope to avoid misreporting. | NEEDS OPERATOR CONFIG |
| Homepage copy | "Foundation preview" framing + explicit disclaimer that onboarding does not finish the credentialing process, already foundation-honest on `origin/main` | OK |
| `/onboarding` | Copy explicitly disclaims completing credentialing | OK |
| `/pricing` | "Pricing is a foundation preview. Payments are not collected in this build." | OK |
| `/docs` | "Docs are a launch-readiness foundation, not complete API documentation." | OK |
| `/status` | "Status surfaces are foundation previews. No uptime guarantee is implied." | OK |

## §4 — Required operator action for preview safety

Two recommendations, in priority order:

### Recommendation 1: Set `VITALCV_ENV_LABEL=preview` on Preview scope

Without this, `/api/status` reports `environment: "production"` on
preview deploys (because `NODE_ENV=production` is the inherited
default). Setting `VITALCV_ENV_LABEL=preview` ensures the status
surface honestly identifies preview deployments to any external
probe.

Effort: 30 seconds in Vercel dashboard. Apply to all preview
environments (including PR previews).

### Recommendation 2: Choose preview signing posture

**Option A (preview-key)**: set `RECEIPT_PRIVATE_KEY_JWK` +
`RECEIPT_KID=vcv-es256-preview-1` on Preview scope. JWKS/DID surfaces
work on preview deploys; preview-issued receipts are clearly
distinguishable by kid prefix. The preview-key MUST be different from
production's `vcv-es256-1` to prevent identity collision.

**Option B (preview-500)**: leave Preview scope empty. Preview deploys
500 the signing surfaces. Acceptable if you don't test those routes
on previews; UI-only previews still work.

Either option is safe. Option A is strictly more functional; Option B
has lower operational surface area. Recommendation: **A** for any
preview that institutional reviewers might probe, **B** for transient
PR previews.

## §5 — What still requires verification AGAINST a live preview

The above analyses are static (code-level). Verification that an
actual deployed preview behaves as described requires running probes
against a live preview URL. Operator-side commands:

```bash
PREVIEW_URL="https://vcv-web-git-some-branch.vercel.app"  # whatever Vercel assigns

# Confirm preview labels itself honestly (after Recommendation 1):
curl -s "$PREVIEW_URL/api/status" | jq '.runtime_continuity, .environment // empty'
# Expect environment field to be "preview", not "production".

# Confirm signing posture (per chosen option in Recommendation 2):
curl -s "$PREVIEW_URL/api/.well-known/jwks.json" | jq '.keys[0].kid'
# Option A: emits "vcv-es256-preview-1" (or whatever you set)
# Option B: returns 500

# Confirm no banned phrase regression on the preview homepage:
curl -s "$PREVIEW_URL/" | grep -iE "automatically verified|HIPAA compliant|SOC2 certified"
# Expect: no output.
```

## §6 — Verdict

**Code-level preview safety: VERIFIED.** No code path on origin/main
can leak `"vcv-es256-dev"` or fabricate institutional posture from a
preview deployment. The fail-closed guard fires before any dev
identity can be emitted; the receipt-route default resolves to the
canonical production value `"vcv-es256-1"` regardless of env presence
in NODE_ENV=production contexts.

**Operational preview safety: REQUIRES OPERATOR CONFIG.** Two small
configurations on the Preview scope (env label + signing posture
choice) close the remaining gap. Estimated effort: <2 minutes total.

No code change is needed beyond what already shipped on PR-362.
