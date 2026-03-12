# CONTEXT.md — VitalCV Canonical System Context
_Last updated: 2026-03-12. Maintained by SparkJoy (OpenClaw agent)._

---

## Mission

VitalCV eliminates the credentialing bottleneck that blocks clinicians from starting work —
turning repeated, manual verification into portable, permanent, cryptographically-proven trust.

By doing so, VitalCV directly attacks the projected US physician shortage of 124,000 by 2032 —
not by creating more clinicians, but by unlocking the capacity that already exists.

---

## The Core Bottleneck

Healthcare has a credentialing problem disguised as a staffing problem.

- A clinician is hired. She accepts. She cannot start for 90 days.
- Not because she is unqualified. Because every hospital re-verifies the same credentials from scratch.
- Fax machines. Paper packets. Credentialing committees. Manual board lookups.
- The ATS data is clear: talent is not the constraint. Interviews are not the constraint.
- **The bottleneck is at the bottom of the funnel — after the hire, before the start.**

---

## The Moneyball Insight

The Oakland A's didn't buy players. They bought runs.
*"As long as they get on first base."*

For healthcare recruiting: **don't buy clinicians — buy starts per year.**

To increase starts per year → increase interviews per year → push clinicians through credentialing faster.

VitalCV compresses credentialing from 45–90 days to under 24 hours.
That is not a workflow improvement. That is a workforce capacity multiplier.

**Founder proof:** Christopher Toler, as a clinician sourcing recruiter at Sutter Health,
managed 9 medical groups across 45+ specialties. Thousands of leads documented in ATS.
Pipelines full. The drop-off was always at credentialing — every time, without exception.

---

## Primary Buyers

| Buyer | Problem | Value Delivered |
|---|---|---|
| Hospital systems / IDNs | Slow time-to-start, compliance risk | Faster starts, reduced liability, capacity visibility |
| Locum tenens agencies | Re-credentialing every placement | Portable trust passports, instant clearance |
| Group practices | Manual PSV, expensive job postings | Free posting, pre-verified candidates |
| Credentialing bodies (MSOs, CVO) | Manual, error-prone workflows | Automated primary source verification |
| Government agencies (CMS, TEFCA) | Interoperability mandate compliance | OID4VCI/VP-compliant credential exchange |

---

## Core Users

| User | Entry Point | Core Job |
|---|---|---|
| Clinician (MD, DO, NP, PA, CRNA, RN, etc.) | NPI lookup → Trust Passport | Verify once, carry everywhere |
| Employer / Verifier | Post opportunity → review candidates | Hire pre-verified clinicians faster |
| Credentialing coordinator | Dashboard → PSV pipeline | Replace manual verification workflow |
| Issuing authority | Issuer onboarding → credential issuance | Issue cryptographic credentials to providers |

---

## Primary Metric

**Time-to-start** — days from hire to Day 1 of clinical work.

Industry baseline: 45–90 days.
VitalCV target: < 5 days (with Trust Passport).
Demo target: < 24 hours from NPI entry to verified credential.

---

## Secondary Metrics

- Credential portability rate (% of starts using an existing VitalCV passport)
- Clinician activation rate (NPI entered → Trust Passport generated)
- Employer adoption rate (opportunities posted → candidates verified)
- MATCHA match rate (clinicians matched to eligible opportunities)
- Clinic capacity score (new metric: starts enabled per quarter per employer)
- Time saved per credentialing cycle (hours, vs. industry baseline)
- Graph density (nodes + edges per clinician profile)

---

## Product Layers (in order of value delivery)

1. **Clinical Identity Layer** — NPI → verified profile (NPPES + PSV)
2. **Trust Passport** — portable credential bundle (SD-JWT VC, W3C compliant)
3. **Primary Source Verification (PSV)** — state boards, NPDB, DEA, OIG, ABMS
4. **Free Specialty Job Board** — all healthcare, all specialties, free to post
5. **Apply with VitalCV** — credential-aware application flow
6. **MATCHA** — AI career matching (gap analysis, readiness, opportunity fit)
7. **Clinic Capacity Intelligence** — first-ever metric: hires enabled per quarter
8. **Knowledge Graph** — traversable clinical identity + trust relationship graph
9. **Developer Platform** — SDKs, webhooks, embed, OID4VCI/VP for health systems
10. **Blockchain Anchor** — PSV results permanently anchored; never re-verify

---

## Long-Term Company Goal

Become the **trust infrastructure standard for US healthcare credentialing** —
the layer that every hospital, agency, government body, and clinician relies on —
operating like Stripe for trust: invisible, essential, and irreplaceable.

---

## Key Constraints

- No live database in dev (Prisma migrations are dry-run SQL; need `prisma migrate deploy` in prod)
- Tailwind v4 CSS-based tokens (no tailwind.config.ts)
- Next.js + Express split (frontend proxy → backend API at port 4000)
- Clerk for auth (x-clerk-user-id header pattern)
- pnpm monorepo — `pnpm --filter @vitalcv/api build` and `pnpm --filter web build`
- Feature flags in `apps/web/lib/features.ts`
- YC application active — March 13, 2026 is selection deadline
