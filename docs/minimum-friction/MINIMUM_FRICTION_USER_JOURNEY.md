# Minimum Friction — User Journey

**Program:** Minimum Friction (MF-WAVE-00, research/architecture only)
**Baseline:** `origin/main` @ `df0ff184c2da9fbc8cfaf73f26e1928188113e61` (2026-08-16)
**Status:** Research deliverable. No UI is changed by this wave — every surface below is described
against what exists today and what the thesis proposes.

> **DESIGN-ONLY BOUNDARY** applies. Note also the binding UX law this journey must obey:
> **EC-1** ("Enter your NPI. VitalCV does the rest.") is already the "One Thing"; **EC-8** ("AI as
> work, not chat; approval moments are sacred"); **EC-20** locks `/onboarding` (NPI lookup is the
> single dominant action, sign-in only when the clinician chooses to save). MF strengthens these;
> it does not reopen them. The target voice is *"We found this. Is it right?"* — never *"Complete
> your profile."*

---

## 0. The Question Admission Gate — the spine of the whole journey

Before any field is shown, it must pass:

```
Do we already know it?            → NPPES bootstrap, prior profile, prior application
   ↓ no
Can a source answer it?           → integrated source read (NPPES/OIG/PECOS/state)
   ↓ no
Can the source be refreshed?      → re-read an aging source
   ↓ no
Can a valid prior answer be reused? → previous application / preference
   ↓ no
Can a less-sensitive substitute do? → proof instead of raw value
   ↓ no
Is it required for the CURRENT goal? → else defer it
   ↓ yes
Does it need answering NOW?        → else defer to point-of-need
   ↓ yes
ASK.
```

**A form field is work; it must justify its existence.** Below, each journey stage names which
current asks the gate would eliminate — grounded in the live-surface inventory.

### Ranked eliminable questions (from the live-surface sweep)

| # | Question asked today | Where | What could answer it instead | Caveat |
|---|---|---|---|---|
| 1 | **"Your profession"** (required, blocks bind) | `/onboarding` `GetReadySurface.tsx` | NPPES primary taxonomy — already resolved & displayed before the button group | pre-select ≠ replace attestation; taxonomy can be stale |
| 2 | **NPI re-entry** after it is bound | `OnboardingFlowSteps#onboarding-npi`, dead `PrequalifyModal` | `PersonProfile.npi` via `/api/me/workspaces`; `readNpiHandoff()` exists | "known" = registry-known, not identity-proofed |
| 3 | **Work authorization** (5 asks, 3 vocabularies) | `ProfileSurface`, `ProfileCompletionPanel`, MATCHA ×2, board filter | one canonical field asked once | genuinely not source-knowable — the win is "ask once" |
| 4 | **LinkedIn / Portfolio** (2×) | `ProfileSurface`, `ProfileCompletionPanel` (empty box, no prefill) | the saved profile value | prefill from saved links |
| 5 | **Current specialty** | MATCHA `current-specialties` | `Bootstrap.specialty` (already rendered) | coarse/stale; keep editable |
| 6 | **State licenses held** | MATCHA `licenses` | `passport.nppesLicensure` (already rendered) | NPPES license #s carry **no status**; must not gain a verified label |
| 7 | **Preferred / practice state** | MATCHA `preferred-states` | NPPES practice state as default | one chip, editable |
| 8 | Practice email/phone/website | `SelfAttestedEditor` | NPPES practice-location block | stalest NPPES fields; prefill with provenance chip |
| 9 | Years experience | MATCHA `yearsExperience` | NPPES enumeration date (floor) | enumeration ≠ practice start; show the arithmetic |
| 10 | Cover note re-typed per application | `ApplyModal`, `ApplyIntentComposer` | prior applications / garden drafts | seed, never auto-send |

**MF does not delete these asks in this wave.** It defines the *rule* by which a later wave prefills
or suppresses them, with provenance shown and every value editable.

---

## 1. NPI-first — the 60-second experience

**Today (EXISTS):** `/onboarding` → type 10 digits → NPPES bootstrap resolves name, specialty,
practice state → the record is displayed → the clinician ticks an attestation → `PersonProfile`
upsert. The `/directory/[npi]` → "Claim this record" → `/onboarding?npi=` handoff already
implements the admission-gate pattern (the NPI is carried, not re-asked). This is the good precedent.

**MF target voice:**

```
We found your professional record.

Already found:  identity · specialty · practice location · source state
Worth confirming:  3 things.
```

