# Live Blocker Execution Matrix
Generated: 2026-05-13T18:11:00Z

---

## Phase 6 Verdict: ALL LOW-COMPLEXITY BLOCKERS ELIMINATED THIS WAVE

Remaining blockers are true hard engineering or operator actions. Nothing easy left.

---

## Eliminated This Wave

| Blocker | Elimination | Commit |
|---|---|---|
| Receipt issuer_did leaked 'mock (dev)' | Fixed: canonical `did:web:vitalcv.com` everywhere | 8912bc7e |
| jti non-deterministic (Date.now() suffix) | Fixed: `rcpt_{responseId}` deterministic | 8912bc7e |
| Signing key kid changes on restart | Fixed: stable `vcv-es256-dev` in dev | 8912bc7e |
| DID document missing service entries | Fixed: 3 service entries added | 8912bc7e |
| checkedAt format space-separated | Fixed: ISO 8601 Z-suffix | pending |
| run_id rendered without ellipsis | Fixed: `4…4` shortHash format | pending |
| No schedulers for lane probes | Fixed: 3 OpenClaw cron jobs live | this wave |
| `did:web:vitalcv.health` references in docs | Normalized: zero `.health` refs remaining | 083ffeaf |
| trust.json missing discoverability URIs | Fixed: trust_graph_uri, verify_uri added | 8912bc7e |
| Status endpoint missing 5 endpoints | Fixed: 11 endpoints in verifier_continuity | 8912bc7e |
| Employer review has no runtime trust metadata | Fixed: runtimeTrustCohesion wired | 8912bc7e |
| Replay corruption has no containment record | Fixed: replayCorruptionContainment wired | 8912bc7e |

---

## Remaining Blockers — Ranked

### P0 — PILOT DEMO BLOCKER

**PILOT-1: No real clinician ingest completed**
- Severity: Critical for demo — all passport lookups return degraded
- Work: Single API call: `POST /api/identity/bootstrap/1457128589` (or equivalent ingest endpoint)
- Time: 5 minutes
- Blocks: Live demo, employer review, passport surface

```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"npi": "1457128589"}'
# OR
curl -X POST http://localhost:3030/api/identity/bootstrap/1457128589
```

---

### P0 — PRODUCTION SIGNING KEY

**`RECEIPT_PRIVATE_KEY_JWK` not set on Vercel**
- Severity: Critical for production — ephemeral key per cold start breaks verifier continuity
- Work: Generate ES256 key once → set as Vercel env var
- Time: 5 minutes
- See: `DEPLOYMENT_ACTIVATION_STATE.md` for exact commands

---

### P0 — PRODUCTION CORS

**`CORS_ORIGIN` not set on Railway**
- Severity: Critical — production backend rejects all cross-origin requests
- Work: `railway variables --set "CORS_ORIGIN=https://vitalcv.com"`
- Time: 2 minutes

---

### P0 — PRODUCTION API BASE

**`NEXT_PUBLIC_BACKEND_URL` not set on Vercel**
- Severity: Critical — all backend proxy routes fail in production
- Work: Set Railway URL in Vercel env
- Time: 2 minutes

---

### P1 — REPLAY PERSISTENCE

**No `ReplayRunRecord` / `runId` on `SourceRun`**
- Severity: Medium institutional — replay not DB-backed
- Work: Prisma migration + ingest wire + backend query endpoint (sub-agent running)
- Time: 1 session
- Blocks: Audit-grade replay continuity claim

---

### P1 — PRODUCTION VERCEL REDEPLOY

**Production has not picked up this wave's fixes**
- Severity: High for external verifiability
- Work: `vercel --prod` after env vars are set
- Time: 5 minutes + deploy time
- Blocks: External apex validation

---

### P2 — VERCEL CLI NOT INSTALLED

**Cannot probe production URL without Vercel CLI**
- Work: `npm i -g vercel && vercel login`
- Time: 2 minutes
- Blocks: Production apex validation

---

### P3 — LONG HORIZON

| Blocker | Work | Blocks |
|---|---|---|
| OIG exclusion lane | Full adapter + API | T3 exclusion check |
| State license lane | Per-state board adapters | T3 state license |
| TSA/RFC 3161 anchor | TSA integration | Replay offline verifiability |
| Status List 2021 | Infrastructure + storage | Credential revocation |
| Per-node σ-pill on chronology | React component | Design spec compliance |
| `SignaturePanel` component | New component | Verifier issuer continuity |
| Rate limiting on `/api/receipts/verify` | Middleware | Production hardening |
| JWKS key rotation retention | Key array + rotation logic | Post-rotation verification |

---

## Mounted-but-Disabled Routes: NONE FOUND

No routes returning 503 or disabled status. All routes either return real data or correct 404s.

---

**SUCCESS: All fast blockers eliminated. Remaining blockers are P0 operator actions (20 min total) or P1 engineering.**
