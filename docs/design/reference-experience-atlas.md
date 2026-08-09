# Reference Experience Atlas

**Status:** Harvest complete. All 36 pages named in the founder directive have been measured.
**Established:** 2026-08-01 · **Harvest completed:** 2026-08-01
**Authority:** Subordinate to [`VITALCV_CREATIVE_DIRECTION.md`](VITALCV_CREATIVE_DIRECTION.md) (CD-1…CD-20).
This document supplies **external evidence**; the creative direction supplies **law**. Where a
reference pattern and a CD clause disagree, the clause wins and the pattern is recorded under PATTERN
TO REJECT with the number that killed it.

> **Amendment 2026-08-02.** Some patterns recorded below as PATTERN TO REJECT were rejected on the
> **pre-amendment** readings of CD-11 and CD-13 — specifically the flat 8px displacement cap and the
> literal reading of the carousel line. Both clauses were amended on 2026-08-02 (see
> [`founder-rulings-2026-08.md`](founder-rulings-2026-08.md) FR-1 and FR-2), so a rejection here that
> rests *only* on "horizontal movement" or *only* on ">8px displacement" no longer stands by itself.
> Re-read it against the amended clause before citing it in review.
>
> **Nothing is reinstated.** Rejections citing the carousel *format*, wheel/touch-driven scrolling,
> auto-advance, scroll snap, stock clinician imagery, metric theatre, or glass-on-evidence are
> unaffected and remain binding. Only those two readings narrowed.

**Supersedes:** the prior instruction naming Zoox the sole external design authority. That instruction
was conversational and left no repo artifact (`grep -ril zoox` over the tree returns nothing).

**✅ Fed back into doctrine:** §7 records one measured contradiction of CD-20 (the Carefam capture was
stale). **Amended 2026-08-01** in `VITALCV_CREATIVE_DIRECTION.md` under CD-19, with a dated rationale,
on founder instruction. See §7 C12.

---

## 1. How to read this document

### 1.1 The evidence standard

One rule, the same one the product runs on: **an observation is either measured or it is marked
absent.** Nothing here is filled in from reputation.

| Marker | Means |
| --- | --- |
| *(measured)* | Read out of the live DOM/CSSOM on 2026-08-01 at the stated viewport. |
| *(read)* | Read from rendered text/structure — accurate, but descriptive rather than numeric. |
| **Not observed** | Not captured. The reason is stated. Never guessed. |

### 1.2 Capture method and its limits

Live pages, headless Chromium, **desktop 1280×720** unless stated. Per page: a DOM/CSSOM probe
(computed `position`, media elements, ARIA roles, resolved type, heading text, tap-target geometry,
and a full stylesheet walk for `prefers-reduced-motion` blocks / `@keyframes` / `scroll-snap-type`),
plus a six-point scroll sample on the Zoox home.

**Blind spots, stated up front:**

- **Cross-origin stylesheets are unreadable.** Every CSS count carries `blocked: N`. A
  reduced-motion count of `0` is authoritative **only** when `blocked: 0`. Two records
  (`docs.truvera.io` at `blocked: 8, readable: 2`, and `doximity.com` at `blocked: 6, readable: 421`)
  have CSS counts too degraded to use, and are marked so rather than quoted.
- **Headless is not a human.** Pointer choreography, hover states and scroll-scrubbed video are
  under-observed. Where the directive names such a behavior and I could not confirm it, the record
  says so.
- **Lazy media undercounts.** `img` counts reflect what had loaded at probe time, not the page total.
  Treat them as floors and as relative signal, not inventory.
- **One mobile capture** (Medallion CVO, 375×812). Every other MOBILE RECOMPOSITION field is empty.
- **My own regex missed a claim.** The metric matcher used `\b\d+x\b`, which is case-sensitive, so it
  returned `[]` on Carefam while the page reads "3X faster". Corrected by hand in §7.14. Recorded
  because a silent tooling gap is exactly what this standard exists to prevent.

### 1.3 Record format

The founder's 26 fields are used verbatim. For the four multi-page references they are recorded
**once at reference level**, with a per-page measurement table beneath — because the measurements
prove these are site-level systems, not page-level choices. All seven Palantir pages share one
8,922-rule stylesheet with the same 60 `@keyframes`, 3 reduced-motion blocks and 23 `scroll-snap`
rules; all six Zoox pages share one ~3,3xx-rule sheet with 9 keyframes and **0** reduced-motion
blocks. Repeating identical numbers 7× would be ritual, not evidence.

---

## 2. Harvest status — complete

**36 pages across 14 references.** Zero queued.

| Ref | Site | Pages | Viewport |
| --- | --- | --- | --- |
| R1 | Zoox | 6 | 1280×720 |
| R2 | Palantir | 7 | 1280×720 |
| R3 | Medallion | 5 | 1280×720 **+ 375×812** |
| R4 | Dock Labs / Truvera | 6 | 1280×720 |
| R5 | Checkr | 1 | 1280×720 |
| R6 | HiringCafe | 1 | 1280×720 |
| R7 | CertifyOS | 1 | 1280×720 |
| R8 | Verifiable | 1 | 1280×720 |
| R9 | OpenEvidence | 1 | 1280×720 |
| R10 | Abridge | 1 | 1280×720 |
| R11 | Doximity | 1 | 1280×720 |
| R12 | Zocdoc | 1 | 1280×720 |
| R13 | hireEZ | 1 | 1280×720 |
| R14 | Carefam | 1 | 1280×720 |

**Two URLs in the directive resolved elsewhere** *(measured redirects)*:
`hiring.cafe` → `hiringcafe.com`; `docs.dock.io` → **`docs.truvera.io`**. The second is a finding, not
a formality — see §7.4.

---

## 3. The cross-reference scoreboard

The single most useful output of the full harvest. Every column is measured; this is what a
completeness pass buys that six pages could not.

### 3.1 Reduced motion — `prefers-reduced-motion` blocks vs `@keyframes`

Sorted by posture. `blocked` is the count of unreadable cross-origin sheets.

| Reference | Page | RM blocks | Keyframes | Blocked | Reading |
| --- | --- | --- | --- | --- | --- |
| Medallion | `/` | **11** | 10 | 2 | Best ratio measured — a reduced path per animation |
| Checkr | `/` | 9 | 14 | 2 | Strong |
| Medallion | `/solutions/cvo-credentialing` | 8 | 8 | 2 | 1:1 |
| Medallion | `/products` | 8 | 7 | 2 | 1:1 |
| HiringCafe | `/` | 5 | 17 | 0 | Partial |
| Carefam | `/` | 5 | 19 | 1 | Partial |
| Palantir | all 7 pages | 3 | 60 | 0–2 | Heavy motion, path exists |
| Medallion | `/who-we-serve/operations-leaders` | 3 | 6 | 2 | Adequate |
| Verifiable | `/` | 1 | 5 | 4 | Minimal |
| OpenEvidence | `/` | 1 | 48 | 0 | **48 keyframes, 1 block** |
| Palantir | `/docs/foundry` | 1 | 2 | 0 | Docs are near-static |
| Dock | all 5 marketing pages | **0** | 1 | 0 | Nothing to reduce |
| Abridge | `/` | **0** | 1 | 0 | Nothing to reduce |
| CertifyOS | `/` | **0** | 6 | 0 | Gap |
| hireEZ | `/` | **0** | 29 | 1 | **29 keyframes, 0 blocks** |
| **Zoox** | **all 6 pages** | **0** | 9–13 | **0** | **Authoritative zero, sitewide** |

**The finding.** Motion volume and reduced-motion support are **uncorrelated**. Palantir runs 60
keyframes *and* ships a path; Medallion ships 11 blocks against 10 keyframes; Zoox runs a
12.6-viewport cinematic with none at all, on stylesheets that are fully readable, so the zero is not
a measurement artifact. CD-15 is therefore not a tax on ambition — it is a choice these teams made
differently from one another.

### 3.2 Touch targets under 44px (desktop 1280×720)

CD-15 sets a 44px floor. Desktop is the *generous* case.

| Reference | Page | Under 44px | Total | % failing |
| --- | --- | --- | --- | --- |
| OpenEvidence | `/` | 39 | 40 | **98%** |
| Palantir | `/docs/foundry` | 21 | 26 | 81% |
| Doximity | `/` | 17 | 21 | 81% |
| Zoox | `/know-your-ride` | 47 | 67 | 70% |
| Zoox | `/how-to-ride` | 32 | 45 | 71% |
| Palantir | `/offerings/palantir-for-hospitals/` | 97 | 140 | 69% |
| Zoox | `/community` | 29 | 43 | 67% |
| Zoox | `/where-to-ride` | 30 | 45 | 67% |
| CertifyOS | `/` | 9 | 14 | 64% |
| Truvera docs | `/` | 22 | 35 | 63% |
| hireEZ | `/` | 14 | 24 | 58% |
| Medallion | `/compliance` | 9 | 16 | 56% |
| Abridge | `/` | 40 | 75 | 53% |
| Palantir | `/impact/` | 69 | 146 | 47% |
| Medallion | `/who-we-serve/operations-leaders` | 18 | 35 | 51% |
| Palantir | `/` | 99 | 221 | 45% |
| Verifiable | `/` | 7 | 17 | 41% |
| Medallion | `/products` | 11 | 28 | 39% |
| Carefam | `/` | 5 | 14 | 36% |
| Dock | `/feature/ecosystem` | 14 | 44 | 32% |
| Dock | `/industries/iam` | 14 | 48 | 29% |
| Zoox | `/support` | 8 | 28 | 29% |
| **Zocdoc** | `/` | 33 | 175 | **19%** |
| **Medallion (mobile 375)** | `/solutions/cvo-credentialing` | **57** | **79** | **72%** |