**Gate applied:** the "profession" button (rank #1) is pre-selected from NPPES taxonomy, editable,
with the attestation checkbox unchanged. Nothing that NPPES already answered is re-asked. Sign-in
occurs only when the clinician chooses to save (EC-20). The emotional target is EC-1's *"That's
it?"*.

**Truth boundary:** the bootstrap confirms *registry identity only* — the copy already says so
(`npi-binding.ts`). MF preserves that; "found" never means "verified you own this." Ownership stays
`CLAIMED`/pending until corroboration (assurance ladder A2→A3, SECURITY §3).

---

## 2. CV import — candidate, never truth

**Today (PARTIAL):** `/holder` → "Add evidence" → `POST /api/documents/parse` (OCR default is a
**stub**; `gpt-4o` only when `OCR_PROVIDER=openai`, silently falling back to stub on error) →
`CandidateCredential` (status `UNVERIFIED`) → confirm → `PENDING_VERIFICATION`. Extraction does
**not** write `PersonProfile` — the boundary holds. (The full `packages/ingest` resume parser is
DEAD/routeless.)

**MF target voice:**

```
We found 14 career facts in your CV.
10 already match what we know.
3 need your confirmation.
1 conflicts with an existing source.
```

**Gate applied (AI Candidate Quarantine, SECURITY §2):**
- Every extracted fact is a **candidate**, tagged with artifact + (future) source-passage + model-id
  + confidence. It is `INFERRED`, never `VERIFIED`.
- Clinician confirmation moves it to `USER_ENTERED` / attested — a distinct state, **not**
  `VERIFIED`.
- A contradiction is `CONFLICT`/review — **never silent selection**.
- **Fix dependency (SECURITY §2.0):** today `CandidateCredential` at confidence ≥0.9 reaches
  requirement level L3 on the matching surface. MF's quarantine forbids this; cap at L2 until a
  source corroborates. This is a product dependency recorded, not solved in a design wave.

---

## 3. The "One Thing" interface

**Today (EXISTS ×3, heuristic):** three planners order next-actions, none by impact (no dependency
index). So the "One Thing" as *leverage-ranked* is a post-compiler capability; MF can fixture it now.

**MF target voice (EC-8-compliant — work, not chat; approval is sacred):**

```
You're in good shape.

One thing needs you:
Confirm your employment end date.

Why?  It resolves one profile conflict and completes two active application requirements.

[Confirm]   [Not correct]   [Why am I seeing this?]
```

If nothing needs the clinician:

```
You're up to date. VitalCV is maintaining the sources you authorized.
```

**Gate applied:** the headline is the **deterministic** leverage number (requirements provably
moved), computed from the `satisfies` backlinks. Potential and AI-predicted impact are shown only as
labelled secondary detail (OPTIMIZATION §5). **"Why this?"** traverses the Career Graph
`requires`/`satisfies` edges — auditable, never asserted. Controllers are never merged (EC-7): "Needs
you" vs "VitalCV handles" vs "Waiting on [actor]" stay distinct.

---

## 4. Precomputed application — the private preflight

**Today (PARTIAL):** the sealed Apply Intent path (`ApplicationPacket` + `ConsentGrant`) already
computes per-field packet entries with evidence state, source, and withheld/absent distinction —
the richest disclosure record in the repo. The live homepage widget uses the weaker
`BundleShareEvent` path. **No sharing happens during preflight** in either.

**MF target voice:**

```
Stanford role
42 items already available
2 employer-specific questions
1 source refresh
0 document uploads currently necessary
```

**Preflight partition (per opportunity, privately, no disclosure):**

```
Already known · Reusable · Needs refresh · Employer-specific · Unknown · Clinician decision required
```

**Gate applied (Disclosure Admission Gate):** preflight computes the **minimum evidence set** for
the resolved recipient + purpose + transaction, but reveals nothing. At the moment the clinician
clicks **Apply with VitalCV**, only irreducible role-specific questions remain, and the clinician
sees the exact set before authorizing. **Nothing is shared until explicit authorization**
(DOCTRINE: anonymous/unauthorized writes rejected; consent is per-recipient, per-purpose, never
silently reused).

**Product dependency:** the "Already known / Reusable / Needs refresh" partition needs the
`satisfies` dependency index (NEW-PTC). MF fixtures it for Demo-0; production needs the compiler.

---

## 5. Anticipatory maintenance — "this changed"

**Today (PARTIAL):** `continuousMonitor.ts` cron recomputes CRS/trust-state on *adverse source
change*. There is **no** job that ages evidence into `stale` and recomputes gaps/readiness — that
trigger is the gap.

**MF target voice:**

```
One thing needs you.
Your CA license source check is older than this employer accepts.
Refreshing it updates 2 active applications.
```

**Flow:** `change → dependency impact analysis → incremental recompute → safe automatic work →
determine whether human action remains`. **No notification when the system can safely maintain
state without the user** (thesis §22 / EC-8). Safe-automatic = refresh authorized sources, recompute
derived state, expire stale projections, prepare preflight/preview. Never-automatic = share, attest,
resolve a factual conflict, accept, confirm start.

**Gate applied:** the trigger set is event-driven, not polling-noise; a recompute that changes
nothing the clinician must act on produces **no** notification.

---

## 6. The second move — proving reuse

**Today (NEW as product):** reuse does not exist as a clinician-facing feature. The PSV receipt
reuse lane is a different lane; a clinician's *second application* re-does the work.

**MF target voice:**

```
Most of your professional state carries forward.
New employer-specific work: 2 items.
```

**How reuse is proven (friction telemetry, thesis §29):** measured per second move —
`fields not re-entered`, `evidence not re-collected`, `source queries avoided`, `documents not
re-uploaded`, `time delta vs first move`. **Zero and unknown are valid measurements.** This is the
Q20 answer: the second move is easier iff those deltas are positive and measured, not asserted.

**North-star tie:** every completed move must make the next easier. The friction objective profile
(OPTIMIZATION) minimizes newly-collected sensitive attributes and clinician actions first, so a
second employer inherits the first move's state by construction.

---

## 7. What this journey must never become

- **"Complete your profile."** Replaced by *"We found this. Is it right?"*
- **A chatbot.** EC-8: AI manifests as work, not chat. No "Ask VitalCV anything," no transcripts.
- **A maximum-proofing signup.** Assurance rises with consequence (A0→A5); public browsing and
  preference capture stay at A0/A1.
- **A giant dashboard.** The "One Thing" card is the default; enrichment stays visibly optional.
- **Silent AI truth.** Every AI-proposed fact is a labelled candidate the clinician confirms.
- **Silent resharing.** Each new employer is a separately authorized disclosure.
