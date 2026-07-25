# Browser-agent audit bundle — vitalcv.com current state

**Cut:** 2026-07-21 · **Refreshed:** 2026-07-25 (TASK 9 added; surface map re-verified).
**For:** Claude in Chrome / any browser agent. Each task below is a self-contained
prompt — paste one at a time. Do not run them as one blob; the findings blur.

> **Staleness warning.** The homepage changed substantially between the cut and the
> refresh (#831, #834, #835, #836, #842, #849, #850). The *surface map* and the
> constraints below still hold; anything this bundle says about homepage
> **composition** may not. TASK 9 audits against the controlling doctrine and is
> the one to run first if you only run one.

---

## Read this first — hard constraints

These are not suggestions. Each one has burned a previous session.

1. **You cannot sign in. Do not try.** `clerk.vitalcv.com` returns 503 to
   automated browsers and 200 to real ones. Every task here is **signed-out
   only**. If a task seems to need auth, the answer is "blocked, needs Chris",
   not a workaround.
2. **Do not judge the hero's 3D field from a canvas readback.** `drawImage` /
   `getImageData` on a WebGPU canvas returns **blank even when it is painting
   correctly** — this exact false negative cost a session. Judge it by eye from
   a screenshot, nothing else. Many automated browsers also have no WebGPU at
   all and will legitimately show the static fallback poster; that is correct
   behaviour, not a bug.
3. **A red deploy-health probe is not a broken deploy.** It fails after every
   web deploy due to a snapshot-vs-refresher race. Re-check on the next tick
   before reporting it.
4. **Vercel PR checks reading "Account blocked" are permanent known noise.**
   Railway is the deployment target; Vercel is deprecated.
5. **Report what you saw, with a URL and a screenshot.** No "looks fine". If you
   could not check something, say so explicitly and why.

### Vocabulary you need

VitalCV's UI uses four **evidence-state flags**. They are load-bearing legal
language, not decoration:

| Flag | Means |
| --- | --- |
| `Source-backed` | read from a named public source |
| `Checked` | VitalCV compared something |
| `Access required` | the source is gated; VitalCV could not read it |
| `Employer decision` | a human employer decides; VitalCV does not |

**The bare word `Verified` is banned as a status label anywhere on the site.**

The banned-phrase list is exactly these 23 strings, and nothing else — taken
from the `phrase:` field of `scripts/check-public-claims.ts`:

`hire instantly` · `instant credentialing` · `complete credentialing` ·
`credentialing replacement` · `automatically verified` ·
`guaranteed verification` · `no further verification required` ·
`final verification without review` · `source confirmed before response` ·
`legally accepted` · `risk transferred` · `final authority` ·
`certified compliant` · `HIPAA certified` · `HIPAA compliant` ·
`SOC 2 certified` · `SOC2 certified` · `NCQA certified` · `NPDB cleared` ·
`blockchain anchored` · `zero knowledge proof` · `zero trust ledger` ·
`all 50 states`

> **Do NOT flag these — they are the APPROVED replacements**, not violations:
> `audit trail`, `cryptographically signed`, `selectively disclosed (SD-JWT)`,
> `configured source lanes`. They live in the script's `fix:` field, which is
> the *recommended wording* for each banned phrase. An earlier cut of this
> bundle scraped both fields and listed them as banned; that produced a
> false-positive "audit trail" defect on `/trust`. If in doubt, only the 23
> strings above count.

**More important than the string list:** `check-public-claims` can only catch
*phrases*. It cannot catch a claim that is simply **false against system
state** — see TASK 2, which is where the real defects live.

---

## Live surface map (verified 2026-07-21)

**200 OK — audit these:**
`/` · `/trust` · `/trust/attribution` · `/status` · `/employers` ·
`/onboarding` · `/pilot` · `/privacy` · `/terms` · `/contact` ·
`/legal/cookies` · `/legal/dpa` · `/evidence-network` · `/passport` ·
`/sign-in` · `/verify/<npi>`

**307 redirect:** `/get-ready` · `/documents` — follow and record the destination.

**404 — already known, do not re-report as new:** `/compliance` `/explore`
`/search` `/ask` `/investors` `/partners` `/updates` `/developers` `/mobile`.
These sit in the `PUBLIC_SURFACE_PATHS` allowlist but have no page. **No live
page links to any of them**, so they are stale config, not dead links. Only
report if you find one actually linked from a rendered page.

---

## TASK 1 — Evidence-flag honesty sweep (highest value)

> Visit each of these pages on vitalcv.com, signed out: `/`, `/trust`,
> `/trust/attribution`, `/status`, `/employers`, `/pilot`, `/evidence-network`,
> `/passport`, `/onboarding`.
>
> On each page, find every status label, badge, chip, pill, or legend entry that
> describes the state of a credential, a source, or a check. For each one record:
> the page URL, the exact text, and what it is attached to.
>
> Then flag any of the following as a DEFECT:
> 1. The bare word "Verified" used as a status label (the word may appear in
>    running prose like "verifies" or "verification"; it is only banned as a
>    label).
> 2. Any of the banned phrases listed in this bundle's preamble.
> 3. A label implying VitalCV made a credentialing decision, guaranteed an
>    outcome, or removed the employer's judgement.
> 4. A source described as read/confirmed when the same page elsewhere says it
>    is access-gated or pending.
>
> Report a table: URL | label text | element | verdict (OK / DEFECT + which rule).
> Screenshot every DEFECT.

---

## TASK 2 — Does the site contradict itself about which lanes are live?

**A CONFIRMED DEFECT ALREADY LIVES HERE (verified 2026-07-21).** Three surfaces
in production state three different things about the same two source lanes:

| Surface | OIG / LEIE and CMS PECOS |
| --- | --- |
| Homepage source ribbon | "read live — public source, read live", under a **"Live system fact"** badge |
| `/trust/attribution` | "not retrieved (**connector not live**)", `data-truth-state="connector-not-live"` |
| `/api/status` | `operational`, but **monthly LEIE snapshot cache** / **quarterly PECOS snapshot** |

The JSON is the precise one: these are cached snapshots, not live reads. A
quarterly PECOS snapshot can be ~90 days stale, so the homepage's "read live"
is an **overclaim** — the exact failure this product exists to prevent. Note
that `check-public-claims` cannot catch it: "read live" is not a banned phrase,
it is a claim that is false against system state.

**Your job is to find the REST of this class**, not to re-report the above.

> 1. Open `https://vitalcv.com/status` and write down, for every data lane
>    listed, its exact stated state.
> 2. Open `https://vitalcv.com/api/status` (raw JSON) and do the same.
> 3. Open `https://vitalcv.com/trust/attribution` and `https://vitalcv.com/`
>    (the source ribbon under the hero) and record what each claims about the
>    same lanes.
>
> Produce a four-column comparison: lane | /status | /api/status | ribbon +
> attribution. **Flag every row where they do not agree.** Pay closest attention
> to OIG Exclusions, CMS PECOS, NPPES, and state licensure.
>
> Do not resolve the contradiction yourself — just prove it exists, with
> screenshots and the raw JSON quoted.

---

## TASK 3 — The primary conversion, signed out

The homepage's only job is: NPI in → honest readiness out.

> On `https://vitalcv.com/`:
> 1. Confirm the NPI field and its submit button are both visible **without
>    scrolling** at 1440×900, 1280×800, and 390×844.
> 2. Type `123` — confirm submit stays disabled and the hint shows a digit count.
> 3. Type a 10-digit number that fails the CMS check digit (e.g. `1234567890`) —
>    confirm it is refused with a plain-language reason, not a server error.
> 4. Enter a **real** 10-digit NPI (get one from the public NPPES registry
>    search). Submit. Screenshot the result.
> 5. On the result, apply TASK 1's flag rules. Specifically: does it claim
>    anything about this real person that VitalCV did not actually read from a
>    named source? Does it name its sources? Does it state what remains the
>    employer's decision?
>
> Report the full click path and every screen. A fabricated or overstated claim
> about a real clinician is the single most serious defect you can find here.

---

## TASK 4 — Console, network, and broken-link sweep

> For each 200-OK URL in the surface map above:
> 1. Load it signed out with devtools open.
> 2. Record every console **error** and **warning**, and every network request
>    returning ≥400. Ignore requests to `clerk.vitalcv.com` (see constraint 1)
>    and anything from browser extensions.
> 3. Click every link in the page's main content and footer. Record any that
>    404, redirect unexpectedly, or go off-domain without saying so.
>
> Report: URL | console errors | failed requests | broken links. Note that
> `/get-ready` and `/documents` are expected redirects — record where they land.

---

## TASK 5 — Mobile at 390px

> Set the viewport to 390×844 and visit `/`, `/employers`, `/trust`, `/status`,
> `/pilot`, `/onboarding`.
>
> On each, check and screenshot:
> 1. **Horizontal overflow** — can the page be scrolled sideways at all? It
>    should not be possible anywhere.
> 2. **The NPI action** (homepage) is reachable and tappable without pinching.
> 3. Any text overlapping other text, or clipped by a container.
> 4. The sticky top nav: does page content remain readable *through or behind*
>    it while scrolling, or does it obscure headings?
> 5. Tap targets under ~44px.
>
> Report each defect with a screenshot and the element.

---

## TASK 6 — Reading order and accessibility

> On `/` and `/trust`, signed out:
> 1. Tab from the very top. Record the full focus order. Is the skip link first
>    and does it work? Is focus ever invisible? Does it ever get trapped?
> 2. List every heading in order with its level (h1→h6). Flag: more than one
>    `h1`, or a level skipped (h2 → h4).
> 3. Check that every image/icon conveying meaning has a text equivalent, and
>    that purely decorative visuals are hidden from assistive tech.
> 4. Find any text whose contrast against its actual background looks below
>    4.5:1 — especially small uppercase labels on the warm paper background, and
>    any text sitting on top of the animated hero visual.
> 5. Confirm the hero visual is not the only place a piece of information exists
>    — every name it shows should also be readable as text.
>
> Report findings with screenshots. Note the site's own axe job whitelists
> colour-contrast, so contrast problems will NOT have been caught by CI — look
> carefully.

---

## TASK 7 — Does the page argue one thing?

This is a judgement task. Be opinionated and specific.

> Read `https://vitalcv.com/` top to bottom as a first-time visitor who is a
> working clinician and has never heard of VitalCV.
>
> 1. After the first screen only, write in one sentence what you think this
>    product does and what it wants you to do.
> 2. Scroll the whole page. List every section heading in order.
> 3. For each section, answer: what job is this doing that no other section
>    does? Name any two sections that are doing the same job.
> 4. Where does the page lose you, repeat itself, or change vocabulary for the
>    same idea?
> 5. Count how many distinct calls-to-action you are offered, and name them.
>
> Report as prose plus the section list. Do not be polite — the founder's own
> assessment was that it "looks like a hot mess", and specifics are what help.

---

## TASK 8 — Hero visual, judged by eye only

> Re-read constraint 2 before starting. **No canvas pixel readback — screenshots
> and eyes only.**
>
> On `https://vitalcv.com/` at 1440×900:
> 1. Screenshot the hero. Does the right-hand visual show a field of glowing
>    spheres connected by fine lines, with a frosted rounded rectangle labelled
>    "Your career record" near the centre and a ringed node at "Opportunity"?
> 2. Does that visual sit **flush on the page background**, or is it inside a
>    visible box — a lighter fill, a hard border, a rounded card edge? It should
>    read as part of the page. Report a visible box as a DEFECT with a
>    screenshot.
> 3. Do the labels NPPES, OIG / LEIE, PECOS, "Your career record" and
>    "Opportunity" each sit next to a node rather than floating over empty space
>    or overlapping a sphere?
> 4. Move the mouse across it. Does it respond with a small parallax, or not at
>    all? Either is acceptable — just record which.
> 5. Enable "reduce motion" at the OS level, reload, and confirm the visual
>    still shows the same named structure without animating.
>
> If your browser has no WebGPU you will see a flat static version. That is the
> designed fallback — say so and still answer 2 and 3, which apply either way.

---

## How to report back

One message per task. For each finding:

- **Severity** — Blocker (dishonest claim / broken conversion) · Major (broken
  link, overflow, a11y failure) · Minor (polish)
- **URL**, exact element, exact text
- **Screenshot**
- **What you expected vs what you saw**

Then a single combined table of all findings, sorted severity-first.

**Anything you could not test — especially anything behind sign-in — goes in a
separate "Blocked, needs a human" list.** That list is a real deliverable, not a
failure.

---

## TASK 9 — Audit `/` against the competitive mandate's eight guardrails

**Run this one first.** `docs/strategy/competitive-mandate.md` (from Chris's
`VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md`) is the
**controlling creative authority** for the homepage. Everything else in this
bundle is a quality check; this is a doctrine check.

Read its §"Homepage guardrails" first — do not work from the summary below,
which is a checklist, not the text.

> On `https://vitalcv.com/` at 1440×900, signed out, with a cache-busting query
> param (an audit was once written against a stale cached copy):
>
> | # | Guardrail | What a violation looks like |
> | --- | --- | --- |
> | 1 | One horizontal film driven by vertical scroll | The page is an ordinary vertical stack of sections |
> | 2 | No Rolodex / card queue | Framed "chapter cards", a product carousel, wide card decks |
> | 3 | No public graph | Nodes, links, a constellation, people, physics/drag controls |
> | 4 | Cloud Dancer `#F0EEE9` is the paper | A competing background palette |
> | 5 | Almost no copy | Visible section taxonomy, generic feature headers, long body copy |
> | 6 | No number theatre | Giant counters, `01`–`06` step grammar, percentage rings, "days saved" |
> | 7 | Proof is a close-up | A wall of status labels instead of one evidence artifact |
> | 8 | Mobile / reduced-motion / no-JS are first-class | Meaning that only exists with GPU, hover, or motion |
>
> For each: PASS / VIOLATION / PARTIAL, with a screenshot and the specific
> element. Then count the **visible words** on the page and report the number —
> guardrail 5 is the one most easily rationalised away.
>
> **Known and already recorded — do not re-report as new findings:**
> - Guardrails 1, 2 and 5 are expected to fail today. `/` has not been flipped
>   to the film; the film lives at `/dev/compete-film`, and the flip is a
>   pending founder decision (see `docs/design/homepage-film-flip-plan.md`).
>   Confirm the current state, do not re-litigate it.
> - Guardrail 6's `01`–`06` numbering was retired in #850. If you still see
>   numbered eyebrows, that is a **deploy/caching** finding, not a code one —
>   say so and give the timestamp.
> - CSS custom properties named `--vt-graph-node-*` exist in the stylesheet.
>   Those are dormant tokens, not a rendered graph. Only report guardrail 3 if
>   nodes/links are actually **drawn**.
>
> What is genuinely useful from this task: guardrails **3, 4, 7, 8**, and an
> honest word count for 5.