**The finding.** **Every one of the 14 references fails the 44px floor on desktop**, ranging from 19%
to 98% of targets. Zocdoc — the only true consumer product in the set — is the best by a wide margin,
which is what you would expect from a business whose users are patients on phones. Medallion, the
named competitor, gets *worse* on mobile (72%) than on desktop (39% on `/products`), which is the
opposite of the correct direction.

### 3.3 Heading semantics

| Reference | Page | Defect *(measured)* |
| --- | --- | --- |
| Carefam | `/` | `<h1>` present but **empty**; **all 9** sampled `h2`/`h3` empty |
| CertifyOS | `/` | `<h1>` present but **empty**; **4** empty `h2`s |
| OpenEvidence | `/` | **No `<h1>` at all** |
| Palantir | `/offerings/palantir-for-hospitals/` | **No `<h1>` at all** |
| Palantir | `/platforms/` | 3 empty `h2`s |
| Palantir | `/platforms/aip/` | `<h1>` is an 18px meta-description sentence |
| Zoox | `/know-your-ride`, `/community`, `/support` | `<h1>` is a 12px eyebrow (`KNOW YOUR ZOOX`, `ZOOX COMMUNITY`, `GET IN TOUCH`), not the page's actual title |
| Doximity | `/` | `<h1>` is a product prompt ("How can I assist you?") |

**The finding.** **Eight of fourteen references have a broken or degraded document outline** — and it
is worst on the two closest analogues to a VitalCV marketing page (Carefam, CertifyOS), where the
heading structure carries no text at all. A screen-reader user landing on those pages gets no
outline. This is free, uncontested ground: a correct `h1`→`h2` outline costs nothing and every one of
these teams got it wrong.

### 3.4 ARIA correctness where tabs are used

| Reference | Page | `[role=tablist]` | `[role=tab]` | Verdict |
| --- | --- | --- | --- | --- |
| Medallion | `/` | 4 | 12 | Correct |
| Dock | `/industries/iam` | 2 | 9 | Correct |
| Palantir | `/offerings/…hospitals/` | 2 | 8 | Correct |
| Palantir | `/impact/` | 2 | 7 | Correct |
| Abridge | `/` | 2 | 6 | Correct |
| Dock | `/` | 1 | 6 | Correct |
| Dock | `/feature/…credentials`, `/feature/ecosystem` | 1 | 5 | Correct |
| Zoox | `/know-your-ride` | 1 | 4 | Correct |
| Medallion | `/solutions/cvo-credentialing` | 2 | 3 | Correct, **survives 375px** |
| Palantir | `/`, `/platforms/`, `/platforms/aip/`, Foundry, Tampa | 1 | 3 | Correct |
| **Medallion** | `/who-we-serve/operations-leaders` | **1** | **0** | **Tablist with zero tabs** |
| **Checkr** | `/` | **0** | **0** | `TabsBlock-*` classes, **no roles at all** |
| HiringCafe | `/` | 0 | 0 | 374 buttons, 0 combobox/listbox/expanded |
| CertifyOS, OpenEvidence, Zocdoc | `/` | 0 | 0 | No tab pattern |

**The finding.** Tab semantics are the one thing this cohort mostly gets *right* — 11 of 13 tabbed
implementations ship real roles. The two failures are instructive: Checkr styles tabs without
behavior, and Medallion ships a tablist containing nothing. Both are the shape `LINT-07` exists to
catch. **Use real roles; it is the market norm, not a differentiator — but breaking it is a visible
defect.**

### 3.5 Proof strategy

| Strategy | Who | Example *(read)* |
| --- | --- | --- |
| **Unauditable percentages** | Checkr, Verifiable, hireEZ, Medallion, Palantir | `99.95%`, `260M+` (Checkr); `10x`, `98%`, `100%`, `0%` (Verifiable); `2000%`, `400%` (Palantir hospitals) |
| **`trusted by N`** | Medallion, hireEZ, Doximity | "Trusted by 300+ healthcare organizations"; "Trusted by over 3 million U.S. clinicians" |
| **Named institutional partner** | **OpenEvidence** | "An Official AI Partner of…" NEJM, JAMA, Cochrane, National Academy — **and no metrics** |
| **Named customer + specific outcome** | **Abridge**, Palantir | Kaiser / Johns Hopkins / Duke / Yale New Haven, each with a named delta |
| **Standards compliance** | **Dock** | W3C Verifiable Credentials, OpenID — capability, not percentage |
| **Countable corpus** | **HiringCafe** | `3,313,469 jobs · 113,830 companies` |
| **None at all** | **Zoox** | No metric, no logo wall, no customer proof on any of 6 pages |

**The finding, and it matters for CD-20.** There are **four** honest-ish proof strategies in this
market that do not require an unauditable number: name your institutional backer (OpenEvidence), name
the customer and the specific delta (Abridge), cite the standard you conform to (Dock), or state a
countable fact (HiringCafe). VitalCV's own strategy — *name the source that returned the result and
when* — is a fifth, and it is the only one a reader can verify **themselves, in the first viewport**.
CD-20's "show one artifact" column is not an aesthetic preference; it is the strongest position
available on this board.

### 3.6 Typography — display type across the cohort

| Reference | Display face | Size | Weight | Tracking | Type contrast |
| --- | --- | --- | --- | --- | --- |
| Palantir | Alliance No.2 | **100px** (Foundry) / 80px (home) | **400** | **−2px / −3.4px** | 2 families |
| CertifyOS | ABC-Diatype | 48px | 400 | normal | 1 family |
| hireEZ | Poppins | 48px | 600 | normal | 1 family |
| Abridge | Avantt | 42px | 500 | −1.68px | 1 family |
| Zoox | gt Standard | 40px | 700 | −0.02px | **1 family** |
| Dock | Satoshi | 40px | 500 | — | **1 family** |
| Verifiable | Poppins | 40px | 400 | **−2px** | 1 family |
| Medallion | Space Grotesk | 32px | **300** | −0.96px | 2 families (Inter text) |
| Carefam | Poppins | 30px | 400 | −0.9px | 1 family |
| Zocdoc | sharp-sans | 28px | 400 | — | 1 family |
| Doximity | Inter | 28px | 400 | normal | 1 family |
| Checkr | National 2 **Narrow** | 32px | 500 | — | **width contrast** |
| Truvera docs | Inter + **IBM Plex Mono** for `<code>` | 24px | 700 | — | **mono for machine text** |

**The finding.** **Nine of fourteen ship a single family.** Nobody in this cohort uses
serif-for-argument. Only two use mono at all, and only Truvera's docs use it the way CD-8 does — for
machine-returned text. The mono law is genuinely uncontested territory: it is the cheapest available
signal that a value was *retrieved* rather than *written*, and no competitor is spending it.

The strongest transferable number is Palantir's **100px at weight 400 with −2px tracking**. Big and
*light* reads as authority; big and *bold* reads as advertising. CD-9 currently specifies Fraunces
**500** for `display-xl` — worth testing 400 with optical sizing before assuming 500 is right.

---

## 4. Reference records

Fields follow the founder's 26-field schema (§1.3).

### R1 — Zoox · 6 pages

`/` · `/how-to-ride` · `/where-to-ride` · `/know-your-ride` · `/community` · `/support`
Role per directive: *native-scroll cinematic progression.*

**Site system** *(measured, identical across all 6 pages: `blocked: 0` throughout)* — one shared
stylesheet of ~3,338–3,532 rules, 9–13 `@keyframes`, exactly **1** `scroll-snap-type` rule, and
**0** `prefers-reduced-motion` blocks. Nav is `position: fixed`, 51px tall, transparent at every
scroll depth sampled. One `position: sticky` element per page. A `SKIP TO CONTENT` link is present
on every page *(read)*.

| Page | Viewports | Sticky/Fixed | Video | Canvas | SVG | `aria-expanded` | Tabs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | **12.6** | 1 / 4 | 2 (1 autoplay+loop+muted; 1 **unmuted**, user-initiated) | 2 | 75 | — | 0 |
| `/how-to-ride` | **46.2** | 1 / 5 | 1 — **`autoplay: false`, muted, no controls** | **5** | 66 | 4 | 0 |
| `/where-to-ride` | 6.5 | 1 / 4 | 0 | 2 | 67 | 4 | 0 |
| `/know-your-ride` | 18.4 | 1 / 4 | **12**, all `autoplay: false` + muted | 3 | 95 | 8 | **1 / 4** |
| `/community` | 15.9 | 1 / 6 | 2, `autoplay: false` + loop + muted | 2 | 64 | 10 | 0 |
| `/support` | — | 1 / 4 | 0 | 2 | 88 | **22** | 0 |

