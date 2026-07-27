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

- Use **one non-PHI test NPI only**. Do not show a real clinician's account or packet.
- Use a clean browser profile and verify the exact production SHA:

```bash
curl -s https://vitalcv.com/api/version
```

  It must report `branch: main`, `environment: production`, and the SHA at the tip of `origin/main`.
- Have a fallback recording ready **before** attempting a live authenticated demonstration.
- Do not show `/status/technical`, pilot metrics, crypto implementation details, or an ATS widget.

### On-screen sequence

1. **Homepage (10 s)** — say: "A clinician starts with an NPI — no repeated document chase." Enter the prepared test NPI.
2. **Evidence and gaps (25 s)** — show the named source, observation time, and limitation for the returned information. Say: "This is not a green-light score. It separates what a source answers from what still needs review or access."
3. **Clinician-controlled packet (20 s)** — show selected evidence and the consent/recipient context. Say: "The clinician chooses the evidence presented. The submitted packet is preserved as the historical record."
4. **Employer view (20 s)** — open the same test packet as the authorized employer. Point to one explicit blocker or limitation. Say: "The employer starts from the exact packet, then completes its own review. Institution review remains final."
5. **Close (5 s)** — say: "VitalCV gives trust a memory across a clinician's career move."

## Rehearsal checklist and receipt

Record the time, operator, non-PHI test fixture identifier, deployed SHA, and result for each item.

Rows marked ✅ were verified against production on **2026-07-27 (UTC morning)** at SHA `27aa85e6`; the full 19-check smoke receipt is committed beside this file as [`release-receipt-2026-07-27.json`](release-receipt-2026-07-27.json). Re-run before recording if anything has merged since:

```bash
node scripts/deploy-smoke.mjs --base https://vitalcv.com --sha "$(git rev-parse origin/main)" --receipt /tmp/yc-receipt.json
```

| Check | Pass condition | Result |
| --- | --- | --- |
| Production identity | `/api/version` reports `main`, `production`, and the expected SHA | ✅ 2026-07-27 · `27aa85e6` |
| Public entry | Homepage loads and the NPI-first entry point is visible | ✅ 2026-07-27 (smoke: `data-home-hero` marker + form) |
| Source truth | Returned evidence identifies source, observation time, state, and limitation | ✅ structure verified (ProofPacketInspector renders source · retrieval · receipt · limitation); re-verify with the chosen fixture NPI |
| Status parity | `/status`, `/status/technical`, `/api/status` agree on every lane | ✅ 2026-07-27 (smoke: "6 lanes agree" on both surfaces) |
| Authentication | Clinician sign-in returns to the intended next step; no role is supplied by the client | ⬜ founder rehearsal (requires a real session) |
| Consent | Recipient, purpose, selection, and consent are visible before submission | ⬜ founder rehearsal |
| Historical packet | Submitted packet has a stable version/hash and does not silently use current Wallet state | ⬜ founder rehearsal |
| Employer boundary | Authorized test employer can access its packet; signed-out and cross-org attempts are denied without disclosure | ✅ anonymous half: all `/employer/*` routes 307 to sign-in (verified in prod 2026-07-27); authorized half ⬜ founder rehearsal |
| Decision boundary | Employer sees a named remaining blocker and no copy claims credentialing is complete | ⬜ founder rehearsal |
| Revocation/withdrawal | If demoed: the authorized actor can revoke or withdraw and prior history remains intact | ⬜ founder rehearsal |
| Recording fallback | An unlisted, labeled, non-PHI walkthrough plays in a clean browser | ⬜ founder |

**Open item — the fixture NPI.** The demo needs one designated non-PHI test NPI with predictable lane behavior. Prior pilot material used NPI `1003000126` (public NPPES data, a real provider); prefer a purpose-made test fixture if one exists, and record whichever identifier is used in the table above. This is a founder decision — do not improvise one on camera.

## If the authenticated rehearsal cannot pass

Do not improvise a workaround or weaken authorization. Submit with the truthful public NPI walkthrough and the labeled fallback recording. State that VitalCV is validating the clinician-to-employer pilot transaction; do not imply a completed commercial deployment.

## Claims to avoid on camera

See [`CLAIMS_FOR_APPLICATION.md`](CLAIMS_FOR_APPLICATION.md) — the merged banned list is authoritative. Highlights: no "instant credentialing" or unmeasured speed gains; no completed credentialing/privileging/approval; no blockchain/crypto/decentralized-identity/post-quantum product claims; no customer, ROI, time-to-start, or coverage number that cannot be evidenced today.
