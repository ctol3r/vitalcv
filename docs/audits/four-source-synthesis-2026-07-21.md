# Four-source synthesis — one slate for vitalcv.com

**Date:** 2026-07-21 · **Read at:** `origin/main` `fe6f2265a` · **Live site checked:** same day

Four planning artifacts were handed over together with the instruction to make
vitalcv.com "aligned with all of the attached as one perfect synthesized" whole.
They do not agree with each other, and three of the four are partly stale. This
file is the reconciliation: **read this one**, then the per-source notes below
only if you need provenance.

> **The headline: alignment is mostly already true.** The largest single risk in
> this pile is not unbuilt work — it is re-executing work that already shipped,
> against documents written before it did. Two of the four sources explicitly
> warn about this; one contains a task that would delete live source.

---

## 1. Disposition of each attachment

| Attachment | Date | What it actually is | Disposition |
| --- | --- | --- | --- |
| `godmode waves 1509-1516.pdf` | 07-20 | Image-only, 39 tasks / 8 waves | **Superseded.** Transcribed to `docs/waves/godmode-master-plan-1509-1516.md`; corrected by `docs/audits/waves-1509-1516-reconciliation-2026-07-20.md`. Read the reconciliation, never the PDF's task labels verbatim. |
| `VitalCV_Deep_Audit_..._2026-07-21.md` | 07-21 | Waves 0–8 + PR queue order | **Current, with one false P0** (see §3). Waves 0–2 and its security lane executed 07-21. |
| `VitalCV System Pages (standalone).html` | 07-20 | A 79-token design contract + governance model, JS-rendered | **Already ported** — see §4. Its remaining value is governance, not tokens. |
| `vitalcv-handoff (2).zip` | 07-12 | 733-file Claude Design export | **Already ingested.** Its own README names `wave1505/index.html` as the primary design; that file is **byte-identical** to the repo's copy, and the `.w1505` island shipped in #628/#629. The other ~429 HTML files are older concept explorations, not a build list. |

---

## 2. The single slate

### Shipped 2026-07-21 (verified live in production)

| Source task | PR | Commit |
| --- | --- | --- |
| Audit security lane — malformed NPI at passport proxy | #823 | `360cbbbcb` |
| PDF **S3** rate limiting — 5 unmetered public lanes | #814 | `dd1f1f642` |
| PDF **C3** debug-artifact purge + fabricated `uptime: 99.99%` | #815 | `c814ad4ff` |
| PDF **S4** Sentry PII scrubbing | #813 | `fc92ba14e` |
| PDF **P2** / audit Wave 1 — source-lane registry | #817 | `2e2bd9037` |
| PDF **S5** header-trust ratchet | #820 | `53c3d0164` |
| Audit Wave 0 — deploy canonicality | #826 | `c33a00b98` |
| Audit Wave 2 — first-screen rebuild | #819 | `b81de98e8` |
| PDF **P3** funnel analytics | #818 | `11c5552bc` |
| Audit Wave 1 tail — per-lane freshness on `/verify` | #824 | `617be58bd` |
| PDF **E2** (ADR half) — backlinks authz ADR | #804 | `fe6f2265a` |
| PDF **H3 + R1** — `#start` anchor, pre-W2 CSS, harness drift | #828 | open |

### Do not execute

- **C4 "phantom packages"** — premise false. There are zero committed `dist/`
  directories and the named packages do not exist. Running it deletes real,
  imported source. (Reconciliation §0.1.)
- **C2 `career-graph/data.ts`** and **C1 `PublicTruthSections`** — both are
  claimed to have no importers; both are load-bearing. `data.ts` is read off disk
  by literal path in a P0 quarantine guard.
- **H1 pre-mount baseline** — no longer capturable; the mount happened in #800.
- **The audit's P0 "production is behind `main`"** — false. See §3.

### Genuinely open

| Item | Source | Note |
| --- | --- | --- |
| **R2** scene residuals | PDF | `GrainOverlay` hardcoded to `getChapterScene('wallet')`; `scrim` computed at `progress.ts` and never consumed. |
| **R3 / axe gate is weak** | PDF | `a11y-gate.yml` runs one file against five synthetic fixtures — not the real homepage — and whitelists `color-contrast`. |
| **A3 / A4** activation | PDF | Backend live; blocked in the web tier on a surface-linkage decision (`ReviewClient` is entity-keyed, has no `applicationId`). |
| **D4** status memory | PDF | Probe results are log-only / in-memory; die on cold start. |
| **E1** employer workspace | PDF | No audited claim record; requirements are a seed-catalog tier, not the four readiness dimensions. |
| **C5a** vitest spread | PDF | Three generations live at once; a hand-written root `vitest/` dir shadows the real package. |
| **Waves 5–8** | Audit | Clinician loop, employer doorway, system-pages port, trust-at-scale. Wave 6 is visible today: `/employers` still opens with "Claim your organization." |
| **#748** | Both | Held behind ADR-0006 (now merged). Needs the backlink allow-list + contract test. |
| **#801** | Audit | Blast radius now known: `globals.css:310–312` define `--color-bg/ink/line` for real and the circular block at `335–342` overrides them. Removing it restores 3 tokens, deletes 5 dead ones, touches 11 files — 9 of them `components/sandbox/`. |