| Field | Observation |
| --- | --- |
| **PRIMARY COMPOSITION** | Full-bleed media hero under a transparent fixed nav, then a scene stack. On `/` the six-point scroll sample found "Privacy Policy" as nearest heading from y≈5,832 of 8,332 — **the final third is footer/legal**, not scene *(measured)* |
| **NAVIGATION MODEL** | One fixed 7-link nav, **transparent at 0/15/30/50/70/90% scroll — it never acquires a plate** *(measured)*. A four-item helper rail (`HOW TO RIDE` / `WHERE TO RIDE` / `KNOW YOUR RIDE` / `SUPPORT`) repeats on every sub-page *(read)* |
| **SCROLL MODEL** | Native document scroll. `scroll-snap-type: none` on `html` and `body`; 1 snap rule sitewide *(measured)*. No second scroll owner detected |
| **STICKY ELEMENTS** | Exactly **1 per page**, at `top: 0` *(measured)*. Strikingly sparse |
| **SLIDING ELEMENTS** | **Not observed.** 0 transformed sections at all six scroll depths on `/` — scene change is not carried by section `transform`. On `/how-to-ride`, **1 non-autoplay muted video + 5 `<canvas>` across 46.2 viewports** is the signature of scroll-scrubbed media, but the scrub itself was not confirmed headlessly |
| **EXPANDING ELEMENTS** | 4→22 `[aria-expanded]`, peaking on `/support` (FAQ) *(measured)*. 0 `<details>` — JS-driven |
| **MEDIA BEHAVIOR** | **The home page autoplays; the interior pages do not.** Every interior video is `autoplay: false` + muted *(measured)* — media is bound to scroll or interaction, not to page load |
| **TYPOGRAPHY BEHAVIOR** | **One family sitewide** (`gt Standard`), h1 40px/700/−0.02px, body 20px→16px *(measured)*. No serif, no mono, no type contrast |
| **SURFACE TRANSITIONS** | 9–13 `@keyframes` *(measured)* — low |
| **BUTTON / ICON INTERACTIONS** | **Not observed** — requires pointer choreography |
| **TAB INTERACTIONS** | Only on `/know-your-ride`: **1 tablist / 4 tabs**, correct roles, switching product-feature videos *(measured)* |
| **FORM INTERACTIONS** | 9–12 inputs + 5 checkboxes on every page — the cookie consent manager, not product *(measured)* |
| **PRODUCT-UI PRESENTATION** | None; the product is a vehicle, shown as cinematography *(read)* |
| **TIMELINE PRESENTATION** | Ride narrative, not a dated timeline *(read)* |
| **PROOF PRESENTATION** | **None across all 6 pages** — no metric, no logo wall, no customer proof *(measured: metric regex returned `[]` on every page)* |
| **MOBILE RECOMPOSITION** | **Not observed** |
| **REDUCED-MOTION BEHAVIOR** | **0 blocks, 0 sheets blocked, on all 6 pages** *(measured — authoritative)* |
| **VITALCV SURFACE THAT BENEFITS** | `/` homepage film; `/employers` |
| **PATTERN TO ADOPT** | **Restraint as the mechanism** — 1 sticky element and ~9 keyframes produce a 12.6-viewport effect; the ambition is in composition and media, not in scroll machinery. This independently argues *for* CD-11's one-owner rule. **A hero with no proof furniture.** **`SKIP TO CONTENT` on every page.** **Interior media that does not autoplay** |
| **PATTERN TO ADAPT** | Transparent nav over full-bleed media → VitalCV's glass rail is legal only under CD-12 (content must pass *beneath* it). Zoox's never gains a plate; ours must, because ours sits over paper and text |
| **PATTERN TO REJECT** | **0 reduced-motion support sitewide → CD-15, CD-2.3.** Non-negotiable. **Single-family type → CD-7/CD-8** — with one face there is no way to signal machine fact vs prose vs argument. **12px eyebrow-as-`h1`** on 3 pages → breaks the outline (§3.3). **Autoplaying full-bleed video → CD-13** |
| **COPYRIGHT / BRAND BOUNDARY** | No asset, frame, class name, font, colour or copy line reused. `gt Standard` is licensed to Zoox. Behavior described in prose only |

---

### R2 — Palantir · 7 pages

`/` · `/platforms/` · `/platforms/foundry/` · `/platforms/aip/` · `/offerings/palantir-for-hospitals/`
· `/impact/` · `/impact/tampa-general-hospital/` · `/docs/foundry`
Role: *enterprise-scale composition, dramatic editorial typography.*

**Site system** *(measured)* — one 8,922-rule stylesheet across the marketing pages with **60
`@keyframes`, 3 reduced-motion blocks, 23 `scroll-snap-type` rules**. `/docs/foundry` is a separate,
far lighter system: 1,952 rules, 2 keyframes, 1 reduced-motion block. Body is Alliance No.1 @18px
throughout; display is Alliance No.2.

| Page | Viewports | Sticky / Fixed | Notable sticky | Tabs | Video | Metrics found |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 9.3 | 3 / 6 | `banner`, `buttonWrapper`, `headerBgWrapper` | 1 / 3 | **6**, all autoplay+loop+muted | `50%`, `40,000`, `90%` |
| `/platforms/foundry/` | **17.1** | 5 / 7 | + **`foundryNav` @ `top:0`** | 1 / 3 | 1, autoplay + **`controls: true`** | — |
| `/platforms/aip/` | — | 5 / 8 | **4× `tabHeader` @ `top:-1px`** | 1 / 3 | 10, mixed | — |
| `/offerings/…hospitals/` | 15.7 | **6 / 7** | **3× `tabHeader` @ `top:-1px`** | **2 / 8** | 0 | `400%`, `2000%`, `83%`, `28%`, `7.6%` |
| `/impact/` | — | 1 / 6 | `banner` | 2 / 7 | 0 | `100x`, `90%`, `20%`, `100%` · **4 `<blockquote>`** |
| `/impact/tampa-general-hospital/` | — | 1 / 8 | `banner` | 1 / 3 | 0 | `28%`, `30%`, `95%`, `83%` · **0 blockquote, 0 cite** |
| `/platforms/` | — | 1 / 6 | `banner` | 1 / 3 | 0 | — (3 empty `h2`s) |
| `/docs/foundry` | — | 1 / 5 | `navContainer` @ `top:0` | 1 / 3 | 0 | **0 `<code>`, 0 `<pre>`** |

