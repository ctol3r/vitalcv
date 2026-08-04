# Zenlike UI Doctrine

**VitalCV · Design Wave D56 · Calm Credentialing Layer**
Status: doctrine · binding for product surfaces
Companion: [`role-auth-interoperability-ux.md`](./role-auth-interoperability-ux.md)

These are rules, not adjectives. Each is testable in design QA.

---

## North star

> *VitalCV should feel like the calm credentialing layer between fragmented systems.*

Every surface answers six questions, in this order:

1. What is known?
2. What is source-backed?
3. What requires access?
4. What is unavailable?
5. What still needs institution review?
6. What can I safely do next?

If a surface cannot answer #6 in one glance, the surface fails.

---

## 1. Visual style

### 1.1 Palette
- Background: `--paper #f4f2ec`.
- Foreground: the `--ink` scale only (`--ink-0` … `--ink-950`).
- Semantic accents only:
  - `--ok` for source-backed.
  - `--watch` (amber) for access-required and temporarily-unavailable.
  - `--unknown` for not-connected.
  - `--p0` (red) is reserved for **actual adverse or blocking** signals only. Never for outages, never for not-connected, never for unauthenticated.

### 1.2 Type
- **Geist** for prose.
- **Geist Mono** for state tokens, identifiers, eyebrows, technical surfaces.
- No third family.

### 1.3 Surface
- One primary action per surface. Everything else is `btn.ghost` (outline) or `btn.muted` (text-only) or a mono text link.
- Density is earned through hierarchy, not stripped through bigger margins. Tables and registers are first-class citizens.

### 1.4 What is forbidden
- Gradients in marketing or product surfaces.
- Decorative crypto visuals.
- Looping pulses.
- "Live" ticker animations.
- SaaS confetti.
- Aggressive iconography filling empty space.
- Stock photography of clinicians.

---

## 2. Interaction style

- **NPI-first.** The fastest path to value on `/` is typing 10 digits and pressing return. The NPI input is focused on page load. Keyboard shortcut `/` re-focuses it from any surface.
- **One decision per screen.** If a screen presents two, the second is a quiet secondary, not a peer.
- **Role-aware progression.** Post-login destination is computed from the role tile, not from a generic dashboard.
- **Verbs do, nouns destinate.** A button with a verb is an action ("Check readiness"); a button with a noun is a destination ("Passport"). Never blend; never use bare "Continue."
- **Unknown / unavailable feels operational, not personal.** Copy never grades the clinician.
- **No shame language.** No "incomplete", "missing", "failed verification". Use "needs institution review" or "not connected in this build".

---

## 3. Motion

- Default transition: **320 ms**. Range: **280–420 ms**. Easing: `cubic-bezier(.2, .7, .2, 1)`.
- Permitted: fade, slide ≤ 8px, opacity, single-shot.
- **No looping animations on idle surfaces.**
- "Live" indicators only when tied to a real event in the last 60 seconds. Otherwise show a timestamp.
- Loading state is a skeleton lane with the source name visible. No global spinners. No shimmer larger than the affected cell.
- Forbidden: fake activity tickers, counters that increment without a source event, animated checkmarks for things that did not just happen.

---

## 4. Information hierarchy

Every readiness surface follows the same five-step ladder:

1. **What happened.** One sentence at the top.
2. **What it means.** One line per lane in the Proof Continuity Rail.
3. **What is still needed.** Lane-level CTA, never page-level alarm.
4. **What to do next.** One primary action below the rail.
5. **Proof details only if expanded.** Inspect drawer carries `runId`, `lineageKey`, `kid`, attestation boundary, receipt, replay.

If information cannot pass the test *"would a clinician want to read this on the primary surface?"*, it belongs inside Inspect, on `/trust`, or nowhere.

---

## 5. Voice

### 5.1 Tone
- Calm, precise, factual.
- We are credentialing infrastructure, not a credentialing committee.
- Never enthusiastic. Never apologetic. Operational.

### 5.2 Sentence shape
- Short. Verb-led. No marketing throat-clearing.
- Translate every protocol term into a felt experience (see translation table in role-auth doc §3.4).
- The phrase "Nothing has been marked adverse." appears literally on every degraded state.

### 5.3 Banned phrases
See role-auth doc §0 and §8. Summary:
- `Verified` (in any form, bare)
- `Cleared`, `Approved` (as adjudication)
- `Complete credentialing`, `Instant credentialing`
- `Accepted everywhere`
- `HIPAA compliant`, `SOC2 certified`, `NCQA certified` (unless evidenced)
- `Wallet ready`, `Blockchain login`
- `Real-time monitoring` (unless evidenced)

---

## 6. State token system

Single shared vocabulary, used identically across `/passport`, `/demo/*`, `/trust`, employer view, and the printed packet.

| Token | Visual | Meaning |
|---|---|---|
| `SOURCE-BACKED` | green outline, filled dot | Primary source returned a record this session. |
| `ACCESS REQUIRED` | amber filled, square dot | Gated; needs organization auth or separate evidence. |
| `NOT CONNECTED` | dashed outline, dashed dot | Lane not wired in this build. |
| `TEMPORARILY UNAVAILABLE` | amber filled, round dot | Source up but didn't answer. **Not red.** |
| `SNAPSHOT ONLY` | ink dashed | Saved point-in-time, may be stale. |
| `NEEDS INSTITUTION REVIEW` | amber outline, diamond dot | Evidence captured; decision belongs to the committee. |
| `DEMO ONLY` | info blue | Illustrative, not customer data. |

Adverse / blocking states (true red) are reserved for genuine adverse findings from a primary source, never for technical conditions.

---

## 7. Disclosure pattern

Every readiness surface carries one persistent line:

> Reviewer-ready head start. Institution review is still required.

Every demo surface carries one persistent line:

> Illustrative market benchmark — not a customer outcome.

Every verifier surface (`/trust`, `/trust/attribution`) carries an explicit, page-level **attestation boundary** that names what VitalCV claims and what it does not.

---

## 8. Design QA checklist (run per surface)

- [ ] Exactly one primary CTA visible.
- [ ] Every CTA names a destination or a clear action — no bare "Continue."
- [ ] Banned phrases (§5.3) do not appear.
- [ ] No red used for non-adverse states.
- [ ] No looping animation persists past 1s on idle screens.
- [ ] All entrance transitions fall within 280–420 ms.
- [ ] Disclosure line present where required (§7).
- [ ] State tokens (§6) meet WCAG AA contrast on `--paper`.
- [ ] Tab order: NPI input → primary CTA → secondaries → nav.
- [ ] Demo surfaces carry `DEMO ONLY` chip.
- [ ] Inspect drawer is the only place protocol identifiers (`runId`, `lineageKey`, `kid`, `JWKS`, `DID`) appear in product copy.

---

## 9. Related

- [`role-auth-interoperability-ux.md`](./role-auth-interoperability-ux.md) — flows, journeys, copy, screens.
- [`../ops/role-auth-ux-implementation-brief.md`](../ops/role-auth-ux-implementation-brief.md) — implementation handoff.
- `VitalCV Calm Wave D56 Design Report.html` — full visual specification (project root).
- `VitalCV Passport Truth-State Spec.html` (D55) — truth-state backbone.
