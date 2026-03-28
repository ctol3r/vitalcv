# VitalCV Pilot — Buyer Brief

## The Problem

Healthcare employers spend 7–21+ days verifying a clinician's credentials before they can start — manually cross-referencing NPPES, OIG exclusion lists, PECOS enrollment, and state board records across disconnected portals. Every day delayed is revenue lost and a bed or shift unfilled.

## What VitalCV Does

- **One NPI lookup** resolves a clinician's identity, sanctions status, and enrollment standing against federal primary sources (NPPES, OIG/LEIE, PECOS) in under 15 seconds.
- **A source-backed readiness snapshot ("Passport")** shows exactly what was checked, what passed, and what is still pending — no self-reported data, no manual uploads required.
- **An employer review link** lets your credentialing team see the readiness snapshot and take an action (Proceed / Request Refresh / Route to Review) — replacing the initial back-and-forth with a single decision surface.

## What You Get in the Pilot

| Capability | Status |
|---|---|
| NPPES identity resolution | Live |
| OIG/LEIE sanctions check | Live |
| PECOS enrollment verification | Live (quarterly cadence — may show PENDING between cycles) |
| State board licensure | Access-required — available in production phase |
| Portable readiness passport | Live |
| Employer review + action workflow | Live |
| Start outcome tracking + TTS metric | Live (operator-captured) |
| KPI dashboard + CSV export | Live (internal, monitoring-secret gated) |

**Honest note:** PECOS data refreshes quarterly. State board data requires per-state access agreements not yet in place for pilot. These are documented limitations, not bugs.

## What This Reduces

**Primary metric: Time to Start (TTS)** — days from first contact to clinician start date.

The pilot measures TTS from the first employer review to confirmed start. Every source that resolves immediately (NPPES, OIG) removes a manual lookup step. Every source that shows PENDING (PECOS) or ACCESS-REQUIRED (state board) is transparently documented rather than silently blocking.

The goal is not to eliminate all verification — it is to eliminate redundant lookups, give employers a clear picture faster, and measure whether that translates to faster starts.

## How to Start

1. Share one real clinician NPI with VitalCV
2. We run the lookup and generate a readiness passport
3. Your credentialing team reviews the snapshot via a shared link
4. We capture the outcome (start date or reason for delay)
5. After 3–5 cases, we review TTS data together

**No integration required.** The pilot runs on VitalCV's hosted platform. Your team needs a browser and 5 minutes per case.

Contact: [pilot@vitalcv.com] | Site: https://vitalcv.com
