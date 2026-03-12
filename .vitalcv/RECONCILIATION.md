# RECONCILIATION.md — Repo Reality vs Strategic Intent
_Last reconciled: 2026-03-12 15:00 PDT_

## Method
Full repo scan: Prisma schema (67+ models), route files (86+), service directories (97+), git log, .vitalcv/ knowledge layer.

---

## Architecture State

### Layer 1 — Identity
| Component | Strategic Intent | Repo Reality | Gap |
|---|---|---|---|
| NPI lookup | Live NPPES | ✅ Live, production-ready | None |
| DID registry | did:vitalcv resolution | ✅ Built, in-memory | Needs Prisma persistence |
| WebAuthn/Passkey | Biometric auth | 🔶 Stub (routes exist, no real flow) | Phase 4 |
| Clinical identity enrichment | Doximity, PubMed, LinkedIn | ❌ Not built | Phase 2 |

### Layer 2 — Evidence (PSV)
| Source | Intent | Reality | Gap |
|---|---|---|---|
| NPPES | Live verification | ✅ Live | None |
| Nursys | Nursing licenses | ✅ Adapter built | Not tested against live API |
| BreEZe/DCA | CA medical board | ✅ Adapter built | Not tested against live API |
| FSMB | Federation state boards | ✅ Adapter built | Not tested against live API |
| OIG/LEIE | Exclusion check | 🔶 Stub in PSV pipeline | Wave 241 |
| NPDB | Malpractice | 🔶 Partial adapter | Wave 242 |
| DEA | Controlled substance | 🔶 Stub | Phase 2 |
| ABMS | Board certification | ❌ Not built | Wave 243 |
| Document Intelligence | AI credential parsing | ✅ Built (Wave 237) | Hardened (237h) |

### Layer 3 — Trust Computation
| Component | Intent | Reality | Gap |
|---|---|---|---|
| Credential issuance (ES256) | Sign VCs | ✅ Built | None |
| SD-JWT selective disclosure | Privacy-preserving sharing | ✅ Built | None |
| OID4VCI/VP | Standards compliance | ✅ Built | None |
| Revocation registry | Credential lifecycle | ✅ Built | None |
| Audit ledger | Append-only trail | ✅ Built + wired to doc parse | None |
| Decision Capsule | Employer decisions | ✅ Built | Not wired to live flow |
| CandidateCredential pipeline | Upload → ingest → verify | ✅ Built (Wave 238) | First real data flow |
| Trust state machine | walletMachine/verifierMachine | ✅ Built | Not wired to credential pipeline |

### Layer 4 — User Experience
| Surface | Intent | Reality | Gap |
|---|---|---|---|
| Homepage | YC-ready dark design | ✅ Live, antigravity system | None |
| Document Intelligence | Credential upload + parse | ✅ Live at /documents | None |
| Credential onboarding | Upload → review → ingest | ✅ Built (Wave 238) | Needs deploy |
| Explore / Apply | Marketplace loop | ✅ Live | Match badges pending (Wave 239) |
| Verifier inbox | Live applications | ✅ Live (Wave 234) | None |
| Holder opportunities | MATCHA-powered matches | 🔶 Hardcoded | Wave 239 in progress |
| Mobile | React Native app | ❌ Not built | Phase 4 |

### Layer 5 — Intelligence
| Component | Intent | Reality | Gap |
|---|---|---|---|
| MATCHA engine | Multi-dimensional scoring | ✅ Built (Wave 187) | Uses mock data in routes |
| MATCHA live service | Real DB queries | ✅ Built (liveMatchaService.ts) | Route wiring in progress (239) |
| Credential enrichment | Uploaded creds improve scores | ✅ Just wired | Needs 239 deploy |
| Capacity model | Starts-per-quarter metric | ❌ Not built | Wave 240, gated |
| Ask VitalCV | AI Q&A | 🔶 Flag-gated | Phase 3 |

### Layer 6 — Network Effects
| Component | Intent | Reality | Gap |
|---|---|---|---|
| Federation | External network discovery | ✅ Built | Seeded, not live-probing |
| Free job board | All specialties | ✅ Built | None |
| Passport sharing | QR + Wallet | ✅ Built | None |
| Specialty aggregation | Auto-pull from boards | ❌ Not built | Phase 3 |

---

## Critical Flows — Status

| Flow | Status | Blocking Issue |
|---|---|---|
| NPI → Trust Passport | ✅ Works | None |
| Upload credential → Parse → Review → Ingest | ✅ Built | Needs production DB |
| Upload → Better MATCHA scores | ✅ Wired | Pending Wave 239 deploy |
| Clinician applies to opportunity | ✅ Works | None |
| Verifier reviews applications | ✅ Works (live data) | None |
| Employer posts opportunity | ✅ Works | None |
| MATCHA matches real opportunities | 🔄 Building | Wave 239 |
| Capacity score computes from real data | ❌ Not built | Wave 240 (gated) |

---

## Strategic Gaps — Ranked by Leverage

| # | Gap | Impact | Depends On | Wave |
|---|---|---|---|---|
| 1 | MATCHA routes use mock data | Intelligence layer is fake | liveMatchaService exists | 239 (building) |
| 2 | Capacity model doesn't exist | No enterprise sales metric | Real application + start data | 240 |
| 3 | OIG/LEIE not checked | Safety signal missing | Public dataset available | 241 |
| 4 | NPDB incomplete | Malpractice check missing | API access needed | 242 |
| 5 | ABMS not integrated | Board cert verification | API partnership | 243 |
| 6 | Mobile app not built | "Not portable" | Core flows solid first | 250+ |

---

## Re-Ranked Next Waves

1. **Wave 239** — MATCHA live (in progress): replace mock routes with liveMatchaService + credential enrichment
2. **Wave 240** — Capacity score MVP: compute from real Application + CandidateCredential records
3. **Wave 241** — OIG/LEIE exclusion check: public dataset, adds safety signal
4. **Wave 242** — Trust state machine wiring: connect walletMachine to credential pipeline events
5. **Wave 243** — NPDB malpractice integration

---

## Doctrine Compliance Check

| Rule | Status |
|---|---|
| Trust durability over demo features | ✅ Durable Prisma store, audit trail |
| Clinician onboarding over aesthetic | ✅ Wave 238 before any UI polish |
| Verifier confidence over UI polish | ✅ Live inbox, audit events |
| Buyer proof over speculative capability | ✅ Document Intelligence is real, not mock |
| Small safe waves over large rewrites | ✅ Incremental: 237→237h→238→239 |
| No MATCHA until real credential data | ✅ MATCHA enriched from CandidateCredential |
| No capacity until real application data | ✅ Wave 240 gated |
