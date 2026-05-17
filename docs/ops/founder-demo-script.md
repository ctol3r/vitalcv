# Founder Demo Script — 3 minutes

Single shared script for live and Zoom demos. Aims for the hospital
operator's 10-second value scan, then expands into the persona pitch
and pilot ask.

## Pre-flight (≤30 seconds before joining the call)

```bash
scripts/founder-mode.sh                 # local demo on http://localhost:3030/launch
# or
scripts/founder-mode.sh --public        # also start a cloudflared tunnel
```

If the public-URL surface returns 200, you are demo-ready.

## The 3-minute script

### Beat 1 — The premise (≤30s)

> "Credentialing repeats the same primary-source facts over and
> over. Every employer asks the clinician to re-prove what NPPES,
> OIG, PECOS, and the state board already say."

Show **/launch** hero: "Reusable, source-backed clinician readiness."

### Beat 2 — One NPI, one preview (≤45s)

> "Start with an NPI. We read what the public sources say and render
> a readiness preview — source-backed where available, access-required
> where the portal is gated, pending where the source is still
> responding."

Switch to **/demo/clinician**. Scroll through 2–3 personas (rural
FQHC, locum hospitalist, IMG). Point at the source rows: "Each fact
carries its source and its tier."

### Beat 3 — Reviewer reads the same picture (≤45s)

> "An employer reviewer opens the same readiness as a queue — move
> forward, review recommended, or waiting on sources. They pick the
> next action; VitalCV does not make the credentialing decision."

Switch to **/demo/employer**. Scroll the queue. Open the ROI
calculator: "This is illustrative — public benchmarks applied to one
role. Pilots replace these numbers with the real cycle."

### Beat 4 — Verifier can inspect the proof trail (≤30s)

> "Every issuer outcome is attributable. A confirmation by the
> registrar carries forward to the next reviewer; an unable-to-verify
> outcome is recorded as a property of the issuer, not as a clinician
> defect."

Switch to **/demo/issuer**. Point at the audit trail entries.

### Beat 5 — The pilot ask (≤30s)

> "We are running 5–10-clinician pilots, one geography, one role
> family at a time. The pilot replaces the illustrative ROI numbers
> with your actual cycle data — you keep the receipts; we keep the
> readiness-as-a-service layer."

Switch back to **/launch** → "Request a pilot" CTA.

## Truth boundaries to surface explicitly

- "We do not finish credentialing. Hospitals still own the committee."
- "We do not certify compliance. We are a readiness preview."
- "We do not transfer risk. Reviewers still own their decisions."
- "We do not replace primary sources. We read them."

## What to do if the demo breaks mid-call

- **Local server didn't start**: `scripts/founder-mode.sh` will print the failing step. Fall back to a screenshare of `/demo/employer` via a pre-rendered screenshot (keep one in your demo folder).
- **Public tunnel failed**: drop the public URL ask; share screen via Zoom directly.
- **Apex is paused (HTTP 402)**: that is irrelevant to this demo — the demo runs from `localhost`. The apex pause is operator-side and disclosed in `docs/architecture/pause-root-cause-report.md`.

## After the demo

Capture the pilot intent in the lead-capture form on `/demo/employer`
(persists to browser localStorage in the current build; server-side
capture wires in a later release).