### Blocked on the owner, not on code

These are **not** engineering tasks. Every one is a Railway variable or a founder
decision, and each blocks a "shipped" item from being live:

- `CLERK_ISSUER` + `CLERK_JWT_VERIFICATION=enforce` → closes **G1/S1**, and
  upgrades the #814 rate limiter from IP-keyed to verified-user-keyed
  automatically (no redeploy — the limiter reads the flag).
- `VERIFIER_RBAC_ENFORCED` **and** `VERIFIER_RBAC_MODE` (two flags, not one) → **G2/S2**.
- `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` → makes **#813** live.
- `NEXT_PUBLIC_POSTHOG_KEY` → makes **#818** live. Set an explicit PostHog
  retention window *before* setting the key (`docs/ops/metrics-analytics.md`).
- **FD-1 / FD-2 / FD-3** founder decisions.

---

## 3. The audit's headline P0 was a false positive

The deep audit opens by stating production is materially behind `main` — old
hero, old five-step story, duplicate outline nav, a 34% pseudo-outcome. Checked
against live production the same day, **none of it was true**: the homepage
served `Get hired faster.`, the NPI-first subhead, and the four-chapter rail
(`data-rail-pinned`, `data-rail-chapter`, `data-rail-skip`), byte-identical
across cache-busted and plain requests.

It read a stale cached copy — possible for up to a year under the pre-ISR
`s-maxage=31536000`. `revalidate = 300` had already fixed the cause, and the live
`s-maxage=300` header proves the fix deployed. **No redeploy was performed,
because none was warranted.**

This matters beyond one wrong bullet: the false P0 sat *above* the real one in
the same document. The genuine defect — `/evidence-network` calling monthly and
quarterly snapshots "read live" — was ranked lower and fixed by #817/#824.

Full detail and the verification command: `docs/ops/deploy-canonicality.md`.

---

## 4. System Pages: the repo is already ahead of the prototype

The prototype defines 79 `:root` tokens, including a six-state hue vocabulary
(`--hue-{ok,watch,p0,info,unknown,contra}`, each with `-bg` and `-rule`).

**Two findings change what Wave 7 should be:**

1. **The contract is already ported.** Those `--hue-*` tokens live in
   `apps/web/components/design-wave1505/styles.ts` — the `.w1505` island that
   shipped on 404/error/pricing/contact/legal in #628/#629.

2. **The repo's state vocabulary is a superset.** Production carries
   `--vt-state-{access,blocked,checked,contradicted,gated,ndg,pending,preview,review,stale,unavailable,unknown,verified}`,
   each with `-bg` and `-rule` — roughly 39 tokens against the prototype's 18,
   and the extra states (`ndg`, `preview`, `contradicted`, `review`) encode real
   product distinctions the prototype has no vocabulary for.

**So Wave 7 is not "port the prototype's tokens."** Doing that would *narrow*
the live system. What the prototype still contributes is **governance**: the
non-color-alone rule, the calm empty/error/offline/legal surfaces, the
route-level visual-regression matrix, and design lint. Take the discipline;
leave the palette.

---

## 5. What "aligned" means as of this commit

Verified against live production on 2026-07-21:

- Hero is `Get hired faster.`; one H1, one NPI input, one action in the first
  viewport; no old hero copy, no duplicate outline, no 34% claim.
- Desktop rail pins and scrubs four chapters; mobile and reduced-motion get the
  same chapters as ordinary vertical DOM with no horizontal burden.
- NPPES is the only lane claiming a per-request live read. OIG is labelled a
  monthly snapshot, PECOS quarterly, licensure access-gated — consistently on the
  homepage, `/evidence-network`, `/status`, `/api/status`, and `/verify/[npi]`,
  all driven from `lib/trust/sourceLanes.ts`. A repo-wide sweep finds no
  remaining freshness overclaim.
- Malformed NPIs are refused at the public proxy; well-formed-but-unknown still
  returns a degraded 200 (anti-enumeration, deliberate).
- Public API lanes are rate-limited with the applied scope advertised.
- `/metrics/public` publishes no unmeasured number.
- The only public graph remains the conceptual evidence model.

**Known and not yet aligned:** `/employers` still leads with "Claim your
organization" rather than the buyer outcome (audit Wave 6), and Waves 5, 7 and 8
are open as listed in §2.
