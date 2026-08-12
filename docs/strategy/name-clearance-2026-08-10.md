# Name clearance research — "VitalCV"

**Date:** 2026-08-10
**Status:** RESEARCH MEMO — not legal advice, and not a clearance opinion
**Recommendation:** Keep the name. Commission a real clearance search from counsel before the
first pilot contract is signed.

---

## The question

Does VitalCV need a new name?

## Verdict: no, but the clock on one decision is real

The name is not the constraint — zero verified clinicians and zero pilots is. No rename fixes
that, and a rename would consume the runway that should go to the first hundred clinicians.

There is, however, one cost that grows with time rather than staying flat, and it is worth
understanding before deferring the question indefinitely.

### Why a rename gets more expensive, and it isn't the marketing

Brand equity is not the switching cost here — there is none to lose. The cost is in the trust
chain. `did:web:vitalcv.com` is the issuer identity on signed artifacts and is published at
`/.well-known/did.json`, `jwks.json`, `openid-credential-issuer`, and `verifier-manifest.json`.
Every receipt issued under it carries that DID as its `issuerDid`.

Changing the domain therefore means one of two things: carrying `did:web:vitalcv.com` forever as
the historical issuer for everything signed before the change, or running a DID and key migration
that every relying party has to follow. Neither is a find-and-replace, and both get worse per
signed artifact.

**Practical consequence:** if the name is ever going to change, it should change before receipt
volume is meaningful. That is a reason to decide, not a reason to rename.

---

## What the research actually found

### 1. There is another VitalCV, and it is in recruiting

[VitalCV](https://az.linkedin.com/company/vitalcv) is an Azerbaijani HR and recruitment technology
company, 11–50 employees, self-described as a "Tech Startup in HR and Recruitment sphere" offering
a recruiting platform, behavioural assessment, and career counselling. It is profiled on
[CB Insights](https://www.cbinsights.com/company/vitalcv) and
[Tracxn](https://tracxn.com/d/companies/vital-cv/__3HpXfbAfUqGItdDStW9fzKUjR0UcrE-d42CYomeO2-k).

This is not a healthcare conflict. It is worse in one specific way and better in another:

- **Worse:** it is in the *same broad category* — recruitment and employment — which is exactly
  the category VitalCV-the-clinician-network competes in. A conflict in an unrelated field would
  be noise; this one is adjacent.
- **Better:** it appears to be Azerbaijan-only, which materially weakens any US priority claim.

**The part that matters most is not legal.** Their LinkedIn still lists **www.vitalcv.com** as
their website, and there is a `youtube.com/user/VitalCV` channel and an `@VitalCV` X handle in the
same lineage. The public record therefore contains a corpus that answers the question "what is
VitalCV?" with "an Azerbaijani HR recruiting startup".

That is a direct hit on the strategy in `docs/strategy/` and the 2026-08-10 positioning work: the
recommended channel is search and answer-engine citation — winning *share of model* on clinician
and credentialing queries. Brand-name ambiguity is the one failure mode that channel cannot route
around, because "VitalCV" is the query where the answer should be unambiguous.

### 2. No US registration surfaced — but this was not a reliable search

Searches restricted to Justia Trademarks, Trademarkia, uspto.report, TrademarkElite and TSDR
returned no `VITALCV` or `VITAL CV` mark. Nearby marks exist and are unrelated (`VITAL` /
Vital Images, `VITAL CONNECT`, `VITALIFE`, `VITALCOR`).

**Do not treat that as a clearance result.** Every trademark database refused automated access
(HTTP 403 from Justia, uspto.report, RocketReach; the USPTO `tmsearch` API rejected the query; the
California Secretary of State `bizfileonline` API refused too). Absence of evidence here is a
consequence of the tooling, not a finding about the register. A knockout search that cannot read
the register is not a knockout search.

### 3. A California entity exists

`VitalCV LLC`, California registration **B20250441676**, incorporated **2025-12-30**. Surfaced via
a third-party aggregator only; not confirmed against the Secretary of State directly, because that
API also refused. Confirm this from the SoS record rather than from this memo.

---

## The other friction: the name argues against the positioning

`docs/strategy/vitalcv-category-strategy.md` lists **"Résumé-builder positioning"** in its
`supersedes:` block. The name says *CV*. The category strategy says *not a résumé builder*. The
homepage currently resolves this well enough — "Enter your NPI. VitalCV does the rest." never
invites the résumé reading — but the wordmark is doing the opposite of the strategy's work, and
the collision above reinforces the reading, because the other VitalCV genuinely is a CV product.

This is a copy problem, not a naming emergency. It is manageable, and it is being managed.

---

## Recommended actions

1. **Commission a real clearance search.** A knockout plus full search in the relevant classes
   (roughly: 9 — software; 35 — employment/recruitment services; 42 — SaaS; 44 — healthcare
   information services). This memo cannot substitute for it and does not try to. Do it before the
   first pilot contract, not after.
2. **Do not rename now.** Revisit only on a trigger (below).
3. **Reduce the ambiguity you can control** without touching the name: own the "what is VitalCV"
   answer on your own surfaces, so the corpus an answer engine reads has a clinician-network entry
   with better provenance than a stale LinkedIn page.
4. **Stop renaming the inside.** The instability that is actually costing comprehension is
   internal vocabulary churn, not the wordmark: "Provider Career Evidence Network" retired,
   `MATCHA` retired from copy, `wallet` and `passport` promoted to tier-1 banned on 2026-08-10.
   The customer-language inventory is the right instrument; the discipline is to let it settle.

## Revisit triggers

- Counsel's search finds a blocking US mark in classes 35/42/44.
- Pilot conversations show clinicians or employers reading "CV" as a résumé product in a way that
  measurably costs conversion — checkable once the funnel is instrumented and not before.
- International expansion into or near Azerbaijan / the Caucasus, where the other party's rights
  are strongest.
- The category shifts away from an individual portable profile.

## Method note

Findings here come from public web sources on 2026-08-10 and are limited by the access refusals
recorded in §2. Every claim that could not be confirmed from a primary source says so.
