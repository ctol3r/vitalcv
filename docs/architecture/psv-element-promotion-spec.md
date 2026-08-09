# PSV promotion — element-scoped decision grade

Status: **draft spec, awaiting founder GO. Docs-only; no code may cite this
until it is accepted.** Promotion from `PSVReceiptCandidate` to a real
`PSVReceipt` has always been "a separate gated wave" (truth contract,
CLAUDE.md). This document is that wave's gate design. It exists because the
founder asked, 2026-08-09, to close the "no decision-grade packet" gap.

---

## The problem stated honestly

`decisionGrade` is the literal `false` on every receipt candidate the platform
produces. That is correct today: a hospital cannot onboard on our output, and
the type system says so. But the gap is not one boolean — it is that
"decision-grade" was scoped to the whole packet, when the truth is
**per element**. NPPES identity IS decision-grade. OIG/LEIE exclusion IS
decision-grade. A packet that is 3/10 verified is not a false packet; it is a
packet with three true elements and seven honest absences.

## Design: promote elements, never packets

1. **A `PSVReceipt` is issued per ELEMENT, not per clinician.** Each receipt
   names exactly one verification element (identity, exclusion, medicare
   enrollment, licensure:{authority}, education, board_certification,
   malpractice_history, dea, work_history, references), one source, one
   method, one timestamp, one methodology version.
2. **An element may promote only when its source is live and decision-grade**
   under the existing `isLive()` seven-condition gate and the
   `decisionGrade: true` adapter flag — both already exist and both already
   fail closed. No new bypass, no env override, no "temporary" widening.
3. **The packet never carries a packet-level `decisionGrade`.** The packet is
   a set of element receipts plus a set of explicit absences ("licensure:CA —
   no decision-grade route exists; here is why"). The absence list is the
   refusal ledger's input (Wave L §9) — the same artifact, two surfaces.
4. **Candidates remain the only output for elements without live sources.**
   Nothing in this spec touches `ReceiptCandidate.decisionGrade: false` or the
   five policy-review gates. Promotion is a new, parallel path for elements
   that have earned it — never a relabeling of candidates.

## What can promote on day one (no new agreements)

| Element | Source | Already live? |
|---|---|---|
| identity | NPPES | yes |
| exclusion | OIG/LEIE | yes |
| medicare_enrollment | PECOS | yes |

## What promotes when procurement lands

| Element | Source | Gate |
|---|---|---|
| licensure (nurse/APRN) | Nursys e-Notify | institutional enrolment ($0) |
| licensure (physician, all boards) | FSMB PDC | agreement + $9–12/physician |
| education / training | AMA Profile | agreement + $41/physician |
| board_certification | FSMB Premium or AMA | same agreements |
| malpractice / adverse actions | **NPDB certified self-query** | engineering only — see below |

## The NPDB self-query element

The practitioner self-query is identity-proofed, returned as a digitally
certified PDF whose signature invalidates on alteration, and forwardable by
the practitioner. Engineering: an intake lane where the clinician uploads
their certified PDF and we verify the certifying signature before promotion.
The receipt's `method` is `practitioner_supplied_certified_document` —
honestly distinct from a direct source pull, and stated on the receipt.
Signature-verification failure → the document confers nothing and the element
stays a candidate. Fail closed, as everywhere.

## Boundaries (what this spec refuses)

- No LLM anywhere in promotion. Promotion is a deterministic predicate over
  adapter output.
- No packet-level "verified" summary line, badge, or percentage. Banned
  strings stay banned; no status label may be the bare word `Verified`.
- No promotion of any element whose adapter fabricates (the
  seedDefaults/trustStateEngine class of defect blocks its element until
  fixed).
- Knowledge-trust-graph boundaries are added for the promotion gate before
  code lands, numbered after current head — never rewriting existing ones.

## Sequencing

1. Founder accepts or amends this spec.
2. Wave P0: element-receipt schema + promotion predicate + the three day-one
   elements, behind a flag, with injection-proofed gate tests.
3. Wave P1: NPDB certified-document intake (engineering-only unlock).
4. Wave P2+: per-source elements as procurement lands, one source per wave.
