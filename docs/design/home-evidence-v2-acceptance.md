# Home Evidence Experience v2 — acceptance checklist

Companion to [`home-evidence-experience-v2.md`](./home-evidence-experience-v2.md).
Every box must be checked, or the miss must be recorded explicitly in the wave
report, before the program is called complete.

Legend: `[ ]` open · `[x]` met · `[—]` deliberately not applicable (state why).

---

## Product

- [ ] NPI entry reads as the beginning of VitalCV, not a newsletter field.
- [ ] A visitor sees real source behavior without leaving the homepage.
- [ ] Source response, limitation, and access gap remain visually distinct.
- [ ] Employer review is stated as explicitly human.
- [ ] Permission is stated as clinician-controlled, next to the action it governs.
- [ ] The clinician CTA is primary; the employer CTA is secondary.
- [ ] One next-best action on the resolved result — not a menu.

## Design

- [ ] One semantic surface system (`data-home-tone`), homepage-scoped.
- [ ] One motion vocabulary; one product easing token.
- [ ] One CTA hierarchy: filled / bounded / text+cue.
- [ ] One evidence-capsule visual language shared by resolving, resolved and error.
- [ ] No copied Zoox implementation, class name, font, asset, colour or copy.
- [ ] No decorative widget pile; no carousel; no scroll hijacking.

## Source truth

- [ ] No bare `Verified` status label anywhere (JSX text or quoted literal).
- [ ] No phrase from the 23-item prohibited list ships unnegated.
- [ ] Every lane renders **its own cadence**, never a blanket "live".
- [ ] OIG cadence is read from `SOURCE_LANE_OPS`, never typed inline.
- [ ] PECOS and licensure are never labelled confirmed.
- [ ] Access-required and unavailable states stay visible, not hidden.
- [ ] No timestamp is rendered unless the API actually provided one.
- [ ] No fabricated percentage, score, confidence, clinician name or source result.
- [ ] Identity header renders registry-derived values only (`registryIdentity`).
- [ ] The legacy `alreadyRegistered`-without-`identitySource` payload falls back
      to the neutral header.
- [ ] System error is presented as a system state, not a finding about the NPI.
- [ ] Illustrative artifacts carry a visible illustrative note.
- [ ] Decorative atmosphere contains no live-result vocabulary.

## Engineering

- [ ] No new runtime dependency.
- [ ] `scripts/design-lint-baseline.json` is unchanged or **lower** — never raised.
- [ ] No `@keyframes` outside `apps/web/styles/motion.css`.
- [ ] No `animation: … infinite` on any homepage surface.
- [ ] No `scroll-snap-type`.
- [ ] No `wheel` / `touchmove` listener and no `onWheel`.
- [ ] No page-level scroll-progress listener.
- [ ] No raw colour, literal z-index, raw `box-shadow` or literal font stack in
      new `apps/web/styles/**` files.
- [ ] No increase in raw `lucide-react` imports.
- [ ] No page-level `opacity: 0` hidden-content trap.
- [ ] SSR-readable DOM order preserved.
- [ ] All existing analytics events preserved (or supersession documented).

## Accessibility

- [ ] Exactly one `<h1>`; heading order is semantic.
- [ ] The NPI field has a real, persistent `<label>` — never placeholder-only.
- [ ] Field description wired via `aria-describedby`.
- [ ] Errors announced (`role="alert"` or a correctly wired live region).
- [ ] Resolving state is a polite live region.
- [ ] Resolved state is announced.
- [ ] Complete keyboard path; focus indicators never removed.
- [ ] Focus returns to the input after reset.
- [ ] Tabs are keyboard-operable and announce the active state.
- [ ] Colour is never the sole carrier of meaning.
- [ ] Contrast meets AA at every tone.
- [ ] Usable at 200% zoom.
- [ ] Reduced-motion parity: final state, immediately.
- [ ] Page is readable with JS disabled.
- [ ] Touch targets are adequate; input is ≥16px on iOS.

## Gates

- [ ] `pnpm check:design`
- [ ] `pnpm check:claims`
- [ ] `pnpm check:routes`
- [ ] `pnpm check:canonical-source-adapters`
- [ ] `pnpm check:workflow-contract`
- [ ] `pnpm --filter @vitalcv/web lint`
- [ ] `pnpm --filter @vitalcv/web test`
- [ ] `pnpm --filter @vitalcv/web test:e2e`
- [ ] `pnpm build:web:direct`

## Release

- [ ] All required CI checks green — not "most".
- [ ] Any failure proven unrelated **against main**, not assumed.
- [ ] Merge SHA recorded.
- [ ] `https://vitalcv.com/api/version` reports production / Railway / main /
      the exact deployed SHA.
- [ ] Auth health 200, DB health 200, homepage 200.
- [ ] Reduced-motion CSS present in the production bundle.
- [ ] No hydration or console errors in production.
- [ ] Release receipt distinguishes **passed / skipped / pending / failed**.
- [ ] Rollback SHA documented (`8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003`).

---

## Hard stop conditions

Stop and report rather than guessing when:

1. A proposed claim is not supported by existing source/API data.
2. A timestamp or source observation time is unavailable.
3. A wave would require **increasing** a design-lint baseline.
4. Baseline main is already red before the change.
5. The current API contract conflicts with the requested state.
6. A database migration or public API breaking change appears necessary.
7. A security/authentication boundary would change.
8. Existing production behavior cannot be preserved without a founder choice.
9. Exact-SHA production convergence cannot be proven.
10. Uncommitted user work unrelated to this program is encountered.