| Field | Observation |
| --- | --- |
| **PRIMARY COMPOSITION** | Editorial long-form: oversized display headline, then stacked explanatory sections *(read)* |
| **NAVIGATION MODEL** | Global 30-link `<nav>` **plus** a page-scoped sticky rail — `foundryNav` on Foundry, `tabHeader` at `top:-1px` on AIP and Hospitals *(measured)*. Two-tier |
| **SCROLL MODEL** | Native scroll with **23 `scroll-snap-type` rules** *(measured)* — almost certainly inner horizontal tracks |
| **STICKY ELEMENTS** | A deliberate sticky *system*, 1–6 per page. The `top:-1px` offset on `tabHeader` is the classic hairline-hiding trick for a pinned section header *(measured)* |
| **EXPANDING ELEMENTS** | 3 `[aria-expanded]` sitewide *(measured)* |
| **MEDIA BEHAVIOR** | Home autoplays 6 muted loops; Foundry's single video is autoplay **with `controls`** — ambient but user-seizable *(measured)*. Impact and hospital pages carry **no video at all** |
| **TYPOGRAPHY BEHAVIOR** | **100px / weight 400 / −2px** on Foundry; 80px / 400 / **−3.4px** on home *(measured)*. Two families. Authority from scale and restraint, not weight |
| **SURFACE TRANSITIONS** | 60 `@keyframes` — a real motion system *(measured)* |
| **TAB INTERACTIONS** | Correct `[role=tablist]`/`[role=tab]` on all 7 pages *(measured)* |
| **PRODUCT-UI PRESENTATION** | Real screens; Foundry Ontology named as the organising concept *(read)* |
| **TIMELINE PRESENTATION** | "Transformation Journeys Start with Palantir" *(read)*; no dated timeline component observed |
| **PROOF PRESENTATION** | **A two-tier system** *(measured)*: the `/impact/` **index** carries 4 `<blockquote>` under "In the Words of Our Customers"; the **individual story** (Tampa General) carries **0 blockquote, 0 cite** and leads with 4 metrics instead. Quotes sell the section; numbers carry the story |
| **MOBILE RECOMPOSITION** | **Not observed** |
| **REDUCED-MOTION BEHAVIOR** | **3 blocks against 60 keyframes** *(measured; `blocked: 0` on home/platforms/impact — authoritative there)* |
| **VITALCV SURFACE THAT BENEFITS** | `/employers`; `/trust`; long explanatory surfaces |
| **PATTERN TO ADOPT** | **The sticky in-page rail.** On a 17-viewport page it is what stops the reader getting lost; it is *chrome*, so CD-12 permits glass. **`tabHeader` at `top:-1px`** to hide the hairline seam when pinned. **A reduced-motion path despite a heavy motion system.** **Video with `controls`.** **A docs system that is deliberately lighter than the marketing system** (1,952 vs 8,922 rules) |
| **PATTERN TO ADAPT** | **100px / 400 / −2px** validates CD-9's large-and-tight direction but at a *lighter* weight than Fraunces 500 — test 400 with optical sizing (§3.6) |
| **PATTERN TO REJECT** | **23 `scroll-snap-type` rules → `R2` is `error`-mode**; a port fails CI on arrival. **Two-tier nav → CD-13** retires dual page-level rails. **Dark/light inversion** (the directive's named Palantir role) **→ `LINT-04` is `error`-mode** and CD-6 confines dark to signed-in workspace. **`2000%` and `400%` → CD-20**, and adjacent to `LINT-08`. **No `<h1>` on the hospitals page** (§3.3) |
| **COPYRIGHT / BRAND BOUNDARY** | Alliance No.1/No.2 licensed to Palantir; VitalCV ships Fraunces + Geist. No class names (`foundryNav`, `tabHeader`), copy, imagery or Ontology terminology reused |

---

### R3 — Medallion · 5 pages

`/` · `/products` · `/solutions/cvo-credentialing` (desktop **+ 375×812**) · `/compliance` ·
`/who-we-serve/operations-leaders`
Role: *healthcare workflow navigation.* Also the named CD-20 competitor — this record is
competitive intelligence as much as design harvest.

**Site system** *(measured)* — 2,730–3,081 rules, 4–10 `@keyframes`, **1–11 reduced-motion blocks**
(the best ratios in the cohort), 0–1 `scroll-snap` rules, `blocked: 2` throughout. One
`.navbar-wrapper` sticky at `top: 0` on every page. Display is Space Grotesk **300–400** at 32px,
−0.64/−0.96px; body is **Inter at 12px**.

| Page | Sticky/Fixed | Images | Tabs | `aria-expanded` | RM | `01–0N` numbering |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 1 / 3 | **150** | **4 / 12** | 18 | **11** | **`01 02 03 04`** |
| `/products` | 1 / 2 | 110 | 0 / 0 | 13 | 8 | **`01 02 03`** |
| `/solutions/cvo-credentialing` | 1 / 3 | 105 | 2 / 3 | 14 | 8 | **`01 02 03`** |
| `/compliance` | 1 / 2 | 43 | 0 / 0 | 6 | 1 | **`01 02 03`** |
| `/who-we-serve/operations-leaders` | 1 / 3 | 73 | **1 / 0** ⚠ | 9 | 3 | **`01 02 03 04`** |

| Field | Observation |
| --- | --- |
| **PRIMARY COMPOSITION** | Buyer-facing: promise headline → benefit stack → numbered workflow → AI positioning → FAQ → proof band *(read)* |
| **NAVIGATION MODEL** | Sticky `.navbar-wrapper` mega-menu, 40 links, 6–18 `[aria-expanded]` *(measured)* |
| **SCROLL MODEL** | Native scroll; ≤1 snap rule *(measured)* |
| **EXPANDING ELEMENTS** | Mega-menu panels + FAQ accordion; 0 `<details>`, so JS-driven *(measured)* |
| **MEDIA BEHAVIOR** | Overwhelmingly still imagery — **150 images on `/`** *(measured)*; one autoplay+loop+muted video on `/` only. Dashboard screenshots, logo wall, award badges *(read)* |
| **TYPOGRAPHY BEHAVIOR** | Space Grotesk **300** display over Inter **12px** body *(measured)* — an unusually light display weight and an unusually small body |
| **TAB INTERACTIONS** | Correct roles on `/` and CVO, **and preserved at 375px** *(measured)*. ⚠ `/who-we-serve/operations-leaders` ships **a tablist containing zero tabs** |
| **FORM INTERACTIONS** | Cookie consent only. No product form in the acquisition path — demo-gated, consistent with CD-20 *(read)* |
| **PRODUCT-UI PRESENTATION** | Dashboard screenshots as static images behind tabs *(read)* |
| **TIMELINE PRESENTATION** | **`01/02/03(/04)` numbered stages on all five pages** *(measured)* — a site-wide system, not one page's choice |
| **PROOF PRESENTATION** | "Trusted by 300+ healthcare organizations" plus `2x`, `66%`, `99.9%`, `95%`, logo wall, award badges *(measured/read)*. `/compliance` names **SOC 2** and **NCQA** — and notably **does not** claim HIPAA compliance *(measured: `hipaa: false`)* |
| **MOBILE RECOMPOSITION** | *(measured, 375×812, CVO page)* Grids collapse 3→1; **no horizontal overflow** (`scrollWidth` 375); tab semantics survive. **But h1 stays 32px — identical to desktop, so no fluid scale; body is 12px; and 57 of 79 targets are under 44px** |
| **REDUCED-MOTION BEHAVIOR** | **11 blocks on `/` against 10 keyframes** — best measured ratio in the cohort *(measured; `blocked: 2`)* |
| **VITALCV SURFACE THAT BENEFITS** | `/employers`; employer workspace; readiness surfaces |
| **PATTERN TO ADOPT** | **Reduced-motion matched ~1:1 with keyframes.** **Tab semantics that survive mobile.** **"Experts-in-the-loop / Checkpoint review / Built-in compliant oversight"** *(read, `/`)* — the closest external analogue to `HumanReviewCheckpoint`, and evidence that a buyer *wants* to see the human gate named rather than hidden. **Declining to claim HIPAA compliance** — even the aggressive competitor won't say it |
| **PATTERN TO ADAPT** | Tab-controlled product imagery → `SourceWorkflowTabs`, but panels must show **a real evidence artifact** (CD-14), not a dashboard screenshot. Same interaction, opposite content |
| **PATTERN TO REJECT** | **`01/02/03` on all five pages → CD-13** retires `01–06` numbering, and this repo already shipped that numbering once against a guardrail that banned it. **"Trusted by 300+…" → `LINT-08` matches `trusted by N` literally** — error mode. **57/79 sub-44px targets at 375px → CD-15.** **12px body → CD-9** (`body` = 15px). **Static 32px h1 across breakpoints → CD-9** mandates `clamp()`. **Tablist with zero tabs.** **150 dashboard/logo/award images → CD-13** |
| **COPYRIGHT / BRAND BOUNDARY** | No copy, logo, badge, screenshot or class name reused. Space Grotesk/Inter are not VitalCV faces. The quoted fragments are short, attributed, and quoted **in order to prohibit them** |

---

### R4 — Dock Labs / Truvera · 6 pages

`dock.io/` · `/feature/issue-verifiable-credentials` · `/feature/ecosystem` · `/feature/interoperable`
· `/industries/iam` · `truvera.io/` · `docs.dock.io` → **`docs.truvera.io`**
Role: *portable-identity choreography.*

**Site system** *(measured)* — one 3,935-rule stylesheet, **1 `@keyframes`, 0 reduced-motion blocks,
0 scroll-snap, `blocked: 0`**. Essentially a static site. Satoshi throughout, h1 40px/500. Diagram-led:
**38–51 `<svg>` against 19–32 `<img>`**, zero video on every page.

| Page | Sticky/Fixed | SVG / IMG | Tabs | `wallet` | `blockchain` | `DID` | Notable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 1 / 2 | 51 / 32 | 1 / 6 | 8 | **0** | **0** | Opens with a testimonial quote; "Issue a Verified Digital ID" → "Store the Digital ID" |
| `/feature/issue-verifiable-credentials` | **0** / 2 | 39 / 19 | 1 / 5 | **11** | **0** | **0** | Expiration + revocation as first-class |
| `/feature/ecosystem` | 0 / 2 | 44 / 19 | 1 / 5 | 9 | **0** | **0** | **"One platform. Three roles." → "1. Issuers", "2. Wallet Holders"** |
| `/feature/interoperable` | 0 / 2 | 38 / 19 | 0 / 0 | 8 | **0** | **3** | W3C ×4, OpenID ×1 — **the only page carrying DID vocabulary** |
| `/industries/iam` | 0 / 2 | 39 / 20 | **2 / 9** | 9 | **0** | **0** | **"How it works" → "1. Digital ID issuance / 2. Digital ID storage / 3. Cross-domain recognition"**; "rip and replace" ×3 |
| `truvera.io/` | 0 / 5 | 12 / 6 | 0 / 0 | 0 | 0 | 0 | **528 CSS rules, one `h2`, no `h1`, 7 interactive elements — a workspace login, not a marketing site** |
| `docs.truvera.io` | 2 / 8 | 77 / 11 | 0 / 0 | — | — | — | Sticky 64px header + sticky bottom bar; **`<code>` set in IBM Plex Mono**. CSS unusable (`blocked: 8`, 2 readable rules) |

| Field | Observation |
| --- | --- |
| **PRIMARY COMPOSITION** | Feature pages: promise headline → capability stack → reuse thesis *(read)* |
| **NAVIGATION MODEL** | **0 sticky on 4 of 5 marketing pages** *(measured)* — the nav does not follow the reader |
| **SCROLL MODEL** | Native scroll, **0 snap rules** *(measured)* |
| **SLIDING / EXPANDING** | Sliding **not observed**; 4 `[aria-expanded]` *(measured)* |
| **MEDIA BEHAVIOR** | **Zero video across all six pages** *(measured)*. The product is explained by drawing, not by screenshot or film |
| **TYPOGRAPHY BEHAVIOR** | **Single family** (Satoshi), h1 40px/500 *(measured)* — same limitation as Zoox. Except `docs.truvera.io`, which sets `<code>` in **IBM Plex Mono** |
| **SURFACE TRANSITIONS** | **1 `@keyframes` sitewide** *(measured)* — essentially static |
| **TAB INTERACTIONS** | Correct roles, 5–9 tabs *(measured)* |
| **PRODUCT-UI PRESENTATION** | Capability sections: issue from existing identity data; W3C/OpenID conformance; expiration and revocation controls; SDK delivery *(read)* |
| **TIMELINE PRESENTATION** | **A numbered 3-step sequence, on every page that explains the model** *(measured/read)*: issue → store → recognise. **Never a node-link diagram** |
| **PROOF PRESENTATION** | Standards conformance (W3C, OpenID) and one testimonial quote on `/`. **No metrics found on any page** *(measured)* |
| **MOBILE RECOMPOSITION** | **Not observed** |
| **REDUCED-MOTION BEHAVIOR** | **0 blocks, `blocked: 0`** — but with 1 keyframe there is almost nothing to reduce. Low motion is itself an accessibility posture *(measured)* |
| **VITALCV SURFACE THAT BENEFITS** | Proof packet; `/verify/:npi`; holder evidence surfaces |
| **PATTERN TO ADOPT** | **The numbered sequence instead of a graph** — this is the single most important finding of the completeness pass, and it resolves C2 (see §6). **"Verify once, reuse everywhere" / "One verification. Every system."** — the reuse thesis stated with zero metrics. **Standards-as-proof.** **Explain by diagram, not screenshot** (38–51 svg, 0 video): a drawing can be made honest in a way a screenshot cannot, because a drawing does not imply a live result. **Revocation and expiry as first-class product surface.** **`docs` in IBM Plex Mono** — corroborates CD-8 from an unexpected direction. **Technical vocabulary quarantined to the technical page**: `DID` appears 3× on `/feature/interoperable` and **0× on all four business pages** *(measured)* — a deliberate, transferable discipline |
| **PATTERN TO ADAPT** | Issue → store → share choreography → `PacketHandoff` / `ConsentSeal`, stripped of wallet framing and re-expressed as *evidence handed to a named employer, with a scope and an expiry* |
| **PATTERN TO REJECT** | **"Wallet" — 8–11 occurrences on every marketing page** *(measured)* — is a hard reject. It is on CD-13's kill list **and** in the shipped `BUYER_BANNED_STRINGS` array in `apps/web/__tests__/buyer-proof-page.test.tsx`, alongside `blockchain`, `ledger`, `zero-knowledge`. `DeviceWalletFrame` fails on its name alone. **Single-family type → CD-7/CD-8** |
| **COPYRIGHT / BRAND BOUNDARY** | No SVG, diagram, copy or class name reused. Satoshi is not a VitalCV face. **Note in Dock's favour:** `blockchain` appears **0 times on all six pages** *(measured)* — they have already de-crypto'd their marketing. Read that as market confirmation, not licence to adopt the vocabulary they dropped |

---

### R5 — Checkr `/`

Role: *consent, exception handling, adverse-state communication.*

| Field | Observation |
| --- | --- |
| **PRIMARY COMPOSITION** | Segment-led: rotating-noun hero → segment blocks → metric bands *(read)* |
| **NAVIGATION MODEL** | 4 fixed; 8 `[aria-expanded]` *(measured)* |
| **SCROLL MODEL** | Native; 1 snap rule in 7,023 *(measured)* |
| **STICKY ELEMENTS** | **16 — the most of any reference** *(measured)*. Five `TabsBlock-label` at `top: auto` plus `TabsBlock-separator` at `top: 61px`: **scroll-linked section labels that pin as their block passes** |
| **MEDIA BEHAVIOR** | 94 `<img>`, 8 `<svg>`, 0 video *(measured)* |
| **TYPOGRAPHY BEHAVIOR** | **Two cuts of one family** — `National 2 Narrow` display over `National 2` text *(measured)*. Contrast by **width**, an elegant and cheap device |
| **SURFACE TRANSITIONS** | 14 `@keyframes` *(measured)* |
| **TAB INTERACTIONS** | **0 `[role=tablist]`, 0 `[role=tab]`** despite `TabsBlock-*` class names *(measured)* — styled as tabs, not built as tabs |
| **PROOF PRESENTATION** | `97%`, `78%`, `75%`, `48%`, `99.95%`, `50%`, `260M+`, `96%`, `140,000+` *(measured)* — none reader-auditable |
| **REDUCED-MOTION BEHAVIOR** | **9 blocks** *(measured; `blocked: 2`)* — second-best ratio |
| **MOBILE / BUTTON / ICON / FORM** | **Not observed** |
| **VITALCV SURFACE THAT BENEFITS** | `/employers`; application and decision surfaces |
| **PATTERN TO ADOPT** | **Sticky scroll-linked section labels.** On a long evidence page, a label that pins while its block is in view answers "what am I reading?" without a second nav rail — pure chrome, so CD-12 permits it. This is the honest source for `ExpandingEyebrow` / `HomeHelperNav`. **Width-contrast typography** |
| **PATTERN TO ADAPT** | Dual employer/candidate framing → VitalCV's dual-audience doctrine, but on **one shared artifact** rather than split segment tabs |
| **PATTERN TO REJECT** | **Rotating-noun hero** (candidates → borrowers → tenants → drivers → caregivers) → **CD-11 "Nothing idles"**. **Nine unauditable percentages → CD-20**; `99.95%` is also close to `LINT-08`'s `100% secure/verified` shape. **Tab styling without tab semantics → CD-15**, and the exact shape `LINT-07` exists to catch. **Directive premise correction:** the directive credits Checkr with "candidate consent" and "adverse-state communication", but on the homepage **`adverse` = 0, `consent` = 0, `dispute` = 0** *(measured)*. Those patterns are **in-product, not on the marketing site** |
| **COPYRIGHT / BRAND BOUNDARY** | No copy, metric, image or class name reused. `National 2` is not a VitalCV face |

---

### R6 — HiringCafe `/` (`hiring.cafe` → `hiringcafe.com`)

Role: *dense search, filtering, rapid scanning — future MATCHA utility.*

| Field | Observation |
| --- | --- |
| **PRIMARY COMPOSITION** | Application shell: one query field + location + environment toggles, a deep filter column, a result feed *(read)*. No marketing layer |
| **NAVIGATION MODEL** | 1 fixed; 1 sticky at **`bottom: 0`** — a bottom-anchored action bar *(measured)* |
| **MEDIA BEHAVIOR** | Negligible — type and controls *(read)* |
| **TYPOGRAPHY BEHAVIOR** | **System stack**, 16px *(measured)*. Zero brand typography; the entire budget goes to density |
| **SURFACE TRANSITIONS** | 17 `@keyframes` *(measured)* |
| **BUTTON INTERACTIONS** | **374 `<button>`** *(measured)* — the whole filter system |
| **TAB / FORM INTERACTIONS** | **1 `<input>`** (`"Job title or keyword"`), **0 `<select>`, 0 checkbox, 0 `[role=combobox]`, 0 `[role=listbox]`, 0 `[aria-expanded]`** *(measured)*, against 22 named facet groups *(read)*: Date Posted · Apply Process · Exclude Jobs · Activity & Outcomes · Departments · Job Titles & Keywords · Experience · Commitment · Salary · Benefits & Perks · Education · **Licenses & Certifications** · Security Clearance · Languages · Encouraged to Apply · Shifts & Schedules · Travel Requirement · Company · Industry · Stage & Funding · Size · Founding Year |
| **TIMELINE PRESENTATION** | Per-row **relative age stamps** (`2h`) *(read)* |
| **PROOF PRESENTATION** | `3,313,469 jobs · 113,830 companies` *(read)* — a **countable** claim, not a percentage |
| **REDUCED-MOTION BEHAVIOR** | 5 blocks *(measured; `blocked: 0`)* |
| **MOBILE / ICON / SLIDING** | **Not observed** |
| **VITALCV SURFACE THAT BENEFITS** | MATCHA; `/holder/opportunities`; the swipe decision board |
| **PATTERN TO ADOPT** | **One free-text field over a deep named-facet stack** — not a query builder, not an advanced-search modal. **`Licenses & Certifications` is already a first-class facet in a mainstream job search**: direct market evidence that VitalCV's evidence graph is a *filter*, not a profile ornament. That is a strategic finding, not a visual one. **Per-row triage verbs** (Save / Mark Applied / Hide) — the existing swipe decision board (`ba0fbcf4e`) should converge on these, and they must stay available as buttons, not gestures only. **Relative age stamps on every row** — exactly CD-2.2's required *age* component. **Countable proof** |
| **PATTERN TO ADAPT** | Bottom-anchored sticky action bar → viable for the holder decision surface; must meet CD-15's 44px floor |
| **PATTERN TO REJECT** | **374 buttons with 0 combobox / 0 listbox / 0 `aria-expanded`** → fails CD-15's keyboard and screen-reader floor. Adopt the density, **never** this ARIA posture. **System-stack typography → CD-7** |
| **COPYRIGHT / BRAND BOUNDARY** | No copy, facet wording, class name or listing data reused. Facet *names* recorded as evidence of market taxonomy, not for transcription |

---

## 5. Secondary reference records

Same schema; recorded at the density the evidence supports. Each was captured on one page.

### R7 — CertifyOS `/`
*Provider-data visualization, embedded primary-source workflows.*
**Measured:** 0 sticky / 8 fixed · 61 img / 29 svg · **0 tablist, 0 tab, 0 `aria-expanded`** ·
1,950 rules, 6 keyframes, **0 reduced-motion**, `blocked: 0` · `ABC-Diatype` 48px/400 · paper
`#f4f4f4`, ink `#040610` · 9/14 targets under 44px.
**Composition:** testimonial-led ("WHAT OUR CLIENTS SAY") into "single source of truth" CTA *(read)*.
**Adopt:** the **light warm-grey paper** (`#f4f4f4`) over pure white is the closest any reference gets
to CD-3's Cloud Dancer, and it reads noticeably calmer than the white-background cohort.
**Reject:** **`<h1>` present but empty, plus 4 empty `<h2>`s** — the page has no readable outline
(§3.3). **0 reduced-motion.** **0 ARIA affordances of any kind.**
**Boundary:** `ABC-Diatype` is licensed to CertifyOS. No copy or asset reused.

### R8 — Verifiable `/`
*Provider-data infrastructure, developer-facing.*
**Measured:** 2 sticky (`nav … is-rounded` @ `top:0`) / 4 fixed · 55 img / 64 svg · 9,711 rules,
5 keyframes, 1 reduced-motion, **`blocked: 4`** (counts are a floor) · `Poppins` 40px/400/**−2px** ·
7/17 under 44px · metrics `10x`, `98%`, **`100%`**, **`0%`**, `100%`, `67%`, `3x` *(measured)*.
**Composition:** "Backlog to Batch Processing" → "Fully Transparent AI" → "Custom Governance" →
customer quotes *(read)*.
**Adopt:** **"Fully Transparent AI" and "Custom Governance" as named sections** — the nearest
competitor acknowledgement that buyers want to see the machine's limits and controls, which is
VitalCV's whole thesis. A **rounded detached nav** (`is-rounded`) is a legal CD-12 glass rail shape.
**Reject:** **`100%` and `0%` claims** sit directly on `LINT-08`'s `100% secure/verified` shape.
`−2px` tracking at only 40px is tighter than Palantir runs at 100px — tracking must scale with size,
not be applied flat (CD-9).
**Boundary:** Poppins is not a VitalCV face. No copy or metric reused.

### R9 — OpenEvidence `/`
*High-trust clinical simplicity, institutional presentation.*
**Measured:** 3 sticky / 6 fixed · **286 img** / 28 svg · 0 tablist / 0 tab / **0 `aria-expanded`** ·
1,946 rules, **48 keyframes, 1 reduced-motion**, `blocked: 0` · `Schibsted Grotesk` 16px body ·
**dark field `#1F1E1E` on `#FAFAF9` ink** — the only dark reference in the cohort ·
**39 of 40 targets under 44px (98%)** · one input, placeholder "Ask a medical question" *(measured)*.
**Proof:** **institutional partnership, with no metrics at all** — "An Official AI Partner of" NEJM,
JAMA, Cochrane, the National Academy *(read)*.
**Adopt:** **the strongest proof model in the cohort for VitalCV's purposes.** OpenEvidence proves by
*naming the institution that stands behind the answer* — structurally identical to naming the source
that returned a result, which is CD-2.2 (`glyph + word + source + age`). It also validates the
single-field hero: one question box, no feature tour.
**Reject:** **98% sub-44px targets** — the worst measured. **No `<h1>`** (§3.3). **48 keyframes against
1 reduced-motion block.** **Dark public surface → `LINT-04` error-mode + CD-6.**
**Boundary:** partner institution names are *their* marks; VitalCV names only sources it actually
reads. No copy or asset reused.

### R10 — Abridge `/`
*AI product polish, institutional presentation.*
**Measured:** 1 sticky (`mega_nav_wrapper` @ `top:0`) / 6 fixed · 48 img / 61 svg · **2 tablist /
6 tab** (correct roles) · 7,483 rules, **1 keyframe, 0 reduced-motion**, `blocked: 0` · `Avantt`
42px/500/**−1.68px** · 40/75 under 44px.
**Proof:** **named institution paired with a specific outcome** — Kaiser Permanente, Johns Hopkins,
Duke Health, Yale New Haven, alongside "43% increase in ability to accommodate urgent…", "86%
reduction in documentation effort", "14% increase in wRVUs", "100M+ conversations" *(read)*.
**Adopt:** **a 7,483-rule site with exactly 1 `@keyframes`** — proof that polish is composition and
type, not motion. **Naming the customer next to the number** is materially more auditable than
Checkr's or Verifiable's bare percentages: a reader can at least ask Duke.
**Adapt:** the named-institution + named-delta pairing is the honest half of `ImpactStory` — but see
C11, VitalCV has no such pair yet.
**Reject:** **0 reduced-motion blocks.** The metrics remain unauditable **by the reader**, which is
CD-20's actual bar.
**Boundary:** `Avantt` is not a VitalCV face; health-system names are their marks. No copy reused.

### R11 — Doximity `/`
*Clinician profile composition, professional-record breadth.*
**Measured:** 1 sticky (`scroll-slider-sticky` @ `top:0`) / 5 fixed · 54 img / 33 svg ·
0 tablist / 0 tab / 2 `aria-expanded` · `Inter` 28px/400 h1 **"How can I assist you?"** ·
17/21 under 44px · **CSS unusable — 421 readable rules, `blocked: 6`**.
**Read:** "The #1 healthcare professional network"; product rail Ask / Scribe / Dialer / Fax / News;
**"Trusted by over 3 million U.S. clinicians"**.
**Directive premise correction:** the directive expects "clinician profile composition" and
"professional-record breadth". The homepage is now **AI-product-led** — `profile` occurs **once**,
`NPI` and `CME` **zero times** *(measured)*. The profile surface is behind auth; it is not on the
marketing page.
**Adopt:** `scroll-slider-sticky` names a pinned scroll-linked component — same family as Checkr's
pinned labels (§R5).
**Reject:** **"Trusted by over 3 million…" → `LINT-08` `trusted by N`, error mode.** **`<h1>` is a
product prompt**, not a page title (§3.3).
**Boundary:** No copy or asset reused. CSS-derived claims deliberately omitted — the sheets were
unreadable, and a number I cannot read is a number I do not publish.

### R12 — Zocdoc `/`
*Consumer clinician search, practice and operational detail.*
**Measured:** **0 sticky** / 4 fixed · 30 img / **130 svg** · 0 tablist / 0 tab / 2 `aria-expanded` ·
1,440 rules, 8 keyframes, **2 reduced-motion**, `blocked: 0` · `sharp-sans` 28px/400 · paper
**`#F7F8F9`**, ink `#333` · 2 inputs / 100 buttons · **33 of 175 under 44px — 19%, the best measured**.
**Read:** "Book local doctors who take your insurance"; "Find an in-network doctor from over 1,000…";
"Dentists with the shortest wait time".
**Adopt:** **the best touch-target discipline in the cohort by a factor of two** — and it is the only
consumer product here, which is the lesson: a product used by ordinary people on phones cannot afford
what B2B sites get away with. VitalCV's clinicians arrive on phones. **130 svg vs 30 img** — icon and
illustration over photography. **Sorting by an operational fact** ("shortest wait time") rather than a
rating is a directly transferable pattern for MATCHA.
**Reject:** **0 combobox / 0 listbox on a search product** — the same ARIA gap as HiringCafe.
**Boundary:** `sharp-sans` is not a VitalCV face. No copy or listing data reused.

### R13 — hireEZ `/`
*Dense search, filtering — future MATCHA utility.*
**Measured:** 1 sticky (`unit-box unit3` @ **`top: 112px`**) / 9 fixed · **235 img** / 2 svg ·
1 tablist / 4 tab · **36 `aria-expanded`** · 995 rules, **29 keyframes, 0 reduced-motion**,
`blocked: 1` · `Poppins` 48px/600 · 14/24 under 44px · metrics `50%`, `60%`, `2x`, `38%`, `7x`,
`100%` · `trusted by` **present** *(measured)*.
**Read:** "Your recruiting stack might share data. N…"; **"The numbers that show up in the QBR."**
**Adopt:** a sticky offset at **`top: 112px`** (clearing a fixed header) is the correct mechanic for a
pinned secondary rail under existing chrome. **36 `aria-expanded`** is the cohort's most thorough
disclosure-state annotation.
**Reject:** **235 images against 2 svg** — a screenshot-led page, the opposite of CD-13's
own-artifacts-only rule. **29 keyframes, 0 reduced-motion.** **`trusted by` → `LINT-08`.** Explicitly
selling to the QBR is the back-office framing CD-20 says we do not adopt.
**Boundary:** Poppins is not a VitalCV face. No copy or metric reused.

### R14 — Carefam `/` — **URL verified 2026-08-01**
*Named CD-20 competitor.* The directive said "use the currently verified official URL";
`carefam.com` resolves and serves *Home – Carefam: Healthcare Hiring Powered by AI* *(measured)*.
**Measured:** 0 sticky / 2 fixed · 33 img / 38 svg · 0 tablist / 0 tab / 13 `aria-expanded` ·
3,194 rules, 19 keyframes, **5 reduced-motion**, `blocked: 1` · `Poppins` 30px/400/−0.9px ·
ink `#091555` navy · 5/14 under 44px.
**Read (full page text):** a **Day 1 / Day 2 / Day 3** onboarding narrative — *Get Started
Instantly* (no integrations or IT needed) → *Our AI Goes to Work* (outreach, resume screening,
interview scheduling) → **"Hire top talent 3X faster"** — plus a newsletter signup and **Book A Demo**.
**⚠ This contradicts CD-20.** See §7.
**Adopt:** nothing. The one structurally interesting choice — a **time-based** Day 1/2/3 narrative
rather than abstract stage numbers — is a softer version of a pattern CD-13 already retires.
**Reject:** **`<h1>` empty and all 9 sampled `h2`/`h3` empty** — the worst heading structure measured
(§3.3). The **"3X faster" speed hero** is precisely the positioning VitalCV deliberately dropped.
**Boundary:** Poppins is not a VitalCV face. No copy or asset reused.

---

## 6. The composite design rule

Six references became fourteen, and the synthesis did not change — it got better evidenced.

| System | Sourced from | Expressed in VitalCV as |
| --- | --- | --- |
| **Interaction chassis** | Zoox's restraint (1 sticky / 9 keyframes across 6 pages) + Checkr's pinned scroll-linked labels + Palantir's sticky in-page rail + hireEZ's `top:112px` offset | One scroll owner (CD-11), one sticky helper label, no second rail. Chrome may be glass (CD-12) |
| **Enterprise theater** | Palantir's 100px / 400 / −2px and its two-tier proof system | Fraunces at CD-9's `display-xl`, optical sizing doing the work, **one** accent word |
| **Healthcare workflow UI** | Medallion's tab panels + "Experts-in-the-loop / Checkpoint review" + Dock's tabbed capability stack | `SourceWorkflowTabs` and `HumanReviewCheckpoint` with real ARIA roles — panels containing **evidence artifacts**, not dashboards (CD-14) |
| **Portable-evidence choreography** | Dock's numbered issue → store → recognise sequence, revocation as first-class, standards-as-proof | `EvidenceCapsule` → `ConsentSeal` → `PacketHandoff`, with scope, expiry and revocation as first-class states (CD-5) |
| **Density and triage** | HiringCafe's one-field-over-deep-facets + per-row verbs; Zocdoc's touch discipline; sorting by an operational fact | MATCHA and the holder decision board — dense, but at the 44px floor and with real ARIA |

**The synthesis, restated.** The directive's equation is *Zoox chassis + Palantir theater + Medallion
workflow + Dock choreography + VitalCV truth*. Thirty-six pages support it, with one correction that
only the full harvest could establish: **the strongest thing these references share is what they do
not do.** Zoox reaches 12.6 viewports on 1 sticky element and 9 keyframes. Dock explains an entire
credential lifecycle across five pages on **one** `@keyframes` and zero video. Abridge ships 7,483 CSS
rules and **one** keyframe. The ambition is in composition, type and media — never in scroll
machinery. That is CD-11's one-owner rule, arrived at independently five times.

**And on the axis VitalCV competes on, the full cohort loses — measurably:**

- **All 14 fail the 44px touch floor** on desktop, 19%–98% (§3.2).
- **8 of 14 have a broken document outline** — empty or missing `h1` (§3.3).
- **6 of 14 ship zero reduced-motion support**, including Zoox across 6 pages with fully readable
  stylesheets (§3.1).
- **9 of 14 ship a single type family** — structurally unable to distinguish machine fact from prose
  (§3.6).
- **Nobody uses serif-for-argument. Only Truvera's docs use mono for machine text.**

CD-20 says we do not beat these companies by out-glossing them. Thirty-six pages of measurement say
we do not have to. **A page that is fully legible in grayscale, at 200% zoom, with motion off, with a
correct outline, at a 44px floor, beats this entire cohort on the ground where a credentialing
buyer's risk actually lives.** That is measurable, defensible, and currently uncontested.

---

## 7. Conflict register — directive and doctrine vs. shipped gates

`error`-mode means **must be zero** — not a ratchet, not a warning. A PR implementing these fails on
arrival, and the failure looks like a broken build rather than a doctrine collision.

| # | Item | Collides with | Mode | Resolution |
| --- | --- | --- | --- | --- |
| C1 | `DeviceWalletFrame`; Dock "wallet presentation" (8–11 hits per page, all 5 marketing pages) | `BUYER_BANNED_STRINGS` in `buyer-proof-page.test.tsx` + CD-13 | test **error** | **Rename and reframe.** `PacketHandoff` covers the behavior |
| C2 | Dock "ecosystem diagrams", issuer/holder/verifier relationships | `R1` — no graph vocabulary or node/edge drawing; CD-13 | **error** | **Resolved by the harvest — see below** |
| C3 | Palantir dark/light inversion; OpenEvidence's dark field | `LINT-04`; CD-6 | **error** | Dark stays in signed-in workspace |
| C4 | Medallion numbered stages — **confirmed on all 5 pages** | CD-13 retires `01–06` numbering | kill list | Named stages. This repo already shipped that numbering once against a guardrail that banned it |
| C5 | Medallion / hireEZ / Doximity `trusted by N` | `LINT-08` matches literally | **error** | One readable artifact (CD-20) |
| C6 | Palantir scroll-snap scenes (**23 rules, all 7 pages**) | `R2` | **error** | Native scroll only |
| C7 | `HomeScrollExperience`, `ScrollSceneStage`, `ScrollSceneMenu`, `ScrollMediaTrack`, `HomeHelperNav` | `R8` (no second page-level scroll owner) **+ Home Evidence v2 locked contract §2**, which gives `app/page.tsx` sole composition ownership | **error** + locked contract | **Highest-risk item. Needs a founder call** |
| C8 | Medallion "operational dashboards"; Palantir's `2000%` | `R4`; CD-1 "a record, not a dashboard" | **error** | Evidence artifacts, not dashboards |
| C9 | 18 new components | CD-2.5; CD-16 targets one component library | doctrine | Land in `apps/web/design-system/`. **`EvidenceCapsule` already exists** — extend it |
| C10 | Palantir video; Medallion's 150 images; hireEZ's 235 | CD-13: only our own artifacts | kill list | Our own packet, rendered honestly |
| C11 | `ImpactStory` | CD-1 truth-outranks-beauty | doctrine | **Sharpened by the harvest — see below. Needs a founder call** |

### C2 is now resolved by measurement

The directive asks for Dock's "ecosystem diagrams" and "issuer/holder/verifier relationships", and
`R1` bans node-link drawing outright. That looked like a hard conflict. **It is not, because Dock does
not draw a node-link graph either.** Across all five marketing pages, the model is presented as a
**numbered sequence** *(measured/read)*:

- `/feature/ecosystem`: "One platform. Three roles." → "1. Issuers", "2. Wallet Holders"
- `/industries/iam`: "How it works" → "1. Digital ID issuance", "2. Digital ID storage",
  "3. Cross-domain recognition"
- `/`: "Issue a Verified Digital ID" → "Store the Digital ID"

**Resolution:** express issuer → holder → verifier as an ordered sequence with named roles — who
issued it, who holds it, who was shown it, when. No `.lineTo(`, no force simulation, no `R1` risk, and
it matches what the reference actually ships. The conflict was with a *description* of Dock, not with
Dock.

### C11 is sharpened, and still needs a decision

The harvest found **three distinct proof models** among the references that publish customer stories
*(measured)*:

1. **Palantir** — a two-tier system: the `/impact/` index carries 4 `<blockquote>` under "In the Words
   of Our Customers"; the individual Tampa General story carries **0 blockquote, 0 cite** and leads
   with 4 metrics.
2. **Abridge** — named institution paired with a specific named delta (Kaiser, Hopkins, Duke, Yale).
3. **OpenEvidence** — named institutional partner and **no metrics at all**.

All three require something VitalCV does not have: **a real, attributable, consented customer
outcome.** Building `ImpactStory` before one exists means fabricating it, which CD-1 forbids.

**Recommendation:** defer the component, and adopt **OpenEvidence's model** when the time comes — it
is the only one of the three that needs no metric, and it is structurally identical to what VitalCV
already does everywhere else: *name the source, and let the name carry the weight.*

### ✅ C12 — CD-20's Carefam record was stale · **RESOLVED 2026-08-01**

CD-20 records Carefam (captured 2026-07-25) as: a workflow diagram *sourcing & screening → matching &
scheduling → offer & onboarding*, a client logo grid, stock healthcare photography, and **four
metrics** — *20 scheduled interviews, 60+ hours saved, 90% phone time saved, 200 engaged candidates*.

**Measured 2026-08-01, none of that is on the page.** `carefam.com` now serves a **Day 1 / Day 2 /
Day 3** narrative with a single claim, **"Hire top talent 3X faster"**, plus a newsletter block and
*Book A Demo*. The metric regex returned `[]`; the "3X" was found by reading the page text, because my
matcher was case-sensitive (§1.2).

What still holds from CD-20: Carefam is demo-gated, sells recruiter-labour automation, and makes a
speed claim. What does not hold: the specific four metrics, the three-stage workflow diagram, and the
stock photography.

**Resolved.** On founder instruction, CD-20 was amended 2026-08-01 under CD-19. Four edits landed in
`VITALCV_CREATIVE_DIRECTION.md`:

1. The capture line now splits the dates — Medallion 2026-07-25, Carefam 2026-08-01.
2. The Carefam paragraph was replaced with the Day 1 / Day 2 / Day 3 capture, the single **3X faster**
   claim, and the measured empty-outline defect. A block-quoted amendment note records what the
   2026-07-25 entry said, why it was replaced, what survives unchanged, and **what is deliberately not
   claimed** — 33 images remain on the page and their content was not inspected, so the absence of a
   logo grid or stock photography is *not* asserted.
3. Two downstream lines that still cited retired Carefam facts were corrected: the asymmetry table's
   *"90% phone time saved"* → *"3X faster"*, and *"illustrated with a workflow diagram"* → *"…or a
   three-day timeline"*.
4. The "same page with different nouns" sentence dropped *logo wall* and *generic healthtech gradient*
   as a joint claim; it now holds those for Medallion only and marks them unverified for Carefam.

The strategic conclusion CD-20 draws is unaffected — arguably strengthened. A competitor who rewrites
their hero inside eight days is not a stable bar, which is why CD-20's asymmetries are stated
structurally rather than as a response to any one page.

---

## 8. Component disposition

The directive's 18 components against what is actually on `origin/main`.

| Component | Exists? | Verdict | Note |
| --- | --- | --- | --- |
| `EvidenceCapsule` | **Yes** — `components/home/evidence/EvidenceCapsule.tsx` + `evidenceCapsuleModel.ts` | **Extend** | CD-2.5 forbids a second implementation |
| `EvidenceInspector` | No | Build | The CD-14 reference surface. Highest product value of the 18 |
| `SourceWorkflowTabs` | No | Build | Real `[role=tablist]` — the cohort norm (11 of 13), and Checkr/Medallion show what breaking it looks like |
| `ConsentSeal` | No | Build | Scope + expiry + revocability, no wallet framing |
| `PacketHandoff` | No | Build | Absorbs `DeviceWalletFrame`'s intent |
| `HumanReviewCheckpoint` | No | Build | Maps to `policyReview.ts` gates. Medallion validates the buyer appetite |
| `ApplicationEvidenceTimeline` | No | Build | **Numbered sequence** — C2 resolved |
| `ExpandingEyebrow` | No | Build | Source: Checkr's sticky `TabsBlock-label`. Single-shot only (CD-11) |
| `InteractiveIcon` | No | Build **carefully** | `LINT-02`: glyph set is closed; truth-state iconography is `TrustGlyph` **only** |
| `ProductAction` | No | Build | 44px floor — the thing all 14 references fail (§3.2) |
| `EnterpriseWorkflowCloseup` | No | Build | Close-ups of **our** artifacts (C10) |
| `HomeHelperNav` | No | **Blocked — C7** | A chrome-only pinned label may be viable; a second nav rail is CD-13 |
| `HomeScrollExperience` | No | **Blocked — C7** | Forks `app/page.tsx` ownership |
| `ScrollSceneStage` | No | **Blocked — C7** | |
| `ScrollSceneMenu` | No | **Blocked — C7** | |
| `ScrollMediaTrack` | No | **Blocked — C7 + C10** | |
| `DeviceWalletFrame` | No | **Reject — C1** | Fails on its name against a shipped guard |
| `ImpactStory` | No | **Defer — C11** | No honest content exists yet |

**Recommended order.** `EvidenceInspector` → `SourceWorkflowTabs` → `ConsentSeal` → `PacketHandoff`
→ `ApplicationEvidenceTimeline`. All five are workspace/artifact-tier, none touch `/`, none collide
with the locked homepage contract, and together they build the surface CD-14 calls the brand.

---

## 9. Reference acceptance block

Required in every major component PR, alongside **Design Handoff References**.

```md
REFERENCES REVIEWED:      <atlas record IDs, e.g. R2, R5, R9>
PATTERNS OBSERVED:        <what was measured, not what is reputed>
PATTERNS ADOPTED:
PATTERNS ADAPTED:
PATTERNS REJECTED:        <cite the CD clause or lint rule that killed it>
VITALCV-NATIVE EXPRESSION:
SOURCE-TRUTH DEPENDENCY:  <which lane/state; or "none — chrome only">
ACCESSIBILITY CONSTRAINT: <grayscale, 200% zoom, keyboard, reduced-motion, 44px, outline>
PERFORMANCE CONSTRAINT:
NON-COPY BOUNDARY:        <confirm no code/CSS/asset/font/copy/composition reuse>
```

A PR citing a reference **not** in §2 must add its record first.

---

## 10. Non-copy boundary

Recreate **principles and behavior** with original implementation. Never copy source, CSS, JS, class
names, assets, video, illustration, logos, fonts, copy, datasets, exact compositions, exact animation
timelines, or brand colours.

Concretely, from this harvest, every one of these faces is licensed to someone else: `gt Standard`
(Zoox), `Alliance No.1/No.2` (Palantir), `Space Grotesk`/`Inter` (Medallion), `Satoshi` (Dock),
`National 2` (Checkr), `ABC-Diatype` (CertifyOS), `Poppins` (Verifiable, hireEZ, Carefam),
`Schibsted Grotesk` (OpenEvidence), `Avantt` (Abridge), `sharp-sans` (Zocdoc), `IBM Plex Mono`
(Truvera docs). VitalCV ships **Fraunces + Geist Sans + Geist Mono** (CD-7).

No class name recorded here (`foundryNav`, `tabHeader`, `TabsBlock-label`, `navbar-wrapper`,
`scroll-slider-sticky`, `unit-box unit3`, `mega_nav_wrapper`) may appear in our source; they are
recorded to identify a *behavior*. Competitor copy is quoted only in short, attributed fragments, and
only where the point is that we prohibit it. Partner and customer institution names (NEJM, JAMA,
Cochrane, Kaiser, Johns Hopkins, Duke, Yale New Haven, Tampa General) are **their** marks, recorded as
evidence of a proof *strategy* — VitalCV names only sources it actually reads.

---

## 11. What to do next

1. **Resolve C7 and C11** — the two still needing a founder call (§7). ~~C12~~ is resolved: CD-20 was
   amended 2026-08-01 under CD-19.
2. **Build the artifact-tier five** in the order in §8. None touch `/`.
3. **Close the measured gaps that are free wins**: a correct `h1`→`h2` outline (8 of 14 references
   fail), a 44px floor (14 of 14 fail), reduced-motion parity (6 of 14 fail). These cost almost
   nothing and no competitor has done them.
4. **Extend the harvest method.** The remaining blind spots are pointer choreography, mobile beyond
   the single Medallion capture, and keyboard traversal (§1.2). Everything they would have told us is
   marked "Not observed" and should stay that way until it is measured.

---

## 12. Founder reference set — process-explainer program (2026-08-09)

The founder directed a homepage-and-every-page deepening: "more higher level illustrations and
animations… almost a whole visual of how the process of vitalcv works. almost cartoon-like, flowy,
3d, gif explainer visual… shown throughout on every page," naming the reference set below. Captured
2026-08-09 headlessly at 1440×900 (hero + 35% + 65% scroll), same method caveats as §1.

**The set:** medallion.co · abridge.com · mercor.com/research · palantir.com/offerings/palantir-for-hospitals
· verifiable.com · steadymd.com/credentialing-licensing · nursedash.com · openloophealth.com ·
checkr.com · docs.truvera.io · healthstream.com · kaigohealth.ai · harbera.com · joinplanbase.com ·
healthsherpa.com · beparallel.com · heyrevia.ai · doximity.com · linkedin.com · cheqd.io · world.org
· chia.net · docs.discovery.verifiable.com · github.com/{cheqd,worldcoin,Chia-Network,metriport,docknetwork}

### Pattern taxonomy (what the set actually does)

| # | Pattern | Where observed | Verdict for VitalCV |
|---|---|---|---|
| P1 | **Agent work-timeline** — the flagship explainer narrates the agent doing real multi-week work ("Goal: Enroll Dr. Chen…", SIGNAL→DECISION→TASK→INTERACTION, "Step 17 of 28") | Medallion | **ADOPT the structure.** This is EC-27's five beats told as work over time — already VitalCV doctrine. Medallion names a real-sounding provider and payer; EC-25.1 forbids us that; ours stays masked and labeled. |
| P2 | **Product-truth chips over life** — photography of working people with small honest product cards overlaid ("CVO Request Status", "Identity verified") | Checkr, Verifiable, OpenLoop | ADOPT the *chip honesty*, reject the stock-photo carrier (CD: no stock clinician imagery). Our carrier is the record object, not a model's face. |
| P3 | **Soft dimensional dreamscape** — pastel gradient 3D renders as ambient identity (stairway, orb, ribbon) | Mercor research, cheqd, world.org | PARTIAL. The *feeling* (depth, softness, flow) is the founder's ask. The *palette* is outside EC-20's locked gradient row (one indigo `--vt-scene-glow` per viewport). Adopting the full pastel field requires an EC-22 amendment to a LOCKED row — flagged to the founder at the UX-04 gate, not smuggled. |
| P4 | **Cinematic human film** — warm film stills/video of real people; product secondary | Abridge, Kaigo, World | REJECT as homepage carrier (stock/actor clinicians; EC-25.1-adjacent) — lawful someday for real customer stories. |
| P5 | **Product-as-hero** — the actual UI framed dark, sometimes a live demo | Planbase, harbera, heyrevia | Already VitalCV doctrine (EC-11.4 "demonstrate it"); the hero WorkSurface is this. |
| P6 | **Editorial authority** — giant type + institution logo wall, no illustration | Palantir hospitals | REJECT the logo wall (we have no such customers to name — truth), note the type confidence. |
| P7 | **Numbered platform tour** — 01–04 sections walking the platform | Medallion | REJECT as marketing-number theatre on `/` (competitive-mandate guardrails 5–6) — but chapter numerals inside ONE self-contained explainer (a story, not a section taxonomy) do not re-create the 01–06 spine the mandate killed. Recorded so review can check the distinction deliberately. |

### The synthesis that shipped (UX-04 slice 1)

**Honest object, atmospheric field.** The protagonist record stays paper/ink per the Z0 anatomy
(`vitalcv-cinematic-storyboard.md`) — evidence is never cartoon. The *world around it* carries the
founder's flow: indigo atmosphere (within the locked gradient row), soft single-shot staggered
motion, layered depth from overlap and scale. P1's structure × P5's honesty × as much of P3's
feeling as current law permits. If the founder wants the full pastel-dimensional register after
seeing this, that is an EC-22 amendment to EC-20's gradient row, decided at a visual gate — the
atlas records the option so nobody discovers it mid-PR.

### Rollout map (the "every page" part — EC-28 is the authority)

The scene inventory already assigns home surfaces: NPI Reveal → NPI entry/resolution (UX-05 owns);
Profile Layers → claim/profile completion (UX-06); Choice Gate → apply/sharing; Opportunity Field →
`/holder/opportunities*`; Employer Desk → employer acquisition (`/employers`); Continuity Ribbon →
application timeline; Quiet Source Constellation → Trust Center/Status; Workbench Window →
clinician product page; Decision Trail → opportunity detail. Slice 1 (this PR) ships the homepage
process story. Each subsequent surface is its own wave under EC-25 truth review + EC-29 budgets;
none may blur illustration into app state (EC-26 kinds are law).
