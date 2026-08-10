# L1 — FSMB and NCSBN access diligence

> **2026-08-09:** the no-paid-data-sources rule was amended — paid sources may
> now be proposed where the goal requires them. Verified pricing, budget
> shapes, and the recommended sequence live in
> [paid-source-procurement.md](./paid-source-procurement.md); this document
> remains the per-vendor question list to take into those conversations.

**This wave is not an engineering task.** It is commercial and legal work that
only Chris can execute, and it blocks L2, L3, L5, L8, L9 and L10. Nothing in the
licensure program can go live until the questions below have answers.

Engineering is done waiting: the adapters, contracts, registry, runtime gate and
projections all exist and fail closed. They need facts, not code.

---

## Why this is the bottleneck

Every route in `packages/licensure/src/runtimeState.ts` is blocked on one of
three things, and two of them are resolved here:

1. **Permitted access** — no terms review has been done for any board or network.
2. **Production credentials** — none exist for FSMB or NCSBN.
3. A successful production run — impossible until 1 and 2 land.

---

## Track A — FSMB Physician Data Center

Covers physicians, osteopathic physicians and (per FSMB's own membership
materials) physician-assistant data. This is the single highest-leverage
integration in the program: it is the only route that plausibly reaches all 55
jurisdictions without 69 separate board negotiations.

References:
- PDC data files — <https://www.fsmb.org/PDC/pdc-data-files/>
- PDC queries — <https://www.fsmb.org/PDC/pdc-query/>
- Member boards — <https://www.fsmb.org/about-fsmb/fsmb-member-medical-boards/>

### Questions to resolve

**Commercial**
1. What are the product tiers — bulk data files, per-query API, or both? Which
   fits a per-clinician verification flow?
2. Pricing model: per query, per seat, per covered clinician, or flat licence?
3. Minimum contract term and volume commitment?
4. Is there a pilot or evaluation tier that permits a small number of real
   production queries?

**Coverage**
5. Which of the 55 jurisdictions does PDC actually cover, and are any member
   boards excluded from data sharing?
6. Are separate osteopathic boards (12 jurisdictions) covered, or MD boards only?
7. Is physician-assistant licensure included, and for which jurisdictions?
   *This directly fills the PA inventory gap.*
8. Does a PDC record retain the originating board, or is it flattened to a
   national record? **If it does not retain the board, the program cannot use it
   as-is** — `LicensureObservation` requires the originating authority.

**Data semantics**
9. What licence statuses can be returned, verbatim? Needed to build the status
   map without inventing values.
10. Is disciplinary information included — full detail, an indicator only, or
    absent? Populates `DISCIPLINE AVAILABLE`, currently `UNKNOWN` on all 115 rows.
11. How fresh is the data — how often does FSMB pull from each board? This sets
    the real `freshnessWindowHours`, currently a placeholder 24h.
12. Are compact privileges (IMLC) returned, and are they distinguishable from
    state licences? They must not collapse into one object.

**Legal / permitted use**
13. May results be **retained** and **redisplayed** to an employer inside VitalCV,
    or is display limited to the querying institution?
13a. **The one that decides the business model:** may a single purchased profile
    back credentialing decisions at **multiple, unaffiliated employers**, or is
    each employer a separate purchase? Ask it in exactly those terms — Q13 asks
    about redisplay to *an* employer and does not settle reuse across *several*.
    The whole verify-once-reuse-everywhere argument in
    [paid-source-procurement.md](./paid-source-procurement.md) rests on the
    answer: "one purchase, many employers" makes Tier 1 one-time per clinician;
    "per employer" makes it recurring and multiplies the budget by the number of
    employers each clinician applies to. **Get the answer in writing.**
    Precedent for the restrictive answer: NPDB forbids exactly this reuse across
    entities, even with the practitioner's written consent
    (<https://www.npdb.hrsa.gov/guidebook/DQA11.jsp>). Do not assume FSMB is more
    permissive — its published terms already bar reproducing or distributing its
    data without prior written consent. **The same question goes to the AMA** for
    the Physician Profile, which carries the larger per-unit price.
14. May results be shown to the clinician themselves (wallet/passport surface)?
15. What attribution is required on display?
16. Are there caching restrictions — must each display be backed by a fresh query?
17. What are the audit/logging obligations?

**Technical**
18. Response schema and a set of **real sample responses**. The adapter refuses to
    interpret a shape that has not been recorded from the real source, so this is
    a hard prerequisite for L2.
19. Auth model, rate limits, sandbox availability.
20. Is there a change/delta feed, or is monitoring poll-only? Determines whether
    L8 is viable.

---

## Track B — Nursys / NCSBN

Covers RN, LPN/VN and APRN. Separate agreement, separate track.

References:
- License verification — <https://ncsbn.org/nursing-regulation/licensure/license-verification.page>
- NCSBN ID — <https://www.ncsbn.org/nursing-regulation/licensure/license-verification/ncsbn-id.page>

### Questions to resolve

1. Which product fits: Nursys e-Notify (subscription/monitoring) or QuickConfirm
   (point-in-time verification)? The two have different display rights.
2. **Which boards of nursing participate, and which do not?** Non-participating
   states need a direct or manual route, and the coverage projection must name
   them. This also produces the BON inventory the registry currently lacks.
3. Does a Nursys response retain the originating board of nursing? Same hard
   requirement as FSMB.
4. Institutional eligibility — does VitalCV qualify as an employer/institution
   for e-Notify enrolment, and on what basis?
5. Pricing and minimum commitment.
6. Retention and redisplay rights — to employers, and to the clinician.
7. Is the NCSBN ID required as a lookup key, or will licence number + name + DOB
   resolve? Currently declared as `NCSBN_ID / LICENSE_NUMBER / NAME_DOB`, unverified.
8. Statuses returned, verbatim, including how compact privileges appear.
9. Disciplinary data scope.
10. Delta/notification feed for e-Notify — cadence and payload.
11. Real sample responses and schema.

---

## Immediate cleanup this diligence enables

The legacy backend adapter at
`apps/api/backend/src/services/psv-adapters/adapters/nursysAdapter.ts` used to
fetch `nursys.com/NLV/NLVSearch.aspx` with no credentials and no agreement. That
call has been removed — the adapter now makes no request unless
`NURSYS_BASE_URL`, `NURSYS_CLIENT_ID` and `NURSYS_CLIENT_SECRET` are all set.

Confirm with NCSBN that no unauthenticated automated access occurred against
their public surface, and that the intended integration path is e-Notify or
QuickConfirm rather than the public page.

---

## Definition of done for L1

- [ ] FSMB agreement executed, or a documented decision not to pursue it
- [ ] NCSBN agreement executed, or a documented decision not to pursue it
- [ ] Permitted-use answers recorded for retention, redisplay and caching
- [ ] Real sample responses captured for both sources
- [ ] Verbatim status vocabularies captured for both sources
- [ ] Participating-board lists captured (FSMB jurisdictions; Nursys BONs)
- [ ] Confirmed both sources retain the originating board on each record
- [ ] Real freshness windows recorded, replacing the placeholder 24h

Only then does L2 (`FsmbPdcAdapter.mapResponse`) become writable, and only after
a genuine production run does any route reach `LIVE`.
