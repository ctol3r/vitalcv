# Home Evidence v2 — production convergence receipt

Verified **2026-08-02**, against the live site rather than against CI.

This is the check the Wave 5 release receipt could not make. That receipt verified
production at `595e25395`. Six merges have landed since — `#1021`, `#1024`,
`#1025`, `#1026`, `#1029` and their siblings — so *"the program passed in
production"* had quietly become a statement about a commit that is no longer
serving. Nothing had confirmed the current tip was deployed at all.

Every line below was executed. Where something was not executed it is marked
**SKIPPED** or **PENDING**, never passed.

---

## 1. Verdict

| Gate | Result |
| --- | --- |
| APPLICATION LIVE | **passed** |
| PUBLIC SMOKE | **passed** |
| EXACT SHA | **passed** |
| SIGNED-IN CHECK | **skipped** — see §5 |
| CONVERGENCE RECEIPT | **passed** |
| BLOCKER | none |

---

## 2. Exact-SHA convergence

The gate this receipt exists for. A green public smoke proves *a* build works;
it does not prove *this* build is the one answering.

```
main tip                865445f55d12b78ed71f943b319db6febc46eb13
web  /api/version       865445f55d12b78ed71f943b319db6febc46eb13   ← identical
api  /health git_sha    865445f55d12b78ed71f943b319db6febc46eb13   ← identical
```

Both services, not just the web app. `/api/version` also reports
`branch=main`, `environment=production`, `platform=railway`.

`builtAt` is `null`. That is the correct value, not a gap: the field previously
returned the *request* clock, which made build time unfalsifiable. Reporting
nothing is honest where reporting a timestamp was not.

---

## 3. Health

| Check | HTTP | Body |
| --- | --- | --- |
| `vitalcv.com/api/health/auth` | 200 | `status: ok`, `authExpected: true`, runtime publishable + secret keys present |
| `vitalcv.com/api/health/db` | 200 | `db: ok` |
| `api.vitalcv.com/health` | 200 | `status: ok`, 0 error requests, p90 0.98ms |
| `/`, `/status`, `/trust`, `/trust/attribution` | 200 | — |

Bodies were read, not just status codes. A 200 carrying a failure body is the
failure mode this table exists to catch.

---

## 4. The program, measured on the live page

Driven in a real browser against `https://vitalcv.com`, not inferred from HTML.

| Marker | Live value |
| --- | --- |
| `data-home-phase` (D1) | `idle` at the SSR floor |
| `data-home-tone` (D3) | `paper`, `mist`, `trust` — all three present, in order |
| NPI label (PR B) | `Your 10-digit NPI` — one name, no per-state rewording |
| NPI input font size | 60px (≥16px, no iOS zoom) |
| Decorative seal / tick (D2) | **0 elements** |
| TruthBoundary (D6) | present |
| Horizontal overflow | 0px |
| Console errors | none |
| Page / hydration errors | none |
| Infinite animations **running** | **none** |

The infinite-animation line needs its method stated. The shared CSS bundle
contains **48** `infinite` declarations, which looks like a contract breach at a
glance. They belong to other routes — `aicon-*`, `vh-*`, `matcha-*`, `mz-*`. A
shared bundle containing a rule is not evidence the homepage applies it, so the
figure above is `animationIterationCount` read from every element actually in
the live DOM. Zero.

Reduced-motion CSS ships in all three homepage bundles. No `scroll-snap-type` in
any of them.

---

## 5. SKIPPED — and why

| Not done | Why | Consequence if wrong |
| --- | --- | --- |
| **Signed-in check** | Requires entering real credentials. That is not an action this agent performs, under any framing. | A defect reachable only behind auth would not appear here. The public homepage this program changed needs no session. |
| **Cross-browser** | Chromium only, inherited from the Wave 5 receipt. The atmosphere recession depends on `:has(~ …)`, the newest CSS the homepage leans on. | Recession stops; atmosphere holds its rest state. Legible, no meaning lost. |
| **Real screen reader** | Nobody drove production with VoiceOver or NVDA. | An announcement could be technically correct and still read badly. |
| **Real device** | Viewport emulation only. | Touch-target and iOS-zoom findings rest on computed CSS, not a thumb. |

---

## 6. Source-lane consistency

Checked because these surfaces have contradicted each other before, and because
the homepage overstating a lane is the exact failure the truth contract exists
to prevent.

| Lane | `/api/status` | Homepage ledger | Overstated? |
| --- | --- | --- | --- |
| `nppes_identity` | operational | Available · read live | no |
| `oig_exclusions` | operational | Available · monthly snapshot | no |
| `pecos_enrollment` | operational | Available · quarterly snapshot | no |
| `state_license` | pending_integration | Access required | no |
| `employment_history` | non_production | Not yet connected | no |
| `board_certification` | not_implemented | Not yet connected | no |

Same six keys on both surfaces. No lane on the homepage claims more than
`/api/status` grants it. The hero cadence sentence agrees with the ledger:
NPPES live per request, OIG monthly, PECOS quarterly, licensure access-gated.

---

## 7. Rollback

`#1021` — the seal removal — reverts with:

```
git revert -m 1 11f7c9b4a
```

Additive at the file level; touches no route, data path or API. Reverting it
restores a permanent green confirmed checkmark to the homepage, so it should be
reverted only alongside a decision about what the decorative field is for.

---

## 8. Carried forward

Unchanged from the Wave 5 receipt and still open:

- **E0 `/api/system/source-runtime` returns 401** — a route whose own header
  calls it a public transparency endpoint is gated by `tenantGuard`.
- **Homepage lane availability reads the static registry**, not E0 runtime
  truth. Correct today, but the two should be reconciled once E0 is readable.
- **Identity header repeats the NPI** when the registry cannot resolve a name.

Closed by `#1021` and no longer carried: *"the decorative field is a founder
decision."* The field's geometry remains a design question, but the part that
was a **truth** question — a checkmark in `--vt-state-source-confirmed`,
rendered before any lookup — is gone. The Wave 5 audit recorded that the field
"carries no live-result vocabulary", which was accurate about words; the seal
was not a word, and the glyph fell through the gap between copy review and
colour review.
