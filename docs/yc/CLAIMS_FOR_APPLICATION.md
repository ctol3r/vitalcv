# VitalCV — approved claims for the YC application

**Status:** canonical wording for the 2026-07-27 submission. Every sentence in the application, the founder video, and the demo must be traceable to this file or to live product behavior.
**Sources:** YC second-submission audit (2026-07-26), founder demo runbook (2026-07-27), CLAUDE.md truth contract, `apps/web/lib/trust/sourceLanes.ts` (the registry that drives `/status`, `/api/status`, and the homepage ledger).

## The one sentence

> VitalCV helps clinicians apply once with portable, source-backed career evidence, so employers begin credentialing from a trusted head start instead of restarting a document chase.

Long form: VitalCV gives every clinician a portable, consented career-evidence record; an employer receives a source-attributed head start when the clinician applies, then completes its own credentialing and hiring decision.

## Why this founder

At Sutter Health, Chris helped build the centralized clinician sourcing engine across nine affiliated medical groups and all inbound clinician applicants. The lesson: hospitals can find clinicians — but after the clinician says yes, credentialing restarts because nobody trusts the last verification. **Trust has no memory.**

## What may be claimed (all true today)

- A clinician starts from an NPI and sees what source lanes answer, what is unverified, and what requires access.
- VitalCV creates a consented, attributed packet and can share a time-limited application bundle with an employer.
- Employer review begins with coverage, freshness, limitations, and remaining blockers — not a completed credentialing decision.
- Every claim in a packet carries a named source, an observation time, and a stated limitation.
- A VitalCV receipt can be checked for origin and tampering. (Never imply the signature makes the underlying source fact true.)
- Institution review remains final — VitalCV is not a replacement for credentialing, privileging, or the hiring decision.

## Source coverage — state it exactly

Derived from the live registry (verify against [vitalcv.com/status](https://vitalcv.com/status) before submitting; the deploy gate keeps all surfaces in agreement):

| Lane | Say |
| --- | --- |
| NPPES identity | Read per request |
| OIG/LEIE exclusions | Monthly snapshot |
| CMS PECOS enrollment | Quarterly snapshot |
| State licensure | **Access required — not automated. Say so.** |
| Employment history | Not yet connected |
| Board certification | Not yet connected |

Never say "four lanes", "all sources", or "universal coverage". Three federal lanes are live; the rest are gated or unbuilt.

## Banned in the application, video, and demo

**From the truth contract (CLAUDE.md):** "automatically verified" · "guaranteed verification" · "complete credentialing" · "instant credentialing" · "legally accepted" · "risk transferred" · "final verification without review" · "source confirmed before response" · "certified compliant" · "HIPAA compliant" · "SOC2 certified" · any status label that is the bare word "Verified".

**From the YC audit:** completed credentialing/privileging/employer approval · continuous compliance monitoring · real-time verification (only NPPES is per-request; say cadence) · "instant" starts or "hire instantly" · any measured speed gain, time-to-start, ROI, "100x faster", or customer/pilot count without evidence that exists today · NCQA certification or CVO status.

**Vocabulary to keep out of the acquisition path:** blockchain · on-chain · crypto-native · decentralized identity · self-sovereign · DID/VC · wallet-as-crypto · post-quantum signing. (If a YC form question requires architecture detail: "receipts are cryptographically checkable for origin and tampering" is the ceiling.)

**Wording precision (audit P1):** the current bundle integrity mechanism is a **hash**, not an asymmetric signature — say "integrity hash" until issuer signing is in the request path.

## Traction answers — founder facts only, never inferred

The audit deliberately declines to guess these. Fill in before submission; if a number does not exist, say so plainly and give the narrowly scoped next proof (one employer accepting one source-attributed packet for one clinician).

| Question | Answer (founder) |
| --- | --- |
| Current user count | ⬜ |
| Pilots / LOIs / active employer conversations | ⬜ |
| Revenue | ⬜ |
| What changed since the first YC submission | ⬜ |
| Cofounder status and equity | ⬜ |
| Customer/pilot names that may be disclosed | ⬜ |
| Demo URL: live or recorded | ⬜ |

## The vocabulary of the submission

One consistent set of words everywhere (form, video, site): **clinician · NPI · career evidence · source · observation time · limitation · consent · packet · head start · start date · credentialing committee.** The founder video, application answers, and live copy must use the same vocabulary — a reviewer who sees "wallet" in one place and "evidence record" in another is reading two products.
