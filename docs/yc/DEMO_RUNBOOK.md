# VitalCV YC demo runbook

**Status:** canonical demo procedure for the 2026-07-27 YC submission (deadline 8:00 p.m. Pacific).
**Source:** founder runbook of 2026-07-27, committed per Wave YC-2; production facts below verified against the live site the same day.
**Rule zero:** use only with the current production receipt and non-PHI test data.

## The company in one sentence

VitalCV helps clinicians apply once with portable, source-backed career evidence, so employers begin credentialing from a trusted head start instead of restarting a document chase.

## Founder video: 60–75 seconds

> Hi, I'm Chris Toler. At Sutter Health, I helped build the centralized clinician sourcing engine across nine medical groups.
>
> We could find clinicians. The breakdown came after a clinician said yes: credentialing restarted because no one could rely on the last verification. Trust had no memory.
>
> VitalCV starts with a clinician's NPI. It shows what a named source can answer today, what still needs review, and what the clinician chooses to share. When they apply, the employer receives that exact consented evidence packet — including the source, observation time, and limitation — as a head start.
>
> It is not a replacement for credentialing, privileging, or an employer's hiring decision. It is the work that should not need to start from zero each time a clinician moves.
>
> We are now proving the first outcome that matters: whether a source-attributed, clinician-controlled packet reduces the days at risk before a clinician can start.

## Demo plan: 75–90 seconds

### Before recording

- **Enter no NPI at all.** The earlier instruction here — "use one non-PHI test NPI" —
  described a fixture that does not exist. Every NPI in the demo material turned out to
  belong to a real registrant, and the NPI space is too densely assigned to improvise a
  safe one. The sequence below is built to need none.
- Use a clean browser profile and verify the exact production SHA:

```bash
curl -s https://vitalcv.com/api/version
```

  It must report `branch: main`, `environment: production`, and the SHA at the tip of `origin/main`.
- Have a fallback recording ready **before** attempting a live authenticated demonstration.
- Do not show `/status/technical`, pilot metrics, crypto implementation details, or an ATS widget.

### On-screen sequence — what may actually be filmed

**This sequence contains no clinician and no NPI, and that is deliberate.** The
previous version of this section instructed "enter the prepared test NPI" and then
open a packet — which contradicted the fixture decision recorded below it. Following
those steps would have put a real physician on camera. They are replaced.

**Do not type any NPI on camera.** There is no safe improvised value: the NPI space is
densely assigned, so a plausible-looking number is very likely a real registrant, and a
deliberately invalid one only demonstrates an error state. Leave the field empty and
narrate what happens next.

1. **The question (15 s)** — homepage, field empty. Say: "A clinician starts with one
   number. VitalCV runs the federal screens a hospital would run on day one, and shows
   what each source can answer today."
2. **The record schema (20 s)** — scroll to the six-lane ledger. This is REAL registry
   availability, not a sample record. Point at the lanes that are honest about their
   limits. Say: "Three federal sources answer today. State licensure is access-gated and
   says so. Two more are not connected, and the page says that too."
3. **The four steps (25 s)** — the spine: NPI → source evidence → the packet you choose →
   hospital review. Each panel is a labelled illustration, not a live result. Say: "The
   clinician chooses what a hospital receives. The hospital reviews it claim by claim.
   The credentialing committee still decides."
4. **The boundary (15 s)** — `/trust` or `/status`. Say: "Every claim names its source
   and when it was read. Where we have no access, the product says so rather than
   guessing."
5. **Close (10 s)** — say: "VitalCV gives trust a memory across a clinician's career
   move — without asking anyone to take a claim on faith."

**Filmable because they contain no person:** `/`, `/status`, `/trust`, `/employers`.
Verified on the recording-day SHA below: the homepage contains no fabricated clinician
name and no 10-digit NPI.

**Not filmable:** `/verify/<npi>`, `/p/<npi>`, `/directory/<npi>` and any packet or
wallet view. Those render a real registrant even when every lane state on them is
correct.

## Rehearsal checklist and receipt

Record the time, operator, non-PHI test fixture identifier, deployed SHA, and result for each item.

Rows marked ✅ were re-verified against production on **2026-08-02** at web SHA `c555173`
/ backend `c5551736f` (18/18 deploy smoke, zero failures). Re-run before recording — lanes
merge fast here, and several landed between the first verification and this one:

```bash
node scripts/deploy-smoke.mjs --base https://vitalcv.com --receipt /tmp/yc-receipt.json
```

