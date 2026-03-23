# VitalCV Source Coverage Matrix

**MISSION:** Provide a strict ground-truth mapping of data sources locking in source honesty and preventing marketing drift.

## Core Constraints
- **Trust First, Matching Second, Intelligence Third.**
- **No rebrand work.**
- **No platform sprawl.**

## Status Definitions
- **Live:** Actively fetched and parsed in real-time or via webhook.
- **Gated:** Integration exists, but user/employer OAuth or credentials are required.
- **Partial:** Basic metadata available, lacking formal verification documents.
- **Unavailable:** Source does not exist or API is completely blocked.
- **Access-Required:** Strict institutional query only (we cannot query as a platform).
- **Stub:** Simulated or mocked data; never allowed in production.

---

## Source Coverage Matrix

| Source Name | Actual Status | May Influence Readiness? | May Render as VERIFIED / CLEAR / ENROLLED? | Allowed Employer-Facing Copy | Allowed Public-Marketing Copy |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **NPI Registry (NPPES)** | Live | Yes | VERIFIED | "Identity verified via NPPES" | "Live NPI verification" |
| **OIG Exclusion List (LEIE)** | Live | Yes | CLEAR | "Checked against OIG LEIE" | "Automated OIG exclusion checks" |
| **State Medical Boards (e.g. CA)** | Partial | No | No | "Active license found (CA)" | "State license metadata tracking" |
| **DEA Registration** | Gated | Yes | VERIFIED | "DEA Registration Confirmed" | "Supports DEA registration verification" |
| **PECOS** | Gated | Yes | ENROLLED | "Medicare Enrollment Active" | "PECOS enrollment status checks" |
| **NPDB (National Practitioner Data Bank)** | Access-Required | No | No | "Unavailable / Facility must run report" | "Built for institutional workflow handoffs" |
| **State Fingerprinting (DOJ/FBI)** | Access-Required | No | No | "Pending Institutional Background Check" | "Integrates with facility background checks" |
| **Medical School / Residency Lists** | Stub | No | No | "Self-reported training" | "Capture comprehensive training history" |
