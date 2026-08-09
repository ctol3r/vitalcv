# Audit remediation — freeze-exempt findings, 2026-08-09

Closes the findings that `page-consistency-audit-2026-08-09.md` §Suggested
sequencing marked **freeze-exempt now** — truth corrections, accessibility
regressions, metadata, route gating, redirect hygiene and client-fetch guards.
Everything left open below is either gated on UX-02 or is an access change
outside the design-only boundary.

Base: `origin/main` @ `4a023b269`. Every fix verified against a running server,
not inferred.

---

## Fixed

### F3 · NPDB rendered customer-facing — *Class A, EC-3*

Three sites, only one of which the audit had found:

| Site | What it said | Verdict |
|---|---|---|
| `design-system/components/ProvenanceChipLegend.tsx:35` | `unavailable: { source: 'NPDB', detail: 'no payload' }` — renders on `/evidence-network` | **Fixed** → `NPPES`. `unavailable` means "the source did not return a payload **on this attempt**", so the example has to name a source VitalCV actually queries. NPDB has no adapter, so the chip implied a read that never happens |
| `design-system/components/TrustTierBadge.tsx:43` | `example: 'e.g. NPPES, OIG/LEIE, PECOS, NPDB'` under **T3 · Source-checked — "Confirmed against an authoritative registry"** | **Fixed** → `'e.g. NPPES, OIG/LEIE, CMS PECOS'`. This was worse than the legend: a confirmed mark on a non-integrated source, which EC-3 forbids in the same sentence as the noun ban |
| `app/design/freshness/page.tsx:106` | `<FreshnessMeter source="NPDB continuous query" checkedAt={null} />` | **Fixed** → `"Primary source verification"`. A meter for a lane with no adapter reads as a monitored source that simply has not run yet |

**Not changed, deliberately:**

- `components/review/EmployerCockpit.tsx:243` — `<li>NPDB (National Practitioner
  Data Bank)</li>` sits under the heading **"Not included in this review"**. That
  is the opposite of the over-claim EC-3 guards against, and stripping it would
  make the surface *less* honest. Component has zero importers. Allowlisted with
  the reasoning.
- `components/trust-state/types.ts:37,50` — union members of `CredentialType` and
  `SourceType`. CLAUDE.md is explicit: *"Do not mass-rename backend classes,
  schemas, APIs or audit records to match the marketing vocabulary."* EC-3 bans
  the customer-facing **noun**; an identifier no surface renders is not one.
  Allowlisted.

**Why it recurred, and the gate.** `check-public-claims.ts` banned the phrase
`NPDB cleared` — not `NPDB`. Both live violations passed because neither said
"cleared". The gate now bans the bare noun, which its two existing behaviours
keep from being blunt: code comments are skipped, and a phrase preceded by a
negation is treated as honest copy.

Extending it exposed a second gap: the comment-skipper knew `//`, `/* */` and
JSDoc `*`, but not `{/* … */}`. A JSX comment never reaches the DOM, so it
cannot be public copy — yet explaining *why* a banned phrase was removed
re-tripped the gate on the explanation. Fixed, then **proven by injection**:
restoring the real `source="NPDB continuous query"` string fails the gate;
reverting it passes.

### F4 · Public pages with no `<h1>` — *Class A, EC-5*

- **`/investigate/[npi]`** — the masthead already carried the title as two
  `<div>`s ("Credential Investigation" / "NPI …"). They became one `<h1>` rather
  than a new heading being invented above them. Type stays on the spans, so the
  render is byte-identical; verified live — exactly one `h1`, masthead unchanged.
- **`/review/[entityId]`** — `ReviewClient` does have an `h1`; the audit hit the
  **unresolved-link state**, which is a bare `TrustStateCard`, and `CardTitle` is
  a shadcn `<div>`. Added an opt-in `titleAs` prop (default `'div'`, so every
  other instance is unchanged) and set `titleAs="h1"` on the two terminal states.
  Promoting `CardTitle` globally would have scrambled heading order site-wide.

### F5 · Three surfaces with two `<h1>`s — *Class A, EC-5*

`/sign-in` and `/sign-up` rendered the page heading plus Clerk's own card
heading — "Welcome back to VitalCV" over "Sign in to VitalCV", near-duplicate
copy and two competing document headings.

Fixed with a **per-component** Clerk appearance (`authCardAppearance`) that hides
the card's header slot, exactly as `logoBox` is already hidden for the same
reason ("supplied by the shell, not Clerk's slot"). Deliberately **not** added to
the global `clerkAppearance`: that object goes to `<ClerkProvider>` and would
strip the header from `<UserProfile />` and the verification flows, where it is
the only thing naming the panel.

Verified in a browser, and stated precisely: Clerk's `h1` is hidden by an
ancestor (`0×0`, `display: none`), so **one heading is exposed to the
accessibility tree**. The element still exists in the DOM — a naive
`querySelectorAll('h1').length` still returns 2. The a11y outcome is correct; the
DOM count is not zero-cost to claim.

`/auth/resolving` carried **no** `h1` of its own — the audit counted two because
it client-redirects into `/sign-in` and captured that DOM. Its "Signing you in…"
line is now the `h1`, still `aria-live`. It matters for the visitor whose
redirect stalls, for whom the interstitial is the whole page.

### F8 · Metadata defects on five public surfaces

- `/for/{cvo,payer,staffing-exchange}` rendered **"For CVOs — VitalCV — VitalCV"**:
  `landingContent.ts` baked the brand into `title`, and `app/layout.tsx`'s
  `template: '%s — VitalCV'` appended it again. Brand removed from the three
  entries; `title` feeds `generateMetadata` only, so no visible copy moved.
  Verified live: `For CVOs — VitalCV`.