| Check | Pass condition | Result |
| --- | --- | --- |
| Production identity | `/api/version` reports `main`, `production`, and a SHA containing your work | ✅ 2026-08-02 · web `c555173` · backend `c5551736f` |
| Public entry | Homepage loads and the NPI-first entry point is visible | ✅ 2026-08-02 (smoke: `data-home-hero` + form) |
| **No person on the filmed surfaces** | `/` renders no fabricated clinician name and no 10-digit NPI | ✅ 2026-08-02 (regex over rendered text: both absent) |
| Lane truth | The six-lane ledger shows real availability, gated lanes labelled | ✅ 2026-08-02 (3 available, 1 access-required, 2 not connected) |
| Status parity | `/status`, `/status/technical`, `/api/status` agree on every lane | ✅ 2026-08-02 (smoke: "6 lanes agree" on both surfaces) |
| **State-board honesty** | A never-checked lane reports gated/Access required — never `stale`, never a timestamp | ✅ 2026-08-02 · `state: gated`, `checkedAt: null`, `sourceUrl: null` on two NPIs |
| Employer boundary (anonymous) | `/employer/*` denies signed-out visitors without disclosure | ✅ 2026-08-02 (all routes 307 to sign-in) |
| Source truth | Returned evidence identifies source, observation time, state, and limitation | ✅ structure verified; **not demonstrable on camera** — needs a real registrant |
| Authentication | Clinician sign-in returns to the intended next step; no role supplied by the client | ⬜ founder rehearsal (requires a real session) |
| Consent | Recipient, purpose, selection, and consent visible before submission | ⬜ founder rehearsal |
| Historical packet | Submitted packet has a stable version/hash and does not silently use current Wallet state | ⬜ founder rehearsal |
| Decision boundary | Employer sees a named remaining blocker and no copy claims credentialing is complete | ⬜ founder rehearsal |
| Revocation/withdrawal | If demoed: the authorized actor can revoke and prior history remains intact | ⬜ founder rehearsal |
| Founder recording (primary) | An unlisted, labeled, non-PHI founder-only walkthrough plays in a clean browser | ⬜ founder — this is the submission vehicle, not a fallback |

**One caveat on the SHA rows.** The exact-SHA convergence workflow has failed on every run
since 2026-07-30 for want of a `RAILWAY_API_TOKEN` secret, so *its* status is not evidence
either way. Railway still auto-deploys on push — the SHAs above were confirmed by polling
`/api/version` and `/health` directly, which is the check to repeat on recording day.

**Resolved 2026-07-27 — the fixture NPI.** The product walkthrough is **deferred**. There is
no NPI we are permitted to demo, so this submission uses a **founder-only recording** plus the
honest product narrative in [`DEMO_SCRIPT_2026.md`](../DEMO_SCRIPT_2026.md).

`1003000126` is not available and must not be used: it is ARDALAN ENKESHAFI, M.D., a real
physician who never consented to being a demo subject. Prior material additionally attached
three *different* fabricated names to that one NPI ("Sarah Chen", "Robert Smith", and a seeded
production profile). Nine other real NPIs were seeded the same way, two of them Type-2
*organization* NPIs given fabricated person identities.

A live walkthrough returns only when there is an **explicitly consented, founder-controlled
clinician fixture** — a real person who has agreed in writing. Do not improvise a subject on
camera, and do not substitute another real NPI.

### What changed since the fixture decision — and what it does not change

`/verify`'s state-board lane was fixed on 2026-08-02 (#1001). It had rendered
"State License · mbc.ca.gov · 115d ago · **Stale**" for a lane no board is ever
queried for — stale says a source was consulted and aged; nothing had been. It now
reports **Access required** with no timestamp and no source link, verified live.

That removes a false claim from the product. It does **not** make `/verify` filmable:
the page still renders a real registrant's record, and the standing rule is about the
person, not the lane states. `/verify` becomes filmable only alongside a consented
fixture — the same condition as everything else here.

## If the authenticated rehearsal cannot pass

Do not improvise a workaround or weaken authorization. Submit with the founder-only recording
and the honest product narrative. State that VitalCV is validating the clinician-to-employer
pilot transaction; do not imply a completed commercial deployment.

## Claims to avoid on camera

See [`CLAIMS_FOR_APPLICATION.md`](CLAIMS_FOR_APPLICATION.md) — the merged banned list is authoritative. Highlights: no "instant credentialing" or unmeasured speed gains; no completed credentialing/privileging/approval; no blockchain/crypto/decentralized-identity/post-quantum product claims; no customer, ROI, time-to-start, or coverage number that cannot be evidenced today.
