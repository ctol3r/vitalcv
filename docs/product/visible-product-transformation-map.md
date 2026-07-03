# Visible Product Transformation Map (Issue #514)

Goal: make VitalCV *feel* like a polished, dynamic clinician career-wallet and
healthcare-trust network — concept-buy-in ready for clinicians, employers,
credentialing teams, verifiers/issuers, and investors — with AI (MATCHA) shown
as an honest intelligence layer, never "AI-powered" fluff.

North star: a visitor immediately understands *what VitalCV is, why it matters,
what they can do now, why to trust it, and how AI makes it smarter.*

---

## Production audit (baseline)

Captured against `origin/main` (live) before this wave. Classification legend:
impressive / clear / dynamic / trustworthy / visible / live / real-vs-demo.

| Surface | State | Read |
| --- | --- | --- |
| `/` | live, real | Was clear + trustworthy but **static** and read as an NPI checker: hero centered a bare NPI box, product story below the fold. Not yet "impressive." |
| `/sign-in` | live | Clerk-hosted; out of scope for visual wave. |
| `/holder` (Wallet tab) | live, real | Passport + trust state + Recognition. Raw dark-zinc; functional, not command-center polished. |
| `/holder/home` | live, real | Strong dashboard (wallet identity, readiness, checks, Recognition, next step, opportunities, share). The loop was not legible; no explicit "AI next step." |
| `/holder/readiness` | live, real | Source-backed lanes, live state log, share/recognition CTA. Trustworthy; provenance vocabulary not yet spelled out for buy-in. |
| `/clinician/profile` | live, **stub** | Read-only "foundation shell" — 11 sections, all empty placeholders. Biggest genuine gap. |
| `/holder/recognition` | live, real | Acceptance record + "what an acceptance means." Honest states. Not yet the emotional "earn & share" moment. |
| `/holder/opportunities` | live, real | MATCHA/marketplace matched roles with match bands. Real. |
| `/verify/[npi]` | live, real, public | Public source-backed proof — the real share target. |

Honest constraint: signed-in surfaces are Clerk-gated and production blocks
automated browsers, so signed-in work is verified via static render with sample
data (never shipped) plus reviewer confirmation in an authenticated session.

---

## The loop this wave surfaces everywhere

```
Free CV Wallet → identity/readiness from trusted sources → AI explains gaps &
next steps → earn/maintain Recognition → share proof with employers/verifiers →
match to opportunity → apply with VitalCV → start faster → reuse for next move
```

---

## Delivery

- **Wave A — Public homepage** (this PR): product-forward hero with a VitalCV
  Wallet preview + capability rail; **"The intelligence layer" (MATCHA)** section
  (explains gaps, recommends next step, matches readiness→opportunity, helps
  employers trust faster — all honest, reasoning-shown); **"Who buys in"** buyer
  audiences (clinician/employer/credentialing/verifier/investor); free-wallet CTA;
  lightweight accessible motion (reduced-motion safe).
- **Wave B — Holder home**: explicit rules-based **AI next step** + command-center
  polish; the product loop rail (shipped in #516/#517).
- **Wave C — Readiness/profile**: provenance labels (NPI-confirmed / source-backed
  / self-attested / missing / needs review), why-each-item-matters, what improves
  Recognition and helps employers trust faster; polished empty/error/loading.
- **Wave D — Recognition**: the earn-and-share moment — what it means / supports /
  is not yet source-backed / how to prove it; public verifier CTA, no data leakage.

## Honesty rules (held across all waves)

No fake metrics, no fake clinicians, no fake readiness/Recognition, no unsupported
"10x", no employer-platform expansion, honest empty/error states, and the
truth-contract banned strings (no bare "Verified", etc.). AI is deterministic /
rules-based today and is labeled as reasoning over source-backed signals — no
fabricated LLM intelligence.
