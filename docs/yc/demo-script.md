# VitalCV — Demo Script (2–4 minutes)

> **Status: do not run as written (2026-07-27).** Two things are stale.
>
> 1. **The clinician walkthrough is deferred.** There is no NPI we are permitted to demo. Do
>    not improvise a subject, and do not point any step at a real clinician's NPI. It returns
>    only with an explicitly consented, founder-controlled fixture — see
>    [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md), which is authoritative for what may be shown.
> 2. **The UI described below no longer exists.** The "Try a sample" buttons have been
>    removed from `/demo`, so the Step 1 click-path does not match the current page.
>
> Kept as a record of the intended narrative arc, not as an executable script.

## Setup

- Open `https://vitalcv.com/demo` in a browser tab
- Have this script visible on a second screen (or printed)
- Ensure the API is healthy: check the "Live status" widget on the demo page

---

## 0:00 — Opening (30s)

> Healthcare credentialing today is broken. It takes weeks to verify that a doctor is who they say they are. Organizations manually check licenses, call boards, and email PDFs back and forth. VitalCV fixes this with cryptographically signed, machine-verifiable credentials.

## 0:30 — Step 1: Identify (45s)

*(Superseded — these buttons no longer exist on `/demo`.)* This step used to click a
**"Try a sample"** button. The sample was labelled "Robert Smith — Internal Medicine", a
fabricated name attached to NPI `1003000126`, which is really ARDALAN ENKESHAFI, M.D. No
replacement sample is offered here: a sample identity must not be a real clinician's NPI.

> This just called the CMS NPPES registry — the federal source of truth for provider identities in the US. We pulled the raw data, normalized it into a clean provider record, and displayed it here.

**Technical flex**: Point out the "Show provider JSON" toggle.

> Every field is extracted from the NPPES response. The `enumeration_type` tells you NPI-1 (individual) vs NPI-2 (organization). This is real federal data, not a mock.

## 1:15 — Step 2: Verify & Credential (60s)

Click **"Generate credential"**.

> Now we've taken that provider data and run it through our identity artifact pipeline. Here's what happened server-side:
>
> 1. We created a **deterministic identity artifact** — same input always produces the same output
> 2. We hashed the raw NPPES payload with **SHA-256** and embedded it in the artifact
> 3. We signed the entire artifact with **ES256** (P-256 elliptic curve) — the same algorithm used by Apple and Google for passkeys

**Technical flex**: Point out key fields in the artifact card:

- **Artifact hash** — content-addressable identifier
- **Payload SHA-256** — tamper-evident hash of the source data
- **ES256 Signed** badge — cryptographic proof of issuance
- **JWS signature** — the actual compact serialization

Click "Show full artifact JSON" to reveal the complete signed bundle.

> This is the full artifact. Any verifier can take this JSON, check the signature against our JWKS endpoint, and confirm that this credential was issued by VitalCV and hasn't been tampered with.

## 2:15 — Standards (30s)

> We're not inventing our own standard. VitalCV implements:
> - **OpenID4VCI** for credential issuance
> - **OpenID4VP** for verifier presentation
> - **HAIP 1.0** (Health Authority Interoperability Profile)
> - **W3C Verifiable Credentials**
>
> This means any standards-compliant wallet or verifier can consume VitalCV credentials out of the box.

## 2:45 — Security model (30s)

Navigate to `/security` (or reference it).

> We publish our security posture publicly. ES256-only signing, DPoP token binding, PKCE on all OAuth flows, and an append-only transparency log. No RSA, no HS256, no "none" algorithm.

## 3:15 — What's next (30s)

> Right now we're migrating to PostgreSQL and adding primary source verification — automated license checks directly from state medical boards. The goal is to reduce credentialing from weeks to seconds.

## 3:45 — Close

> That's VitalCV. Signed healthcare credentials in seconds, not weeks. Any questions?

---

## Fallback scenarios

**If the API is down**: The demo wizard automatically falls back to cached sample data. You'll see a "cached" badge on the provider and artifact cards. This is by design — the demo never fails.

**If someone asks about production readiness**: We enforce TypeScript strict mode, no build errors are ignored, and the API runs rate-limited demo routes separate from production endpoints.

**If someone asks about scale**: The identity pipeline is stateless and horizontally scalable. The signing key is the only server-side secret. We're moving to PostgreSQL for persistence, which gives us connection pooling and replication.