- `/verify` declared no metadata and inherited the root marketing title
  ("Your career evidence, ready before your next job") — a verifier arriving with
  a shared record was pitched clinician job-seeking. It is a client component and
  cannot export `metadata`, so a `layout.tsx` carries it. Its three children all
  export their own and override it. Verified: `Check a shared record — VitalCV`.
- `/auth/error` likewise. Now `Sign-in issue — VitalCV`, `noindex`.

### F10 · `/ops/*` sign-in redirects hand-rolled three ways

`/ops` and `/ops/engine` built the return URL unencoded; **`/ops/survivability`
dropped it entirely**, so a signed-out visitor signed in and did not arrive where
they were going. One `signInRedirectTo()` helper, encoding the way middleware
already does. Not an authorization change — the gate fires identically; only the
return address is formatted. Verified live, all three now
`307 → /sign-in?redirect_url=%2Fops%2F…`.

### F14 · 401s on public surfaces — *partly a real defect, partly not*

The audit listed four. They are not the same thing:

| Surface | Call | Verdict |
|---|---|---|
| `/auth/error`, `/review/request` | `POST /api/pilot-ops/events` via `PilotFailureSignal` | **Real defect — fixed.** Telemetry posted unconditionally from two routes reachable signed out, so every anonymous visitor drew a 401 that served no purpose. Now gated on `useOptionalRoleContext()?.isSignedIn`, with `isSignedIn` in the dep list so a signed-in visitor still reports after hydration. Verified: **zero** `pilot-ops` requests on an anonymous load |
| `/onboarding` (+3 children) | `GET /api/me/workspaces` in `GetReadySurface` | **Not a defect — reclassified.** The 401 is load-bearing: `if (res.status === 401) setPhase('signed_out')`, which then resolves a carried `?npi=`. Rewriting it to read the session first is possible but changes the mechanism on the primary acquisition path; not worth the risk for console tidiness |
| `/auth/resolving` | `GET /api/auth/resolve-role` | **Not a defect — reclassified.** `res.status === 401` *is* the branch that sends the visitor to sign-in |

---

## Recorded, not fixed

### N7 · `VERIFIED` ships as a bare status label on a public surface — *new, Class A*

Not in any prior audit. `/investigate/[npi]` renders `nppes_identity · T3 ·
**VERIFIED**`. CLAUDE.md: *"No status label may be the bare word `Verified`."*
EC-3 repeats it.

**Why every gate missed it.** `check-public-claims.ts` has two detectors —
`BARE_VERIFIED_JSX = />\s*Verified\s*</` and `BARE_VERIFIED_LITERAL =
/(['"`])Verified\1/`. Both are case-sensitive, the stored literal is lowercase
`'verified'`, and the uppercasing happens **at runtime**:

```ts
function statusLabel(s: string): string { return s.toUpperCase().replace(/_/g, ' '); }
```

No static scan of the source can see the rendered string. This is the
`green_ci_is_not_evidence` pattern in a new place: the label only exists in the
browser.

**Measured scope: 6 components on `/investigate` alone**
(`EvidenceTimeline`, `SourceChronology`, `ChronologyRail`, `ReplayEvidenceStack`,
`ReplayChainExplorer`, `StateTransitionTimeline`), each with its own local
`statusLabel`, plus **45 literal uppercase `VERIFIED` sites** across
`app/` + `components/`.

**Why this wave does not fix it.** EC-3's last bullet is explicit:

> **State-vocabulary freeze:** CD-5's six public states and the nine coverage +
> two review states in `packages/trust-state/sourceCoverage.ts` are reconciled by
> UX-02 via one mapping table. Until then neither vocabulary grows.

Changing 6 of 45 sites from `VERIFIED` to the canonical `Checked` ("the only
state that earns the word", per `ProvenanceChip`) would leave the product using
two words for one state — a worse failure than consistent-and-wrong, and it is
vocabulary work the constitution assigns to UX-02's mapping table. It belongs in
that wave, done once, with the gate made case-insensitive **and ratcheted** (the
`check-design-lint` pattern) so it does not go red across 45 sites on day one.

### N8 · Clerk telemetry is CSP-blocked on every auth page

`https://clerk-telemetry.com/v1/event` is not in `connect-src`, so each
`/sign-in` load logs three console errors. Pre-existing, unrelated to this wave,
and arguably correct (the CSP is doing its job). Worth an explicit decision:
allowlist the host, or disable Clerk telemetry via `<ClerkProvider telemetry>`.

### Still open from the companion audit

- **F9** — `/dev/graph/[entityId]` has no gate while every sibling has one.
  Reconfirmed on `4a023b269`. An access change, outside the design-only boundary.
- **F1, F6, F7, F12** — the locked-row conformance sweep (display typeface,
  pills, shadows, `.mz`/`.vcv` islands). UX-02 / UX-03 token convergence.
- **F2** — the EC-9 vocabulary ban, 38 hits. Needs `scripts/copy-rules.json`
  first; the gate must precede the sweep or it recurs.
- **F11** — 716 sub-44px touch targets. Needs a ratcheted gate, not a patch.
- **F13** — sitemap covers 21 of 49 reachable surfaces.

---

## Verification

- `vitest run` — **3937 passed**, 45 skipped, 0 failed (420 files)
- `pnpm turbo run build --filter @vitalcv/web` — compiled; lint + typecheck clean
- `check-public-claims` — PASS (37 phrases); the new NPDB rule proven by injection
- Live server, anonymous: five titles confirmed; three `/ops` redirects confirmed
  encoded and destination-preserving; `/investigate/[npi]` confirmed exactly one
  `h1` with an unchanged masthead; `/sign-in` confirmed one exposed heading;
  `/auth/error` confirmed zero `pilot-ops` requests
