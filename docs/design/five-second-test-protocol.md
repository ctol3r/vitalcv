# The five-second test — C3.1 protocol and freeze-lift checklist

**Status:** Protocol of record for the Wave C3.1 comprehension gate (program GO 2026-08-16).
**Applies to:** the Direction A homepage recomposition, and any later public-surface
recomposition whose review invokes C3.1.
**Companion rule:** the 2026-08-15 homepage visual freeze (`docs/ops/FOUNDER_VISUAL_GATE.md` §1)
lifts only when every box in §3 below is checked.

---

## 1. Why this exists

The founder's standing bar: **a visitor must understand VitalCV within 30 seconds.** The
five-second test is the cheap, repeatable proxy for the first and hardest slice of that —
what a stranger takes from one glance at the rendered page. It measures the page, not the
visitor: no priming, no narration, no founder in the room explaining.

The takeover program (Wave C3.1) states the comprehension targets verbatim:

> A clinician should understand: *Enter your NPI → VitalCV builds what it can → you control
> sharing → find/apply to roles → employers see what remains → your profile survives the move.*
>
> An employer should understand: *Receive a better-prepared clinician and know what's left
> before start.*

Five seconds cannot carry all six clinician beats. The test passes on the load-bearing
prefix — what the product is, who it is for, and what to do first — and the remaining
beats are checked in the untimed follow-up (§2, step 4).

## 2. Protocol

**Subjects.** Five cold viewers per render. "Cold" means: has never seen a VitalCV surface,
has not heard the product described, and is not an employee, contractor, or agent of the
company. Clinicians are ideal but not required; note profession per subject. The same five
people may not be reused for a later run of this test on the same surface.

**Stimuli.** Two static renders of the candidate page from a **production build at the
review SHA** (not a dev server, not a mock): 1440×900 desktop and 390×844 mobile, captured
above the fold with no scroll. Motion is allowed to have settled (the page's one-shot
entrance completes before capture). Each subject sees one render at a time.

**Exposure.** Five seconds per render, timed, then the render is removed from view.

**Questions** (asked after removal, in this order, answers recorded verbatim):

1. What is this product?
2. Who is it for?
3. What would you do first on this page?

**Untimed follow-up** (render returned, subject may scroll for up to 60 seconds — this is
the 30-second-bar check with margin):

4. In your own words: what happens after you do that first thing?
5. Does anything on this page confuse you or feel like it isn't for you?

**No coaching at any point.** If a subject asks a question, the answer is "whatever you
think" — the page has to do the work.

## 3. Pass criteria and the freeze-lift checklist

**Five-second pass** (questions 1–3, majority = ≥3 of 5 subjects, each render evaluated
separately and both must pass):

- Q1: the answer names a **professional record / profile / career tool for clinicians**
  (any wording that lands in that neighborhood counts; "a job board" alone is a miss;
  "credentialing service that verifies you" is a miss — it over-promises the product).
- Q2: **clinicians / doctors / nurses / healthcare workers** (any of these counts).
- Q3: the subject points at (or describes) the **NPI entry action**.

**30-second pass** (question 4, majority ≥3 of 5 on either render): the answer contains,
in the subject's own words, at least two of: *VitalCV assembles the record from public
sources · the visitor controls what is shared · it connects to real roles/applying ·
the record is kept/reused rather than rebuilt.*

**Question 5 has no pass bar.** Every answer is recorded in the results file; any answer
that names a truth-contract problem (e.g., the subject believed the illustrative record
was their real data) is a blocking finding regardless of the other scores.

**The freeze lifts when all three hold:**

- [ ] `FOUNDER VISUAL DECISION: GO` recorded on the recomposition PR against rendered
      evidence at the deployed review URL, and re-confirmed on the **production SHA**
      after merge (the §4 phrase, not an inference).
- [ ] This protocol executed on the production render; the filled results file committed
      to the PR's evidence directory (`docs/design/evidence/<pr-slug>/five-second-results.md`),
      with both five-second renders passing and no blocking Q5 finding.
- [ ] Funnel baseline collection started: `NEXT_PUBLIC_POSTHOG_KEY` set in the web
      environment and the two lanes observable (`$pageview(/)` → `npi_input_started` →
      `npi_resolved` → `npi_bound`; `record_viewed` → `claim_clicked` → `npi_bound`).
      This is a baseline-start requirement, not a score gate — no conversion number
      blocks the lift.

## 4. Results file template

```markdown
# Five-second test — <surface> @ <production SHA> — <date>
Renders: desktop <path/screenshot>, mobile <path/screenshot>
| Subject | Profession | Cold? | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|---|---|
| S1 | ... | yes | ... | ... | ... | ... | ... |
Scoring: desktop Q1 n/5 · Q2 n/5 · Q3 n/5 — PASS/FAIL; mobile same; Q4 n/5 — PASS/FAIL
Blocking Q5 findings: none / <verbatim quote + disposition>
Run by: <name>, no coaching attestation: <initials>
```

## 5. What this protocol is not

It is not a substitute for the founder visual gate (aesthetic judgment stays human and
stays the founder's), not a statistical instrument (n=5 finds comprehension failures, not
percentages), and not a recurring KPI — it runs at recomposition reviews, not on a
schedule. If a page needs a narrator, it fails; that is the only thing being measured.
