# VitalCV — the one platform

> **Superseded where it conflicts — 2026-08-04.**
> [`vitalcv-category-strategy.md`](./vitalcv-category-strategy.md) and
> [`vitalcv-strategy-operating-brief.md`](./vitalcv-strategy-operating-brief.md)
> are now canonical for positioning, homepage messaging, customer-facing
> vocabulary, information architecture, and roadmap sequencing. Where this
> document and those disagree, **those win** — see
> [the source-of-truth order](./README.md#source-of-truth-order).
>
> This file is kept, not deleted: it records which founder documents were synthesized and
> which creative decisions were delegated, which is the only trace of how the
> pre-2026-08-04 direction was arrived at.
> Read it for that, not for what the product should call itself.

**Date:** 2026-07-25
**Status:** Synthesis of seven founder documents into a single governing direction. Creative
decisions in §3 were delegated to and made by Claude Code; every one cites the source that
forces it.

**Sources synthesized**

| Document | Role here |
| --- | --- |
| `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md` | **Controlling for homepage design and creative.** |
| `VitalCV Deep Research Report for YC Positioning.pdf` | Controlling for positioning, product primitives, and pitch sequencing. |
| `VitalCV Deep Research and YC Readiness Report.pdf` | Corroborating market/readiness context. |
| `VitalCV_Deep_Audit_Design_Direction_and_Master_Waves_2026-07-21.md` | **Superseded** by the competitive mandate on three points — see §5. |
| `godmode waves 1509-1516.pdf` | Already transcribed (`docs/waves/`) and reconciled (`docs/audits/`). No new direction. |
| `vitalcv-handoff-6-26-26.zip` | Design prototypes. Harvest-only — see D7. |
| `VitalCV System Pages (standalone).html` | Wave 1505. Shipped (#628/#629). No new direction. |

---

## 1. The one sentence

> **The clinician-owned career evidence engine that turns an NPI into an actionable path to the
> right job and a faster start.**

Two-sided and deliberately asymmetric:

| Visitor | Promise | Proof needed immediately |
| --- | --- | --- |
| Clinician | **Get hired faster. Start working faster.** | Start with NPI; see what is ready, what is missing, what to do next. |
| Employer | **Start clinicians faster from source-backed evidence.** | A consented, attributable packet — and final decision authority stays theirs. |

**What VitalCV is not:** a prettier credentialing dashboard, a staffing marketplace, a clinician
social network, a generic matching engine, a blockchain/digital-identity project, or a public
career graph.

The moat is the **continuity of the loop** — NPI → source-attributed evidence → readiness and next
action → role fit → consented packet → employer review and start path. Every competitor owns
fragments. VitalCV wins only if one real clinician can travel the whole loop without disconnected
accounts, opaque "verified" claims, or fake data.

---

## 2. Where the two research streams agree

The competitive mandate (creative) and the YC positioning report (strategy) were written
independently. They converge on the same instruction, which is why it is safe to treat as settled:

**Sell the outcome. Hide the machinery.**

- YC report: *"VitalCV must sell the hiring-speed and risk-reduction outcome, while hiding most of
  the cryptographic machinery until the buyer asks for it."* Buyers purchase "safe under-10-day
  start readiness with portable proof and continuous monitoring." They do not purchase "Substrate
  ledger plus DID/VC architecture" — *even when that architecture is the source of the moat.*
- Mandate: no DID, VC, wallet, token, blockchain, or self-sovereign-identity vocabulary anywhere in
  the clinician acquisition path.

The strongest investor framing, per the YC report, is **not** blockchain credentialing:

> VitalCV is rebuilding trust for licensed labor in healthcare the way Plaid rebuilt trust for
> financial data — portable, machine-readable, continuously updated, and easy to integrate.

And the lead sentence for buyers:

> We let healthcare organizations know whether a clinician can safely start work right now, with
> reusable proof and continuous monitoring, in days instead of months.

---

## 3. Creative decisions

### D1 — The homepage is the film. `/` flips to `HorizontalCareerFilm`.

Mandate guardrail 1: one continuous horizontal composition advanced by ordinary vertical scroll.
The six-scene film **merged to main in #835** (`455b527e`) and currently lives at
`/dev/compete-film`; `/` is unchanged. Flipping it is a one-line change to `app/page.tsx`.

This is not a preference. **Every homepage alternative now on the table is forbidden by a named
guardrail:**

| Candidate | Killed by |
| --- | --- |
| Drag-rotate constellation (mine, #836) | Guardrail 3 — "Never nodes, links, people, a constellation, or physics controls." |
| Node-link hero evidence field | Guardrail 3 — same clause. |
| Pinned horizontal Rolodex rail | Guardrail 2 — "No wide card queue, no product-carousel leaves, no framed chapter cards." |
| Current 2×2 journey grid (live today) | The decision, §"The decision" — not "a long vertical SaaS page decorated with shaders." |

The grid that shipped on 07-23 correctly executed the *retirements* (R1, R2) but stopped at a
waypoint. The film is the destination, and it already exists.

### D2 — Copy is governed by the asymmetric promise, one phrase per scene.

Copy ceiling per mandate: one short editorial phrase per scene; the NPI sentence only where it
explains the action; no visible section taxonomy or generic feature headers. The merged film
already honors this (`Get hired faster.` / `Your record is already out there.` / `Stop starting
over.` / `See what actually fits.` / `Hand over proof, not promises.` / `Your evidence. Your
permission.`).

Research constraints that shape every future rewrite:

- **Front-load the information-carrying word.** NN/g eyetracking: readers concentrate on the first
  few words; move keywords to the front to support scanning.
- **No cute, punning, or coined vocabulary.** NN/g: it "degrades credibility," and jargon and
  branded terms are *ignored even by domain experts.* Reading level: ≤12th grade even for a
  clinician audience; experts want the same succinct scannable copy everyone else does.
- **Overclaiming compounds.** NN/g: misleading labels deplete trust and lower click-through on
  genuinely relevant content *in later sessions.* The banned-claims contract is not a tax; it
  protects downstream conversion.

### D3 — State limits specifically, numerically, once, and *after* the positive.

This corrects an assumption I stated earlier in the session and got wrong.

- **Limits do not build trust — they are merely cheap.** van der Bles et al. (five experiments,
  n = 5,780, incl. a preregistered replication and a BBC News field experiment): communicating
  uncertainty produced a *small decrease* in trust, not an increase.
- **The form is what costs.** Verbal hedging ("roughly", "there is some uncertainty") d = −0.55;
  numeric uncertainty d = −0.15. **Vague hedging is ~3–4× more damaging than a stated number.**
- **Order and dose matter.** The blemishing effect (Ein-Gar, Shiv & Tormala, *JCR* 2012) shows a
  *small* negative *after* the positive raises favorability — but only under low-effort processing,
  and it **reverses under high-effort processing** (Study 1, N=141, F(1,137)=8.64, p<.01).

**Operationally:** on the scanned clinician film, the institution-review boundary lands once, late,
in the Start scene — never in the hero. On employer/credentialing surfaces (high-effort readers) it
is stated plainly and early, because the blemishing effect does not apply there. Everywhere: name
the specific cadence ("monthly snapshot") over the vague hedge ("may not be current").

### D4 — Adopt canonical trust states. Retire the verified/not-verified binary.

The YC report's highest-leverage product recommendation is a buyer-facing **Trust State API** with a
small canonical vocabulary:

> **ready · ready-with-conditions · stale-source · under-review · adverse · blocked**

with each state exposing its provenance and time-to-refresh policy. Layered validity — **source
validity** (is the license active), **credential validity** (is the capsule unrevoked), **policy
validity** (is this clinician ready for *this* employer and role) — because a digital credential can
be revoked while the underlying license remains perfectly valid.

This is a natural extension of `lib/trust/sourceLanes.ts`, which already splits `lifecycle` from
`readCadence`. It also converts the honesty constraint into the product: *"a clinician should not
become 'unverified' merely because one state board page failed for 90 minutes."*

### D5 — No number theatre. Anywhere.

Mandate guardrail 6 bans giant counters, `01–06` step grammar, percentage rings, generic
"days saved," and fabricated velocity claims. Consequences, already ruled as C5 in #835:

- **`MetricStrip` retires** — its `00`–`03` grammar *is* the banned step pattern, and it animates
  system facts on load.
- **`TimeToStartComparison` recomposes** — the cited 90–120 day figure survives as ink, worded as an
  **industry** benchmark, never as a VitalCV result. The bar chart does not survive.
- The wave1501 **72% readiness ring is dead on arrival** — it already trips
  `homepage-truth-pass.test.tsx:33`.

Only *returned personal state* after a real NPI lookup may animate, plus real scoped pilot outcomes
once a pilot produces them.

### D6 — One scroll engine. In-repo. No GSAP.

A single passive scroll listener, a single rAF, one composited transform — the pattern
`HorizontalStoryRail` already proved. Framer Motion stays for discrete/local animation only, never
as a scroll owner.

Research backs keeping IntersectionObserver rather than migrating to CSS scroll-driven animation:

- `animation-timeline: scroll()` sits at **~83.7% global support** (June 2026). Safari/iOS only from
  26.0; Firefox only from 155. ~1 in 6 users would get nothing.
- It is a **scrub** model — progress binds to scroll position and *reverses on scroll-up*. That
  fights the single-shot doctrine directly. The matching primitive (scroll-*triggered*) is
  Chrome-145-only.
- **WCAG 2.2 SC 2.3.3 is AAA, not AA** — and it explicitly excludes changes of color or opacity that
  do not alter perceived size, shape, or position. **Opacity-only reveals fall outside the criterion
  entirely;** translate/scale reveals fall inside it. Prefer opacity-only, which is also the
  CLS-safe choice the scrub-heading contract already requires.

### D7 — Harvest the wave1501 handoff. Do not promote it.

Keep: `TrustGlyph`/`STATE_META`, `HonestyLabel`, `FreshnessStamp` **with its corrected lane
cadences**, the segmented ten-cell NPI field, and the `.w1501` CSS scoping discipline.

Drop: the constellation (guardrail 3), the 72% ring (guardrail 6), and the six-H2 section stack
(the mandate's "almost no copy" ceiling).

`/design/wave1501` stays as a noindex reference. It is a design archive, not a candidate.

**Two truth corrections the port already forced, which must not regress:** the handoff marked OIG
LEIE as "Checked · 2h ago" (it is a **monthly** snapshot) and CMS PECOS as "gated · requires
enrollment agreement" (it is **active, quarterly** — it reads a real CMS dataset). The genuinely
access-gated lane is **state licensure**.

---

## 4. What this retires, in one list

| Retired | Authority |
| --- | --- |
| Public knowledge graph / constellation / node-link hero field | Mandate guardrail 3 (R1) |
| Horizontal Rolodex, card queues, chapter cards | Mandate guardrail 2 (R2) |
| Long vertical SaaS homepage (incl. today's 2×2 grid) | Mandate, "The decision" |
| `MetricStrip` `00`–`03` counters | Guardrail 6 / C5 |
| Percentage readiness rings | Guardrail 6 |
| DID / VC / wallet / blockchain vocabulary in the acquisition path | Mandate §4 + YC report |
| Verified / not-verified as a binary | YC report — replaced by D4 |

---

## 5. Where the two 07-21 documents conflict

`VitalCV_Deep_Audit_Design_Direction_and_Master_Waves_2026-07-21.md` says the opposite of the
competitive mandate on three points: *keep and tune* `HorizontalStoryRail`, **forbid** full-page
horizontal scrolling, and **forbid** GSAP.

**The competitive mandate controls** (founder ruling, 2026-07-21). The GSAP prohibition is kept
anyway — both documents agree there, and D6 independently reaches it.

The mandate names `VitalCV_Whole_Horizontal_Rebuild_Directive_2026-07-21.md` as controlling above
itself. **That file does not exist** in the repo, Dropbox, or Drive, and was not among the seven
documents supplied. Do not spend time hunting it; proceed on the competitive mandate.

---

## 6. Execution order

| # | Work | State |
| --- | --- | --- |
| 1 | Merge the six-scene film | ✅ **Done** — #835, `455b527e` |
| 2 | Flip `/` from the grid to the film | **Next.** One line in `app/page.tsx` + the homepage test contract. Founder-visible change; needs a look before it ships. |
| 3 | Retire `MetricStrip`; recompose `TimeToStartComparison` | Ruled (C5), not executed |
| 4 | Canonical trust states (D4) behind the existing `sourceLanes` split | Not started — highest product leverage per YC report |
| 5 | Employer surface: plain, early limits (D3 high-effort branch) | Not started |
| 6 | Harvest wave1501 primitives into the film's proof artifact | Not started |

**Open founder questions this synthesis does not settle:** policy semantics during a source outage;
employer appetite for selective disclosure vs packet export; the dispute-handling SLA buyers will
require before trusting automated adverse-state propagation; and when to externalize the recognition
registry rather than keep it permissioned. All four are named in the YC report as the genuinely
unresolved product questions.
