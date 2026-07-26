# Tonight's Final State
Generated: 2026-05-13T20:45:00Z
Build: PASSING ✅
Branch: wave-10a/docs-status = main (af3245bd)

---

## 1. What Shipped Tonight

### Runtime Infrastructure (earlier in day)
- `priorRunId` chain in PostgreSQL — 3-run chain for NPI 1457128589
- `replayReconstructor.ts` — `reconstructChain`, `repairChain`, `reconstructAll`
- Replay DB-first retrieval — `GET /api/replay/[runId]` returns PostgreSQL records
- `GET /api/replay/runs/by-npi/:npi` — enriched with entityId, chronologyIndex, newest-first
- `GET /api/replay/chain/[npi]` — continuityState, firstObservedAt, lastObservedAt
- 3 OpenClaw schedulers (degraded probe 30min, lane probe 6h, replay reconciliation 12h)
- 7 Vercel production env vars set (signing key, Clerk, backend URL, env label)
- ES256 production signing key — `vcv-es256-1` (durable across cold starts)

### Productization (tonight)
| Commit | What |
|---|---|
| `47e67397` | Compact replay strip, structural reorder, calm degraded banner |
| `50b5bdfa` | Confirmed/Checking/Not checked states, ISO 8601 timestamps |
| `8ede079b` | Decision-first employer console, trust-weighted lanes |
| `3ec16ad2` | Verdict bar first on verifier, monochrome tier badge, institutional sections |
| `411d28eb` | Empty inbox hidden, blocker fields reduced, timestamp grid removed |
| `cb861362` | "Identity confirmed" score framing, "N of M sources" callout |
| `30b70b6d` | "Verification record" label, ref: prefix, lineageKey → "Identity" |
| `7ca36d37` | Section rhythm, sliding loading bar, compact inbox |
| `d384c9db` | NPPES_API → "NPPES Registry", infra labels purged from UI |
| `877f455c` | Source label completeness, review copy — "Start Assessment", no "packet" |
| `e46dff16` | Phase labels momentum-driven, "Identity confirmed" eyebrow |
| `af6cba33` | Personal value sentence, "See a live example →", tier ladder simplified |
| `d384e3ff` | Trust posture state expansion, SectionReveal passthrough |
| `4043f726` | Passport API shape, "Source-backed" label, ProvenanceStrip |
| `af3245bd` | Build fix — TypeScript type error |

---

## 2. What Materially Improved

| Surface | Before | After |
|---|---|---|
| Verifier `/verify/[npi]` | No verdict bar, colored tier badges | Verdict bar first, monochrome, institutional sections |
| Passport `/passport?npi=...` | "Checking primary sources…", "Provider" eyebrow | "Confirming your identity…", "Identity confirmed" |
| Employer console | Equal-weight layout, all blocker fields | Decision-first, displayName + requiredAction only |
| Source labels | `NPPES_API`, `OIG_LEIE`, "packet" | "NPPES Registry", "OIG LEIE", "credentials" |
| Homepage | "Use demo NPI ↑", T1/T2/T3/T4 table | "See a live example →", single sentence |
| Degraded states | "Unavailable", "Cannot verify" | "Not checked", "Not available", blue-tinted pending |
| Replay strip | 3-section card with expandable chronology | Single flat metadata strip |
| Loading states | `animate-pulse` on text | Sliding thin bar, static label |

---

## 3. What Remains Degraded

| Surface | Degraded State | Reason |
|---|---|---|
| Production replay chain API | Returns `degraded: true` externally | Railway backend not confirmed reachable from Vercel |
| Passport for all NPIs except 1457128589 | Shows degraded mode | Only 1 NPI ingested |
| OIG/PECOS/state lanes | Always "Not checked" | Sources pending integration |
| TSA/RFC 3161 anchor | Not wired | Not implemented |
| Status List 2021 | Not wired | Not implemented |

---

## 4. Remaining Operational Risks

| Risk | Severity | Fix |
|---|---|---|
| Railway backend URL not confirmed reachable from Vercel | High | Test `curl https://vitalcv.com/api/replay/chain/1457128589` — if 404 or degraded, confirm Railway URL |
| Only 1 NPI with data (1457128589) | High for demo | POST /api/ingest/{npi} for 2-3 more NPIs (~5 min each) |
| Production signing key bytes ephemeral in dev | Low (prod stable) | `RECEIPT_PRIVATE_KEY_JWK` already set on Vercel |
| `reconstructAll()` not wired to backend startup | Medium | 5-line addition in server.ts |
| Build passes but not verified post-push | Low | Vercel auto-builds from main push |

---

## 5. Remaining UX/Productization Opportunities

Ranked:

1. **"You're ready to share" completion moment** — when phase=done, show CTA: "Share with an employer" + "View your full passport". Currently the done state just shows "Identity confirmed" as label.

2. **Collapse unintegrated source lanes** — render `LaneHealthMount` showing only NPPES (verified) by default. Collapse OIG/PECOS/state into "3 additional sources — integrating." First impression shifts from "4/6 not checked" to "identity confirmed."

3. **Ingest 3-5 more NPIs** — operator action, 5 min per NPI. Makes the product feel live, not a single-record demo.

4. **Confirm Railway backend connectivity** — test from external IP, not localhost.

5. **"No account required" as trust badge** — move the disclaimer to above the submit button as a positive feature statement.

---

## 6. Current Deployment State

| Layer | State |
|---|---|
| Vercel (web app) | ✅ Auto-building from main push `af3245bd` |
| Production signing key | ✅ `RECEIPT_PRIVATE_KEY_JWK` set — durable |
| Clerk | ✅ Keys set on Vercel production |
| Backend URL | ✅ `NEXT_PUBLIC_BACKEND_URL` set to Railway URL |
| Railway backend | ⚠️ Not confirmed reachable from Vercel |
| Local dev | ✅ localhost:3030 + localhost:4000 both running |
| DB | ✅ PostgreSQL vitalcv_dev — 36 source_runs, 38+ receipts |

---

## 7. Current Branch Topology

```
main                    af3245bd ← tonight's canonical state
wave-10a/docs-status    af3245bd ← same (synced)

Notable unmerged:
  board/prf-delta       ahead 4, behind 95 (stale)
  a11y/homepage-main-landmark (accessibility fix, not merged)
```

---

## 8. Next Highest-Leverage Priorities (Tomorrow)

1. **Confirm Railway backend reachable externally** — test `curl https://delightful-essence-production.up.railway.app/api/replay/runs/by-npi/1457128589`
2. **Ingest 3 more NPIs** — `POST /api/ingest/{npi}` via Railway URL (with x-org-id: vcv-system)
3. **"You're ready to share" completion component** — 30 min, single new component
4. **Collapse unintegrated source lanes** — 30 min in LaneHealthSection.tsx
5. **Wire `reconstructAll()` to backend startup** — 5 lines in server.ts

**No architecture needed. No new systems. Content and operator actions only.**
