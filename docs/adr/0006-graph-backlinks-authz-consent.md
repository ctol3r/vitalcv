# ADR 0006: Public bidirectional-relationships endpoint — authorization & consent

- **Status:** Proposed — gates the merge of [#748](https://github.com/ctol3r/vitalcv/pull/748) (G4 bidirectional backlinks).
- **Date:** 2026-07-20
- **Context basis:** `origin/main`; endpoint under review: `apps/web/app/api/entities/[type]/[id]/relationships/route.ts` (from PR #748).
- **Deciders:** graph lane + product/policy. BASE-0 (`docs/audits/base-0-current-state-2026-07-20.md` §8) flags #748 **REBASE, then hold for ADR** — "do not merge on CI-green alone."

## Context

PR #748 adds `GET /api/entities/[type]/[id]/relationships` → `{ outgoing, backlinks }` for a focus node, projected from the same real evidence chain (`projectEvidenceToGraph`) that `/api/organizations` already uses. Observed properties of the route as written:

- **Public, unauthenticated**, keyed by NPI. Only `type === 'clinician'` with a 10-digit NPI id is wired; everything else → a **uniform 404** (`NPI_RE.test(id)` guard, no 500 leak).
- `Cache-Control: no-store`; anti-enumeration 404 for any bad id or projection failure.
- The PR's own justification (route header): *"its relationships are the clinician's own evidence graph, which is already public via `/verify/:npi` and `/api/evidence`, so this adds no new authorization surface."*

That justification is **sound for the `outgoing` half** — a clinician's outgoing edges (their identity → the sources/issuers backing their own evidence) are exactly what `/verify/:npi` already publishes. It is **not automatically sound for the `backlinks` half.**

### The real question: aggregation of backlinks

`backlinks` answers *"who points at this clinician?"* — e.g., which organizations recognized/accepted them, which issuers issued to them. Two facts can each be individually public yet still create a new disclosure when **aggregated behind one NPI-keyed call**:

- Individually public today: NPI-keyed employer **acceptance history** is a public read (Recognition), and a credential's **issuer** is visible on `/verify/:npi`.
- New surface if unbounded: a single endpoint that enumerates *every* backlink to a clinician turns scattered public facts into a **relationship map** — e.g., "every employer associated with NPI X." Even with public inputs, one-call aggregation is an inference/profiling surface the individual reads do not hand you, and it is the exact shape a scraper wants.

The truth/consent posture (Godmode product law #1 "career-owned, consent-based data"; law #10 "privacy is a product feature") means we must be able to state precisely *which* edges a public viewer may aggregate, and prove it.

## Decision

**Merge #748's `outgoing` as public (no new surface), and constrain `backlinks` to an explicit, tested allow-list of independently-public edge types — do not ship an unbounded public backlinks projection.**

Concretely, the merge gate for #748 is:

1. **Allow-list the backlink edge types** the public endpoint may return, to those already independently public by their own source's rule (Recognition/acceptance edges that are already NPI-keyed public; issuer edges already on `/verify`). Any edge type not on the list is **excluded from the public response**, not merely undocumented.
2. **A contract test** asserts the public projection contains no edge type outside the allow-list — so a future addition to `projectEvidenceToGraph` (a private employer note, a draft acceptance, a non-public relationship) cannot silently leak into the public backlinks. This is the enforcement, mirroring how the public-claims gate and the `/design` guard turn a rule into CI fact.
3. **Keep the existing hardening:** uniform 404 anti-enumeration and `no-store` stay.
4. **Preserve exact-match only:** NPI `^\d{10}$` (already present) — no fuzzy/partial id lookups.

If, on inspection, `projectEvidenceToGraph`'s backlink edges are **already** all public-derivable, this ADR is satisfied by adding the test that pins that invariant (little code, permanent guarantee). If any backlink edge is **not** independently public, that edge must be gated behind subject/authorized-org auth (the viewer is the subject clinician, or an org with a legitimate relationship) rather than served publicly.

## Options considered

| Option | Verdict |
|---|---|
| **A. Ship as-is** ("already public") | Rejected. True for `outgoing`, unproven for `backlinks`; no guard prevents a future private edge from leaking through the shared projection. |
| **B. Gate the whole endpoint behind auth** | Rejected as the default. Overkill for `outgoing`, which is genuinely public, and it would break the public `/verify`-adjacent use case the feature is for. Reserve auth-gating for any specific non-public backlink edge. |
| **C. Allow-list + tested public-edge invariant** (chosen) | Preserves the feature and the "no new authorization surface" claim by making it *true and enforced*, not asserted. |
| **D. Demo-NPI-only gate** | Rejected as the end state (it's a launch crutch), though acceptable as an interim if the allow-list work is deferred — the route already references a demo NPI. |

## Consequences

- **Positive:** the public relationship endpoint ships with a provable disclosure boundary; the truth/consent contract is testable, not narrative; scraping surface is bounded to already-public facts.
- **Cost:** #748 needs the allow-list + one contract test before merge (small); a genuine audit of which backlink edge types `projectEvidenceToGraph` emits.
- **Follow-on:** when an authenticated, tenant-scoped person/evidence relationship view is built (the richer graph), it is a *separate* authorized surface — this ADR governs only the **public** NPI-keyed endpoint.

## Action for #748

Do not merge on CI-green alone (per BASE-0). Before merge: add the backlink edge-type allow-list + the contract test above; confirm no non-public edge type is in the public response. Then the endpoint may ship public.
